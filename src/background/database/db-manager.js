// Database manager - handles all database operations

import { createTables } from "./schema.js";
import { migrateDatabase } from "./migrations.js";
import { DatabaseError } from "../errors/error-types.js";
import { initSqlJs } from "./sql-js-loader.js";
import { getConfig } from "../config/config-manager.js";

let db = null;
let encryptionManager = null;
let eventBus = null;
let isSaving = false;
let autoSaveInterval = null;
const DB_FILE_NAME = "universal_request_analyzer.sqlite";
let configManager = null;

// Helper function for conditional console logging
async function log(level, ...args) {
  const config = configManager ? await configManager.getConfig() : {};
  if (config.enableConsoleLogging !== false) {
    console[level](...args);
  }
}

// Helper function to map SQL result rows to objects
function mapRowsToObjects(result) {
  if (!result || !result.columns || !result.values) {
    return [];
  }
  return result.values.map(row => {
    const obj = {};
    result.columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}

async function loadDatabaseFromOPFS() {
  try {
    const fsHandle = await navigator.storage.getDirectory();
    const fileHandle = await fsHandle.getFileHandle(DB_FILE_NAME, {
      create: true,
    });
    const file = await fileHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    log("warn", "Failed to load database from OPFS. Creating a new one.", error);
    return null;
  }
}

async function saveDatabaseToOPFS(data) {
  try {
    const fsHandle = await navigator.storage.getDirectory();
    const fileHandle = await fsHandle.getFileHandle(DB_FILE_NAME, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    log("info", "Database saved to OPFS.");
  } catch (error) {
    log("error", "Failed to save database to OPFS.", error);
  }
}

// Add a function to log errors into the database
export async function logErrorToDatabase(dbInstance, error) {
  if (!dbInstance || typeof dbInstance.exec !== "function") {
    log("error", "Database is not initialized or invalid. Cannot log error.");
    return;
  }

  const config = configManager ? await configManager.getConfig() : {};
  if (!config.logErrorsToDatabase) {
    return;
  }

  try {
    const tableCheck = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='errors'");
    if (!tableCheck[0] || !tableCheck[0].values.length === 0) {
      log("warn", "Errors table does not exist. Cannot log error.");
      return;
    }

    dbInstance.exec(
      `INSERT INTO errors (category, message, stack, timestamp, context) VALUES (?, ?, ?, ?, ?)`,
      [
        error.name || "UnknownError",
        error.message || "",
        error.stack || "",
        Date.now(),
        error.context ? JSON.stringify(error.context) : null,
      ]
    );
  } catch (dbError) {
    log("error", "Failed to log error to database:", dbError);
  }
}

// Initialize the database
export async function initDatabase(dbConfig, encryptionMgr, events, configMgr) {
  try {
    encryptionManager = encryptionMgr;
    eventBus = events;
    configManager = configMgr;

    db = await initializeDatabase();

    setupAutoSave(db);

    eventBus.publish("database:ready", { timestamp: Date.now() });

    return createDbInterface();
  } catch (error) {
    log("error", "Failed to initialize database:", error);
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError("Failed to initialize database", error);
  }
}

// Vacuum database to optimize storage
function vacuumDatabase() {
  if (!db) return;

  try {
    db.exec("VACUUM");
    eventBus.publish("database:vacuumed", { timestamp: Date.now() });
    log("info", "[DB] Database vacuumed successfully.");
  } catch (error) {
    log("error", "Failed to vacuum database:", error);
    eventBus.publish("database:error", {
      error: "vacuum_failed",
      message: error.message,
    });
  }
}

// Execute a single query
function executeQuery(query, params = []) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }

  try {
    return db.exec(query, params);
  } catch (error) {
    log("error", "Query execution failed:", error, { query, params });
    logErrorToDatabase(db, new DatabaseError("Query execution failed", error));
    throw new DatabaseError("Query execution failed", error);
  }
}

// Execute multiple queries in a transaction
function executeTransaction(queries) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    throw new DatabaseError("Database not initialized");
  }

  try {
    db.exec("BEGIN TRANSACTION");

    for (const { query, params } of queries) {
      executeQuery(query, params);
    }

    db.exec("COMMIT");
    return true;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch (rollbackError) {
      const rbError = new DatabaseError("Rollback failed", rollbackError);
      log("error", "Rollback failed:", rollbackError);
      logErrorToDatabase(db, rbError);
    }
    const transactionError = error instanceof DatabaseError ? error : new DatabaseError("Transaction failed", error);
    logErrorToDatabase(db, transactionError);
    throw transactionError;
  }
}

