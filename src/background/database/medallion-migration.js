// Medallion Architecture Migration
// Migrates data from legacy schema to medallion architecture

import { DatabaseError } from "../errors/error-types.js";
import {
  createMedallionSchema,
  initializeDefaultConfig,
} from "./medallion-schema.js";

/**
 * Migrate database to medallion architecture
 */
export async function migrateToMedallionArchitecture(db, eventBus) {
  console.log("Starting migration to medallion architecture...");

  try {
    // Step 1: Create medallion schema
    await createMedallionSchema(db);
    console.log("✓ Medallion schema created");

    // Step 2: Initialize default configuration
    await initializeDefaultConfig(db);
    console.log("✓ Default configuration initialized");

    // Step 3: Check if legacy tables exist
    const hasLegacyData = await checkLegacyTables(db);

    if (hasLegacyData) {
      console.log("Legacy data detected, starting migration...");

      // Step 4: Migrate legacy data
      await migrateLegacyRequests(db);
      console.log("✓ Requests migrated to Bronze layer");

      await migrateLegacyHeaders(db);
      console.log("✓ Headers migrated to Bronze layer");

      await migrateLegacyTimings(db);
      console.log("✓ Timings migrated to Bronze layer");

      // Step 5: Process Bronze to Silver
      await processBronzeToSilver(db);
      console.log("✓ Data processed to Silver layer");

      // Step 6: Generate Gold analytics
      await generateGoldAnalytics(db);
      console.log("✓ Analytics generated in Gold layer");

      // Step 7: Mark migration as complete
      await markMigrationComplete(db);
      console.log("✓ Migration marked as complete");
    } else {
      console.log("No legacy data found, migration skipped");
    }

    eventBus?.publish("medallion:migration:complete", {
      timestamp: Date.now(),
    });
    console.log("Migration to medallion architecture completed successfully!");

    return true;
  } catch (error) {
    console.error("Migration failed:", error);
    eventBus?.publish("medallion:migration:failed", { error: error.message });
    throw new DatabaseError("Medallion migration failed", error);
  }
}

/**
 * Check if legacy tables exist
 */
