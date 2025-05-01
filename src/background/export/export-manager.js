// Export manager - handles data export in various formats

import { ExportError } from "../errors/error-types.js";

let dbManager = null;
let encryptionManager = null;
let eventBus = null;
let autoExportInterval = null;

const BATCH_SIZE = 1000; // Process records in batches for better memory usage

// Set up export manager
export function setupExportManager(database, encryption, events) {
  dbManager = database;
  encryptionManager = encryption;
  eventBus = events;

  setupAutoExport();

  // Subscribe to config updates
  eventBus.subscribe("config:updated", (config) => {
    if (config.export) {
      updateAutoExport(config.export);
    }
  });

  console.log("Export manager initialized");

  return {
    exportData,
    exportToCsv,
    exportToJson,
    exportToSqlite,
    exportToPdf,
    exportToExcel,
    getExportFormats,
  };
}

// Get available export formats
export function getExportFormats() {
  return [
    {
      id: "json",
      name: "JSON",
      description: "Export as JSON file with optional compression",
    },
    {
      id: "csv",
      name: "CSV",
      description: "Export as CSV file with configurable columns",
    },
    {
      id: "sqlite",
      name: "SQLite",
      description: "Export as SQLite database file",
    },
  ];
}

// Set up auto-export
function setupAutoExport() {
  chrome.storage.local.get("analyzerConfig", (result) => {
    if (result.analyzerConfig && result.analyzerConfig.export) {
      const exportConfig = result.analyzerConfig.export;

      if (exportConfig.autoExport && exportConfig.autoExportInterval > 0) {
        autoExportInterval = setInterval(() => {
          autoExportData(exportConfig);
        }, exportConfig.autoExportInterval);
      }
    }
  });
}

// Update auto-export settings
function updateAutoExport(exportConfig) {
  // Clear existing interval
  if (autoExportInterval) {
    clearInterval(autoExportInterval);
    autoExportInterval = null;
  }

  // Set up new interval if enabled
  if (exportConfig.autoExport && exportConfig.autoExportInterval > 0) {
    autoExportInterval = setInterval(() => {
      autoExportData(exportConfig);
    }, exportConfig.autoExportInterval);
  }
}

// Auto-export data
async function autoExportData(exportConfig) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `request-analyzer-export-${timestamp}`;

    await exportData({
      format: exportConfig.autoExportFormat,
      filename: filename,
      includeHeaders: exportConfig.includeHeaders,
      prettyPrint: exportConfig.prettyPrint,
      path: exportConfig.autoExportPath,
    });

    // Update last export time
    const config = await getConfig();
    config.export.lastExportTime = Date.now();

    chrome.storage.local.set({ analyzerConfig: config });

    // Publish auto-export event
    eventBus.publish("export:auto_completed", {
      timestamp: Date.now(),
      format: exportConfig.autoExportFormat,
      filename: filename,
    });
  } catch (error) {
    console.error("Auto-export failed:", error);

    // Publish error event
    eventBus.publish("export:error", {
      timestamp: Date.now(),
      error: error.message,
    });
  }
}

// Get configuration
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get("analyzerConfig", (result) => {
      resolve(result.analyzerConfig || {});
    });
  });
}

// Export data in specified format
export async function exportData(options) {
  if (!dbManager) {
    throw new ExportError("Database not initialized");
  }

  try {
    const {
      format,
      filename,
      includeHeaders = true,
      prettyPrint = true,
      compression = false,
    } = options;

    // Publish export started event
    eventBus.publish("export:started", {
      timestamp: Date.now(),
      format,
      filename,
    });

    let data;
    let mimeType;
    let extension;

    // Export in specified format with streaming support
    switch (format) {
      case "csv":
        data = await exportToCsv(includeHeaders);
        mimeType = "text/csv";
        extension = "csv";
        break;

      case "json":
        data = await exportToJson(prettyPrint, compression);
        mimeType = compression ? "application/gzip" : "application/json";
        extension = compression ? "json.gz" : "json";
        break;

      case "sqlite":
        data = await exportToSqlite();
        mimeType = "application/x-sqlite3";
        extension = "sqlite";
        break;

      case "pdf":
        data = await exportToPdf();
        mimeType = "application/pdf";
        extension = "pdf";
        break;

      case "excel":
        data = await exportToExcel();
        mimeType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        extension = "xlsx";
        break;

      default:
        throw new ExportError(`Unsupported export format: ${format}`);
    }

    // Create blob and download
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const downloadId = await downloadFile(url, `${filename}.${extension}`);

    // Clean up
    URL.revokeObjectURL(url);

    // Publish export completed event
    eventBus.publish("export:completed", {
      timestamp: Date.now(),
      format,
      filename,
      downloadId,
    });

    return { success: true, downloadId };
  } catch (error) {
    console.error("Export failed:", error);
    eventBus.publish("export:error", {
      timestamp: Date.now(),
      error: error.message,
    });
    throw new ExportError("Export failed", error);
  }
}

