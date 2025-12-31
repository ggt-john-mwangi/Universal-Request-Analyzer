/**
 * Database Handlers
 * Handles database management operations (size, clear, reset, import, export, backup, vacuum)
 * These are UI-facing operations distinct from internal database methods
 */

import { downloads } from "../../compat/browser-compat.js";
import { exportHandlers } from "./export-handlers.js";

/**
 * Export handler map for database operations
 */
export const databaseHandlers = new Map([
  [
    "getDatabaseSize",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        // Use getDatabaseStats() which returns size, records, oldestDate
        const stats = database.getDatabaseStats();
        if (!stats) {
          return { success: false, error: "Failed to get database stats" };
        }

        return {
          success: true,
          size: stats.size || 0,
          records: stats.totalRequests || 0,
          oldestDate: stats.oldestDate || null,
        };
      } catch (error) {
        console.error("getDatabaseSize error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getDatabaseStats",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        // Get table counts
        const tables = [
          "bronze_requests",
          "silver_requests",
          "gold_domain_stats",
          "bronze_web_vitals",
        ];
        const stats = {};

        for (const table of tables) {
          try {
            const result = database.db.exec(`SELECT COUNT(*) FROM ${table}`);
            stats[table] = result[0]?.values[0]?.[0] || 0;
          } catch (e) {
            stats[table] = 0;
          }
        }

        return { success: true, stats };
      } catch (error) {
        console.error("getDatabaseStats error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getTableSchema",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const { tableName } = message;

        if (!tableName) {
          return { success: false, error: "Table name is required" };
        }

        const query = `PRAGMA table_info(${tableName})`;
        const result = database.db.exec(query);

        if (!result || !result[0]?.values) {
          return { success: false, error: "Table not found" };
        }

        const columns = result[0].values.map((row) => ({
          cid: row[0],
          name: row[1],
          type: row[2],
          notNull: row[3],
          defaultValue: row[4],
          pk: row[5],
        }));

        return { success: true, schema: columns, tableName };
      } catch (error) {
        console.error("getTableSchema error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getTableList",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database || !database.isReady || !database.db) {
          return { success: false, error: "Database not initialized" };
        }

        const query = `
          SELECT name, type 
          FROM sqlite_master 
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `;

        const result = database.db.exec(query);
        const tables = [];

        if (result && result[0]?.values) {
          for (const row of result[0].values) {
            const tableName = row[0];
            // Get row count for each table
            try {
              const countResult = database.db.exec(
                `SELECT COUNT(*) FROM ${tableName}`
              );
              const count = countResult[0]?.values[0]?.[0] || 0;
              tables.push({
                name: tableName,
                type: row[1],
                rowCount: count,
              });
            } catch (e) {
              tables.push({
                name: tableName,
                type: row[1],
                rowCount: 0,
              });
            }
          }
        }

        return { success: true, tables };
      } catch (error) {
        console.error("getTableList error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "clearDatabase",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        const result = await database.clearDatabase();
        return {
          success: result,
          message: "Database cleared successfully",
        };
      } catch (error) {
        console.error("clearDatabase error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "resetDatabase",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        const result = await database.resetDatabase();
        return {
          success: result,
          message: "Database reset successfully",
        };
      } catch (error) {
        console.error("resetDatabase error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "importDatabase",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        const { data } = message;
        if (!data || !Array.isArray(data)) {
          return { success: false, error: "Invalid database data" };
        }

        // Convert array to Uint8Array
        const uint8Array = new Uint8Array(data);

        const result = await database.importDatabase(uint8Array);
        return {
          success: result,
          message: "Database imported successfully",
        };
      } catch (error) {
        console.error("importDatabase error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "createBackup",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        const exportData = database.exportDatabase();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `ura_backup_${timestamp}.sqlite`;

        // Convert to base64 in chunks to avoid stack overflow
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < exportData.length; i += chunkSize) {
          const chunk = exportData.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, chunk);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:application/x-sqlite3;base64,${base64}`;

        // Trigger browser download
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true,
        });

        // Save last backup timestamp to storage
        const backupInfo = {
          timestamp: Date.now(),
          filename,
          size: exportData.length,
        };
        await chrome.storage.local.set({ lastBackup: backupInfo });

        return {
          success: true,
          filename,
          size: exportData.length,
          timestamp: backupInfo.timestamp,
        };
      } catch (error) {
        console.error("createBackup error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "vacuumDatabase",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        database.vacuumDatabase();
        return {
          success: true,
          message: "Database vacuumed successfully",
        };
      } catch (error) {
        console.error("vacuumDatabase error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "cleanupOldRecords",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        const { days = 7 } = message;
        const stats = await database.cleanupOldRecords(days);

        // Save cleanup history to storage
        const cleanupEntry = {
          timestamp: stats.timestamp || Date.now(),
          days,
          recordsDeleted: stats.recordsDeleted || 0,
          cutoffDate: stats.cutoffDate,
        };

        // Get existing history
        const storage = await chrome.storage.local.get("cleanupHistory");
        const history = storage.cleanupHistory || [];

        // Add new entry and keep last 10
        history.unshift(cleanupEntry);
        if (history.length > 10) history.pop();

        await chrome.storage.local.set({ cleanupHistory: history });

        // Return stats fields directly (UI expects response.recordsDeleted)
        return {
          success: true,
          recordsDeleted: stats.recordsDeleted || 0,
          cutoffDate: stats.cutoffDate,
          timestamp: stats.timestamp,
          message: `Deleted records older than ${days} days`,
        };
      } catch (error) {
        console.error("cleanupOldRecords error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "previewCleanup",
    async (message, sender, context) => {
      try {
        const { database } = context;
        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        const { days = 7 } = message;
        const preview = database.previewCleanup(days);

        // Return preview fields directly (UI expects response.recordsToDelete, etc.)
        return {
          success: true,
          recordsToDelete: preview.recordsToDelete || 0,
          recordsRemaining: preview.recordsRemaining || 0,
          sizeFreed: preview.sizeFreed || 0,
          oldestRecord: preview.oldestRecord,
          cutoffDate: preview.cutoffDate,
        };
      } catch (error) {
        console.error("previewCleanup error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getCleanupHistory",
    async (message, sender, context) => {
      try {
        const storage = await chrome.storage.local.get("cleanupHistory");
        return {
          success: true,
          history: storage.cleanupHistory || [],
        };
      } catch (error) {
        console.error("getCleanupHistory error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getLastBackupInfo",
    async (message, sender, context) => {
      try {
        const storage = await chrome.storage.local.get("lastBackup");
        return {
          success: true,
          lastBackup: storage.lastBackup || null,
        };
      } catch (error) {
        console.error("getLastBackupInfo error:", error);
        return { success: false, error: error.message };
      }
    },
  ],
]);
