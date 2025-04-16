// Database manager - handles all database operations

import { createTables } from "./schema.js";
import { migrateDatabase } from "./migrations.js";
import { DatabaseError } from "../errors/error-types.js";
import { initSqlJs } from "./sql-js-loader.js";

let db = null;
let encryptionManager = null;
let eventBus = null;
const DB_FILE_NAME = "universal_request_analyzer.sqlite";

async function loadDatabaseFromOPFS() {
  try {
    const fsHandle = await navigator.storage.getDirectory();
    const fileHandle = await fsHandle.getFileHandle(DB_FILE_NAME, {
      create: true,
    });
    const file = await fileHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    console.warn(
      "Failed to load database from OPFS. Creating a new one.",
      error
    );
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
    console.log("Database saved to OPFS.");
  } catch (error) {
    console.error("Failed to save database to OPFS.", error);
  }
}

// Initialize the database
export async function initDatabase(dbConfig, encryptionMgr, events) {
  try {
    encryptionManager = encryptionMgr;
    eventBus = events;

    const SQL = await initSqlJs({
      locateFile: (file) => {
        if (typeof chrome !== "undefined" && chrome.runtime) {
          return chrome.runtime.getURL(`assets/wasm/${file}`);
        } else if (typeof browser !== "undefined" && browser.runtime) {
          return browser.runtime.getURL(`assets/wasm/${file}`);
        } else {
          console.warn(
            "chrome.runtime.getURL is not available. Using a fallback URL."
          );
          return `assets/wasm/${file}`;
        }
      },
    });

    const savedDb = await loadDatabaseFromOPFS();

    if (savedDb) {
      db = new SQL.Database(savedDb);
      console.log("Opened existing database from OPFS.");

      // Run migrations if needed
      try {
        await migrateDatabase(db);
      } catch (migrationError) {
        console.error("Database migration failed:", migrationError);
        throw new DatabaseError("Database migration failed", migrationError);
      }
    } else {
      db = new SQL.Database();
      console.log("Created new database.");

      // Create tables
      try {
        await createTables(db);
      } catch (tableCreationError) {
        console.error("Failed to create database tables:", tableCreationError);
        throw new DatabaseError(
          "Failed to create database tables",
          tableCreationError
        );
      }
    }

    // Set up auto-save interval
    setInterval(async () => {
      if (db) {
        try {
          const data = db.export();
          await saveDatabaseToOPFS(data);
        } catch (autoSaveError) {
          console.error("Auto-save failed:", autoSaveError);
        }
      }
    }, dbConfig.autoSaveInterval || 60000);

    // Publish database ready event
    eventBus.publish("database:ready", { timestamp: Date.now() });

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
      getDatabaseSize,
      getDatabaseStats,
      exportDatabase,
      clearDatabase,
      encryptDatabase,
      decryptDatabase,
      backupDatabase,
    };
  } catch (error) {
    console.error("Failed to initialize database:", error);
    if (error instanceof DatabaseError) {
      throw error; // Re-throw if it's already a DatabaseError
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
  } catch (error) {
    console.error("Failed to vacuum database:", error);
    eventBus.publish("database:error", {
      error: "vacuum_failed",
      message: error.message,
    });
  }
}

// Execute a single query
function executeQuery(query, params = []) {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    return db.exec(query, params);
  } catch (error) {
    console.error("Query execution failed:", error, { query, params });
    throw new DatabaseError("Query execution failed", error);
  }
}

// Execute multiple queries in a transaction
function executeTransaction(queries) {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    db.exec("BEGIN TRANSACTION");

    for (const { query, params } of queries) {
      db.exec(query, params);
    }

    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    console.error("Transaction failed:", error);
    throw new DatabaseError("Transaction failed", error);
  }
}

// Get requests with pagination and filtering
function getRequests({ page = 1, limit = 100, filters = {} }) {
  if (!db) throw new DatabaseError("Database not initialized");

  const offset = (page - 1) * limit;
  let query = `
    SELECT r.*, t.dns, t.tcp, t.ssl, t.ttfb, t.download
    FROM requests r
    LEFT JOIN request_timings t ON r.id = t.requestId
    WHERE 1=1
  `;

  const params = [];

  // Apply filters
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

  // Add order and pagination
  query += " ORDER BY r.timestamp DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  // Execute query
  const results = executeQuery(query, params);

  // Get total count for pagination
  let countQuery = `
    SELECT COUNT(*) as count
    FROM requests r
    WHERE 1=1
  `;

  // Apply the same filters to count query
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

  return {
    requests: results[0] ? results[0].values : [],
    columns: results[0] ? results[0].columns : [],
    total: countResult[0] ? countResult[0].values[0][0] : 0,
    page,
    limit,
  };
}

