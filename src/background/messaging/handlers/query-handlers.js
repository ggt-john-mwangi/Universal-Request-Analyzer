/**
 * Query Handlers
 * Handles database query, domain, and page operations
 * Extracted from popup-message-handler.js
 */

import { mapResultToArray, escapeStr } from "../../utils/handler-helpers.js";

/**
 * Handle direct database query
 */
async function handleQuery(query, params, context) {
  try {
    const { database } = context;

    if (!database || !database.isReady || !database.db) {
      console.error("[query-handlers] Database not ready:", {
        hasDatabase: !!database,
        isReady: database?.isReady,
        hasDb: !!database?.db,
      });
      return { success: false, error: "Database not initialized" };
    }

    // Execute query
    const result = database.db.exec(query, params);

    if (!result || result.length === 0) {
      return { success: true, data: [] };
    }

    // Convert SQL.js result format to array of objects
    const data = mapResultToArray(result[0]);

    return { success: true, data };
  } catch (error) {
    console.error("Query handler error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get domains - returns list of all tracked domains
 */
async function handleGetDomains(timeRange, context) {
  try {
    const { database } = context;
    const timeRangeMs = parseInt(timeRange || 604800) * 1000;
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
      if (database?.executeQuery) {
        const result = database.executeQuery(query, [startTime]);
        if (result && result[0]?.values) {
          domains = result[0].values.map((row) => ({
            domain: row[0],
            requestCount: row[1],
          }));
        }
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
 * Handle get pages by domain - returns list of pages under a specific domain
 */
async function handleGetPagesByDomain(domain, timeRange, context) {
  try {
    const { database } = context;

    if (!domain) {
      return { success: false, error: "Domain is required" };
    }

    // Get ALL pages for this domain regardless of time
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
      if (database?.db) {
        const result = database.db.exec(query);
        if (result && result[0]?.values) {
          pages = result[0].values.map((row) => ({
            pageUrl: row[0],
            requestCount: row[1],
          }));
        }
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
 * Handle get detailed requests with pagination
 * Ported from popup-message-handler.js lines 1249-1405
 */
async function handleGetDetailedRequests(
  filters,
  limit = 100,
  offset = 0,
  context
) {
  try {
    const { database } = context;

    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { domain, pageUrl, timeRange, type, statusPrefix, searchQuery } =
      filters || {};

    const timeRangeMs = timeRange ? parseInt(timeRange) * 1000 : 5 * 60 * 1000;
    const startTime = Date.now() - timeRangeMs;

    let query = `
      SELECT 
        id, url, method, type, status, status_text,
        duration, size_bytes, timestamp, domain, page_url,
        from_cache, error
      FROM bronze_requests
      WHERE timestamp > ${startTime}
    `;

    // Apply filters (same as handleGetFilteredStats)
    if (domain && domain !== "all") {
      query += ` AND domain = ${escapeStr(domain)}`;
    }

    if (pageUrl && pageUrl !== "") {
      try {
        const url = new URL(pageUrl);
        query += ` AND page_url = ${escapeStr(pageUrl)}`;
        if (!domain || domain === "all") {
          query += ` AND domain = ${escapeStr(url.hostname)}`;
        }
      } catch (urlError) {
        const domainFromUrl = pageUrl.replace(/^https?:\/\//, "").split("/")[0];
        query += ` AND domain = ${escapeStr(domainFromUrl)}`;
      }
    }

    if (type && type !== "") {
      query += ` AND type = ${escapeStr(type)}`;
    }

    // Add search query filter for URL, method, or status
    if (searchQuery && searchQuery !== "") {
      const searchLower = searchQuery.toLowerCase();
      query += ` AND (LOWER(url) LIKE '%${searchLower.replace(
        /'/g,
        "''"
      )}%' OR LOWER(method) LIKE '%${searchLower.replace(
        /'/g,
        "''"
      )}%' OR CAST(status AS TEXT) LIKE '%${searchLower.replace(
        /'/g,
        "''"
      )}%')`;
    }

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

    query += ` ORDER BY timestamp DESC LIMIT ${parseInt(
      limit
    )} OFFSET ${parseInt(offset)}`;

    let requests = [];
    let totalCount = 0;

    try {
      // Build and execute count query
      let countQuery = `
        SELECT COUNT(*) as total
        FROM bronze_requests
        WHERE timestamp > ${startTime}
      `;

      // Apply same filters to count query
      if (domain && domain !== "all") {
        countQuery += ` AND domain = ${escapeStr(domain)}`;
      }

      if (pageUrl && pageUrl !== "") {
        try {
          const url = new URL(pageUrl);
          countQuery += ` AND page_url = ${escapeStr(pageUrl)}`;
          if (!domain || domain === "all") {
            countQuery += ` AND domain = ${escapeStr(url.hostname)}`;
          }
        } catch (urlError) {
          const domainFromUrl = pageUrl
            .replace(/^https?:\/\//, "")
            .split("/")[0];
          countQuery += ` AND domain = ${escapeStr(domainFromUrl)}`;
        }
      }

      if (type && type !== "") {
        countQuery += ` AND type = ${escapeStr(type)}`;
      }

      if (searchQuery && searchQuery !== "") {
        const searchLower = searchQuery.toLowerCase();
        countQuery += ` AND (LOWER(url) LIKE '%${searchLower.replace(
          /'/g,
          "''"
        )}%' OR LOWER(method) LIKE '%${searchLower.replace(
          /'/g,
          "''"
        )}%' OR CAST(status AS TEXT) LIKE '%${searchLower.replace(
          /'/g,
          "''"
        )}%')`;
      }

      if (statusPrefix) {
        if (statusPrefix === "3xx") {
          countQuery += " AND status >= 300 AND status < 400";
        } else if (statusPrefix === "4xx") {
          countQuery += " AND status >= 400 AND status < 500";
        } else if (statusPrefix === "5xx") {
          countQuery += " AND status >= 500 AND status < 600";
        } else if (statusPrefix === "200") {
          countQuery += " AND status >= 200 AND status < 300";
        } else {
          countQuery += ` AND status = ${parseInt(statusPrefix)}`;
        }
      }

      const countResult = database.db.exec(countQuery);
      if (countResult && countResult[0]?.values) {
        totalCount = countResult[0].values[0][0];
      }

      // Get requests with pagination
      const result = database.db.exec(query);
      if (result && result[0]) {
        requests = mapResultToArray(result[0]);
      }
    } catch (queryError) {
      console.error("Get detailed requests query error:", queryError);
    }

    return {
      success: true,
      requests,
      totalCount,
      limit,
      offset,
    };
  } catch (error) {
    console.error("Get detailed requests error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get request types
 * Note: Implementation needs to be extracted from popup-message-handler.js
 */
async function handleGetRequestTypes(filters, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.executeQuery) {
      return { success: false, error: "Database not initialized" };
    }

    const query = `
      SELECT DISTINCT type, COUNT(*) as count
      FROM bronze_requests
      WHERE type IS NOT NULL AND type != ''
      GROUP BY type
      ORDER BY count DESC
    `;

    let requestTypes = [];

    try {
      const result = database.executeQuery(query);
      if (result && result[0]?.values) {
        requestTypes = result[0].values.map((row) => ({
          type: row[0],
          count: row[1],
        }));
      }
    } catch (queryError) {
      console.error("Get request types query error:", queryError);
    }

    return { success: true, requestTypes };
  } catch (error) {
    console.error("Get request types error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for query operations
 */
export const queryHandlers = new Map([
  [
    "query",
    async (message, sender, context) => {
      return await handleQuery(message.query, message.params, context);
    },
  ],

  [
    "getDomains",
    async (message, sender, context) => {
      return await handleGetDomains(message.timeRange, context);
    },
  ],

  [
    "getPagesByDomain",
    async (message, sender, context) => {
      return await handleGetPagesByDomain(
        message.domain,
        message.timeRange,
        context
      );
    },
  ],

  [
    "getDetailedRequests",
    async (message, sender, context) => {
      return await handleGetDetailedRequests(
        message.filters,
        message.limit || 100,
        message.offset || 0,
        context
      );
    },
  ],

  [
    "getRequestTypes",
    async (message, sender, context) => {
      return await handleGetRequestTypes(message.filters, context);
    },
  ],

  [
    "executeDirectQuery",
    async (message, sender, context) => {
      // Alias for query action - used by Options page for direct SQL queries
      return await handleQuery(message.query, message.params, context);
    },
  ],
]);
