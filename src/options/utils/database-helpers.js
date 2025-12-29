/**
 * Database Table Display Helpers
 * Functions for organizing and rendering database table information
 */

import { TABLE_METADATA } from "./table-metadata.js";

/**
 * Group tables by medallion schema with enriched metadata
 * @param {Object[]} tableData - Array of table objects with name and count
 * @returns {Object} Tables grouped by schema with enriched metadata
 */
export function groupTablesBySchema(tableData) {
  const schemas = {
    config: [],
    bronze: [],
    silver: [],
    gold: [],
    other: [],
  };

  tableData.forEach((table) => {
    const metadata = TABLE_METADATA[table.name] || {
      schema: "other",
      purpose: "Unknown",
      feature: "Unknown",
    };

    const enrichedTable = {
      ...table,
      purpose: metadata.purpose,
      feature: metadata.feature,
      status: metadata.status || (table.count === 0 ? "Empty" : "Active"),
      usage: metadata.usage || "No usage information",
    };

    schemas[metadata.schema].push(enrichedTable);
  });

  return schemas;
}

/**
 * Render a schema section with its tables
 * @param {string} title - Section title
 * @param {string} schemaKey - Schema identifier
 * @param {Object[]} tables - Array of table objects
 * @param {string} description - Schema description
 * @returns {string} HTML string for the schema section
 */
export function renderSchemaSection(title, schemaKey, tables, description) {
  const totalRecords = tables.reduce((sum, t) => sum + t.count, 0);
  const emptyTables = tables.filter((t) => t.count === 0).length;

  let html = `
    <div class="schema-section" data-schema="${schemaKey}">
      <div class="schema-header">
        <div class="schema-title">
          <i class="fas fa-chevron-down schema-toggle"></i>
          <strong>${title}</strong>
          <span class="schema-badge">${tables.length} tables</span>
          <span class="schema-badge records">${totalRecords.toLocaleString()} records</span>
          ${
            emptyTables > 0
              ? `<span class="schema-badge empty">${emptyTables} empty</span>`
              : ""
          }
        </div>
      </div>
      <div class="schema-description">${description}</div>
      <div class="schema-tables">
  `;

  tables.forEach((table) => {
    const statusClass = table.count === 0 ? "empty" : "active";
    const statusIcon = table.status?.includes("✅")
      ? "✅"
      : table.status?.includes("⚠️")
      ? "⚠️"
      : "";
    const statusText = table.status?.replace(/✅|⚠️/g, "").trim() || "";
    const statusInfo =
      statusText && statusText !== "Active" && statusText !== "Empty"
        ? `<div class="table-status ${statusClass}">
           <span class="status-icon">${statusIcon}</span>
           <span class="status-text">${statusText}</span>
         </div>`
        : "";

    html += `
      <div class="table-item ${statusClass}" data-table="${table.name}">
        <div class="table-item-header">
          <div class="table-item-name">
            <i class="fas fa-table"></i>
            <span class="table-name">${table.name}</span>
          </div>
          <div class="table-item-count">${table.count.toLocaleString()} records</div>
        </div>
        <div class="table-item-meta">
          <div class="table-purpose">
            <i class="fas fa-info-circle"></i> ${table.purpose}
          </div>
          <div class="table-feature">
            <i class="fas fa-puzzle-piece"></i> ${table.feature}
          </div>
          ${
            table.usage
              ? `<div class="table-usage">
            <i class="fas fa-code"></i> ${table.usage}
          </div>`
              : ""
          }
        </div>
        ${statusInfo}
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

/**
 * Get schema descriptions
 * @returns {Object} Schema keys mapped to descriptions
 */
export function getSchemaDescriptions() {
  return {
    config:
      "Application settings, feature flags, and configuration data stored in this layer",
    bronze:
      "Raw, immutable data captured directly from HTTP requests - the source of truth",
    silver:
      "Validated, enriched, and cleaned data ready for analytics and reporting",
    gold: "Aggregated analytics, insights, and pre-computed metrics for fast querying",
    other:
      "Legacy tables, queues, and special-purpose storage not part of medallion architecture",
  };
}

/**
 * Get schema titles
 * @returns {Object} Schema keys mapped to display titles
 */
export function getSchemaTitles() {
  return {
    config: "⚙️ Config Schema",
    bronze: "🥉 Bronze Schema",
    silver: "🥈 Silver Schema",
    gold: "🥇 Gold Schema",
    other: "📦 Other Tables",
  };
}

/**
 * Calculate statistics for a schema
 * @param {Object[]} tables - Array of tables in the schema
 * @returns {Object} Statistics about the schema
 */
export function calculateSchemaStats(tables) {
  return {
    totalTables: tables.length,
    totalRecords: tables.reduce((sum, t) => sum + t.count, 0),
    emptyTables: tables.filter((t) => t.count === 0).length,
    activeTables: tables.filter((t) => t.status?.includes("✅")).length,
    implementedTables: tables.filter(
      (t) =>
        !t.status?.includes("NOT IMPLEMENTED") &&
        !t.status?.includes("DEPRECATED")
    ).length,
  };
}