// Save a request to the database
function saveRequest(requestData) {
  if (!db) throw new DatabaseError("Database not initialized");

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
    return true;
  } catch (error) {
    console.error("Failed to save request:", error);
    throw new DatabaseError("Failed to save request", error);
  }
}

// Update an existing request
function updateRequest(id, updates) {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    // Build update query dynamically based on provided updates
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    // Add ID to values
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
    return true;
  } catch (error) {
    console.error("Failed to update request:", error);
    throw new DatabaseError("Failed to update request", error);
  }
}

// Delete a request
function deleteRequest(id) {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    // Delete related data first
    db.exec("DELETE FROM request_headers WHERE requestId = ?", [id]);
    db.exec("DELETE FROM request_timings WHERE requestId = ?", [id]);

    // Delete the request
    db.exec("DELETE FROM requests WHERE id = ?", [id]);

    eventBus.publish("request:deleted", { id });
    return true;
  } catch (error) {
    console.error("Failed to delete request:", error);
    throw new DatabaseError("Failed to delete request", error);
  }
}

// Get headers for a request
function getRequestHeaders(requestId) {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    const result = executeQuery(
      "SELECT name, value FROM request_headers WHERE requestId = ?",
      [requestId]
    );

    if (!result[0]) return [];

    return result[0].values.map(([name, value]) => ({ name, value }));
  } catch (error) {
    console.error("Failed to get request headers:", error);
    throw new DatabaseError("Failed to get request headers", error);
  }
}

// Save headers for a request
function saveRequestHeaders(requestId, headers) {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    // Delete existing headers first
    db.exec("DELETE FROM request_headers WHERE requestId = ?", [requestId]);

    // Insert new headers
    for (const header of headers) {
      db.exec(
        "INSERT INTO request_headers (requestId, name, value) VALUES (?, ?, ?)",
        [requestId, header.name, header.value]
      );
    }

    return true;
  } catch (error) {
    console.error("Failed to save request headers:", error);
    throw new DatabaseError("Failed to save request headers", error);
  }
}

// Get timing data for a request
function getRequestTimings(requestId) {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    const result = executeQuery(
      "SELECT dns, tcp, ssl, ttfb, download FROM request_timings WHERE requestId = ?",
      [requestId]
    );

    if (!result[0] || !result[0].values.length) return null;

    const [dns, tcp, ssl, ttfb, download] = result[0].values[0];
    return { dns, tcp, ssl, ttfb, download };
  } catch (error) {
    console.error("Failed to get request timings:", error);
    throw new DatabaseError("Failed to get request timings", error);
  }
}

// Save timing data for a request
function saveRequestTimings(requestId, timings) {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    db.exec(
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

    return true;
  } catch (error) {
    console.error("Failed to save request timings:", error);
    throw new DatabaseError("Failed to save request timings", error);
  }
}

// Get database size in bytes
function getDatabaseSize() {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    const data = db.export();
    return data.length;
  } catch (error) {
    console.error("Failed to get database size:", error);
    throw new DatabaseError("Failed to get database size", error);
  }
}

// Get database statistics
function getDatabaseStats() {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    const stats = {
      totalRequests: 0,
      avgResponseTime: 0,
      statusCodes: {},
      topDomains: [],
      requestTypes: {},
      timeDistribution: {},
    };

    // Get total requests
    const totalResult = executeQuery("SELECT COUNT(*) FROM requests");
    stats.totalRequests = totalResult[0] ? totalResult[0].values[0][0] : 0;

    // Get average response time
    const avgResult = executeQuery(
      "SELECT AVG(duration) FROM requests WHERE duration > 0"
    );
    stats.avgResponseTime = avgResult[0]
      ? Math.round(avgResult[0].values[0][0] || 0)
      : 0;

    // Get status code distribution
    const statusResult = executeQuery(`
      SELECT status, COUNT(*) as count
      FROM requests
      WHERE status > 0
      GROUP BY status
      ORDER BY count DESC
    `);

    if (statusResult[0]) {
      statusResult[0].values.forEach((row) => {
        stats.statusCodes[row[0]] = row[1];
      });
    }

    // Get top domains
    const domainResult = executeQuery(`
      SELECT domain, COUNT(*) as count
      FROM requests
      WHERE domain != ''
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 10
    `);

    if (domainResult[0]) {
      stats.topDomains = domainResult[0].values.map((row) => ({
        domain: row[0],
        count: row[1],
      }));
    }

    // Get request type distribution
    const typeResult = executeQuery(`
      SELECT type, COUNT(*) as count
      FROM requests
      GROUP BY type
      ORDER BY count DESC
    `);

    if (typeResult[0]) {
      typeResult[0].values.forEach((row) => {
        stats.requestTypes[row[0]] = row[1];
      });
    }

    // Get time distribution (last 24 hours by hour)
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const timeResult = executeQuery(`
      SELECT 
        CAST((timestamp - ${oneDayAgo}) / (3600 * 1000) AS INTEGER) as hour,
        COUNT(*) as count
      FROM requests
      WHERE timestamp >= ${oneDayAgo}
      GROUP BY hour
      ORDER BY hour
    `);

    if (timeResult[0]) {
      // Initialize all hours with 0
      for (let i = 0; i < 24; i++) {
        stats.timeDistribution[i] = 0;
      }

      // Fill in actual data
      timeResult[0].values.forEach((row) => {
        const hour = Math.min(Math.max(0, row[0]), 23);
        stats.timeDistribution[hour] = row[1];
      });
    }

    return stats;
  } catch (error) {
    console.error("Failed to get database stats:", error);
    throw new DatabaseError("Failed to get database stats", error);
  }
}

