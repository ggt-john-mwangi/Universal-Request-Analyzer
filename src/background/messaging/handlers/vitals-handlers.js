/**
 * Vitals Handlers
 * Handles Web Vitals and performance metrics operations
 * Ported from popup-message-handler.js
 */

import { mapResultToArray, escapeStr } from "../../utils/handler-helpers.js";

/**
 * Handle get Web Vitals
 */
async function handleGetWebVitals(filters, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { domain, pageUrl, timeRange } = filters || {};
    const timeRangeMs = timeRange ? parseInt(timeRange) * 1000 : 5 * 60 * 1000;
    const startTime = Date.now() - timeRangeMs;

    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    let query = `
      SELECT 
        metric_name, metric_value, rating, timestamp, domain, page_url
      FROM bronze_web_vitals
      WHERE timestamp > ${startTime}
    `;

    if (domain && domain !== "all") {
      query += ` AND domain = ${escapeStr(domain)}`;
    }

    if (pageUrl && pageUrl !== "") {
      query += ` AND page_url = ${escapeStr(pageUrl)}`;
    }

    query += " ORDER BY timestamp DESC LIMIT 100";

    let vitals = [];
    const result = database.db.exec(query);
    if (result && result[0]?.values) {
      vitals = result[0].values.map((row) => ({
        metricName: row[0],
        metricValue: row[1],
        rating: row[2],
        timestamp: row[3],
        domain: row[4],
        pageUrl: row[5],
      }));
    }

    return { success: true, vitals };
  } catch (error) {
    console.error("Get web vitals error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get recent errors (status >= 400)
 */
async function handleGetRecentErrors(limit, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const actualLimit = limit || 10;

    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const query = `
      SELECT 
        id, url, method, status, type, timestamp, error, domain, page_url
      FROM bronze_requests
      WHERE status >= 400
      ORDER BY timestamp DESC
      LIMIT ${parseInt(actualLimit)}
    `;

    const queryResult = database.db.exec(query);

    const errors =
      queryResult.length > 0 && queryResult[0].values
        ? queryResult[0].values.map((row) => {
            const obj = {};
            queryResult[0].columns.forEach((col, idx) => {
              obj[col] = row[idx];
            });
            return obj;
          })
        : [];

    return { success: true, errors };
  } catch (error) {
    console.error("Get recent errors error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get recent requests
 */
async function handleGetRecentRequests(limit, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const actualLimit = limit || 10;

    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const query = `
      SELECT 
        id, url, method, status, duration, timestamp,
        type, domain, page_url, size_bytes as size, status_text
      FROM silver_requests
      ORDER BY timestamp DESC
      LIMIT ${parseInt(actualLimit)}
    `;

    const queryResult = database.db.exec(query);

    const requests =
      queryResult.length > 0 && queryResult[0].values
        ? queryResult[0].values.map((row) => {
            const obj = {};
            queryResult[0].columns.forEach((col, idx) => {
              obj[col] = row[idx];
            });
            return obj;
          })
        : [];

    return { success: true, requests };
  } catch (error) {
    console.error("Get recent requests error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for vitals operations
 */
export const vitalsHandlers = new Map([
  [
    "getWebVitals",
    async (message, sender, context) => {
      return await handleGetWebVitals(message.filters, context);
    },
  ],

  [
    "getRecentErrors",
    async (message, sender, context) => {
      return await handleGetRecentErrors(message.limit, context);
    },
  ],

  [
    "getRecentRequests",
    async (message, sender, context) => {
      return await handleGetRecentRequests(message.limit, context);
    },
  ],
]);