// Export to CSV with streaming
export async function exportToCsv(includeHeaders = true) {
  if (!dbManager) {
    throw new ExportError("Database not initialized");
  }

  try {
    let csv = "";
    let offset = 0;
    const totalCount = await dbManager.getRequestCount();

    // Get column information
    const columns = await dbManager.getTableColumns("requests");
    if (includeHeaders) {
      csv = columns.join(",") + "\n";
    }

    // Stream records in batches
    while (offset < totalCount) {
      const batch = await dbManager.getRequests(offset, BATCH_SIZE);

      batch.forEach((row) => {
        const values = columns.map((col) => {
          const value = row[col];
          return formatCsvValue(value);
        });
        csv += values.join(",") + "\n";
      });

      offset += BATCH_SIZE;

      // Report progress
      eventBus.publish("export:progress", {
        timestamp: Date.now(),
        processed: offset,
        total: totalCount,
        percentage: Math.round((offset / totalCount) * 100),
      });
    }

    return csv;
  } catch (error) {
    console.error("CSV export failed:", error);
    throw new ExportError("CSV export failed", error);
  }
}

// Export to JSON with optional compression
export async function exportToJson(prettyPrint = true, compression = false) {
  if (!dbManager) {
    throw new ExportError("Database not initialized");
  }

  try {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: chrome.runtime.getManifest().version,
        compression: compression ? "gzip" : "none",
      },
      requests: [],
      stats: await dbManager.getDatabaseStats(),
    };

    // Stream records in batches
    let offset = 0;
    const totalCount = await dbManager.getRequestCount();

    while (offset < totalCount) {
      const batch = await dbManager.getRequests(offset, BATCH_SIZE);
      exportData.requests.push(...batch);

      offset += BATCH_SIZE;

      // Report progress
      eventBus.publish("export:progress", {
        timestamp: Date.now(),
        processed: offset,
        total: totalCount,
        percentage: Math.round((offset / totalCount) * 100),
      });
    }

    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, prettyPrint ? 2 : 0);

    // Compress if requested
    if (compression) {
      return await compressData(jsonString);
    }

    return jsonString;
  } catch (error) {
    console.error("JSON export failed:", error);
    throw new ExportError("JSON export failed", error);
  }
}

// Export to SQLite
export async function exportToSqlite() {
  if (!dbManager) {
    throw new ExportError("Database not initialized");
  }

  try {
    // Export database with indexes and triggers
    const data = await dbManager.exportDatabase();

    // Optimize database before export
    await dbManager.vacuum();

    return data;
  } catch (error) {
    console.error("SQLite export failed:", error);
    throw new ExportError("SQLite export failed", error);
  }
}

// Export to PDF
export async function exportToPdf() {
  if (!dbManager) {
    throw new ExportError("Database not initialized");
  }

  try {
    // For PDF export, we would typically use a library like jsPDF
    // Since we don't have that available, we'll throw an error
    throw new ExportError("PDF export is not implemented yet");
  } catch (error) {
    console.error("PDF export failed:", error);
    throw new ExportError("PDF export failed", error);
  }
}

// Export to Excel
export async function exportToExcel() {
  if (!dbManager) {
    throw new ExportError("Database not initialized");
  }

  try {
    // For Excel export, we would typically use a library like SheetJS
    // Since we don't have that available, we'll throw an error
    throw new ExportError("Excel export is not implemented yet");
  } catch (error) {
    console.error("Excel export failed:", error);
    throw new ExportError("Excel export failed", error);
  }
}

// Helper function to format CSV values
function formatCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

// Helper function to compress data using gzip
async function compressData(data) {
  const encoder = new TextEncoder();
  const compressed = await compressionStream(encoder.encode(data));
  return compressed;
}

// Helper function to create a compression stream
async function compressionStream(data) {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  await writer.write(data);
  await writer.close();
  return new Response(cs.readable).arrayBuffer();
}

// Download file helper
async function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: true,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}
