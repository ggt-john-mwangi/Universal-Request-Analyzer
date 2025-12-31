/**
 * Domain Handlers
 * Handles domain-related queries
 * Ported from popup-message-handler.js
 */

import { mapResultToArray, escapeStr } from "../../utils/handler-helpers.js";

/**
 * Handle get domains
 */
async function handleGetDomains(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.executeQuery) {
      return { success: false, error: "Database not initialized" };
    }

    const timeRange = message?.timeRange || 604800; // Default 7 days
    const timeRangeMs = parseInt(timeRange) * 1000;
    const startTime = Date.now() - timeRangeMs;

    const query = `
      SELECT DISTINCT domain, COUNT(*) as request_count
      FROM bronze_requests
      WHERE domain IS NOT NULL AND domain != '' AND timestamp > ?
      GROUP BY domain
      ORDER BY request_count DESC
    `;

    let domains = [];

    try {
      const result = database.executeQuery(query, [startTime]);
      if (result && result[0]?.values) {
        domains = result[0].values.map((row) => ({
          domain: row[0],
          requestCount: row[1],
        }));
      }
    } catch (queryError) {
      console.error("Get domains query error:", queryError);
    }

    return { success: true, domains };
  } catch (error) {
    console.error("Get domains error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get distinct domains (no time filter)
 */
async function handleGetDistinctDomains(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.executeQuery) {
      return { success: false, error: "Database not initialized" };
    }

    const query = `
      SELECT DISTINCT domain, COUNT(*) as request_count
      FROM bronze_requests 
      WHERE domain IS NOT NULL AND domain != ''
      GROUP BY domain
      ORDER BY request_count DESC
    `;

    const result = database.executeQuery(query);
    let domains = [];

    if (result && result[0]?.values) {
      domains = result[0].values.map((row) => ({
        domain: row[0],
        requestCount: row[1],
      }));
    }

    return { success: true, domains };
  } catch (error) {
    console.error("Get distinct domains error:", error);
    return { success: false, error: error.message, domains: [] };
  }
}

/**
 * Handle get pages by domain
 */
async function handleGetPagesByDomain(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const domain = message?.domain;
    const timeRange = message?.timeRange || 604800;

    if (!domain) {
      return { success: false, error: "Domain is required" };
    }

    // Get ALL pages for this domain regardless of time
    // Time filtering should only apply to the metrics displayed, not to available pages
    const query = `
      SELECT DISTINCT page_url, COUNT(*) as request_count
      FROM bronze_requests
      WHERE domain = ${escapeStr(
        domain
      )} AND page_url IS NOT NULL AND page_url != ''
      GROUP BY page_url
      ORDER BY request_count DESC
    `;

    let pages = [];

    try {
      const result = database.db.exec(query);
      if (result && result[0]?.values) {
        pages = result[0].values.map((row) => ({
          pageUrl: row[0],
          requestCount: row[1],
        }));
      }
    } catch (queryError) {
      console.error("Get pages query error:", queryError);
    }

    return { success: true, pages };
  } catch (error) {
    console.error("Get pages by domain error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get domain details
 */
async function handleGetDomainDetails(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const domain = message?.domain;
    const timeRange = message?.timeRange || 604800;
    const timeRangeMs = parseInt(timeRange) * 1000;
    const startTime = Date.now() - timeRangeMs;

    if (!domain) {
      return { success: false, error: "Domain is required" };
    }

    // Get comprehensive domain statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(DISTINCT page_url) as total_pages,
        AVG(duration) as avg_duration,
        MIN(duration) as min_duration,
        MAX(duration) as max_duration,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN status >= 200 AND status < 300 THEN 1 ELSE 0 END) as success_count
      FROM bronze_requests
      WHERE domain = ${escapeStr(domain)} AND timestamp > ${startTime}
    `;

    const result = database.db.exec(statsQuery);

    if (!result || !result[0]?.values || !result[0].values[0]) {
      return { success: false, error: "No data found for domain" };
    }

    const row = result[0].values[0];
    const details = {
      domain,
      totalRequests: row[0] || 0,
      totalPages: row[1] || 0,
      avgDuration: row[2] || 0,
      minDuration: row[3] || 0,
      maxDuration: row[4] || 0,
      errorCount: row[5] || 0,
      successCount: row[6] || 0,
      errorRate: row[0] > 0 ? ((row[5] || 0) / row[0]) * 100 : 0,
    };

    return { success: true, details };
  } catch (error) {
    console.error("Get domain details error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for domain operations
 */
export const domainHandlers = new Map([
  ["getDomains", handleGetDomains],
  ["getDistinctDomains", handleGetDistinctDomains],
  ["getPagesByDomain", handleGetPagesByDomain],
  ["getDomainDetails", handleGetDomainDetails],
]);
