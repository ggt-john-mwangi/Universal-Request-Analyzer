/**
 * Request Handlers
 * Handles request data queries and operations
 * Ported from popup-message-handler.js
 */

import { mapResultToArray, escapeStr } from "../../utils/handler-helpers.js";

/**
 * Handle get requests by filters
 */
async function handleGetRequestsByFilters(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { filters } = message;
    const { domain, pageUrl, type } = filters || {};

    if (!domain) {
      return { success: false, error: "Domain is required" };
    }

    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    // Add time filter to get recent requests (last 7 days)
    const timeRangeMs = 7 * 24 * 60 * 60 * 1000;
    const startTime = Date.now() - timeRangeMs;

    // Get requests without headers/body (fetch those on-demand in Step 3)
    let query = `
      SELECT id, url, method, type, timestamp, status, duration, page_url
      FROM bronze_requests 
      WHERE domain = ${escapeStr(domain)}
        AND timestamp > ${startTime}
    `;

    if (pageUrl) {
      query += ` AND page_url = ${escapeStr(pageUrl)}`;
    }

    if (type) {
      query += ` AND type = ${escapeStr(type)}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT 500`;

    // Execute query and parse SQL.js result format
    const result = database.db.exec(query);
    let requests = [];

    if (result && result[0]?.values) {
      // Map SQL.js result format to objects
      const columns = result[0].columns;
      requests = result[0].values.map((row) => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }

    return { success: true, requests: requests };
  } catch (error) {
    console.error("Get requests by filters error:", error);
    return { success: false, error: error.message, requests: [] };
  }
}

/**
 * Handle get requests
 */
async function handleGetRequests(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { timeRange = 604800, limit = 100, offset = 0 } = message;
    const timeRangeMs = parseInt(timeRange) * 1000;
    const startTime = Date.now() - timeRangeMs;

    const query = `
      SELECT id, url, method, type, domain, page_url, status, duration, timestamp
      FROM bronze_requests
      WHERE timestamp > ${startTime}
      ORDER BY timestamp DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const result = database.db.exec(query);
    const requests = mapResultToArray(result);

    return { success: true, requests };
  } catch (error) {
    console.error("Get requests error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get request details
 */
async function handleGetRequestDetails(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { id } = message;

    if (!id) {
      return { success: false, error: "Request ID is required" };
    }

    const query = `
      SELECT *
      FROM bronze_requests
      WHERE id = ${escapeStr(id)}
    `;

    const result = database.db.exec(query);
    const requests = mapResultToArray(result);

    if (requests.length === 0) {
      return { success: false, error: "Request not found" };
    }

    // Parse JSON fields
    const request = requests[0];
    if (request.request_headers) {
      try {
        request.request_headers = JSON.parse(request.request_headers);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }
    if (request.response_headers) {
      try {
        request.response_headers = JSON.parse(request.response_headers);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    return { success: true, request };
  } catch (error) {
    console.error("Get request details error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle delete requests
 */
async function handleDeleteRequests(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { ids } = message;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: "Request IDs are required" };
    }

    const idList = ids.map((id) => escapeStr(id)).join(",");
    const query = `DELETE FROM bronze_requests WHERE id IN (${idList})`;

    database.db.exec(query);

    // Save database
    if (database.saveDatabase) {
      await database.saveDatabase();
    }

    return { success: true, deleted: ids.length };
  } catch (error) {
    console.error("Delete requests error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle search requests
 */
async function handleSearchRequests(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { query: searchQuery, limit = 100 } = message;

    if (!searchQuery) {
      return { success: false, error: "Search query is required" };
    }

    // Search in URL, domain, and page_url
    const query = `
      SELECT id, url, method, type, domain, page_url, status, duration, timestamp
      FROM bronze_requests
      WHERE url LIKE ${escapeStr("%" + searchQuery + "%")}
         OR domain LIKE ${escapeStr("%" + searchQuery + "%")}
         OR page_url LIKE ${escapeStr("%" + searchQuery + "%")}
      ORDER BY timestamp DESC
      LIMIT ${parseInt(limit)}
    `;

    const result = database.db.exec(query);
    const requests = mapResultToArray(result);

    return { success: true, requests, count: requests.length };
  } catch (error) {
    console.error("Search requests error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for request operations
 */
export const requestHandlers = new Map([
  ["getRequestsByFilters", handleGetRequestsByFilters],
  ["getRequests", handleGetRequests],
  ["getRequestDetails", handleGetRequestDetails],
  ["deleteRequests", handleDeleteRequests],
  ["searchRequests", handleSearchRequests],
]);
