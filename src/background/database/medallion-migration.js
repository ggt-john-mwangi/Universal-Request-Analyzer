// Medallion Architecture Migration
// Migrates data from legacy schema to medallion architecture

import { DatabaseError } from "../errors/error-types.js";
import { createMedallionSchema, initializeDefaultConfig } from "./medallion-schema.js";

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
      
      await migrateLegacyPerformanceMetrics(db);
      console.log("✓ Performance metrics migrated to Bronze layer");
      
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
    
    eventBus?.publish('medallion:migration:complete', { timestamp: Date.now() });
    console.log("Migration to medallion architecture completed successfully!");
    
    return true;
  } catch (error) {
    console.error("Migration failed:", error);
    eventBus?.publish('medallion:migration:failed', { error: error.message });
    throw new DatabaseError('Medallion migration failed', error);
  }
}

/**
 * Check if legacy tables exist
 */
async function checkLegacyTables(db) {
  try {
    const result = db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('requests', 'request_headers', 'request_timings', 'performance_metrics')
    `);
    
    return result && result.length > 0 && result[0].values && result[0].values.length > 0;
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
    db.exec(`
      INSERT OR IGNORE INTO bronze_requests (
        id, url, method, type, status, status_text, domain, path,
        start_time, end_time, duration, size_bytes, timestamp, 
        tab_id, page_url, error, created_at
      )
      SELECT 
        id, url, method, type, status, statusText, domain, path,
        startTime, endTime, duration, size, timestamp,
        tabId, pageUrl, error, timestamp
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
    db.exec(`
      INSERT OR IGNORE INTO bronze_request_headers (
        request_id, header_type, name, value, created_at
      )
      SELECT 
        requestId, 'request', name, value, ?
      FROM request_headers
      WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='request_headers')
    `, [Date.now()]);
    
    const result = db.exec(`SELECT COUNT(*) as count FROM bronze_request_headers`);
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
    db.exec(`
      INSERT OR IGNORE INTO bronze_request_timings (
        request_id, dns_duration, tcp_duration, ssl_duration,
        request_duration, response_duration, created_at
      )
      SELECT 
        requestId, dns, tcp, ssl, ttfb, download, ?
      FROM request_timings
      WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='request_timings')
    `, [Date.now()]);
    
    const result = db.exec(`SELECT COUNT(*) as count FROM bronze_request_timings`);
    const count = result[0]?.values[0]?.[0] || 0;
    console.log(`  Migrated ${count} timing records`);
  } catch (error) {
    console.error("Error migrating timings:", error);
    // Non-critical, continue
  }
}

/**
 * Migrate legacy performance metrics
 */
async function migrateLegacyPerformanceMetrics(db) {
  try {
    db.exec(`
      INSERT OR IGNORE INTO bronze_performance_entries (
        request_id, entry_type, name, start_time, duration, created_at
      )
      SELECT 
        request_id, 'performance', 'legacy_metric', 
        0, total_time, created_at
      FROM performance_metrics
      WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='performance_metrics')
    `);
    
    const result = db.exec(`SELECT COUNT(*) as count FROM bronze_performance_entries`);
    const count = result[0]?.values[0]?.[0] || 0;
    console.log(`  Migrated ${count} performance entries`);
  } catch (error) {
    console.error("Error migrating performance metrics:", error);
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
        ?, ?
      FROM bronze_requests
    `, [now, now]);
    
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
        ?
      FROM bronze_request_timings
    `, [now]);
    
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
        ?
      FROM bronze_requests
      WHERE domain IS NOT NULL
      GROUP BY domain
    `, [now]);
    
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
        ?
      FROM bronze_requests
      WHERE type IS NOT NULL
      GROUP BY type
    `, [now]);
    
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
        ?, ?
      FROM bronze_requests
      WHERE timestamp > ? 
      GROUP BY DATE(timestamp / 1000, 'unixepoch')
    `, [now, now, now - (30 * 24 * 60 * 60 * 1000)]);
    
    // Generate domain performance reports
    db.exec(`
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
    `, [now, now - (30 * 24 * 60 * 60 * 1000)]);
    
    const result = db.exec(`SELECT COUNT(*) as count FROM gold_daily_analytics`);
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
      VALUES ('initial_medallion_migration', ?, 'Migrated legacy schema to medallion architecture')
    `, [now]);
    
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
    
    if (!result || result.length === 0 || !result[0].values[0] || result[0].values[0][0] === 0) {
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
