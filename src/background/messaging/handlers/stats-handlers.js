/**
 * Stats Handlers
 * Handles statistics and metrics operations
 * Extracted from popup-message-handler.js
 */

import { mapResultToArray, escapeStr } from "../../utils/handler-helpers.js";

/**
 * Handle get page stats - supports domain-level aggregation
 */
async function handleGetPageStats(data, context) {
  try {
    const { database } = context;
    const { tabId, url, requestType, statusFilter } = data;

    // Check database availability
    if (!database || !database.isReady) {
      console.error("[stats-handlers] Database not ready:", {
        hasDatabase: !!database,
        isReady: database?.isReady,
      });
      return { success: false, error: "Database not initialized" };
    }

    if (!database.db) {
      console.error("[stats-handlers] Database.db is null/undefined");
      return { success: false, error: "Database instance not available" };
    }

    if (!url) {
      return { success: false, error: "URL required" };
    }

    // Extract domain from URL
    const domain = new URL(url).hostname;

    // Query requests for this domain in the last 5 minutes
    // This aggregates across ALL pages for the domain (as per popup requirements)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const stats = {
      totalRequests: 0,
      avgResponse: 0,
      errorCount: 0,
      dataTransferred: 0,
      requestTypes: {},
      statusCodes: {},
      timestamps: [],
      responseTimes: [],
    };

    try {
      if (database && database.db) {
        // Build query with optional request type filter
        let whereClause = `WHERE domain = ${escapeStr(
          domain
        )} AND created_at > ${fiveMinutesAgo}`;

        if (requestType && requestType !== "") {
          whereClause += ` AND type = ${escapeStr(requestType)}`;
        }

        // Apply status filter for quick filter chips
        if (statusFilter === "2xx") {
          whereClause += ` AND status >= 200 AND status < 300`;
        } else if (statusFilter === "4xx") {
          whereClause += ` AND status >= 400 AND status < 500`;
        } else if (statusFilter === "5xx") {
          whereClause += ` AND status >= 500 AND status < 600`;
        }

        // Query aggregate stats across all pages in the domain
        const aggregateQuery = `
          SELECT 
            COUNT(*) as totalRequests,
            AVG(duration) as avgResponse,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errorCount,
            SUM(size_bytes) as dataTransferred
          FROM bronze_requests
          ${whereClause}
        `;

        const aggregateResult = database.db.exec(aggregateQuery);

        if (
          aggregateResult &&
          aggregateResult[0]?.values &&
          aggregateResult[0].values.length > 0
        ) {
          const [total, avg, errors, bytes] = aggregateResult[0].values[0];
          stats.totalRequests = total || 0;
          stats.avgResponse = Math.round(avg || 0);
          stats.errorCount = errors || 0;
          stats.dataTransferred = bytes || 0;
        }

        // Query detailed request data for charts (aggregated across all pages)
        const detailQuery = `
          SELECT type, status, duration, created_at
          FROM bronze_requests
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT 100
        `;

        const detailResult = database.db.exec(detailQuery);

        if (detailResult && detailResult[0]?.values) {
          detailResult[0].values.forEach((row) => {
            const [type, status, duration, timestamp] = row;

            // Aggregate by type
            if (type) {
              stats.requestTypes[type] = (stats.requestTypes[type] || 0) + 1;
            }

            // Aggregate by status code
            if (status) {
              stats.statusCodes[status] = (stats.statusCodes[status] || 0) + 1;
            }

            // Collect timestamps and response times
            if (timestamp) stats.timestamps.push(timestamp);
            if (duration) stats.responseTimes.push(duration);
          });
        }
      } else {
        console.warn("Database manager not available");
      }
    } catch (queryError) {
      console.error("Query error:", queryError);
      // Return default stats if query fails
    }

    return { success: true, stats };
  } catch (error) {
    console.error("Get page stats error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get filtered stats for DevTools panel and Dashboard
 * Supports domain → page → request type filtering hierarchy
 */
async function handleGetFilteredStats(filters, context) {
  try {
    const { database } = context;

    if (!database || !database.executeQuery) {
      console.error(
        "[stats-handlers] Database manager not initialized or missing executeQuery method"
      );
      return {
        success: false,
        error: "Database not initialized",
        totalRequests: 0,
        timestamps: [],
        responseTimes: [],
        requestTypes: {},
        statusCodes: {},
      };
    }

    const { domain, pageUrl, timeRange, type, statusPrefix } = filters || {};

    // Default to last 5 minutes if not specified
    const timeRangeMs = timeRange ? parseInt(timeRange) * 1000 : 5 * 60 * 1000;
    const startTime = Date.now() - timeRangeMs;

    let query = `
      SELECT 
        id, url, method, type, status, duration, size_bytes, timestamp, domain, page_url
      FROM bronze_requests
      WHERE timestamp > ${startTime}
    `;

    // Filter by domain (if specified)
    if (domain && domain !== "all") {
      query += ` AND domain = ${escapeStr(domain)}`;
    }

    // Filter by page URL (if specified)
    if (pageUrl && pageUrl !== "") {
      try {
        const url = new URL(pageUrl);
        query += ` AND page_url = ${escapeStr(pageUrl)}`;

        // Also ensure domain matches for safety
        if (!domain || domain === "all") {
          query += ` AND domain = ${escapeStr(url.hostname)}`;
        }
      } catch (urlError) {
        // If pageUrl is just a domain, treat it as domain filter
        const domainFromUrl = pageUrl.replace(/^https?:\/\//, "").split("/")[0];
        query += ` AND domain = ${escapeStr(domainFromUrl)}`;
      }
    }

    // Add request type filter
    if (type && type !== "") {
      query += ` AND type = ${escapeStr(type)}`;
    }

    // Add status filter
    if (statusPrefix) {
      if (statusPrefix === "3xx") {
        query += " AND status >= 300 AND status < 400";
      } else if (statusPrefix === "4xx") {
        query += " AND status >= 400 AND status < 500";
      } else if (statusPrefix === "5xx") {
        query += " AND status >= 500 AND status < 600";
      } else if (statusPrefix === "200") {
        query += " AND status >= 200 AND status < 300";
      } else {
        query += ` AND status = ${parseInt(statusPrefix)}`;
      }
    }

    query += " ORDER BY timestamp DESC LIMIT 1000";

    console.log(
      "[stats-handlers] Executing query:",
      query.substring(0, 300) + "..."
    );

    let requests = [];

    try {
      const result = database.db.exec(query);

      if (result && result[0]) {
        requests = mapResultToArray(result[0]);
      }
    } catch (queryError) {
      console.error("Filtered stats query error:", queryError);

      // Check if error is due to schema mismatch
      if (queryError.message && queryError.message.includes("no such column")) {
        console.error(
          "⚠️ Database schema mismatch detected. Please clear extension data and reload."
        );
        return {
          success: false,
          error:
            "Database schema outdated. Please clear extension data and reinstall.",
          totalRequests: 0,
          timestamps: [],
          responseTimes: [],
          requestTypes: {},
          statusCodes: {},
        };
      }

      return {
        success: false,
        error: queryError.message,
        totalRequests: 0,
        timestamps: [],
        responseTimes: [],
        requestTypes: {},
        statusCodes: {},
      };
    }

    // Process data for charts
    const timestamps = [];
    const responseTimes = [];
    const requestTypes = {};
    const statusCodes = {};
    const domainCounts = {};

    requests.forEach((req) => {
      if (req.timestamp && req.duration) {
        timestamps.push(new Date(req.timestamp).toLocaleTimeString());
        responseTimes.push(req.duration);
      }

      if (req.type) {
        requestTypes[req.type] = (requestTypes[req.type] || 0) + 1;
      }

      if (req.domain) {
        domainCounts[req.domain] = (domainCounts[req.domain] || 0) + 1;
      }

      if (req.status) {
        const statusGroup = Math.floor(req.status / 100) * 100;
        statusCodes[statusGroup] = (statusCodes[statusGroup] || 0) + 1;
      }
    });

    return {
      success: true,
      timestamps: timestamps.slice(-50),
      responseTimes: responseTimes.slice(-50),
      requestTypes,
      domainCounts,
      statusCodes,
      totalRequests: requests.length,
      filterApplied: {
        domain: domain || "all",
        page: pageUrl || "all",
        requestType: type || "all",
      },
    };
  } catch (error) {
    console.error("Get filtered stats error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get dashboard stats
 */
async function handleGetDashboardStats(timeRange, context) {
  try {
    const { database } = context;
    // Check database availability
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }
    const timeRangeMs = parseInt(timeRange || 86400) * 1000;
    const startTime = Date.now() - timeRangeMs;

    const stats = {
      totalRequests: 0,
      avgResponse: 0,
      slowRequests: 0,
      errorCount: 0,
      volumeTimeline: { labels: [], values: [] },
      statusDistribution: [0, 0, 0, 0],
      topDomains: { labels: [], values: [] },
      performanceTrend: { labels: [], values: [] },
      layerCounts: { bronze: 0, silver: 0, gold: 0 },
    };

    try {
      if (database?.executeQuery) {
        // Get overall stats
        const overallQuery = `
          SELECT 
            COUNT(*) as totalRequests,
            AVG(duration) as avgResponse,
            SUM(CASE WHEN duration > 1000 THEN 1 ELSE 0 END) as slowRequests,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errorCount
          FROM bronze_requests
          WHERE timestamp > ?
        `;
        const overallResult = database.executeQuery(overallQuery, [startTime]);

        if (
          overallResult &&
          overallResult[0]?.values &&
          overallResult[0].values.length > 0
        ) {
          const [total, avg, slow, errors] = overallResult[0].values[0];
          stats.totalRequests = total || 0;
          stats.avgResponse = avg || 0;
          stats.slowRequests = slow || 0;
          stats.errorCount = errors || 0;
        }

        // Get status distribution
        const statusQuery = `
          SELECT 
            CASE 
              WHEN status >= 200 AND status < 300 THEN '2xx'
              WHEN status >= 300 AND status < 400 THEN '3xx'
              WHEN status >= 400 AND status < 500 THEN '4xx'
              WHEN status >= 500 THEN '5xx'
            END as statusGroup,
            COUNT(*) as count
          FROM bronze_requests
          WHERE timestamp > ? AND status IS NOT NULL
          GROUP BY statusGroup
        `;
        const statusResult = database.executeQuery(statusQuery, [startTime]);

        if (statusResult && statusResult[0]?.values) {
          const statusMap = { "2xx": 0, "3xx": 1, "4xx": 2, "5xx": 3 };
          statusResult[0].values.forEach(([group, count]) => {
            if (group && statusMap[group] !== undefined) {
              stats.statusDistribution[statusMap[group]] = count;
            }
          });
        }

        // Get top domains
        const domainsQuery = `
          SELECT domain, COUNT(*) as count
          FROM bronze_requests
          WHERE timestamp > ? AND domain IS NOT NULL
          GROUP BY domain
          ORDER BY count DESC
          LIMIT 10
        `;
        const domainsResult = database.executeQuery(domainsQuery, [startTime]);

        if (domainsResult && domainsResult[0]?.values) {
          stats.topDomains.labels = domainsResult[0].values.map((r) => r[0]);
          stats.topDomains.values = domainsResult[0].values.map((r) => r[1]);
        }

        // Get volume timeline (hourly aggregation)
        const hoursToShow = Math.min(
          Math.ceil(timeRangeMs / (3600 * 1000)),
          24
        );
        const hourlyQuery = `
          SELECT 
            strftime('%H:00', datetime(timestamp/1000, 'unixepoch')) as hour,
            COUNT(*) as count
          FROM bronze_requests
          WHERE timestamp > ?
          GROUP BY hour
          ORDER BY timestamp ASC
          LIMIT ?
        `;
        const volumeResult = database.executeQuery(hourlyQuery, [
          startTime,
          hoursToShow,
        ]);

        if (volumeResult && volumeResult[0]?.values) {
          stats.volumeTimeline.labels = volumeResult[0].values.map((r) => r[0]);
          stats.volumeTimeline.values = volumeResult[0].values.map((r) => r[1]);
        }

        // Get performance trend (hourly average)
        const perfQuery = `
          SELECT 
            strftime('%H:00', datetime(timestamp/1000, 'unixepoch')) as hour,
            AVG(duration) as avgDuration
          FROM bronze_requests
          WHERE timestamp > ? AND duration IS NOT NULL
          GROUP BY hour
          ORDER BY timestamp ASC
          LIMIT ?
        `;
        const perfResult = database.executeQuery(perfQuery, [
          startTime,
          hoursToShow,
        ]);

        if (perfResult && perfResult[0]?.values) {
          stats.performanceTrend.labels = perfResult[0].values.map((r) => r[0]);
          stats.performanceTrend.values = perfResult[0].values.map((r) =>
            Math.round(r[1])
          );
        }

        // Get layer counts
        const layerQueries = {
          bronze: "SELECT COUNT(*) FROM bronze_requests",
          silver: "SELECT COUNT(*) FROM silver_requests",
          gold: "SELECT COUNT(*) FROM gold_daily_analytics",
        };

        for (const [layer, query] of Object.entries(layerQueries)) {
          try {
            const result = database.executeQuery(query);
            if (result && result[0]?.values && result[0].values.length > 0) {
              stats.layerCounts[layer] = result[0].values[0][0] || 0;
            }
          } catch (layerError) {
            console.warn(`Failed to get ${layer} count:`, layerError);
          }
        }
      }
    } catch (queryError) {
      console.error("Dashboard stats query error:", queryError);
    }

    return { success: true, stats };
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get metrics - reuses dashboard stats logic
 */
async function handleGetMetrics(timeRange, context) {
  try {
    const result = await handleGetDashboardStats(timeRange, context);
    return result;
  } catch (error) {
    console.error("Get metrics error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for stats operations
 */
export const statsHandlers = new Map([
  [
    "getPageStats",
    async (message, sender, context) => {
      return await handleGetPageStats(message.data, context);
    },
  ],

  [
    "getFilteredStats",
    async (message, sender, context) => {
      return await handleGetFilteredStats(message.filters, context);
    },
  ],

  [
    "getDashboardStats",
    async (message, sender, context) => {
      return await handleGetDashboardStats(message.timeRange, context);
    },
  ],

  [
    "getMetrics",
    async (message, sender, context) => {
      return await handleGetMetrics(message.timeRange, context);
    },
  ],
]);
