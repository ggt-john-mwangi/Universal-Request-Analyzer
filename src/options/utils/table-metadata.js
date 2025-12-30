/**
 * Database Table Metadata
 * Comprehensive information about each table's purpose, status, and usage
 *
 * Status Indicators:
 * ✅ ACTIVE - Fully implemented and in use
 * ⚠️ NOT IMPLEMENTED - Schema only, no logic/UI
 * ⚠️ DEPRECATED - Legacy, use alternative table
 * ⚠️ PARTIAL - Backend implemented, UI missing
 */

export const TABLE_METADATA = {
  // ===================================================================
  // CONFIG SCHEMA - Application Settings and Configuration
  // ===================================================================

  config_app_settings: {
    schema: "config",
    purpose: "Application settings storage",
    feature: "Settings Management",
    status: "✅ ACTIVE",
    usage: "settings-manager.js reads/writes, synced to chrome.storage",
  },
  config_feature_flags: {
    schema: "config",
    purpose: "Feature toggle flags",
    feature: "Feature Flags",
    status: "✅ ACTIVE",
    usage: "feature-flags.js checks, Options UI toggles",
  },
  config_user_preferences: {
    schema: "config",
    purpose: "User display preferences",
    feature: "User Preferences",
    status: "✅ ACTIVE",
    usage: "Theme, language, timezone, date/number formats",
  },
  config_extension: {
    schema: "config",
    purpose: "Extension metadata and installation info",
    feature: "Extension Config",
    status: "✅ ACTIVE",
    usage: "Installation ID, version, environment tracking",
  },
  config_performance: {
    schema: "config",
    purpose: "Performance monitoring settings",
    feature: "Performance Config",
    status: "⚠️ NOT IMPLEMENTED",
    usage: "Schema only, performance monitoring not fully implemented",
  },
  config_storage: {
    schema: "config",
    purpose: "Storage limits and cleanup settings",
    feature: "Storage Management",
    status: "✅ ACTIVE",
    usage: "cleanup-manager.js uses for retention policies",
  },
  config_export: {
    schema: "config",
    purpose: "Default export settings",
    feature: "Export Configuration",
    status: "⚠️ PARTIAL",
    usage: "Schema exists, export uses hard-coded defaults",
  },
  config_runner_definitions: {
    schema: "config",
    purpose: "Saved request runners",
    feature: "Request Runners",
    status: "✅ ACTIVE",
    usage:
      "db-manager-medallion.js CRUD, runners.js UI, dashboard.js quick run",
  },
  config_runner_requests: {
    schema: "config",
    purpose: "Individual runner requests",
    feature: "Request Runners",
    status: "✅ ACTIVE",
    usage: "request-runner.js executes, runners.js displays",
  },
  config_runner_collections: {
    schema: "config",
    purpose: "Runner groupings",
    feature: "Runner Collections",
    status: "⚠️ PARTIAL - Backend exists, no UI",
    usage: "runner-collections.js backend, needs Options UI",
  },
  config_runner_scheduled_runs: {
    schema: "config",
    purpose: "Schedule collection executions",
    feature: "Runner Scheduling",
    status: "⚠️ NOT IMPLEMENTED",
    usage: "Schema only, scheduled runs not implemented",
  },
  bronze_requests: {
    schema: "bronze",
    purpose: "Raw HTTP request captures",
    feature: "Request Capture",
    status: "✅ ACTIVE - Core Infrastructure",
    usage:
      "request-capture.js writes, medallion-manager.js reads to process to Silver",
  },
  bronze_request_headers: {
    schema: "bronze",
    purpose: "Request/response headers",
    feature: "Request Details",
    status: "✅ ACTIVE",
    usage: "request-capture.js writes, dashboard.js displays in details modal",
  },
  bronze_request_timings: {
    schema: "bronze",
    purpose: "Detailed timing breakdown",
    feature: "Performance Analysis",
    status: "✅ ACTIVE",
    usage:
      "request-capture.js captures from webRequest API, medallion-manager aggregates to silver_request_metrics",
  },
  bronze_web_vitals: {
    schema: "bronze",
    purpose: "Core Web Vitals metrics",
    feature: "Web Vitals",
    status: "⚠️ EMPTY - Content Script Not Injecting",
    usage: "content.js should capture, not working - needs investigation",
  },
  bronze_sessions: {
    schema: "bronze",
    purpose: "User sessions",
    feature: "Session Tracking",
    status: "⚠️ NOT IMPLEMENTED",
    usage: "Schema only, Phase 2 feature",
  },
  bronze_errors: {
    schema: "bronze",
    purpose: "Error logging",
    feature: "Error Tracking",
    status: "✅ ACTIVE",
    usage:
      "logger.js error() method persists errors, View Logs button queries this table",
  },
  bronze_runner_executions: {
    schema: "bronze",
    purpose: "Runner execution history",
    feature: "Request Runners",
    status: "✅ ACTIVE",
    usage:
      "request-runner.js creates/updates, runners.js & dashboard.js display history",
  },
  bronze_runner_execution_results: {
    schema: "bronze",
    purpose: "Individual run results",
    feature: "Request Runners",
    status: "✅ ACTIVE",
    usage:
      "request-runner.js writes per-request results, runners.js displays in results modal",
  },
  silver_requests: {
    schema: "silver",
    purpose: "Validated & enriched requests",
    feature: "Medallion Pipeline",
    status: "✅ ACTIVE - Primary Analytics Source",
    usage:
      "medallion-manager.processBronzeToSilver() writes, Dashboard queries for all analytics",
  },
  silver_request_metrics: {
    schema: "silver",
    purpose: "Performance timing metrics",
    feature: "Medallion Pipeline",
    status: "✅ ACTIVE",
    usage:
      "medallion-manager.processSilverMetrics() aggregates from bronze_request_timings, Dashboard performance charts",
  },
  silver_domain_stats: {
    schema: "silver",
    purpose: "Domain aggregations",
    feature: "Medallion Pipeline",
    status: "✅ ACTIVE",
    usage:
      "medallion-manager.updateDomainStats() updates per request, Dashboard domain cards",
  },
  silver_resource_stats: {
    schema: "silver",
    purpose: "Resource type aggregations",
    feature: "Medallion Pipeline",
    status: "✅ ACTIVE",
    usage:
      "medallion-manager.updateResourceStats() updates per request, Dashboard resource breakdown chart",
  },
  silver_hourly_stats: {
    schema: "silver",
    purpose: "Time-series aggregations",
    feature: "Medallion Pipeline",
    status: "✅ ACTIVE",
    usage:
      "medallion-manager.updateHourlyStats() buckets by hour, Dashboard time-series charts",
  },
  gold_daily_analytics: {
    schema: "gold",
    purpose: "Daily performance summaries",
    feature: "Daily Analytics Pipeline",
    status: "✅ ACTIVE",
    usage:
      "medallion-manager.processDailyAnalytics() runs nightly, data-sync-manager reads for sync",
  },
  gold_domain_performance: {
    schema: "gold",
    purpose: "Per-domain grades",
    feature: "Domain Reports",
    status: "⚠️ WRITTEN BY MIGRATION - Not in UI",
    usage:
      "medallion-migration.js writes during migration, no UI displays grades",
  },
  runner_alerts: {
    schema: "config",
    purpose: "Runner alert configurations",
    feature: "Runner Alerts",
    status: "⚠️ PARTIAL - Backend partial, no UI",
    usage:
      "Gold schema table for alert conditions, background/notifications/ has some code, needs Options UI",
  },
};