async function checkLegacyTables(db) {
  try {
    const result = db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('requests', 'request_headers', 'request_timings')
    `);

    return (
      result &&
      result.length > 0 &&
      result[0].values &&
      result[0].values.length > 0
    );
  } catch (error) {
    console.error("Error checking legacy tables:", error);
    return false;
  }
}

/**
 * Migrate legacy requests to bronze_requests
 */
async function migrateLegacyRequests(db) {
  try {
    // Check what columns exist in legacy requests table
    const columnsResult = db.exec(`PRAGMA table_info(requests)`);
    if (!columnsResult || !columnsResult[0]?.values) {
      console.log("  No legacy requests table found, skipping migration");
      return;
    }

    const columns = columnsResult[0].values.map((col) => col[1]); // Get column names
    console.log("  Legacy columns:", columns.join(", "));

    // Map legacy column names to bronze column names with fallbacks
    const columnMap = {
      statusText: columns.includes("statusText")
        ? "statusText"
        : columns.includes("status_text")
        ? "status_text"
        : "NULL",
      startTime: columns.includes("startTime")
        ? "startTime"
        : columns.includes("start_time")
        ? "start_time"
        : "timestamp",
      endTime: columns.includes("endTime")
        ? "endTime"
        : columns.includes("end_time")
        ? "end_time"
        : "timestamp",
      size: columns.includes("size")
        ? "size"
        : columns.includes("size_bytes")
        ? "size_bytes"
        : "0",
      tabId: columns.includes("tabId")
        ? "tabId"
        : columns.includes("tab_id")
        ? "tab_id"
        : "NULL",
      pageUrl: columns.includes("pageUrl")
        ? "pageUrl"
        : columns.includes("page_url")
        ? "page_url"
        : "NULL",
    };

    db.exec(`
      INSERT OR IGNORE INTO bronze_requests (
        id, url, method, type, status, status_text, domain, path,
        start_time, end_time, duration, size_bytes, timestamp, 
        tab_id, page_url, error, created_at
      )
      SELECT 
        id, url, method, type, status, ${columnMap.statusText}, domain, path,
        ${columnMap.startTime}, ${columnMap.endTime}, duration, ${columnMap.size}, timestamp,
        ${columnMap.tabId}, ${columnMap.pageUrl}, error, timestamp
      FROM requests
      WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='requests')
    `);

    const result = db.exec(`SELECT COUNT(*) as count FROM bronze_requests`);
    const count = result[0]?.values[0]?.[0] || 0;
    console.log(`  Migrated ${count} requests`);
  } catch (error) {
    console.error("Error migrating requests:", error);
    throw error;
  }
}

/**
 * Migrate legacy headers to bronze_request_headers
 */
async function migrateLegacyHeaders(db) {
  try {
    const now = Date.now();
    db.exec(`
      INSERT OR IGNORE INTO bronze_request_headers (
        request_id, header_type, name, value, created_at
      )
      SELECT 
        requestId, 'request', name, value, ${now}
      FROM request_headers
      WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='request_headers')
    `);

    const result = db.exec(
      `SELECT COUNT(*) as count FROM bronze_request_headers`
    );
    const count = result[0]?.values[0]?.[0] || 0;
    console.log(`  Migrated ${count} headers`);
  } catch (error) {
    console.error("Error migrating headers:", error);
    // Non-critical, continue
  }
}

/**
 * Migrate legacy timings to bronze_request_timings
 */
async function migrateLegacyTimings(db) {
  try {
    const now = Date.now();
    db.exec(`
      INSERT OR IGNORE INTO bronze_request_timings (
        request_id, dns_duration, tcp_duration, ssl_duration,
        request_duration, response_duration, created_at
      )
      SELECT 
        requestId, dns, tcp, ssl, ttfb, download, ${now}
      FROM request_timings
      WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='request_timings')
    `);

    const result = db.exec(
      `SELECT COUNT(*) as count FROM bronze_request_timings`
    );
    const count = result[0]?.values[0]?.[0] || 0;
    console.log(`  Migrated ${count} timing records`);
  } catch (error) {
    console.error("Error migrating timings:", error);
    // Non-critical, continue
  }
}

/**
 * Process Bronze data to Silver layer
 */
async function processBronzeToSilver(db) {
  try {
    const now = Date.now();

    // Migrate to silver_requests with enrichment
    db.exec(`
      INSERT OR IGNORE INTO silver_requests (
        id, url, method, type, status, status_text, domain, path,
        protocol, duration, size_bytes, timestamp, tab_id, page_url,
        is_third_party, is_secure, has_error, performance_score,
        quality_score, created_at, updated_at
      )
      SELECT 
        id, url, method, type, status, status_text, domain, path,
        CASE 
          WHEN url LIKE 'https://%' THEN 'https'
          WHEN url LIKE 'http://%' THEN 'http'
          ELSE 'unknown'
        END as protocol,
        duration, size_bytes, timestamp, tab_id, page_url,
        CASE 
          WHEN domain LIKE '%google%' OR domain LIKE '%facebook%' OR 
               domain LIKE '%twitter%' OR domain LIKE '%analytics%' THEN 1
          ELSE 0
        END as is_third_party,
        CASE WHEN url LIKE 'https://%' THEN 1 ELSE 0 END as is_secure,
        CASE WHEN error IS NOT NULL OR status >= 400 THEN 1 ELSE 0 END as has_error,
        CASE 
          WHEN duration < 100 THEN 100
          WHEN duration > 5000 THEN 0
          ELSE 100 - (duration * 100 / 5000)
        END as performance_score,
        CASE 
          WHEN error IS NOT NULL THEN 50
          WHEN status >= 400 THEN 70
          ELSE 100
        END as quality_score,
        ${now}, ${now}
      FROM bronze_requests
    `);

    // Process metrics
    db.exec(`
      INSERT OR IGNORE INTO silver_request_metrics (
        request_id, total_time, dns_time, tcp_time, ssl_time,
        wait_time, download_time, created_at
      )
      SELECT 
        request_id,
        COALESCE(request_duration, 0) + COALESCE(response_duration, 0) as total_time,
        COALESCE(dns_duration, 0) as dns_time,
        COALESCE(tcp_duration, 0) as tcp_time,
        COALESCE(ssl_duration, 0) as ssl_time,
        COALESCE(request_duration, 0) as wait_time,
        COALESCE(response_duration, 0) as download_time,
        ${now}
      FROM bronze_request_timings
    `);

    // Calculate domain stats
    db.exec(`
      INSERT OR REPLACE INTO silver_domain_stats (
        domain, total_requests, total_bytes, avg_duration,
        min_duration, max_duration, success_count, error_count,
        last_request_at, first_request_at, updated_at
      )
      SELECT 
        domain,
        COUNT(*) as total_requests,
        SUM(COALESCE(size_bytes, 0)) as total_bytes,
        AVG(COALESCE(duration, 0)) as avg_duration,
        MIN(COALESCE(duration, 0)) as min_duration,
        MAX(COALESCE(duration, 0)) as max_duration,
        SUM(CASE WHEN status >= 200 AND status < 400 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status >= 400 OR error IS NOT NULL THEN 1 ELSE 0 END) as error_count,
        MAX(timestamp) as last_request_at,
        MIN(timestamp) as first_request_at,
        ${now}
      FROM bronze_requests
      WHERE domain IS NOT NULL
      GROUP BY domain
    `);

    // Calculate resource stats
    db.exec(`
      INSERT OR REPLACE INTO silver_resource_stats (
        resource_type, total_requests, total_bytes, avg_duration, avg_size, updated_at
      )
      SELECT 
        type,
        COUNT(*) as total_requests,
        SUM(COALESCE(size_bytes, 0)) as total_bytes,
        AVG(COALESCE(duration, 0)) as avg_duration,
        AVG(COALESCE(size_bytes, 0)) as avg_size,
        ${now}
      FROM bronze_requests
      WHERE type IS NOT NULL
      GROUP BY type
    `);

    const result = db.exec(`SELECT COUNT(*) as count FROM silver_requests`);
    const count = result[0]?.values[0]?.[0] || 0;
    console.log(`  Processed ${count} requests to Silver layer`);
  } catch (error) {
    console.error("Error processing Bronze to Silver:", error);
    throw error;
  }
}

/**
 * Generate Gold layer analytics
 */
async function generateGoldAnalytics(db) {
  try {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Generate daily analytics for the last 30 days
    db.exec(`
      INSERT OR REPLACE INTO gold_daily_analytics (
        date, total_requests, total_bytes, avg_response_time,
        error_rate, unique_domains, created_at, updated_at
      )
      SELECT 
        DATE(timestamp / 1000, 'unixepoch') as date,
        COUNT(*) as total_requests,
        SUM(COALESCE(size_bytes, 0)) as total_bytes,
        AVG(COALESCE(duration, 0)) as avg_response_time,
        CAST(SUM(CASE WHEN status >= 400 OR error IS NOT NULL THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) as error_rate,
        COUNT(DISTINCT domain) as unique_domains,
        ${now}, ${now}
      FROM bronze_requests
      WHERE timestamp > ${thirtyDaysAgo}
      GROUP BY DATE(timestamp / 1000, 'unixepoch')
    `);

    // Generate domain performance reports
    db.exec(
      `
      INSERT OR REPLACE INTO gold_domain_performance (
        domain, date, request_count, total_bytes, avg_response_time,
        error_rate, performance_grade, created_at
      )
      SELECT 
        domain,
        DATE(timestamp / 1000, 'unixepoch') as date,
        COUNT(*) as request_count,
        SUM(COALESCE(size_bytes, 0)) as total_bytes,
        AVG(COALESCE(duration, 0)) as avg_response_time,
        CAST(SUM(CASE WHEN status >= 400 OR error IS NOT NULL THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) as error_rate,
        CASE 
          WHEN AVG(COALESCE(duration, 0)) < 100 THEN 'A'
          WHEN AVG(COALESCE(duration, 0)) < 500 THEN 'B'
          WHEN AVG(COALESCE(duration, 0)) < 1000 THEN 'C'
          WHEN AVG(COALESCE(duration, 0)) < 2000 THEN 'D'
          ELSE 'F'
        END as performance_grade,
        ?
      FROM bronze_requests
      WHERE timestamp > ? AND domain IS NOT NULL
      GROUP BY domain, DATE(timestamp / 1000, 'unixepoch')
    `,
      [now, now - 30 * 24 * 60 * 60 * 1000]
    );

    const result = db.exec(
      `SELECT COUNT(*) as count FROM gold_daily_analytics`
    );
    const count = result[0]?.values[0]?.[0] || 0;
    console.log(`  Generated ${count} days of analytics in Gold layer`);
  } catch (error) {
    console.error("Error generating Gold analytics:", error);
    throw error;
  }
}

/**
 * Mark migration as complete
 */
async function markMigrationComplete(db) {
  try {
    const now = Date.now();

    // Create migration tracking table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS medallion_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL,
        completed_at INTEGER NOT NULL,
        details TEXT
      )
    `);

    // Record migration
    db.exec(`
      INSERT INTO medallion_migrations (migration_name, completed_at, details)
      VALUES ('initial_medallion_migration', ${now}, 'Migrated legacy schema to medallion architecture')
    `);

    console.log("  Migration recorded in tracking table");
  } catch (error) {
    console.error("Error marking migration complete:", error);
    // Non-critical, continue
  }
}

