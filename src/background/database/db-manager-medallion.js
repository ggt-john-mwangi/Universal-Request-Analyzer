// Updated Database Manager with Medallion Architecture Integration

import { initSqlJs } from "./sql-js-loader.js";
import { DatabaseError } from "../errors/error-types.js";
import {
  createMedallionSchema,
  initializeDefaultConfig,
  validateAndFixSchema,
} from "./medallion-schema.js";
import { createMedallionManager } from "./medallion-manager.js";
import { createConfigSchemaManager } from "./config-schema-manager.js";
import {
  migrateToMedallionArchitecture,
  isMedallionMigrationComplete,
  fixMissingDomains,
} from "./medallion-migration.js";

let db = null;
let medallionManager = null;
let configManager = null;
let eventBus = null;
let isSaving = false;
let autoSaveInterval = null;
const DB_FILE_NAME = "universal_request_analyzer.sqlite";

/**
 * Load database from OPFS (Origin Private File System)
 */
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

/**
 * Save database to OPFS
 */
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

/**
 * Initialize the database with medallion architecture
 */
async function initializeDatabase() {
  try {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    const data = await loadDatabaseFromOPFS();
    const dbInstance = data ? new SQL.Database(data) : new SQL.Database();

    // Check if medallion migration has been completed
    const migrationComplete = await isMedallionMigrationComplete(dbInstance);

    if (!migrationComplete) {
      console.log("Initializing medallion architecture...");

      // Create medallion schema
      await createMedallionSchema(dbInstance);
      await initializeDefaultConfig(dbInstance);

      // Migrate existing data if any
      await migrateToMedallionArchitecture(dbInstance, eventBus);
    } else {
      console.log("Medallion architecture already initialized");
    }

    // ALWAYS validate and fix schema (handles upgrades and schema changes)
    console.log("Validating database schema...");
    await validateAndFixSchema(dbInstance);

    // Fix any existing rows with missing domains (from before the fix)
    try {
      await fixMissingDomains(dbInstance);
    } catch (error) {
      console.warn("Failed to fix missing domains:", error);
      // Don't fail initialization if this fails
    }

    return dbInstance;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw new DatabaseError("Database initialization failed", error);
  }
}

/**
 * Setup auto-save mechanism
 */
function setupAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }

  // Auto-save every 30 seconds
  autoSaveInterval = setInterval(async () => {
    await saveDatabase();
  }, 30000);
}

/**
 * Save database to OPFS
 */
export async function saveDatabase() {
  if (!db || isSaving) {
    return;
  }

  try {
    isSaving = true;
    const data = db.export();
    await saveDatabaseToOPFS(data);

    eventBus?.publish("database:saved", { timestamp: Date.now() });
  } catch (error) {
    console.error("Failed to save database:", error);
    eventBus?.publish("database:error", {
      error: "save_failed",
      message: error.message,
    });
  } finally {
    isSaving = false;
  }
}

/**
 * Initialize the database manager
 */
export async function initDatabase(dbConfig, encryptionMgr, events) {
  try {
    eventBus = events;

    // Initialize database
    db = await initializeDatabase();

    // Initialize medallion manager
    medallionManager = createMedallionManager(db, eventBus);

    // Initialize config manager
    configManager = createConfigSchemaManager(db, eventBus);

    // Setup auto-save
    setupAutoSave();

    // Publish database ready event
    eventBus?.publish("database:ready", { timestamp: Date.now() });

    console.log("Database manager initialized with medallion architecture");

    // Return API
    return {
      // Core operations
      executeQuery,
      executeTransaction,
      saveDatabase,

      // Medallion operations
      medallion: medallionManager,
      config: configManager,

      // Legacy compatibility (delegates to medallion)
      getRequests: async (options) => getRequestsLegacy(options),
      saveRequest: async (request) => saveRequestLegacy(request),

      // Database management
      getDatabaseSize,
      getDatabaseStats,
      exportDatabase,
      importDatabase,
      clearDatabase,
      resetDatabase,
      cleanupOldRecords,
      previewCleanup,
      vacuumDatabase,
    };
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw new DatabaseError("Database initialization failed", error);
  }
}