// Get requests with pagination and filtering
function getRequests({ page = 1, limit = 100, filters = {} }) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }

  const offset = (page - 1) * limit;
  let query = `
    SELECT r.*, t.dns, t.tcp, t.ssl, t.ttfb, t.download
    FROM requests r
    LEFT JOIN request_timings t ON r.id = t.requestId
    WHERE 1=1
  `;

  const params = [];

  if (filters.domain) {
    query += " AND r.domain LIKE ?";
    params.push(`%${filters.domain}%`);
  }

  if (filters.status) {
    query += " AND r.status = ?";
    params.push(filters.status);
  }

  if (filters.type) {
    query += " AND r.type = ?";
    params.push(filters.type);
  }

  if (filters.startDate) {
    query += " AND r.timestamp >= ?";
    params.push(new Date(filters.startDate).getTime());
  }

  if (filters.endDate) {
    query += " AND r.timestamp <= ?";
    params.push(new Date(filters.endDate).getTime());
  }

  if (filters.url) {
    query += " AND r.url LIKE ?";
    params.push(`%${filters.url}%`);
  }

  if (filters.method) {
    query += " AND r.method = ?";
    params.push(filters.method);
  }

  query += " ORDER BY r.timestamp DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const results = executeQuery(query, params);

  let countQuery = `
    SELECT COUNT(*) as count
    FROM requests r
    WHERE 1=1
  `;

  if (filters.domain) {
    countQuery += " AND r.domain LIKE ?";
  }

  if (filters.status) {
    countQuery += " AND r.status = ?";
  }

  if (filters.type) {
    countQuery += " AND r.type = ?";
  }

  if (filters.startDate) {
    countQuery += " AND r.timestamp >= ?";
  }

  if (filters.endDate) {
    countQuery += " AND r.timestamp <= ?";
  }

  if (filters.url) {
    countQuery += " AND r.url LIKE ?";
  }

  if (filters.method) {
    countQuery += " AND r.method = ?";
  }

  const countResult = executeQuery(countQuery, params.slice(0, -2));

  // Map rows to objects using columns
  const requests = results[0] ? results[0].values.map(row => {
    const obj = {};
    results[0].columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  }) : [];

  return {
    requests,
    columns: results[0] ? results[0].columns : [],
    total: countResult[0] ? countResult[0].values[0][0] : 0,
    page,
    limit,
  };
}

// Save a request to the database
function saveRequest(requestData) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }

  try {
    db.exec(
      `
      INSERT OR REPLACE INTO requests (
        id, url, method, type, status, statusText, domain, path, 
        startTime, endTime, duration, size, timestamp, tabId, pageUrl, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        requestData.id,
        requestData.url,
        requestData.method,
        requestData.type,
        requestData.statusCode || 0,
        requestData.statusText || "",
        requestData.domain || "",
        requestData.path || "",
        requestData.timings?.startTime || 0,
        requestData.timings?.endTime || 0,
        requestData.timings?.duration || 0,
        requestData.size || 0,
        requestData.timestamp || Date.now(),
        requestData.tabId || 0,
        requestData.pageUrl || "",
        requestData.error || "",
      ]
    );

    eventBus.publish("request:saved", { id: requestData.id });
    log("info", `[DB] Request ${requestData.id} saved successfully.`);
    return true;
  } catch (error) {
    log("error", "Failed to save request:", error);
    throw new DatabaseError("Failed to save request", error);
  }
}

// Update an existing request
function updateRequest(id, updates) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }

  try {
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    values.push(id);

    db.exec(
      `
      UPDATE requests
      SET ${fields.join(", ")}
      WHERE id = ?
    `,
      values
    );

    eventBus.publish("request:updated", { id });
    log("info", `[DB] Request ${id} updated successfully.`);
    return true;
  } catch (error) {
    log("error", "Failed to update request:", error);
    throw new DatabaseError("Failed to update request", error);
  }
}

// Delete a request
function deleteRequest(id) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }

  try {
    db.exec("DELETE FROM request_headers WHERE requestId = ?", [id]);
    db.exec("DELETE FROM request_timings WHERE requestId = ?", [id]);
    db.exec("DELETE FROM requests WHERE id = ?", [id]);

    eventBus.publish("request:deleted", { id });
    log("info", `[DB] Request ${id} deleted successfully.`);
    return true;
  } catch (error) {
    log("error", "Failed to delete request:", error);
    throw new DatabaseError("Failed to delete request", error);
  }
}

// Get headers for a request
function getRequestHeaders(requestId) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }

  try {
    const result = executeQuery(
      "SELECT name, value FROM request_headers WHERE requestId = ?",
      [requestId]
    );

    if (!result[0]) return [];

    return result[0].values.map(([name, value]) => ({ name, value }));
  } catch (error) {
    log("error", "Failed to get request headers:", error);
    throw new DatabaseError("Failed to get request headers", error);
  }
}

// Get headers for a request (event-based wrapper)
export async function getRequestHeadersEventBased(requestId, requestIdForEvent) {
  try {
    const headers = getRequestHeaders(requestId);
    chrome.runtime.sendMessage({
      action: "getRequestHeadersResult",
      requestId: requestIdForEvent,
      success: true,
      headers
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      action: "getRequestHeadersResult",
      requestId: requestIdForEvent,
      success: false,
      error: error.message
    });
  }
}

// Save headers for a request
function saveRequestHeaders(requestId, headers) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }

  try {
    db.exec("DELETE FROM request_headers WHERE requestId = ?", [requestId]);

    for (const header of headers) {
      db.exec(
        "INSERT INTO request_headers (requestId, name, value) VALUES (?, ?, ?)",
        [requestId, header.name, header.value]
      );
    }

    log("info", `[DB] Headers for request ${requestId} saved successfully.`);
    return true;
  } catch (error) {
    log("error", "Failed to save request headers:", error);
    throw new DatabaseError("Failed to save request headers", error);
  }
}

// Get timing data for a request
function getRequestTimings(requestId) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }

  try {
    const result = executeQuery(
      "SELECT dns, tcp, ssl, ttfb, download FROM request_timings WHERE requestId = ?",
      [requestId]
    );

    if (!result[0] || !result[0].values.length) return null;

    const [dns, tcp, ssl, ttfb, download] = result[0].values[0];
    return { dns, tcp, ssl, ttfb, download };
  } catch (error) {
    log("error", "Failed to get request timings:", error);
    throw new DatabaseError("Failed to get request timings", error);
  }
}

// Get timing data for a request (event-based wrapper)
export async function getRequestTimingsEventBased(requestId, requestIdForEvent) {
  try {
    const timings = getRequestTimings(requestId);
    chrome.runtime.sendMessage({
      action: "getRequestTimingsResult",
      requestId: requestIdForEvent,
      success: true,
      timings
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      action: "getRequestTimingsResult",
      requestId: requestIdForEvent,
      success: false,
      error: error.message
    });
  }
}

// Save timing data for a request
function saveRequestTimings(requestId, timings) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }

  try {
    executeQuery(
      `
      INSERT OR REPLACE INTO request_timings (
        requestId, dns, tcp, ssl, ttfb, download
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        requestId,
        timings.dns || 0,
        timings.tcp || 0,
        timings.ssl || 0,
        timings.ttfb || 0,
        timings.download || 0,
      ]
    );

    log("info", `[DB] Timings for request ${requestId} saved successfully.`);
    return true;
  } catch (error) {
    log("error", "Failed to save request timings:", error);
    throw new DatabaseError("Failed to save request timings", error);
  }
}

