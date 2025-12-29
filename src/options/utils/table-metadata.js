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

  config_sync_settings: {
    schema: "config",
    purpose: "Cloud sync configuration",
    feature: "Cloud Sync",
    status: "⚠️ NOT IMPLEMENTED",
    usage: "Schema only, sync feature not implemented",
  },

  config_filters: {
    schema: "config",
    purpose: "Saved filter configurations",
    feature: "Advanced Filters",
    status: "⚠️ NOT IMPLEMENTED",
    usage: "Filters use chrome.storage.local instead",
  },

  // ===================================================================
  // BRONZE SCHEMA - Raw Immutable Data Layer
  // ===================================================================

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

  bronze_request_bodies: {
    schema: "bronze",
    purpose: "Request/response bodies",
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
    status: "⚠️ NOT IMPLEMENTED",
    usage: "Errors logged to console, not database",
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

  // ===================================================================
  // SILVER SCHEMA - Validated & Enriched Data Layer
  // ===================================================================

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

  // ❌ COMMENTED OUT - Table disabled in schema
  // silver_tags: {
  //   schema: "silver",
  //   purpose: "Request categorization",
  //   feature: "Tagging System",
  //   status: "⚠️ NOT IMPLEMENTED",
  //   usage: "Schema only, no UI or tagging logic",
  // },

  // ❌ COMMENTED OUT - Table disabled in schema
  // silver_request_tags: {
  //   schema: "silver",
  //   purpose: "Tag mappings",
  //   feature: "Tagging System",
  //   status: "⚠️ NOT IMPLEMENTED",
  //   usage: "Schema only, junction table for many-to-many",
  // },

  // ===================================================================
  // GOLD SCHEMA - Aggregated Analytics Layer
  // ===================================================================

  gold_daily_analytics: {
    schema: "gold",
    purpose: "Daily performance summaries",
    feature: "Daily Analytics Pipeline",
    status: "✅ ACTIVE",
    usage:
      "medallion-manager.processDailyAnalytics() runs nightly, data-sync-manager reads for sync",
  },

  // ❌ COMMENTED OUT - Table disabled in schema
  // gold_performance_insights: {
  //   schema: "gold",
  //   purpose: "AI-generated insights",
  //   feature: "Insights Engine",
  //   status: "⚠️ NOT IMPLEMENTED",
  //   usage: "Schema only, no LLM integration or insight generation",
  // },

  gold_domain_performance: {
    schema: "gold",
    purpose: "Per-domain grades",
    feature: "Domain Reports",
    status: "⚠️ WRITTEN BY MIGRATION - Not in UI",
    usage:
      "medallion-migration.js writes during migration, no UI displays grades",
  },

  // ❌ COMMENTED OUT - Table disabled in schema
  // gold_optimization_opportunities: {
  //   schema: "gold",
  //   purpose: "Performance suggestions",
  //   feature: "Optimization Engine",
  //   status: "⚠️ NOT IMPLEMENTED",
  //   usage: "Schema only, no optimization logic",
  // },

  // ❌ COMMENTED OUT - Table disabled in schema
  // gold_trends: {
  //   schema: "gold",
  //   purpose: "Metric trends",
  //   feature: "Trend Analysis",
  //   status: "⚠️ NOT IMPLEMENTED",
  //   usage: "Schema only, no trend detection logic",
  // },

  // ❌ COMMENTED OUT - Table disabled in schema
  // gold_anomalies: {
  //   schema: "gold",
  //   purpose: "Anomaly detection",
  //   feature: "Anomaly Detection",
  //   status: "⚠️ NOT IMPLEMENTED",
  //   usage: "Schema only, no anomaly detection logic",
  // },

  // ===================================================================
  // OTHER SCHEMA - Legacy and Special Purpose
  // ===================================================================

  runner_results: {
    schema: "other",
    purpose: "Runner summaries (LEGACY)",
    feature: "Request Runners",
    status: "⚠️ DEPRECATED",
    usage:
      "request-runner.js line 877 still writes (bug), use bronze_runner_execution_results instead",
  },

  runner_alerts: {
    schema: "other",
    purpose: "Runner alert configs",
    feature: "Runner Alerts",
    status: "⚠️ PARTIAL - Backend partial, no UI",
    usage: "background/notifications/ has some code, needs Options UI",
  },

  analytics_queue: {
    schema: "other",
    purpose: "Analytics processing queue",
    feature: "Background Processing",
    status: "⚠️ NOT IMPLEMENTED",
    usage: "Schema only, analytics runs synchronously",
  },

  sync_queue: {
    schema: "other",
    purpose: "Cloud sync queue",
    feature: "Cloud Sync",
    status: "⚠️ NOT IMPLEMENTED",
    usage: "Schema only, sync not implemented",
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