/**
 * Execute a single query
 */
export function executeQuery(query, params = []) {
  if (!db) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    return db.exec(query, params);
  } catch (error) {
    console.error("Query execution failed:", error, { query, params });
    throw new DatabaseError("Query execution failed", error);
  }
}

/**
 * Execute multiple queries in a transaction
 */
export function executeTransaction(queries) {
  if (!db) {
    throw new DatabaseError("Database not initialized");
  }

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

/**
 * Legacy compatibility: Get requests
 */
async function getRequestsLegacy(options = {}) {
  const { page = 1, limit = 100, filters = {} } = options;

  const offset = (page - 1) * limit;

  // Query silver layer for enriched data
  let query = `
    SELECT * FROM silver_requests
    WHERE 1=1
  `;

  const params = [];

  // Apply filters
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
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    query += " AND timestamp <= ?";
    params.push(filters.endDate);
  }

  query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = executeQuery(query, params);

  if (!result || !result[0]) {
    return [];
  }

  return mapResultToArray(result[0]);
}

/**
 * Legacy compatibility: Save request
 */
async function saveRequestLegacy(request) {
  // Delegate to medallion manager
  return medallionManager.insertBronzeRequest(request);
}

/**
 * Get database size
 */
export function getDatabaseSize() {
  if (!db) {
    return 0;
  }

  try {
    const data = db.export();
    return data.length;
  } catch (error) {
    console.error("Failed to get database size:", error);
    return 0;
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats() {
  if (!db) {
    return null;
  }

  try {
    const stats = {
      size: getDatabaseSize(),
      tables: {},
      lastModified: Date.now(),
    };

    // Count rows in each layer
    const bronzeCount = executeQuery(
      "SELECT COUNT(*) as count FROM bronze_requests"
    );
    const silverCount = executeQuery(
      "SELECT COUNT(*) as count FROM silver_requests"
    );
    const goldCount = executeQuery(
      "SELECT COUNT(*) as count FROM gold_daily_analytics"
    );

    stats.tables.bronze = bronzeCount[0]?.values[0]?.[0] || 0;
    stats.tables.silver = silverCount[0]?.values[0]?.[0] || 0;
    stats.tables.gold = goldCount[0]?.values[0]?.[0] || 0;

    // Calculate total requests across all layers
    stats.totalRequests =
      stats.tables.bronze + stats.tables.silver + stats.tables.gold;

    // Get oldest record timestamp
    try {
      const oldestResult = executeQuery(
        "SELECT MIN(timestamp) as oldest FROM bronze_requests"
      );
      const oldestTimestamp = oldestResult[0]?.values[0]?.[0];
      if (oldestTimestamp) {
        stats.oldestDate = oldestTimestamp;
      }
    } catch (oldestError) {
      console.warn("Failed to get oldest record:", oldestError);
    }

    return stats;
  } catch (error) {
    console.error("Failed to get database stats:", error);
    return null;
  }
}

/**
 * Export database
 */
export function exportDatabase() {
  if (!db) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    const data = db.export();
    return new Uint8Array(data);
  } catch (error) {
    console.error("Failed to export database:", error);
    throw new DatabaseError("Export failed", error);
  }
}

/**
 * Import database from Uint8Array
 */
export async function importDatabase(uint8Array) {
  if (!SQL || !dbConfig) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    console.log("[DB] Importing database...");

    // Close current database
    if (db) {
      db.close();
    }

    // Create new database from imported data
    db = new SQL.Database(uint8Array);

    // Save to OPFS
    await saveToOPFS(db.export());

    console.log("[DB] Database imported successfully");

    return true;
  } catch (error) {
    console.error("Failed to import database:", error);
    throw new DatabaseError("Import failed", error);
  }
}

/**
 * Clear database (with confirmation)
 */