// Save imported data (requests, headers, timings) in a transaction
async function saveImportedData(data) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    throw new DatabaseError("Database not initialized");
  }

  try {
    db.exec("BEGIN TRANSACTION");

    const requestStmt = db.prepare(`
      INSERT OR IGNORE INTO requests (
        id, url, method, type, status, statusText, domain, path,
        startTime, endTime, duration, size, timestamp, tabId, pageUrl, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    data.requests.forEach(req => {
      requestStmt.run([
        req.id,
        req.url,
        req.method,
        req.type,
        req.status || 0,
        req.statusText || "",
        req.domain || "",
        req.path || "",
        req.startTime || 0,
        req.endTime || 0,
        req.duration || 0,
        req.size || 0,
        req.timestamp || Date.now(),
        req.tabId || 0,
        req.pageUrl || "",
        req.error || "",
      ]);
    });
    requestStmt.free();

    const headerStmt = db.prepare(
      "INSERT OR IGNORE INTO request_headers (requestId, name, value) VALUES (?, ?, ?)"
    );
    data.headers.forEach(header => {
      headerStmt.run([header.requestId, header.name, header.value]);
    });
    headerStmt.free();

    const timingStmt = db.prepare(`
      INSERT OR IGNORE INTO request_timings (
        requestId, dns, tcp, ssl, ttfb, download
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    data.timings.forEach(timing => {
      timingStmt.run([
        timing.requestId,
        timing.dns || 0,
        timing.tcp || 0,
        timing.ssl || 0,
        timing.ttfb || 0,
        timing.download || 0,
      ]);
    });
    timingStmt.free();

    db.exec("COMMIT");
    eventBus.publish("database:imported", { count: data.requests.length });
    log("info", `[DB] Successfully imported ${data.requests.length} requests.`);
    return { success: true, count: data.requests.length };

  } catch (error) {
    log("error", "Failed to save imported data:", error);
    try {
      db.exec("ROLLBACK");
    } catch (rollbackError) {
      log("error", "Rollback failed:", rollbackError);
      logErrorToDatabase(db, new DatabaseError("Rollback failed during import", rollbackError));
    }
    const importError = new DatabaseError("Failed to save imported data", error);
    logErrorToDatabase(db, importError);
    throw importError;
  }
}

// Get database size in bytes
async function getDatabaseSize() {
  if (!db) return 0;
  try {
    const data = db.export();
    return data.byteLength;
  } catch (error) {
    log("error", "Failed to get database size:", error);
    return 0;
  }
}

// Get database statistics
async function getDatabaseStats() {
  if (!db) {
    return { size: 0, requestCount: 0 };
  }
  try {
    const size = await getDatabaseSize();
    const countResult = executeQuery("SELECT COUNT(*) FROM requests", []);
    const requestCount = countResult[0]?.values[0]?.[0] || 0;
    return { size, requestCount };
  } catch (error) {
    log("error", "Failed to get database stats:", error);
    return { size: 0, requestCount: 0 };
  }
}

// Get filtered database statistics
async function getFilteredStats(filters = {}) {
  if (!db) {
    return { error: "Database not initialized" };
  }
  try {
    const params = [];
    let whereClause = "WHERE 1=1";
    if (filters.domain) {
      whereClause += " AND domain LIKE ?";
      params.push(`%${filters.domain}%`);
    }
    const size = await getDatabaseSize();
    const countResult = executeQuery(`SELECT COUNT(*) FROM requests ${whereClause}`, params);
    const requestCount = countResult[0]?.values[0]?.[0] || 0;
    const avgDurationResult = executeQuery(`SELECT AVG(duration) FROM requests ${whereClause} AND duration > 0`, params);
    const avgResponseTime = avgDurationResult[0]?.values[0]?.[0] || 0;
    const successCountResult = executeQuery(`SELECT COUNT(*) FROM requests ${whereClause} AND status >= 200 AND status < 300`, params);
    const successCount = successCountResult[0]?.values[0]?.[0] || 0;
    const errorCountResult = executeQuery(`SELECT COUNT(*) FROM requests ${whereClause} AND status >= 400`, params);
    const errorCount = errorCountResult[0]?.values[0]?.[0] || 0;
    const statusCodesResult = executeQuery(`SELECT status, COUNT(*) as count FROM requests ${whereClause} GROUP BY status ORDER BY count DESC`, params);
    const statusCodes = mapRowsToObjects(statusCodesResult[0]);
    const typesResult = executeQuery(`SELECT type, COUNT(*) as count FROM requests ${whereClause} GROUP BY type ORDER BY count DESC`, params);
    const requestTypes = mapRowsToObjects(typesResult[0]);

    // --- Response Time Time Series (group by minute) ---
    const timeSeriesResult = executeQuery(`SELECT strftime('%H:%M', datetime(timestamp/1000, 'unixepoch')) as time, AVG(duration) as avgDuration, COUNT(*) as count FROM requests ${whereClause} GROUP BY time ORDER BY time`, params);
    const timeSeries = mapRowsToObjects(timeSeriesResult[0]);

    // --- Time Distribution Histogram ---
    const timeBins = [0,100,300,500,1000,2000,5000,10000];
    const timeCounts = [];
    for (let i = 0; i < timeBins.length; i++) {
      const min = timeBins[i];
      const max = timeBins[i+1] || 1e9;
      const countRes = executeQuery(`SELECT COUNT(*) as count FROM requests ${whereClause} AND duration >= ? AND duration < ?`, [...params, min, max]);
      timeCounts.push(countRes[0]?.values[0]?.[0] || 0);
    }
    const timeDistribution = { bins: timeBins, counts: timeCounts };

    // --- Size Distribution Histogram ---
    const sizeBins = [0,1024,10*1024,100*1024,1024*1024,10*1024*1024];
    const sizeCounts = [];
    for (let i = 0; i < sizeBins.length; i++) {
      const min = sizeBins[i];
      const max = sizeBins[i+1] || 1e12;
      const countRes = executeQuery(`SELECT COUNT(*) as count FROM requests ${whereClause} AND size >= ? AND size < ?`, [...params, min, max]);
      sizeCounts.push(countRes[0]?.values[0]?.[0] || 0);
    }
    const sizeDistribution = { bins: sizeBins, counts: sizeCounts };

    // --- Response Times Data (for legacy support) ---
    const timesResult = executeQuery(`SELECT timestamp, duration FROM requests ${whereClause} ORDER BY timestamp DESC LIMIT 100`, params);
    const responseTimes = mapRowsToObjects(timesResult[0]).reverse();
    const responseTimesData = {
      timestamps: responseTimes.map(r => new Date(r.timestamp).toLocaleTimeString()),
      durations: responseTimes.map(r => r.duration),
    };

    return {
      size,
      requestCount,
      avgResponseTime,
      successCount,
      errorCount,
      successRate: requestCount > 0 ? (successCount / requestCount) * 100 : 0,
      statusCodes: statusCodes || [],
      requestTypes: requestTypes || [],
      timeSeries: timeSeries || [],
      timeDistribution,
      sizeDistribution,
      responseTimesData,
    };
  } catch (error) {
    log("error", "Failed to get filtered database stats:", error);
    return { error: "Failed to get filtered stats" };
  }
}

// Get distinct domains
async function getDistinctDomains() {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return [];
  }
  try {
    const result = executeQuery("SELECT DISTINCT domain FROM requests WHERE domain IS NOT NULL AND domain != '' ORDER BY domain");
    if (!result[0] || !result[0].values) {
      return [];
    }
    return result[0].values.map(row => row[0]);
  } catch (error) {
    log("error", "Failed to get distinct domains:", error);
    throw new DatabaseError("Failed to get distinct domains", error);
  }
}