// Export database in various formats
function exportDatabase(format) {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    switch (format) {
      case "sqlite":
        return db.export();

      case "json":
        const requests = executeQuery("SELECT * FROM requests");
        const timings = executeQuery("SELECT * FROM request_timings");
        const headers = executeQuery("SELECT * FROM request_headers");

        return JSON.stringify(
          {
            requests: requests[0] ? requests[0].values : [],
            requestColumns: requests[0] ? requests[0].columns : [],
            timings: timings[0] ? timings[0].values : [],
            timingColumns: timings[0] ? timings[0].columns : [],
            headers: headers[0] ? headers[0].values : [],
            headerColumns: headers[0] ? headers[0].columns : [],
            exportDate: new Date().toISOString(),
          },
          null,
          2
        );

      case "csv":
        const result = executeQuery(`
          SELECT r.*, t.dns, t.tcp, t.ssl, t.ttfb, t.download
          FROM requests r
          LEFT JOIN request_timings t ON r.id = t.requestId
        `);

        if (!result[0]) return "";

        const columns = result[0].columns;
        let csv = columns.join(",") + "\n";

        result[0].values.forEach((row) => {
          // Escape fields that might contain commas
          const escapedRow = row.map((field) => {
            if (field === null || field === undefined) return "";
            const str = String(field);
            return str.includes(",") ? `"${str}"` : str;
          });

          csv += escapedRow.join(",") + "\n";
        });

        return csv;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  } catch (error) {
    console.error(`Failed to export database as ${format}:`, error);
    throw new DatabaseError(`Failed to export database as ${format}`, error);
  }
}

// Clear all data from the database
function clearDatabase() {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    db.exec("DELETE FROM request_headers");
    db.exec("DELETE FROM request_timings");
    db.exec("DELETE FROM requests");

    // Vacuum to reclaim space
    db.exec("VACUUM");

    eventBus.publish("database:cleared", { timestamp: Date.now() });
    return true;
  } catch (error) {
    console.error("Failed to clear database:", error);
    throw new DatabaseError("Failed to clear database", error);
  }
}

// Encrypt the database with a new key
function encryptDatabase(key) {
  if (!db) throw new DatabaseError("Database not initialized");
  if (!encryptionManager)
    throw new DatabaseError("Encryption manager not initialized");

  try {
    // Enable encryption with the provided key
    encryptionManager.setKey(key);
    encryptionManager.enable();

    // Save the database to apply encryption
    const data = db.export();
    saveDatabaseToOPFS(data);

    eventBus.publish("database:encrypted", { timestamp: Date.now() });
    return true;
  } catch (error) {
    console.error("Failed to encrypt database:", error);
    throw new DatabaseError("Failed to encrypt database", error);
  }
}

// Decrypt the database
function decryptDatabase(key) {
  if (!db) throw new DatabaseError("Database not initialized");
  if (!encryptionManager)
    throw new DatabaseError("Encryption manager not initialized");

  try {
    // Set the key and disable encryption
    encryptionManager.setKey(key);
    encryptionManager.disable();

    // Save the database to apply decryption
    const data = db.export();
    saveDatabaseToOPFS(data);

    eventBus.publish("database:decrypted", { timestamp: Date.now() });
    return true;
  } catch (error) {
    console.error("Failed to decrypt database:", error);
    throw new DatabaseError("Failed to decrypt database", error);
  }
}

// Create a backup of the database
function backupDatabase() {
  if (!db) throw new DatabaseError("Database not initialized");

  try {
    const data = db.export();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupKey = `database_backup_${timestamp}`;

    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      // Save backup to storage
      chrome.storage.local.set({ [backupKey]: data });

      eventBus.publish("database:backup_created", {
        timestamp: Date.now(),
        backupKey,
        size: data.length,
      });
    } else {
      console.warn("Chrome storage API not available.");
    }

    return backupKey;
  } catch (error) {
    console.error("Failed to backup database:", error);
    throw new DatabaseError("Failed to backup database", error);
  }
}