export async function clearDatabase() {
  if (!db) {
    return false;
  }

  try {
    // Clear all data but keep schema
    const tables = [
      "bronze_requests",
      "bronze_request_headers",
      "bronze_request_timings",
      "bronze_performance_entries",
      "bronze_events",
      "bronze_sessions",
      "bronze_errors",
      "silver_requests",
      "silver_request_metrics",
      "silver_domain_stats",
      "silver_resource_stats",
      "silver_hourly_stats",
      "silver_request_tags",
      "gold_daily_analytics",
      "gold_performance_insights",
      "gold_domain_performance",
      "gold_optimization_opportunities",
      "gold_trends",
      "gold_anomalies",
    ];

    db.exec("BEGIN TRANSACTION");

    for (const table of tables) {
      try {
        db.exec(`DELETE FROM ${table}`);
      } catch (error) {
        console.warn(`Failed to clear table ${table}:`, error);
      }
    }

    db.exec("COMMIT");

    // Save changes
    await saveDatabase();

    eventBus?.publish("database:cleared", { timestamp: Date.now() });

    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    console.error("Failed to clear database:", error);
    throw new DatabaseError("Clear failed", error);
  }
}

/**
 * Reset database - completely drop all tables and recreate schema
 * This is more destructive than clearDatabase (which only deletes data)
 */
export async function resetDatabase() {
  if (!db) {
    return false;
  }

  try {
    console.log("Resetting database...");

    // Get list of all tables
    const tablesResult = db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    if (tablesResult[0]?.values) {
      db.exec("BEGIN TRANSACTION");

      // Drop all tables
      for (const [tableName] of tablesResult[0].values) {
        try {
          db.exec(`DROP TABLE IF EXISTS ${tableName}`);
          console.log(`Dropped table: ${tableName}`);
        } catch (error) {
          console.warn(`Failed to drop table ${tableName}:`, error);
        }
      }

      db.exec("COMMIT");
    }

    // Recreate schema
    console.log("Recreating medallion schema...");
    createMedallionSchema(db);

    // Initialize default configuration
    console.log("Initializing default configuration...");
    initializeDefaultConfig(db);

    // Recreate managers
    medallionManager = createMedallionManager(db);
    configManager = createConfigSchemaManager(db);

    // Save to OPFS
    await saveDatabase();

    eventBus?.publish("database:reset", { timestamp: Date.now() });

    console.log("Database reset complete");
    return true;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to rollback:", rollbackError);
    }
    console.error("Failed to reset database:", error);
    throw new DatabaseError("Reset failed", error);
  }
}

/**
 * Vacuum database to optimize storage
 */
export function vacuumDatabase() {
  if (!db) {
    return;
  }

  try {
    db.exec("VACUUM");
    eventBus?.publish("database:vacuumed", { timestamp: Date.now() });
  } catch (error) {
    console.error("Failed to vacuum database:", error);
    eventBus?.publish("database:error", {
      error: "vacuum_failed",
      message: error.message,
    });
  }
}

/**
 * Delete records older than specified number of days
 * @param {number} days - Age threshold in days
 * @returns {Object} - Stats about deleted records
 */