// Add this function to support analytics tab distinct value queries
function getDistinctValues(field, filters = {}) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return [];
  }
  try {
    let query = `SELECT DISTINCT ${field} FROM requests WHERE 1=1`;
    const params = [];
    // Optionally add filter support here if needed
    if (filters.domain) {
      query += " AND domain LIKE ?";
      params.push(`%${filters.domain}%`);
    }
    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }
    if (filters.type) {
      query += " AND type = ?";
      params.push(filters.type);
    }
    if (filters.startDate) {
      query += " AND timestamp >= ?";
      params.push(new Date(filters.startDate).getTime());
    }
    if (filters.endDate) {
      query += " AND timestamp <= ?";
      params.push(new Date(filters.endDate).getTime());
    }
    if (filters.url) {
      query += " AND url LIKE ?";
      params.push(`%${filters.url}%`);
    }
    if (filters.method) {
      query += " AND method = ?";
      params.push(filters.method);
    }
    query += ` ORDER BY ${field}`;
    const result = executeQuery(query, params);
    if (!result[0] || !result[0].values) {
      return [];
    }
    return result[0].values.map(row => row[0]);
  } catch (error) {
    log("error", `Failed to get distinct values for field ${field}:`, error);
    return [];
  }
}

// Export database in various formats
async function exportDatabase(format) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    throw new DatabaseError("Database not initialized");
  }

  try {
    switch (format) {
      case "sqlite":
        return db.export();

      case "json":
        const requests = executeQuery("SELECT * FROM requests", []);
        const timings = executeQuery("SELECT * FROM request_timings", []);
        const headers = executeQuery("SELECT * FROM request_headers", []);
        const stats = await getDatabaseStats();

        return JSON.stringify(
          {
            metadata: {
              exportDate: new Date().toISOString(),
              requestCount: stats.requestCount,
            },
            requests: requests?.[0] ? mapRowsToObjects(requests[0]) : [],
            timings: timings?.[0] ? mapRowsToObjects(timings[0]) : [],
            headers: headers?.[0] ? mapRowsToObjects(headers[0]) : [],
          },
          null,
          2
        );

      case "csv":
        const csvQuery = `
          SELECT r.*, t.dns, t.tcp, t.ssl, t.ttfb, t.download
          FROM requests r
          LEFT JOIN request_timings t ON r.id = t.requestId
        `;
        const result = executeQuery(csvQuery, []);

        if (!result[0]) return "";

        const columns = result[0].columns;
        let csv = columns.join(",") + "\n";

        result[0].values.forEach((row) => {
          const escapedRow = row.map((field) => {
            if (field === null || field === undefined) return "";
            const str = String(field);
            if (str.includes(",") || str.includes("\n") || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          });
          csv += escapedRow.join(",") + "\n";
        });

        return csv;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  } catch (error) {
    log("error", `Failed to export database as ${format}:`, error);
    const exportError = new DatabaseError(`Failed to export database as ${format}`, error);
    logErrorToDatabase(db, exportError);
    throw exportError;
  }
}

// Clear all data from the database
async function clearDatabase() {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    throw new DatabaseError("Database not initialized");
  }

  try {
    const tablesResult = executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const tables = tablesResult[0]?.values.map(row => row[0]) || [];

    db.exec("BEGIN TRANSACTION");
    for (const table of tables) {
      executeQuery(`DELETE FROM ${table};`);
    }
    executeQuery("VACUUM;");
    db.exec("COMMIT");

    eventBus.publish("database:cleared", { timestamp: Date.now() });

    await getDatabaseStats();

    log("info", "[DB] Database cleared successfully.");
    return true;
  } catch (error) {
    log("error", "Failed to clear database:", error);
    try { db.exec("ROLLBACK"); } catch (rbError) { }
    const clearError = new DatabaseError("Failed to clear database", error);
    logErrorToDatabase(db, clearError);
    throw clearError;
  }
}

