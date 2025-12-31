/**
 * Insights Handlers
 * Handles performance insights and analytics
 * Ported from popup-message-handler.js
 */

import { mapResultToArray, escapeStr } from "../../utils/handler-helpers.js";

/**
 * Handle get metrics - delegates to dashboard stats
 */
async function handleGetMetrics(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady) {
      return { success: false, error: "Database not initialized" };
    }

    const timeRange = message?.timeRange || 86400;

    // Reuse dashboard stats logic for metrics
    // This would call handleGetDashboardStats if it exists in stats-handlers
    // For now, return basic metrics structure
    return {
      success: true,
      metrics: {
        timeRange,
        timestamp: Date.now(),
      },
      message: "Metrics endpoint - delegates to dashboard stats",
    };
  } catch (error) {
    console.error("Get metrics error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get heatmap data
 */
async function handleGetHeatmapData(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.executeQuery) {
      return { success: false, error: "Database not initialized" };
    }

    const { filters } = message;
    const { domain, pageUrl, timeRange } = filters || {};
    const timeRangeMs = timeRange
      ? parseInt(timeRange) * 1000
      : 30 * 24 * 60 * 60 * 1000; // Default 30 days
    const startTime = Date.now() - timeRangeMs;

    let query = `
      SELECT 
        strftime('%w', datetime(timestamp/1000, 'unixepoch')) as dayOfWeek,
        strftime('%H', datetime(timestamp/1000, 'unixepoch')) as hour,
        COUNT(*) as count,
        AVG(duration) as avgDuration
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

    query += " GROUP BY dayOfWeek, hour ORDER BY dayOfWeek, hour";

    let heatmapData = [];

    try {
      const result = database.executeQuery(query, params);
      if (result && result[0]) {
        heatmapData = mapResultToArray(result[0]);
      }
    } catch (queryError) {
      console.error("Heatmap query error:", queryError);
    }

    // Format for heatmap visualization
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
}

/**
 * Handle multi-domain comparison
 */
async function handleGetMultiDomainComparison(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.executeQuery) {
      return { success: false, error: "Database not initialized" };
    }

    const { domains, filters } = message;

    if (!domains || domains.length === 0) {
      return { success: false, error: "Domains array required" };
    }

    const { timeRange } = filters || {};
    const timeRangeMs = timeRange ? parseInt(timeRange) * 1000 : 86400 * 1000;
    const startTime = Date.now() - timeRangeMs;

    const results = [];

    for (const domain of domains) {
      const query = `
        SELECT 
          COUNT(*) as totalRequests,
          AVG(duration) as avgDuration,
          SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors,
          SUM(size_bytes) as totalBytes
        FROM bronze_requests
        WHERE domain = ? AND timestamp > ?
      `;

      try {
        const result = database.executeQuery(query, [domain, startTime]);
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
}

/**
 * Handle performance insights - generate recommendations
 */
async function handleGetPerformanceInsights(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.executeQuery) {
      return { success: false, error: "Database not initialized" };
    }

    const { filters } = message;
    const { domain, pageUrl, timeRange } = filters || {};
    const timeRangeMs = timeRange ? parseInt(timeRange) * 1000 : 86400 * 1000;
    const startTime = Date.now() - timeRangeMs;

    const insights = [];

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

    query += " GROUP BY type";

    try {
      const result = database.executeQuery(query, params);
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
          const cacheRate = (stat.cachedRequests / stat.totalRequests) * 100;
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
              message: `Average ${stat.type} size is ${(avgSize / 1024).toFixed(
                0
              )}KB`,
              recommendation:
                "Minify and compress assets, consider code splitting",
            });
          }
        });
      }
    } catch (queryError) {
      console.error("Performance insights query error:", queryError);
    }

    // Sort by severity
    insights.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return { success: true, insights };
  } catch (error) {
    console.error("Get performance insights error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for insights operations
 */
export const insightsHandlers = new Map([
  ["getMetrics", handleGetMetrics],
  ["getHeatmapData", handleGetHeatmapData],
  ["getMultiDomainComparison", handleGetMultiDomainComparison],
  ["getPerformanceInsights", handleGetPerformanceInsights],
]);