/**
 * Check if medallion migration has been completed
 */
export async function isMedallionMigrationComplete(db) {
  try {
    const result = db.exec(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name='medallion_migrations'
    `);

    if (
      !result ||
      result.length === 0 ||
      !result[0].values[0] ||
      result[0].values[0][0] === 0
    ) {
      return false;
    }

    const migrationResult = db.exec(`
      SELECT COUNT(*) as count FROM medallion_migrations 
      WHERE migration_name = 'initial_medallion_migration'
    `);

    return migrationResult && migrationResult[0]?.values[0]?.[0] > 0;
  } catch (error) {
    console.error("Error checking migration status:", error);
    return false;
  }
}

/**
 * Migrate legacy data to medallion architecture
 * Wrapper function for compatibility with background.js
 */
export async function migrateLegacyToMedallion(
  legacyDbManager,
  medallionDbManager
) {
  console.log("Starting legacy to medallion migration...");

  try {
    // Ensure medallion database is fully initialized and ready
    if (!medallionDbManager.isReady) {
      console.log(
        "Medallion database not yet ready, skipping migration for now"
      );
      return true;
    }

    // Check if legacy data exists
    const hasLegacyData = await checkLegacyDataInManager(legacyDbManager);

    if (!hasLegacyData) {
      console.log("No legacy data found, migration skipped");
      return true;
    }

    // Get medallion manager from the API
    const medallionManager = medallionDbManager.medallion;
    if (!medallionManager) {
      console.warn("Medallion manager not available, skipping migration");
      return true;
    }

    // Migrate legacy requests to bronze layer
    await migrateLegacyRequestsFromManager(legacyDbManager, medallionManager);
    console.log("✓ Legacy requests migrated to Bronze layer");

    console.log("✓ Legacy to medallion migration completed successfully");
    return true;
  } catch (error) {
    console.error("Legacy migration failed:", error);
    // Don't throw - just log and continue
    console.warn("Continuing without legacy migration");
    return false;
  }
}

/**
 * Check if legacy data exists in the legacy database manager
 */
async function checkLegacyDataInManager(legacyDbManager) {
  try {
    const result = await legacyDbManager.executeQuery(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name='requests'
    `);

    if (!result || !result[0] || !result[0].values || !result[0].values[0]) {
      return false;
    }

    const tableExists = result[0].values[0][0] > 0;

    if (!tableExists) {
      return false;
    }

    // Check if there are any requests
    const countResult = await legacyDbManager.executeQuery(`
      SELECT COUNT(*) as count FROM requests
    `);

    return countResult && countResult[0]?.values[0]?.[0] > 0;
  } catch (error) {
    console.error("Error checking legacy data:", error);
    return false;
  }
}