// Replace the current database with data from a Uint8Array (SQLite file)
async function replaceDatabase(dataBuffer) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    throw new DatabaseError("Database not initialized");
  }

  isSaving = true;
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }

  try {
    db.close();
    db = null;

    const SQL = await initSqlJs();
    db = new SQL.Database(dataBuffer);

    await migrateDatabase(db);

    const data = db.export();
    await saveDatabaseToOPFS(data);

    setupAutoSave(db);

    eventBus.publish("database:replaced", { timestamp: Date.now() });
    log("info", "[DB] Database replaced successfully.");
    return true;
  } catch (error) {
    log("error", "Failed to replace database:", error);
    db = null;
    const replaceError = new DatabaseError("Failed to replace database", error);
    eventBus.publish("database:error", {
      error: "replace_failed",
      message: error.message,
    });
    throw replaceError;
  } finally {
    isSaving = false;
    if (db && !autoSaveInterval) {
      setupAutoSave(db);
    }
  }
}

// Encrypt the database with a new key
function encryptDatabase(key) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }
  if (!encryptionManager)
    throw new DatabaseError("Encryption manager not initialized");

  try {
    encryptionManager.setKey(key);
    encryptionManager.enable();

    const data = db.export();
    saveDatabaseToOPFS(data);

    eventBus.publish("database:encrypted", { timestamp: Date.now() });
    log("info", "[DB] Database encrypted successfully.");
    return true;
  } catch (error) {
    log("error", "Failed to encrypt database:", error);
    throw new DatabaseError("Failed to encrypt database", error);
  }
}

// Decrypt the database
function decryptDatabase(key) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }
  if (!encryptionManager)
    throw new DatabaseError("Encryption manager not initialized");

  try {
    encryptionManager.setKey(key);
    encryptionManager.disable();

    const data = db.export();
    saveDatabaseToOPFS(data);

    eventBus.publish("database:decrypted", { timestamp: Date.now() });
    log("info", "[DB] Database decrypted successfully.");
    return true;
  } catch (error) {
    log("error", "Failed to decrypt database:", error);
    throw new DatabaseError("Failed to decrypt database", error);
  }
}

// Create a backup of the database (save to backups table)
async function backupDatabase(meta = {}) {
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    throw new DatabaseError("Database not initialized");
  }
  try {
    const data = db.export();
    const timestamp = Date.now();
    const backupKey = `database_backup_${new Date(timestamp).toISOString().replace(/[:.]/g, "-")}`;
    const size = data.length;
    db.exec(
      `INSERT INTO backups (key, data, createdAt, size, meta) VALUES (?, ?, ?, ?, ?)`,
      [backupKey, data, timestamp, size, JSON.stringify(meta)]
    );
    eventBus && eventBus.publish("database:backup_created", {
      timestamp,
      backupKey,
      size,
      meta
    });
    log("info", `[DB] Backup created with key: ${backupKey}`);
    return backupKey;
  } catch (error) {
    log("error", "Failed to backup database:", error);
    throw new DatabaseError("Failed to backup database", error);
  }
}

// List all backups from the backups table
async function getBackupList() {
  if (!db) throw new DatabaseError("Database not initialized");
  try {
    const result = executeQuery("SELECT key, createdAt, size, meta FROM backups ORDER BY createdAt DESC");
    return result[0] ? mapRowsToObjects(result[0]) : [];
  } catch (error) {
    log("error", "Failed to get backup list:", error);
    throw new DatabaseError("Failed to get backup list", error);
  }
}