/**
 * Get metadata for a specific table
 * @param {string} tableName - The name of the table
 * @returns {Object} Metadata object with defaults for unknown tables
 */
export function getTableMetadata(tableName) {
  return (
    TABLE_METADATA[tableName] || {
      schema: "other",
      purpose: "Unknown table",
      feature: "Unknown",
      status: "Unknown",
      usage: "No metadata available",
    }
  );
}

/**
 * Get all tables for a specific schema
 * @param {string} schemaName - The schema name (config, bronze, silver, gold, other)
 * @returns {Object[]} Array of table metadata objects with table names
 */
export function getTablesBySchema(schemaName) {
  return Object.entries(TABLE_METADATA)
    .filter(([_, metadata]) => metadata.schema === schemaName)
    .map(([tableName, metadata]) => ({ tableName, ...metadata }));
}

/**
 * Get summary statistics about tables
 * @returns {Object} Statistics about tables by status
 */
export function getTableStatistics() {
  const tables = Object.entries(TABLE_METADATA);

  return {
    total: tables.length,
    active: tables.filter(([_, m]) => m.status?.includes("✅ ACTIVE")).length,
    notImplemented: tables.filter(([_, m]) =>
      m.status?.includes("⚠️ NOT IMPLEMENTED")
    ).length,
    deprecated: tables.filter(([_, m]) => m.status?.includes("⚠️ DEPRECATED"))
      .length,
    partial: tables.filter(([_, m]) => m.status?.includes("⚠️ PARTIAL")).length,
    bySchema: {
      config: tables.filter(([_, m]) => m.schema === "config").length,
      bronze: tables.filter(([_, m]) => m.schema === "bronze").length,
      silver: tables.filter(([_, m]) => m.schema === "silver").length,
      gold: tables.filter(([_, m]) => m.schema === "gold").length,
      other: tables.filter(([_, m]) => m.schema === "other").length,
    },
  };
}