/**
 * Migrate legacy requests from manager to medallion bronze layer
 */
async function migrateLegacyRequestsFromManager(
  legacyDbManager,
  medallionManager
) {
  try {
    // Get all requests from legacy database
    const requestsResult = await legacyDbManager.executeQuery(`
      SELECT * FROM requests ORDER BY timestamp DESC LIMIT 10000
    `);

    if (!requestsResult || !requestsResult[0] || !requestsResult[0].values) {
      console.log("No requests to migrate");
      return;
    }

    const columns = requestsResult[0].columns;
    const requests = requestsResult[0].values.map((row) => {
      const req = {};
      columns.forEach((col, idx) => {
        req[col] = row[idx];
      });
      return req;
    });

    console.log(`Migrating ${requests.length} requests...`);

    // Insert into bronze layer using medallion manager
    for (const request of requests) {
      try {
        await medallionManager.insertBronzeRequest({
          id: request.id,
          url: request.url,
          method: request.method || "GET",
          type: request.type || "other",
          status: request.status,
          statusText: request.statusText || "",
          domain: request.domain || new URL(request.url).hostname,
          path: request.path || new URL(request.url).pathname,
          startTime: request.startTime || request.timestamp,
          endTime: request.endTime || request.timestamp,
          duration: request.duration || 0,
          size: request.size || 0,
          timestamp: request.timestamp,
          tabId: request.tabId,
          pageUrl: request.pageUrl,
          error: request.error,
        });
      } catch (error) {
        console.warn(`Failed to migrate request ${request.id}:`, error.message);
      }
    }

    console.log(`✓ Migrated ${requests.length} requests to Bronze layer`);
  } catch (error) {
    console.error("Error migrating legacy requests:", error);
    throw error;
  }
}