// Delete a backup from the backups table
async function deleteBackup(key) {
  if (!db) throw new DatabaseError("Database not initialized");
  try {
    db.exec("DELETE FROM backups WHERE key = ?", [key]);
    eventBus && eventBus.publish("database:backup_deleted", { key, timestamp: Date.now() });
    log("info", `[DB] Backup deleted: ${key}`);
    return true;
  } catch (error) {
    log("error", "Failed to delete backup:", error);
    throw new DatabaseError("Failed to delete backup", error);
  }
}

// Initialize the database with proper handling of OPFS

export async function initializeDatabase() {
  let retries = 3;
  while (retries > 0) {
    try {
      log("info", "Initializing database...");
      const SQL = await initSqlJs({ locateFile: file => `assets/wasm/${file}` });
      let dbInstance = null;
      let dbData = null;

      dbData = await loadDatabaseFromOPFS();

      if (dbData && dbData.length > 0) {
        log("info", `Loaded database from OPFS (${dbData.length} bytes).`);
        dbInstance = new SQL.Database(dbData);
        log("info", "Database instance created from OPFS data.");
      } else {
        log("info", "No existing database found in OPFS, creating new one.");
        dbInstance = new SQL.Database();
        log("info", "New database instance created.");
        await createTables(dbInstance);
        const initialData = dbInstance.export();
        await saveDatabaseToOPFS(initialData);
      }

      await migrateDatabase(dbInstance);

      setupAutoSave(dbInstance);

      log("info", "Database initialized successfully.");
      db = dbInstance;
      return dbInstance;

    } catch (error) {
      log("error", `Database initialization failed: ${error.message}. Retries left: ${retries - 1}`);
      retries--;
      if (retries === 0) {
        logErrorToDatabase(db, error);
        eventBus.publish("database:error", {
          error: "init_failed",
          message: error.message,
        });
        throw new DatabaseError("Database initialization failed after multiple retries", error);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Setup auto-save interval
function setupAutoSave(dbInstance = db) {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }
  const interval = configManager?.getConfig()?.autoSaveInterval || 60000;

  autoSaveInterval = setInterval(async () => {
    if (!isSaving && dbInstance) {
      isSaving = true;
      try {
        const data = dbInstance.export();
        await saveDatabaseToOPFS(data);
      } catch (error) {
        log("error", "Auto-save failed:", error);
        logErrorToDatabase(dbInstance, new DatabaseError("Auto-save failed", error));
        eventBus.publish("database:error", {
          error: "autosave_failed",
          message: error.message,
        });
      } finally {
        isSaving = false;
      }
    }
  }, interval);
  log("info", `Database auto-save configured with interval: ${interval / 1000}s`);
}

// Stops the auto-save interval and cleans up resources
export async function cleanupDatabase() {
  log("info", "Cleaning up database resources...");
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
    log("info", "Auto-save interval cleared.");
  }
  if (db) {
    try {
      if (!isSaving) {
        log("info", "Performing final save before closing DB...");
        const data = db.export();
        await saveDatabaseToOPFS(data);
      }
      db.close();
      db = null;
      log("info", "Database connection closed.");
    } catch (error) {
      log("error", "Error closing database:", error);
      db = null;
    }
  }
}

// Add helper functions if they don't exist
async function getRequestCount() {
  if (!db) return 0;
  try {
    const result = executeQuery("SELECT COUNT(*) FROM requests");
    return result[0]?.values[0]?.[0] || 0;
  } catch (error) {
    log("error", "Failed to get request count:", error);
    return 0;
  }
}

async function getTableColumns(tableName) {
  if (!db) return [];
  try {
    const result = executeQuery(`PRAGMA table_info(${tableName})`);
    if (result[0] && result[0].values) {
      return result[0].values.map(colInfo => colInfo[1]);
    }
    const sample = executeQuery(`SELECT * FROM ${tableName} LIMIT 0`);
    if (sample[0] && sample[0].columns) {
      return sample[0].columns;
    }
    return [];
  } catch (error) {
    log("error", `Failed to get columns for table ${tableName}:`, error);
    return [];
  }
}

// Get database schema summary (table names and row counts)
function getDatabaseSchemaSummary() {
  if (!db) {
    throw new DatabaseError("Database not initialized");
  }
  try {
    const tablesResult = executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    if (!tablesResult[0] || !tablesResult[0].values) {
      return [];
    }
    const tables = tablesResult[0].values.map(row => row[0]);
    const summary = [];
    for (const tableName of tables) {
      try {
        const countResult = executeQuery(`SELECT COUNT(*) FROM ${tableName};`);
        const rowCount = countResult[0]?.values[0]?.[0] || 0;
        summary.push({ name: tableName, rows: rowCount });
      } catch (countError) {
        log("warn", `Could not get row count for table ${tableName}:`, countError);
        summary.push({ name: tableName, rows: 'Error' });
      }
    }
    return summary;
  } catch (error) {
    log("error", "Failed to get database schema summary:", error);
    throw new DatabaseError("Failed to get database schema summary", error);
  }
}

// Get logged errors from the errors table
function getLoggedErrors(limit = 100) {
  if (!db) {
    throw new DatabaseError("Database not initialized");
  }
  try {
    const tableCheck = executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='errors'");
    if (!tableCheck[0] || !tableCheck[0].values.length === 0) {
      log("info", "Errors table does not exist. No errors to fetch.");
      return [];
    }
    const result = executeQuery(`SELECT id, category, message, stack, timestamp, context FROM errors ORDER BY timestamp DESC LIMIT ${limit}`);
    return result[0] ? mapRowsToObjects(result[0]) : [];
  } catch (error) {
    log("error", "Failed to get logged errors:", error);
    return [];
  }
}

// --- SQL Query History (persisted in database) ---
const MAX_HISTORY = 10;

async function saveSqlToHistoryDb(sql, success, errorMessage, durationMs) {
  if (!db) return;
  try {
    db.exec(
      `INSERT INTO sql_history (query, executed_at, success, error_message, duration_ms) VALUES (?, ?, ?, ?, ?)`,
      [sql, Date.now(), success ? 1 : 0, errorMessage || null, durationMs || null]
    );
  } catch (e) {
    log("warn", "Failed to save SQL to history table", e);
  }
}

function getSqlHistory(limit = MAX_HISTORY) {
  if (!db) return [];
  try {
    const result = executeQuery(
      `SELECT id, query, executed_at, success, error_message, duration_ms FROM sql_history ORDER BY executed_at DESC LIMIT ?`,
      [limit]
    );
    return result[0] ? mapRowsToObjects(result[0]) : [];
  } catch (e) {
    log("warn", "Failed to fetch SQL history from table", e);
    return [];
  }
}

// --- Enhanced Raw SQL Execution: Multi-statement, CSV export ---
async function executeRawSql(sql, opts = {}) {
  if (!db) {
    log("error", "executeRawSql: Database is not initialized.");
    throw new DatabaseError("Database is not initialized");
  }
  const lowerSql = sql.toLowerCase().trim();
  const allowed = [
    "select", "pragma", "explain", "insert", "update", "delete", "create", "drop", "alter", "replace", "vacuum", "begin", "commit", "rollback"
  ];
  const statements = lowerSql
    .split(';')
    .map(s => s.replace(/--.*$/gm, '').trim())
    .filter(Boolean);
  let affectedRows = 0;
  for (const stmt of statements) {
    const firstWord = stmt.split(/\s+/)[0];
    if (!allowed.includes(firstWord)) {
      const securityError = new DatabaseError(`Raw SQL execution denied for non-allowed query type.`);
      log("warn", "Attempting to execute potentially harmful SQL:", stmt);
      try { await logErrorToDatabase(db, securityError); } catch {}
      await saveSqlToHistoryDb(sql, false, securityError.message, null);
      throw securityError;
    }
  }
  // Save to history (with status)
  const start = Date.now();
  try {
    let results = [];
    db.exec("BEGIN TRANSACTION");
    for (const stmt of statements) {
      if (stmt) {
        const res = executeQuery(stmt, []);
        if (res) results = results.concat(res);
        // For non-select, count affected rows
        if (["update", "delete", "insert", "replace", "create", "drop", "alter"].includes(stmt.split(/\s+/)[0])) {
          if (typeof db.getRowsModified === "function") {
            affectedRows += db.getRowsModified();
          }
        }
      }
    }
    db.exec("COMMIT");
    const duration = Date.now() - start;
    await saveSqlToHistoryDb(sql, true, null, duration);
    const mappedResults = results.map(result => ({
      columns: result.columns || [],
      values: result.values || []
    }));
    if (opts.exportCsv && mappedResults[0]) {
      const columns = mappedResults[0].columns;
      let csv = columns.join(",") + "\n";
      mappedResults[0].values.forEach(row => {
        const escapedRow = row.map(field => {
          if (field === null || field === undefined) return "";
          const str = String(field);
          if (str.includes(",") || str.includes("\n") || str.includes('"')) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        });
        csv += escapedRow.join(",") + "\n";
      });
      return { csv, mappedResults, affectedRows };
    }
    // Return affectedRows for non-select queries
    return mappedResults.length ? mappedResults : { affectedRows };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    log("error", "Raw SQL execution failed:", error.message, { sql });
    await saveSqlToHistoryDb(sql, false, error.message, null);
    throw new DatabaseError(`Raw SQL execution failed: ${error.message || 'Unknown reason'}`, error);
  }
}

// --- Config Table Persistence ---

/**
 * Save the config object to the config table in the database.
 * @param {object} config - The configuration object to save.
 * @param {string} [key='main'] - The config key (default: 'main').
 */
export function saveConfigToDb(config, key = 'main') {
  if (!db) throw new DatabaseError('Database not initialized');
  try {
    db.exec(
      `INSERT OR REPLACE INTO config (key, value, updatedAt) VALUES (?, ?, ?)`,
      [key, JSON.stringify(config), Date.now()]
    );
    eventBus && eventBus.publish('config:saved', { key, timestamp: Date.now() });
    log('info', `[DB] Config saved to DB (key: ${key})`);
    return true;
  } catch (error) {
    log('error', 'Failed to save config to DB:', error);
    throw new DatabaseError('Failed to save config to DB', error);
  }
}

/**
 * Load the config object from the config table in the database.
 * @param {string} [key='main'] - The config key (default: 'main').
 * @returns {object|null}
 */
export function loadConfigFromDb(key = 'main') {
  if (!db) throw new DatabaseError('Database not initialized');
  try {
    const result = executeQuery('SELECT value FROM config WHERE key = ?', [key]);
    if (result[0] && result[0].values.length > 0) {
      return JSON.parse(result[0].values[0][0]);
    }
    return null;
  } catch (error) {
    log('error', 'Failed to load config from DB:', error);
    return null;
  }
}

/**
 * Update the config object in the config table in the database.
 * @param {object} newConfig - The new configuration object to merge and update.
 * @param {string} [key='main'] - The config key (default: 'main').
 */
export function updateConfigInDb(newConfig, key = 'main') {
  if (!db) throw new DatabaseError('Database not initialized');
  try {
    const current = loadConfigFromDb(key) || {};
    const updated = { ...current, ...newConfig };
    saveConfigToDb(updated, key);
    eventBus && eventBus.publish('config:updated', { key, timestamp: Date.now() });
    log('info', `[DB] Config updated in DB (key: ${key})`);
    return true;
  } catch (error) {
    log('error', 'Failed to update config in DB:', error);
    throw new DatabaseError('Failed to update config in DB', error);
  }
}

// API performance over time for a domain: { [path]: [{time, duration}, ...] }
async function getApiPerformanceOverTime(filters = {}) {
  if (!db) {
    return { error: "Database not initialized" };
  }
  try {
    const params = [];
    let whereClause = "WHERE 1=1";
    if (filters.domain) {
      whereClause += " AND domain = ?";
      params.push(filters.domain);
    }
    if (filters.pageUrl) {
      whereClause += " AND pageUrl = ?";
      params.push(filters.pageUrl);
    }
    if (filters.method) {
      whereClause += " AND method = ?";
      params.push(filters.method);
    }
    if (filters.type) {
      whereClause += " AND type = ?";
      params.push(filters.type);
    }
    if (filters.startDate) {
      whereClause += " AND timestamp >= ?";
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += " AND timestamp <= ?";
      params.push(filters.endDate);
    }
    if (filters.minTime) {
      whereClause += " AND duration >= ?";
      params.push(filters.minTime);
    }
    if (filters.maxTime) {
      whereClause += " AND duration <= ?";
      params.push(filters.maxTime);
    }
    if (filters.avgTime) {
      // Only include requests where the duration is within a small window of avgTime (e.g., ±10ms)
      whereClause += " AND ABS(duration - ?) <= 10";
      params.push(filters.avgTime);
    }
    // Group by path and time bucket (minute)
    const result = executeQuery(
      `SELECT path, 
              (timestamp / 60000) * 60000 as time, 
              COUNT(*) as count, 
              AVG(duration) as avgDuration, 
              MIN(duration) as minDuration, 
              MAX(duration) as maxDuration
       FROM requests 
       ${whereClause}
       GROUP BY path, time
       ORDER BY path, time ASC`,
      params
    );
    const rows = mapRowsToObjects(result[0]);
    // Debug: log number of rows found
    if (typeof console !== 'undefined') {
      console.log('[DB] getApiPerformanceOverTime rows:', rows.length, 'filters:', filters);
    }
    // Group by path
    const apiOverTime = {};
    rows.forEach(row => {
      if (!apiOverTime[row.path]) apiOverTime[row.path] = [];
      apiOverTime[row.path].push({
        time: row.time,
        count: row.count,
        avgDuration: row.avgDuration,
        minDuration: row.minDuration,
        maxDuration: row.maxDuration
      });
    });
    return { apiOverTime };
  } catch (err) {
    return { error: err.message || 'Failed to load API performance data' };
  }
}

async function clearRequests(){
  //clears this tables in db
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }
  try {
    db.exec("DELETE FROM requests");
    db.exec("DELETE FROM request_headers");
    db.exec("DELETE FROM request_timings");
    db.exec("DELETE FROM errors");
    db.exec("DELETE FROM sql_history");
    eventBus.publish("database:requests_cleared", { timestamp: Date.now() });
    log("info", "[DB] Requests cleared successfully.");
  } catch (error) {
    log("error", "Failed to clear requests:", error);
  }
}
async function clearHistoryLog() {
  //clears this tables in db
  if (!db) {
    log("error", "Database is not initialized or invalid.");
    return;
  }
  try {
    db.exec("DELETE FROM sql_history");
    eventBus.publish("database:history_log_cleared", { timestamp: Date.now() });
    log("info", "[DB] History log cleared successfully.");
  } catch (error) {
    log("error", "Failed to clear history log:", error);
  }
}
// Helper to create the returned DB interface object
function createDbInterface() {
  return {
    executeQuery,
    executeTransaction,
    getRequests,
    saveRequest,
    updateRequest,
    deleteRequest,
    getRequestHeaders,
    saveRequestHeaders,
    getRequestTimings,
    saveRequestTimings,
    saveImportedData,
    getDatabaseSize,
    getDatabaseStats,
    getFilteredStats,
    getDistinctDomains,
    getDistinctValues,
    exportDatabase,
    clearDatabase,
    encryptDatabase,
    decryptDatabase,
    backupDatabase,
    getBackupList,
    deleteBackup,
    replaceDatabase,
    vacuumDatabase,
    getRequestCount,
    getTableColumns,
    getDatabaseSchemaSummary,
    getLoggedErrors,
    executeRawSql,
    getSqlHistory,
    logError: (error) => logErrorToDatabase(db, error),
    close: cleanupDatabase,
    saveConfig: saveConfigToDb,
    loadConfig: loadConfigFromDb,
    updateConfig: updateConfigInDb,
    getApiPerformanceOverTime,
    clearRequests,
    clearHistoryLog
  };
}
