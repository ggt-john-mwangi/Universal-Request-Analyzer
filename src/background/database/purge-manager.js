// Data purge manager - handles data retention and cleanup

import { DatabaseError } from "../errors/error-types.js";

let dbManager = null;
let eventBus = null;
let purgeInterval = null;

const DEFAULT_RETENTION_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_PURGE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export function setupPurgeManager(database, events) {
  dbManager = database;
  eventBus = events;

  // Set up automatic purging
  startAutoPurge();

  return {
    purgeOldData,
    purgeByRetentionPolicy,
    purgeBySize,
    purgeByCustomFilter,
    purgeAllData,
    optimizeStorage,
  };
}

// Start automatic purging
function startAutoPurge() {
  // Clear existing interval if any
  if (purgeInterval) {
    clearInterval(purgeInterval);
  }

  // Set up new interval
  purgeInterval = setInterval(async () => {
    try {
      const settings = await dbManager.getPerformanceSettings();
      const retentionPeriod =
        settings?.retentionPeriod || DEFAULT_RETENTION_PERIOD;
      await purgeByRetentionPolicy(retentionPeriod);
    } catch (error) {
      console.error("Auto-purge failed:", error);
    }
  }, DEFAULT_PURGE_INTERVAL);
}

// Purge old data based on timestamp
export async function purgeOldData(timestamp) {
  if (!dbManager) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    // Begin transaction
    dbManager.executeQuery("BEGIN TRANSACTION");

    // Delete old request headers
    await dbManager.executeQuery(
      "DELETE FROM request_headers WHERE requestId IN (SELECT id FROM requests WHERE timestamp < ?)",
      [timestamp]
    );

    // Delete old request timings
    await dbManager.executeQuery(
      "DELETE FROM request_timings WHERE requestId IN (SELECT id FROM requests WHERE timestamp < ?)",
      [timestamp]
    );

    // Delete old performance metrics
    await dbManager.executeQuery(
      "DELETE FROM performance_metrics WHERE created_at < ?",
      [timestamp]
    );

    // Delete old requests
    await dbManager.executeQuery("DELETE FROM requests WHERE timestamp < ?", [
      timestamp,
    ]);

    // Delete old sessions
    await dbManager.executeQuery("DELETE FROM sessions WHERE expiresAt < ?", [
      timestamp,
    ]);

    // Delete old audit logs
    await dbManager.executeQuery("DELETE FROM audit_log WHERE timestamp < ?", [
      timestamp,
    ]);

    // Commit transaction
    dbManager.executeQuery("COMMIT");

    // Optimize storage
    await optimizeStorage();

    // Publish purge completed event
    eventBus.publish("database:purge_completed", {
      timestamp: Date.now(),
      purgeType: "old_data",
      cutoffTime: timestamp,
    });

    return true;
  } catch (error) {
    // Rollback on error
    dbManager.executeQuery("ROLLBACK");
    console.error("Failed to purge old data:", error);
    throw new DatabaseError("Failed to purge old data", error);
  }
}

// Purge data based on retention policy
export async function purgeByRetentionPolicy(
  retentionPeriod = DEFAULT_RETENTION_PERIOD
) {
  const cutoffTime = Date.now() - retentionPeriod;
  return purgeOldData(cutoffTime);
}

// Purge data to keep database size under limit
export async function purgeBySize(maxSizeBytes) {
  if (!dbManager) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    const currentSize = await dbManager.getDatabaseSize();
    if (currentSize <= maxSizeBytes) {
      return true;
    }

    // Calculate how many records to remove
    const result = await dbManager.executeQuery(
      "SELECT COUNT(*) as count FROM requests"
    );
    const totalRecords = result[0].values[0][0];
    const targetRecords = Math.floor(totalRecords * 0.8); // Remove 20% of records

    // Get timestamp threshold for deletion
    const threshold = await dbManager.executeQuery(
      "SELECT timestamp FROM requests ORDER BY timestamp DESC LIMIT 1 OFFSET ?",
      [targetRecords]
    );

    if (threshold[0]?.values[0]?.[0]) {
      await purgeOldData(threshold[0].values[0][0]);
    }

    return true;
  } catch (error) {
    console.error("Failed to purge by size:", error);
    throw new DatabaseError("Failed to purge by size", error);
  }
}

// Purge data based on custom filter
export async function purgeByCustomFilter(filter) {
  if (!dbManager) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    // Begin transaction
    dbManager.executeQuery("BEGIN TRANSACTION");

    // Apply custom filter conditions
    if (filter.domain) {
      await dbManager.executeQuery("DELETE FROM requests WHERE domain LIKE ?", [
        `%${filter.domain}%`,
      ]);
    }

    if (filter.status) {
      await dbManager.executeQuery("DELETE FROM requests WHERE status = ?", [
        filter.status,
      ]);
    }

    if (filter.type) {
      await dbManager.executeQuery("DELETE FROM requests WHERE type = ?", [
        filter.type,
      ]);
    }

    // Commit transaction
    dbManager.executeQuery("COMMIT");

    // Optimize storage
    await optimizeStorage();

    // Publish purge completed event
    eventBus.publish("database:purge_completed", {
      timestamp: Date.now(),
      purgeType: "custom_filter",
      filter,
    });

    return true;
  } catch (error) {
    // Rollback on error
    dbManager.executeQuery("ROLLBACK");
    console.error("Failed to purge by custom filter:", error);
    throw new DatabaseError("Failed to purge by custom filter", error);
  }
}

// Purge all data
export async function purgeAllData() {
  if (!dbManager) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    // Begin transaction
    dbManager.executeQuery("BEGIN TRANSACTION");

    // Delete all data from all tables
    await dbManager.executeQuery("DELETE FROM request_headers");
    await dbManager.executeQuery("DELETE FROM request_timings");
    await dbManager.executeQuery("DELETE FROM performance_metrics");
    await dbManager.executeQuery("DELETE FROM requests");
    await dbManager.executeQuery("DELETE FROM audit_log");

    // Keep user data and settings
    // await dbManager.executeQuery("DELETE FROM users");
    // await dbManager.executeQuery("DELETE FROM settings");

    // Commit transaction
    dbManager.executeQuery("COMMIT");

    // Optimize storage
    await optimizeStorage();

    // Publish purge completed event
    eventBus.publish("database:purge_completed", {
      timestamp: Date.now(),
      purgeType: "all_data",
    });

    return true;
  } catch (error) {
    // Rollback on error
    dbManager.executeQuery("ROLLBACK");
    console.error("Failed to purge all data:", error);
    throw new DatabaseError("Failed to purge all data", error);
  }
}

// Optimize storage after purging
export async function optimizeStorage() {
  if (!dbManager) {
    throw new DatabaseError("Database not initialized");
  }

  try {
    // Vacuum database to reclaim space and optimize
    await dbManager.executeQuery("VACUUM");

    // Analyze tables for query optimization
    await dbManager.executeQuery("ANALYZE");

    // Rebuild indexes
    await dbManager.executeQuery("REINDEX");

    // Publish optimization completed event
    eventBus.publish("database:optimized", {
      timestamp: Date.now(),
    });

    return true;
  } catch (error) {
    console.error("Failed to optimize storage:", error);
    throw new DatabaseError("Failed to optimize storage", error);
  }
}