/**
 * Fix existing bronze_requests with missing domain values
 * Extracts domain from url column where domain is NULL
 */
export async function fixMissingDomains(db) {
  console.log("Fixing missing domains in bronze_requests...");

  try {
    // Get all requests with NULL or empty domain
    const result = db.exec(`
      SELECT id, url FROM bronze_requests 
      WHERE domain IS NULL OR domain = ''
    `);

    if (
      !result ||
      result.length === 0 ||
      !result[0].values ||
      result[0].values.length === 0
    ) {
      console.log("No rows with missing domains found");
      return 0;
    }

    const rows = result[0].values;
    let updated = 0;
    let failed = 0;

    console.log(`Found ${rows.length} rows with missing domains`);

    for (const row of rows) {
      const [id, url] = row;

      try {
        // Extract domain from URL
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const path = urlObj.pathname;
        const protocol = urlObj.protocol.replace(":", "");
        const queryString = urlObj.search;

        // Escape SQL strings
        const escapeStr = (val) => {
          if (val === undefined || val === null || val === "") return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        // Update the row
        db.exec(`
          UPDATE bronze_requests 
          SET domain = ${escapeStr(domain)},
              path = ${escapeStr(path)},
              protocol = ${escapeStr(protocol)},
              query_string = ${escapeStr(queryString)}
          WHERE id = ${escapeStr(id)}
        `);

        updated++;

        if (updated % 100 === 0) {
          console.log(`Updated ${updated}/${rows.length} rows...`);
        }
      } catch (error) {
        failed++;
        console.warn(
          `Failed to extract domain from URL for request ${id}:`,
          error.message
        );
      }
    }

    console.log(
      `✓ Updated ${updated} rows with extracted domains (${failed} failed)`
    );
    return updated;
  } catch (error) {
    console.error("Error fixing missing domains:", error);
    throw error;
  }
}
