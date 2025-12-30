/**
 * Analytics Handlers
 * Handles historical data and endpoint analysis operations
 * Ported from popup-message-handler.js
 */

import { mapResultToArray, escapeStr } from "../../utils/handler-helpers.js";

/**
 * Helper: Calculate percentile from sorted array
 */
function calculatePercentile(sortedArray, percentile) {
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

/**
 * Export handler map for analytics operations
 */
export const analyticsHandlers = new Map([
  [
    "getHistoricalData",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const groupBy = message.groupBy || "hour";
        const { domain, pageUrl, type, timeRange } = filters;

        const timeRangeMs = timeRange
          ? parseInt(timeRange) * 1000
          : 24 * 60 * 60 * 1000;
        const startTime = Date.now() - timeRangeMs;

        let timeFormat;
        switch (groupBy) {
          case "minute":
            timeFormat = "%Y-%m-%d %H:%M";
            break;
          case "hour":
            timeFormat = "%Y-%m-%d %H:00";
            break;
          case "day":
            timeFormat = "%Y-%m-%d";
            break;
          default:
            timeFormat = "%Y-%m-%d %H:00";
        }

        let query = `
          SELECT 
            strftime('${timeFormat}', datetime(timestamp/1000, 'unixepoch')) as time_bucket,
            COUNT(*) as request_count,
            AVG(duration) as avg_duration,
            MIN(duration) as min_duration,
            MAX(duration) as max_duration,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
            SUM(size_bytes) as total_bytes
          FROM bronze_requests
          WHERE timestamp > ?
        `;

        const params = [startTime];

        if (domain && domain !== "all") {
          query += " AND domain = ?";
          params.push(domain);
        }

        if (pageUrl && pageUrl !== "") {
          query += " AND page_url = ?";
          params.push(pageUrl);
        }

        if (type && type !== "") {
          query += " AND type = ?";
          params.push(type);
        }

        query += " GROUP BY time_bucket ORDER BY time_bucket ASC";

        let historicalData = [];
        if (database.executeQuery) {
          const result = database.executeQuery(query, params);
          if (result && result[0]?.values) {
            historicalData = result[0].values.map((row) => ({
              timeBucket: row[0],
              requestCount: row[1],
              avgDuration: Math.round(row[2] || 0),
              minDuration: row[3] || 0,
              maxDuration: row[4] || 0,
              errorCount: row[5] || 0,
              totalBytes: row[6] || 0,
            }));
          }
        }

        return { success: true, data: historicalData, groupBy, timeRange };
      } catch (error) {
        console.error("Get historical data error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getEndpointAnalysis",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const { domain, pageUrl, timeRange, type } = filters;
        const timeRangeMs = timeRange
          ? parseInt(timeRange) * 1000
          : 24 * 60 * 60 * 1000;
        const startTime = Date.now() - timeRangeMs;

        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        let query = `
          SELECT 
            url,
            COUNT(*) as call_count,
            AVG(duration) as avg_duration,
            MIN(duration) as min_duration,
            MAX(duration) as max_duration,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
            AVG(size_bytes) as avg_size
          FROM bronze_requests
          WHERE timestamp > ${startTime} AND url IS NOT NULL
        `;

        if (domain && domain !== "all") {
          query += ` AND domain = ${escapeStr(domain)}`;
        }

        if (pageUrl && pageUrl !== "") {
          query += ` AND page_url = ${escapeStr(pageUrl)}`;
        }

        if (type && type !== "") {
          query += ` AND type = ${escapeStr(type)}`;
        }

        query += " GROUP BY url ORDER BY call_count DESC LIMIT 50";

        let endpoints = [];
        const result = database.db.exec(query);
        if (result && result[0]?.values) {
          endpoints = result[0].values.map((row) => {
            const url = row[0];
            let endpoint = url;
            try {
              const urlObj = new URL(url);
              endpoint = urlObj.pathname;
              endpoint = endpoint.replace(/\/\d+/g, "/:id");
              endpoint = endpoint.replace(/\/[0-9a-f]{8,}/gi, "/:hash");
            } catch (e) {}

            return {
              endpoint,
              url,
              callCount: row[1],
              avgDuration: Math.round(row[2] || 0),
              minDuration: row[3] || 0,
              maxDuration: row[4] || 0,
              errorCount: row[5] || 0,
              avgSize: Math.round(row[6] || 0),
              errorRate:
                row[1] > 0 ? (((row[5] || 0) / row[1]) * 100).toFixed(2) : 0,
            };
          });
        }

        return { success: true, endpoints };
      } catch (error) {
        console.error("Get endpoint analysis error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getEndpointPerformanceHistory",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const {
          domain,
          pageUrl,
          endpoint,
          type,
          timeBucket = "none",
          startTime,
          endTime,
          maxPointsPerEndpoint = 100,
          sortBy = "requests",
          limit = 10,
        } = filters;

        const actualStartTime =
          startTime || Date.now() - 7 * 24 * 60 * 60 * 1000;
        const actualEndTime = endTime || Date.now();

        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        let query;

        if (timeBucket === "none") {
          query = `
            SELECT timestamp, url, duration, status, size_bytes
            FROM bronze_requests
            WHERE timestamp >= ${actualStartTime} AND timestamp <= ${actualEndTime}
          `;
        } else {
          let timeBucketExpr;
          if (timeBucket === "minutely") {
            timeBucketExpr = `strftime('%Y-%m-%d %H:%M:00', timestamp / 1000, 'unixepoch')`;
          } else if (timeBucket === "daily") {
            timeBucketExpr = `strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch')`;
          } else {
            timeBucketExpr = `strftime('%Y-%m-%d %H:00:00', timestamp / 1000, 'unixepoch')`;
          }

          query = `
            SELECT 
              ${timeBucketExpr} as time_bucket, url,
              COUNT(*) as request_count,
              AVG(duration) as avg_duration,
              MIN(duration) as min_duration,
              MAX(duration) as max_duration,
              SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
              SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as server_error_count,
              AVG(size_bytes) as avg_size,
              SUM(size_bytes) as total_size
            FROM bronze_requests
            WHERE timestamp >= ${actualStartTime} AND timestamp <= ${actualEndTime}
          `;
        }

        if (domain && domain !== "") {
          query += ` AND domain = ${escapeStr(domain)}`;
        }

        if (pageUrl && pageUrl !== "") {
          query += ` AND page_url = ${escapeStr(pageUrl)}`;
        }

        if (type && type !== "") {
          query += ` AND type = ${escapeStr(type)}`;
        }

        if (endpoint && endpoint !== "") {
          query += ` AND (url LIKE ${escapeStr(
            `%${endpoint}%`
          )} OR url = ${escapeStr(endpoint)})`;
        }

        if (timeBucket === "none") {
          query += ` ORDER BY timestamp DESC`;
        } else {
          query += ` GROUP BY time_bucket, url ORDER BY time_bucket DESC, request_count DESC`;
        }

        let history = [];
        const result = database.db.exec(query);
        if (result && result[0]?.values) {
          if (timeBucket === "none") {
            history = result[0].values.map((row) => {
              const url = row[1];
              let endpointPattern = url;
              try {
                const urlObj = new URL(url);
                endpointPattern = urlObj.pathname
                  .replace(/\/\d+/g, "/:id")
                  .replace(/\/[0-9a-f]{8,}/gi, "/:hash");
              } catch (e) {}

              return {
                timestamp: row[0],
                url,
                endpoint: endpointPattern,
                duration: Math.round(row[2] || 0),
                status: row[3] || 0,
                sizeBytes: row[4] || 0,
                isError: row[3] >= 400,
              };
            });
          } else {
            history = result[0].values.map((row) => {
              const url = row[1];
              let endpointPattern = url;
              try {
                const urlObj = new URL(url);
                endpointPattern = urlObj.pathname
                  .replace(/\/\d+/g, "/:id")
                  .replace(/\/[0-9a-f]{8,}/gi, "/:hash");
              } catch (e) {}

              const requestCount = row[2] || 0;
              const errorCount = row[6] || 0;

              return {
                timeBucket: row[0],
                url,
                endpoint: endpointPattern,
                requestCount,
                avgDuration: Math.round(row[3] || 0),
                minDuration: Math.round(row[4] || 0),
                maxDuration: Math.round(row[5] || 0),
                errorCount,
                serverErrorCount: row[7] || 0,
                avgSize: Math.round(row[8] || 0),
                totalSize: row[9] || 0,
                errorRate:
                  requestCount > 0
                    ? ((errorCount / requestCount) * 100).toFixed(2)
                    : 0,
                successRate:
                  requestCount > 0
                    ? (
                        ((requestCount - errorCount) / requestCount) *
                        100
                      ).toFixed(2)
                    : 100,
              };
            });
          }
        }

        const groupedHistory = {};
        history.forEach((record) => {
          if (!groupedHistory[record.endpoint]) {
            groupedHistory[record.endpoint] = [];
          }
          groupedHistory[record.endpoint].push(record);
        });

        const endpointMetrics = Object.keys(groupedHistory).map((endpoint) => {
          const records = groupedHistory[endpoint];
          let totalRequests, avgDuration, totalErrors, avgSize;

          if (timeBucket === "none") {
            totalRequests = records.length;
            avgDuration =
              records.reduce((sum, r) => sum + r.duration, 0) / totalRequests;
            totalErrors = records.filter((r) => r.isError).length;
            avgSize =
              records.reduce((sum, r) => sum + r.sizeBytes, 0) / totalRequests;
          } else {
            totalRequests = records.reduce((sum, r) => sum + r.requestCount, 0);
            avgDuration =
              records.reduce((sum, r) => sum + r.avgDuration, 0) /
              records.length;
            totalErrors = records.reduce((sum, r) => sum + r.errorCount, 0);
            avgSize =
              records.reduce((sum, r) => sum + r.avgSize, 0) / records.length;
          }

          return {
            endpoint,
            totalRequests,
            avgDuration,
            totalErrors,
            avgSize,
            records,
          };
        });

        endpointMetrics.sort((a, b) => {
          switch (sortBy) {
            case "slowest":
              return b.avgDuration - a.avgDuration;
            case "errors":
              return b.totalErrors - a.totalErrors;
            case "size":
              return b.avgSize - a.avgSize;
            case "requests":
            default:
              return b.totalRequests - a.totalRequests;
          }
        });

        const topEndpoints = endpointMetrics.slice(0, limit);
        const filteredGroupedHistory = {};
        topEndpoints.forEach(({ endpoint, records }) => {
          if (timeBucket === "none") {
            filteredGroupedHistory[endpoint] = records.slice(
              0,
              maxPointsPerEndpoint
            );
          } else {
            filteredGroupedHistory[endpoint] = records;
          }
        });

        return {
          success: true,
          history,
          groupedByEndpoint: filteredGroupedHistory,
          timeBucket,
          startTime: actualStartTime,
          endTime: actualEndTime,
          totalEndpoints: Object.keys(groupedHistory).length,
          displayedEndpoints: Object.keys(filteredGroupedHistory).length,
        };
      } catch (error) {
        console.error("Get endpoint performance history error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getRequestTypePerformanceHistory",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const {
          domain,
          pageUrl,
          type,
          timeBucket = "hourly",
          startTime,
          endTime,
        } = filters;

        const actualStartTime =
          startTime || Date.now() - 7 * 24 * 60 * 60 * 1000;
        const actualEndTime = endTime || Date.now();

        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        let timeBucketExpr;
        if (timeBucket === "daily") {
          timeBucketExpr = `strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch')`;
        } else {
          timeBucketExpr = `strftime('%Y-%m-%d %H:00:00', timestamp / 1000, 'unixepoch')`;
        }

        let query = `
          SELECT 
            ${timeBucketExpr} as time_bucket, type,
            COUNT(*) as request_count,
            AVG(duration) as avg_duration,
            MIN(duration) as min_duration,
            MAX(duration) as max_duration,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
            SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as server_error_count,
            AVG(size_bytes) as avg_size,
            SUM(size_bytes) as total_size
          FROM bronze_requests
          WHERE timestamp >= ${actualStartTime} AND timestamp <= ${actualEndTime}
            AND type IS NOT NULL AND type != ''
        `;

        if (domain && domain !== "") {
          query += ` AND domain = ${escapeStr(domain)}`;
        }

        if (pageUrl && pageUrl !== "") {
          query += ` AND page_url = ${escapeStr(pageUrl)}`;
        }

        if (type && type !== "") {
          query += ` AND type = ${escapeStr(type)}`;
        }

        query += ` GROUP BY time_bucket, type ORDER BY time_bucket DESC, request_count DESC`;

        let history = [];
        const result = database.db.exec(query);
        if (result && result[0]?.values) {
          history = result[0].values.map((row) => {
            const requestCount = row[2] || 0;
            const errorCount = row[6] || 0;

            return {
              timeBucket: row[0],
              type: row[1] || "unknown",
              requestCount,
              avgDuration: Math.round(row[3] || 0),
              minDuration: Math.round(row[4] || 0),
              maxDuration: Math.round(row[5] || 0),
              errorCount,
              serverErrorCount: row[7] || 0,
              avgSize: Math.round(row[8] || 0),
              totalSize: row[9] || 0,
              errorRate:
                requestCount > 0
                  ? ((errorCount / requestCount) * 100).toFixed(2)
                  : 0,
              successRate:
                requestCount > 0
                  ? (
                      ((requestCount - errorCount) / requestCount) *
                      100
                    ).toFixed(2)
                  : 100,
            };
          });
        }

        const groupedHistory = {};
        history.forEach((record) => {
          if (!groupedHistory[record.type]) {
            groupedHistory[record.type] = [];
          }
          groupedHistory[record.type].push(record);
        });

        return {
          success: true,
          history,
          groupedByType: groupedHistory,
          timeBucket,
          startTime: actualStartTime,
          endTime: actualEndTime,
        };
      } catch (error) {
        console.error("Get request type performance history error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getApiEndpointPerformanceHistory",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const {
          domain,
          pageUrl,
          timeBucket = "hourly",
          startTime,
          endTime,
        } = filters;

        const actualStartTime =
          startTime || Date.now() - 7 * 24 * 60 * 60 * 1000;
        const actualEndTime = endTime || Date.now();

        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        let timeBucketExpr;
        if (timeBucket === "daily") {
          timeBucketExpr = `strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch')`;
        } else {
          timeBucketExpr = `strftime('%Y-%m-%d %H:00:00', timestamp / 1000, 'unixepoch')`;
        }

        let query = `
          SELECT 
            ${timeBucketExpr} as time_bucket, url, method, type,
            COUNT(*) as request_count,
            AVG(duration) as avg_duration,
            MIN(duration) as min_duration,
            MAX(duration) as max_duration,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
            SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as server_error_count,
            AVG(size_bytes) as avg_size,
            SUM(size_bytes) as total_size
          FROM bronze_requests
          WHERE timestamp >= ${actualStartTime} AND timestamp <= ${actualEndTime}
            AND (type = 'fetch' OR type = 'xmlhttprequest' OR type = 'xhr')
        `;

        if (domain && domain !== "") {
          query += ` AND domain = ${escapeStr(domain)}`;
        }

        if (pageUrl && pageUrl !== "") {
          query += ` AND page_url = ${escapeStr(pageUrl)}`;
        }

        query += ` GROUP BY time_bucket, url, method ORDER BY time_bucket DESC, request_count DESC`;

        let history = [];
        const result = database.db.exec(query);
        if (result && result[0]?.values) {
          history = result[0].values.map((row) => {
            const url = row[1];
            const method = row[2] || "GET";

            let endpointPattern = url;
            try {
              const urlObj = new URL(url);
              endpointPattern = urlObj.pathname;
              endpointPattern = endpointPattern.replace(/\/\d+/g, "/:id");
              endpointPattern = endpointPattern.replace(
                /\/[0-9a-f]{8,}/gi,
                "/:hash"
              );
            } catch (e) {}

            const requestCount = row[4] || 0;
            const errorCount = row[8] || 0;

            return {
              timeBucket: row[0],
              url,
              method,
              type: row[3],
              endpoint: `${method} ${endpointPattern}`,
              requestCount,
              avgDuration: Math.round(row[5] || 0),
              minDuration: Math.round(row[6] || 0),
              maxDuration: Math.round(row[7] || 0),
              errorCount,
              serverErrorCount: row[9] || 0,
              avgSize: Math.round(row[10] || 0),
              totalSize: row[11] || 0,
              errorRate:
                requestCount > 0
                  ? ((errorCount / requestCount) * 100).toFixed(2)
                  : 0,
              successRate:
                requestCount > 0
                  ? (
                      ((requestCount - errorCount) / requestCount) *
                      100
                    ).toFixed(2)
                  : 100,
            };
          });
        }

        const groupedHistory = {};
        history.forEach((record) => {
          if (!groupedHistory[record.endpoint]) {
            groupedHistory[record.endpoint] = [];
          }
          groupedHistory[record.endpoint].push(record);
        });

        return {
          success: true,
          history,
          groupedByEndpoint: groupedHistory,
          timeBucket,
          startTime: actualStartTime,
          endTime: actualEndTime,
        };
      } catch (error) {
        console.error("Get API endpoint performance error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getResourceSizeBreakdown",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const { domain, pageUrl, timeRange } = filters;
        const timeRangeMs = timeRange
          ? parseInt(timeRange) * 1000
          : 24 * 60 * 60 * 1000;
        const startTime = Date.now() - timeRangeMs;

        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        let query = `
          SELECT 
            type,
            COUNT(*) as count,
            SUM(size_bytes) as total_bytes,
            AVG(size_bytes) as avg_bytes,
            MAX(size_bytes) as max_bytes
          FROM bronze_requests
          WHERE timestamp > ${startTime} AND type IS NOT NULL AND size_bytes > 0
        `;

        if (domain && domain !== "all") {
          query += ` AND domain = ${escapeStr(domain)}`;
        }

        if (pageUrl && pageUrl !== "") {
          query += ` AND page_url = ${escapeStr(pageUrl)}`;
        }

        query += " GROUP BY type ORDER BY total_bytes DESC";

        const results = database.db.exec(query);
        let breakdown = [];
        let totalSize = 0;
        let totalCount = 0;

        if (results && results.length > 0) {
          const rows = results[0].values;
          breakdown = rows.map((row) => ({
            type: row[0] || "unknown",
            count: row[1] || 0,
            totalBytes: row[2] || 0,
            avgBytes: Math.round(row[3] || 0),
            maxBytes: row[4] || 0,
          }));

          totalSize = breakdown.reduce((sum, item) => sum + item.totalBytes, 0);
          totalCount = breakdown.reduce((sum, item) => sum + item.count, 0);

          breakdown = breakdown.map((item) => ({
            ...item,
            percentage:
              totalSize > 0
                ? ((item.totalBytes / totalSize) * 100).toFixed(2)
                : 0,
          }));
        }

        return { success: true, breakdown, totalSize, totalCount };
      } catch (error) {
        console.error("Get resource size breakdown error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getWaterfallData",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const limit = message.limit || 50;
        const { domain, pageUrl, timeRange, type } = filters;
        const timeRangeMs = timeRange
          ? parseInt(timeRange) * 1000
          : 5 * 60 * 1000;
        const startTime = Date.now() - timeRangeMs;

        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        let query = `
          SELECT 
            id, url, method, type, status, status_text, duration, 
            size_bytes, timestamp, from_cache, domain, page_url
          FROM bronze_requests
          WHERE timestamp > ${startTime}
        `;

        if (domain && domain !== "all") {
          query += ` AND domain = ${escapeStr(domain)}`;
        }

        if (pageUrl && pageUrl !== "") {
          query += ` AND page_url = ${escapeStr(pageUrl)}`;
        }

        if (type && type !== "") {
          query += ` AND type = ${escapeStr(type)}`;
        }

        query += ` ORDER BY timestamp ASC LIMIT ${parseInt(limit)}`;

        let requests = [];
        const result = database.db.exec(query);
        if (result && result[0]) {
          requests = mapResultToArray(result[0]);
          requests = requests.map((req) => {
            const duration = req.duration || 0;
            return {
              ...req,
              startTime: req.timestamp,
              phases: {
                queued: Math.round(duration * 0.05),
                dns: Math.round(duration * 0.1),
                tcp: Math.round(duration * 0.15),
                ssl: Math.round(duration * 0.1),
                ttfb: Math.round(duration * 0.3),
                download: Math.round(duration * 0.3),
              },
            };
          });
        }

        return { success: true, requests };
      } catch (error) {
        console.error("Get waterfall data error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getPercentilesAnalysis",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const { domain, pageUrl, timeRange, type } = filters;
        const timeRangeMs = timeRange
          ? parseInt(timeRange) * 1000
          : 86400 * 1000;
        const startTime = Date.now() - timeRangeMs;

        let query = `
          SELECT duration
          FROM bronze_requests
          WHERE timestamp > ? AND duration IS NOT NULL
        `;
        const params = [startTime];

        if (domain && domain !== "all") {
          query += " AND domain = ?";
          params.push(domain);
        }

        if (pageUrl && pageUrl !== "") {
          query += " AND page_url = ?";
          params.push(pageUrl);
        }

        if (type && type !== "") {
          query += " AND type = ?";
          params.push(type);
        }

        query += " ORDER BY duration ASC";

        let durations = [];
        if (database.executeQuery) {
          const result = database.executeQuery(query, params);
          if (result && result[0]?.values) {
            durations = result[0].values.map((row) => row[0]);
          }
        }

        const percentiles = {};
        if (durations.length > 0) {
          percentiles.p50 = calculatePercentile(durations, 50);
          percentiles.p75 = calculatePercentile(durations, 75);
          percentiles.p90 = calculatePercentile(durations, 90);
          percentiles.p95 = calculatePercentile(durations, 95);
          percentiles.p99 = calculatePercentile(durations, 99);
          percentiles.min = durations[0];
          percentiles.max = durations[durations.length - 1];
          percentiles.count = durations.length;
        }

        return { success: true, percentiles };
      } catch (error) {
        console.error("Get percentiles analysis error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getAnomalyDetection",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const { domain, pageUrl, timeRange } = filters;
        const timeRangeMs = timeRange
          ? parseInt(timeRange) * 1000
          : 86400 * 1000;
        const startTime = Date.now() - timeRangeMs;

        let query = `
          SELECT 
            strftime('%H', datetime(timestamp/1000, 'unixepoch')) as hour,
            COUNT(*) as count,
            AVG(duration) as avgDuration,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors
          FROM bronze_requests
          WHERE timestamp > ?
        `;
        const params = [startTime];

        if (domain && domain !== "all") {
          query += " AND domain = ?";
          params.push(domain);
        }

        if (pageUrl && pageUrl !== "") {
          query += " AND page_url = ?";
          params.push(pageUrl);
        }

        query += " GROUP BY hour ORDER BY hour";

        let hourlyData = [];
        if (database.executeQuery) {
          const result = database.executeQuery(query, params);
          if (result && result[0]) {
            hourlyData = mapResultToArray(result[0]);
          }
        }

        const anomalies = [];

        if (hourlyData.length > 0) {
          const counts = hourlyData.map((d) => d.count);
          const durations = hourlyData.map((d) => d.avgDuration);
          const errorRates = hourlyData.map((d) => (d.errors / d.count) * 100);

          const countMean = counts.reduce((a, b) => a + b, 0) / counts.length;
          const countStd = Math.sqrt(
            counts.reduce((sum, val) => sum + Math.pow(val - countMean, 2), 0) /
              counts.length
          );

          const durationMean =
            durations.reduce((a, b) => a + b, 0) / durations.length;
          const durationStd = Math.sqrt(
            durations.reduce(
              (sum, val) => sum + Math.pow(val - durationMean, 2),
              0
            ) / durations.length
          );

          hourlyData.forEach((data, index) => {
            const countZScore = Math.abs(
              (data.count - countMean) / (countStd || 1)
            );
            const durationZScore = Math.abs(
              (data.avgDuration - durationMean) / (durationStd || 1)
            );

            if (
              countZScore > 2 ||
              durationZScore > 2 ||
              errorRates[index] > 10
            ) {
              anomalies.push({
                hour: data.hour,
                type:
                  countZScore > 2
                    ? "traffic_spike"
                    : durationZScore > 2
                    ? "slow_response"
                    : "high_errors",
                severity:
                  countZScore > 3 ||
                  durationZScore > 3 ||
                  errorRates[index] > 20
                    ? "high"
                    : "medium",
                value: data.count,
                avgDuration: Math.round(data.avgDuration),
                errorRate: errorRates[index].toFixed(2),
              });
            }
          });
        }

        return { success: true, anomalies, hourlyData };
      } catch (error) {
        console.error("Get anomaly detection error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getTrendAnalysis",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const filters = message.filters || {};
        const compareType = message.compareType || "week";
        const { domain, pageUrl, type } = filters;

        const now = Date.now();
        const ranges =
          compareType === "week"
            ? {
                current: { start: now - 7 * 24 * 60 * 60 * 1000, end: now },
                previous: {
                  start: now - 14 * 24 * 60 * 60 * 1000,
                  end: now - 7 * 24 * 60 * 60 * 1000,
                },
              }
            : {
                current: { start: now - 30 * 24 * 60 * 60 * 1000, end: now },
                previous: {
                  start: now - 60 * 24 * 60 * 60 * 1000,
                  end: now - 30 * 24 * 60 * 60 * 1000,
                },
              };

        const getMetrics = async (startTime, endTime) => {
          let query = `
            SELECT 
              COUNT(*) as totalRequests,
              AVG(duration) as avgDuration,
              SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors,
              SUM(size_bytes) as totalBytes
            FROM bronze_requests
            WHERE timestamp > ? AND timestamp <= ?
          `;
          const params = [startTime, endTime];

          if (domain && domain !== "all") {
            query += " AND domain = ?";
            params.push(domain);
          }

          if (pageUrl && pageUrl !== "") {
            query += " AND page_url = ?";
            params.push(pageUrl);
          }

          if (type && type !== "") {
            query += " AND type = ?";
            params.push(type);
          }

          if (database.executeQuery) {
            const result = database.executeQuery(query, params);
            if (result && result[0]?.values && result[0].values[0]) {
              const [requests, duration, errors, bytes] = result[0].values[0];
              return {
                totalRequests: requests || 0,
                avgDuration: Math.round(duration || 0),
                errors: errors || 0,
                totalBytes: bytes || 0,
              };
            }
          }

          return { totalRequests: 0, avgDuration: 0, errors: 0, totalBytes: 0 };
        };

        const currentMetrics = await getMetrics(
          ranges.current.start,
          ranges.current.end
        );
        const previousMetrics = await getMetrics(
          ranges.previous.start,
          ranges.previous.end
        );

        const calculateChange = (current, previous) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return (((current - previous) / previous) * 100).toFixed(2);
        };

        const trends = {
          requestsChange: calculateChange(
            currentMetrics.totalRequests,
            previousMetrics.totalRequests
          ),
          durationChange: calculateChange(
            currentMetrics.avgDuration,
            previousMetrics.avgDuration
          ),
          errorsChange: calculateChange(
            currentMetrics.errors,
            previousMetrics.errors
          ),
          bytesChange: calculateChange(
            currentMetrics.totalBytes,
            previousMetrics.totalBytes
          ),
          current: currentMetrics,
          previous: previousMetrics,
          compareType,
        };

        return { success: true, trends };
      } catch (error) {
        console.error("Get trend analysis error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getPerformanceInsights",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const { domain, pageUrl, timeRange } = message.filters || {};
        const timeRangeMs = timeRange
          ? parseInt(timeRange) * 1000
          : 86400 * 1000;
        const startTime = Date.now() - timeRangeMs;

        const insights = [];

        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        let query = `
          SELECT 
            COUNT(*) as totalRequests,
            AVG(duration) as avgDuration,
            MAX(duration) as maxDuration,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors,
            SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END) as cachedRequests,
            SUM(size_bytes) as totalBytes,
            type
          FROM bronze_requests
          WHERE timestamp > ${startTime}
        `;

        if (domain && domain !== "all") {
          query += ` AND domain = ${escapeStr(domain)}`;
        }

        if (pageUrl && pageUrl !== "") {
          query += ` AND page_url = ${escapeStr(pageUrl)}`;
        }

        query += " GROUP BY type";

        try {
          const result = database.db.exec(query);
          if (result && result[0]) {
            const typeStats = mapResultToArray(result[0]);

            typeStats.forEach((stat) => {
              // Slow requests insight
              if (stat.avgDuration > 1000) {
                insights.push({
                  type: "performance",
                  severity: stat.avgDuration > 3000 ? "high" : "medium",
                  category: stat.type,
                  message: `${stat.type} requests averaging ${Math.round(
                    stat.avgDuration
                  )}ms - consider optimization`,
                  recommendation:
                    "Optimize server response time, implement caching, or reduce payload size",
                });
              }

              // Low cache hit rate
              const cacheRate =
                (stat.cachedRequests / stat.totalRequests) * 100;
              if (cacheRate < 30 && stat.type !== "xhr") {
                insights.push({
                  type: "caching",
                  severity: "medium",
                  category: stat.type,
                  message: `Only ${cacheRate.toFixed(1)}% of ${
                    stat.type
                  } requests cached`,
                  recommendation:
                    "Implement browser caching with proper Cache-Control headers",
                });
              }

              // High error rate
              const errorRate = (stat.errors / stat.totalRequests) * 100;
              if (errorRate > 5) {
                insights.push({
                  type: "reliability",
                  severity: errorRate > 15 ? "high" : "medium",
                  category: stat.type,
                  message: `${errorRate.toFixed(1)}% error rate for ${
                    stat.type
                  } requests`,
                  recommendation:
                    "Investigate failed requests and implement better error handling",
                });
              }

              // Large resource size
              const avgSize = stat.totalBytes / stat.totalRequests;
              if (
                avgSize > 500000 &&
                (stat.type === "script" || stat.type === "stylesheet")
              ) {
                insights.push({
                  type: "optimization",
                  severity: "medium",
                  category: stat.type,
                  message: `Average ${stat.type} size is ${(
                    avgSize / 1024
                  ).toFixed(0)}KB`,
                  recommendation:
                    "Minify and compress assets, consider code splitting",
                });
              }
            });
          }
        } catch (queryError) {
          console.error("Performance insights query error:", queryError);
        }

        return { success: true, insights };
      } catch (error) {
        console.error("Get performance insights error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getHeatmapData",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const { domain, pageUrl, timeRange } = message.filters || {};
        const timeRangeMs = timeRange
          ? parseInt(timeRange) * 1000
          : 7 * 86400 * 1000; // Default 7 days
        const startTime = Date.now() - timeRangeMs;

        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        let query = `
          SELECT 
            CAST(strftime('%w', timestamp/1000, 'unixepoch') AS INTEGER) as dayOfWeek,
            CAST(strftime('%H', timestamp/1000, 'unixepoch') AS INTEGER) as hour,
            COUNT(*) as count,
            AVG(duration) as avgDuration
          FROM bronze_requests
          WHERE timestamp > ${startTime}
        `;

        if (domain && domain !== "all") {
          query += ` AND domain = ${escapeStr(domain)}`;
        }

        if (pageUrl && pageUrl !== "") {
          query += ` AND page_url = ${escapeStr(pageUrl)}`;
        }

        query += " GROUP BY dayOfWeek, hour";

        const result = database.db.exec(query);
        const heatmapData =
          result && result[0] ? mapResultToArray(result[0]) : [];

        // Create 7x24 matrix (days x hours)
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const matrix = Array(7)
          .fill(null)
          .map(() => Array(24).fill(0));
        const durationMatrix = Array(7)
          .fill(null)
          .map(() => Array(24).fill(0));

        heatmapData.forEach((d) => {
          const day = parseInt(d.dayOfWeek);
          const hour = parseInt(d.hour);
          matrix[day][hour] = d.count;
          durationMatrix[day][hour] = Math.round(d.avgDuration);
        });

        return {
          success: true,
          heatmap: {
            days: dayNames,
            hours: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            data: matrix,
            durations: durationMatrix,
          },
        };
      } catch (error) {
        console.error("Get heatmap data error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getMultiDomainComparison",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const domains = message.domains;
        if (!domains || domains.length === 0) {
          return { success: false, error: "Domains array required" };
        }

        const { timeRange } = message.filters || {};
        const timeRangeMs = timeRange
          ? parseInt(timeRange) * 1000
          : 86400 * 1000;
        const startTime = Date.now() - timeRangeMs;

        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        const results = [];

        for (const domain of domains) {
          const query = `
            SELECT 
              COUNT(*) as totalRequests,
              AVG(duration) as avgDuration,
              SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors,
              SUM(size_bytes) as totalBytes
            FROM bronze_requests
            WHERE domain = ${escapeStr(domain)} AND timestamp > ${startTime}
          `;

          try {
            const result = database.db.exec(query);
            if (result && result[0]?.values && result[0].values[0]) {
              const [requests, duration, errors, bytes] = result[0].values[0];
              results.push({
                domain,
                totalRequests: requests || 0,
                avgDuration: Math.round(duration || 0),
                errors: errors || 0,
                totalBytes: bytes || 0,
                errorRate:
                  requests > 0 ? ((errors / requests) * 100).toFixed(2) : 0,
              });
            }
          } catch (queryError) {
            console.error(`Query error for domain ${domain}:`, queryError);
          }
        }

        return { success: true, comparison: results };
      } catch (error) {
        console.error("Multi-domain comparison error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getResourceCompressionStats",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const { filters = {} } = message;
        const { domain, timeRange = 86400 } = filters;

        const startTime = Date.now() - parseInt(timeRange) * 1000;

        let whereClause = `WHERE timestamp > ${startTime}`;
        if (domain) {
          whereClause += ` AND domain = '${domain.replace(/'/g, "''")}'`;
        }

        // Get compression statistics
        const query = `
          SELECT 
            type as resource_type,
            COUNT(*) as request_count,
            SUM(size_bytes) as total_size,
            AVG(size_bytes) as avg_size,
            SUM(CASE WHEN response_headers LIKE '%Content-Encoding:%' THEN 1 ELSE 0 END) as compressed_count
          FROM bronze_requests
          ${whereClause}
          GROUP BY type
          ORDER BY total_size DESC
        `;

        const result = database.executeQuery(query);
        const stats = [];

        if (result && result[0]?.values) {
          for (const row of result[0].values) {
            const [resourceType, count, totalSize, avgSize, compressedCount] =
              row;
            stats.push({
              resourceType,
              requestCount: count,
              totalSize: totalSize || 0,
              avgSize: Math.round(avgSize || 0),
              compressedCount: compressedCount || 0,
              compressionRate:
                count > 0 ? ((compressedCount / count) * 100).toFixed(1) : 0,
            });
          }
        }

        return {
          success: true,
          stats,
          message: "Resource compression stats retrieved",
        };
      } catch (error) {
        console.error("Get resource compression stats error:", error);
        return { success: false, error: error.message };
      }
    },
  ],
]);