export async function cleanupOldRecords(days) {
  if (!db) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    const cutoffTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;

    // First, count records that will be deleted (Bronze + Silver + Gold layers)
    const cutoffDate = new Date(cutoffTimestamp).toISOString().split("T")[0];
    const countQuery = `
      SELECT 
        (SELECT COUNT(*) FROM bronze_requests WHERE timestamp < ${cutoffTimestamp}) as bronze_count,
        (SELECT COUNT(*) FROM bronze_web_vitals WHERE timestamp < ${cutoffTimestamp}) as vitals_count,
        (SELECT COUNT(*) FROM silver_requests WHERE timestamp < ${cutoffTimestamp}) as silver_count,
        (SELECT COUNT(*) FROM gold_daily_analytics WHERE date < '${cutoffDate}') +
        (SELECT COUNT(*) FROM gold_performance_insights WHERE created_at < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_domain_performance WHERE created_at < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_optimization_opportunities WHERE created_at < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_trends WHERE created_at < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_anomalies WHERE detected_at < ${cutoffTimestamp}) as gold_count
    `;

    const countResult = db.exec(countQuery);
    const counts = countResult[0]?.values?.[0] || [0, 0, 0, 0];
    const totalToDelete = counts[0] + counts[1] + counts[2] + counts[3];

    console.log(
      `Cleaning up ${totalToDelete} records older than ${days} days (Bronze: ${counts[0]}, Silver: ${counts[2]}, Gold: ${counts[3]})`
    );

    // Begin transaction
    db.exec("BEGIN TRANSACTION");

    // Delete from bronze layer
    db.exec(`DELETE FROM bronze_requests WHERE timestamp < ${cutoffTimestamp}`);
    db.exec(
      `DELETE FROM bronze_web_vitals WHERE timestamp < ${cutoffTimestamp}`
    );
    db.exec(
      `DELETE FROM bronze_request_headers WHERE request_id NOT IN (SELECT id FROM bronze_requests)`
    );
    db.exec(
      `DELETE FROM bronze_request_timings WHERE request_id NOT IN (SELECT id FROM bronze_requests)`
    );

    // Delete from silver layer
    db.exec(`DELETE FROM silver_requests WHERE timestamp < ${cutoffTimestamp}`);

    // Delete from gold layer (analytics)
    // Note: gold_daily_analytics uses date string, not timestamp
    db.exec(`DELETE FROM gold_daily_analytics WHERE date < '${cutoffDate}'`);
    db.exec(
      `DELETE FROM gold_performance_insights WHERE created_at < ${cutoffTimestamp}`
    );
    db.exec(
      `DELETE FROM gold_domain_performance WHERE created_at < ${cutoffTimestamp}`
    );
    db.exec(
      `DELETE FROM gold_optimization_opportunities WHERE created_at < ${cutoffTimestamp}`
    );
    db.exec(`DELETE FROM gold_trends WHERE created_at < ${cutoffTimestamp}`);
    db.exec(
      `DELETE FROM gold_anomalies WHERE detected_at < ${cutoffTimestamp}`
    );

    // Commit transaction
    db.exec("COMMIT");

    // Save database
    await saveDatabase();

    // Vacuum to reclaim space
    vacuumDatabase();

    const stats = {
      recordsDeleted: totalToDelete,
      cutoffDate: new Date(cutoffTimestamp).toISOString(),
      timestamp: Date.now(),
    };

    eventBus?.publish("database:cleanup", stats);

    return stats;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to rollback:", rollbackError);
    }
    console.error("Failed to cleanup old records:", error);
    throw new DatabaseError("Cleanup failed", error);
  }
}

/**
 * Preview cleanup - count records that would be deleted
 * @param {number} days - Age threshold in days
 * @returns {Object} - Preview stats
 */
export function previewCleanup(days) {
  if (!db) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    const cutoffTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffTimestamp).toISOString().split("T")[0];

    const query = `
      SELECT 
        (SELECT COUNT(*) FROM bronze_requests WHERE timestamp < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM bronze_web_vitals WHERE timestamp < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM silver_requests WHERE timestamp < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_daily_analytics WHERE date < '${cutoffDate}') +
        (SELECT COUNT(*) FROM gold_performance_insights WHERE created_at < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_domain_performance WHERE created_at < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_optimization_opportunities WHERE created_at < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_trends WHERE created_at < ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_anomalies WHERE detected_at < ${cutoffTimestamp}) as records_to_delete,
        (SELECT COUNT(*) FROM bronze_requests WHERE timestamp >= ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM bronze_web_vitals WHERE timestamp >= ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM silver_requests WHERE timestamp >= ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_daily_analytics WHERE date >= '${cutoffDate}') +
        (SELECT COUNT(*) FROM gold_performance_insights WHERE created_at >= ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_domain_performance WHERE created_at >= ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_optimization_opportunities WHERE created_at >= ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_trends WHERE created_at >= ${cutoffTimestamp}) +
        (SELECT COUNT(*) FROM gold_anomalies WHERE detected_at >= ${cutoffTimestamp}) as records_remaining,
        (SELECT MIN(timestamp) FROM bronze_requests) as oldest_timestamp
    `;

    const result = db.exec(query);
    if (!result[0]?.values?.[0]) {
      return {
        recordsToDelete: 0,
        recordsRemaining: 0,
        oldestRecord: null,
        sizeFreed: 0,
      };
    }

    const [recordsToDelete, recordsRemaining, oldestTimestamp] =
      result[0].values[0];

    // Estimate size freed (average 1KB per record)
    const estimatedSizeFreed = (recordsToDelete || 0) * 1024;

    return {
      recordsToDelete: recordsToDelete || 0,
      recordsRemaining: recordsRemaining || 0,
      oldestRecord: oldestTimestamp
        ? new Date(oldestTimestamp).toISOString()
        : null,
      cutoffDate: new Date(cutoffTimestamp).toISOString(),
      sizeFreed: estimatedSizeFreed,
    };
  } catch (error) {
    console.error("Failed to preview cleanup:", error);
    throw new DatabaseError("Preview failed", error);
  }
}

/**
 * Map SQL result to array of objects
 */
function mapResultToArray(result) {
  if (!result || !result.columns || !result.values) {
    return [];
  }

  return result.values.map((row) => {
    const obj = {};
    result.columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

/**
 * Cleanup on shutdown
 */
export async function cleanup() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }

  await saveDatabase();

  if (db) {
    db.close();
    db = null;
  }

  medallionManager = null;
  configManager = null;
}

/**
 * Class wrapper for backward compatibility
 */
export class DatabaseManagerMedallion {
  constructor() {
    this.initialized = false;
    this.dbApi = null;
  }

  async initialize(config = {}, encryptionMgr = null, events = null) {
    if (this.initialized) {
      console.warn("DatabaseManagerMedallion already initialized");
      return this.dbApi;
    }

    try {
      this.dbApi = await initDatabase(config, encryptionMgr, events);
      this.initialized = true;
      return this.dbApi;
    } catch (error) {
      console.error("Failed to initialize DatabaseManagerMedallion:", error);
      throw error;
    }
  }

  // Proxy methods to the API
  executeQuery(...args) {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.executeQuery(...args);
  }

  executeTransaction(...args) {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.executeTransaction(...args);
  }

  async saveDatabase() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.saveDatabase();
  }

  getRequests(...args) {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.getRequests(...args);
  }

  saveRequest(...args) {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.saveRequest(...args);
  }

  getDatabaseSize() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.getDatabaseSize();
  }

  getDatabaseStats() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.getDatabaseStats();
  }

  exportDatabase() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.exportDatabase();
  }

  async importDatabase(...args) {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    const result = await this.dbApi.importDatabase(...args);
    // Reinitialize API after import
    this.dbApi = await initDatabase(null, null, this.eventBus);
    return result;
  }

  clearDatabase() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.clearDatabase();
  }

  vacuumDatabase() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.vacuumDatabase();
  }

  async resetDatabase() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    const result = await this.dbApi.resetDatabase();
    // Reinitialize to get fresh API with updated managers
    this.dbApi = await initDatabase(null, null, eventBus);
    return result;
  }

  async cleanupOldRecords(days) {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return await this.dbApi.cleanupOldRecords(days);
  }

  previewCleanup(days) {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.previewCleanup(days);
  }

  get medallion() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.medallion;
  }

  get config() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    return this.dbApi.config;
  }

  get db() {
    if (!this.initialized) throw new DatabaseError("Database not initialized");
    // Return the module-level db instance that was initialized
    return db;
  }

  get isReady() {
    return this.initialized && this.dbApi !== null && db !== null;
  }

  async cleanup() {
    if (this.initialized) {
      await cleanup();
      this.initialized = false;
      this.dbApi = null;
    }
  }
}
