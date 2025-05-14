// Export manager - handles data export in various formats

import { ExportError } from "../errors/error-types.js"

let dbManager = null
let encryptionManager = null
let eventBus = null
let autoExportInterval = null

// Set up export manager
export function setupExportManager(database, encryption, events) {
  dbManager = database
  encryptionManager = encryption
  eventBus = events

  // Set up auto-export if enabled
  setupAutoExport()

  // Subscribe to config updates
  eventBus.subscribe("config:updated", (config) => {
    if (config.export) {
      updateAutoExport(config.export)
    }
  })

  console.log("Export manager initialized")

  return {
    exportData,
    exportToCsv,
    exportToJson,
    exportToSqlite,
    exportToPdf,
    exportToExcel,
    getExportFormats, // Add getExportFormats here
  }
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
    // Add other formats if/when implemented and supported
    // { id: "pdf", name: "PDF", description: "Export as PDF (Not implemented)" },
    // { id: "excel", name: "Excel", description: "Export as Excel (Not implemented)" },
  ];
}

// Set up auto-export
function setupAutoExport() {
  if (dbManager && dbManager.getConfig) {
    const config = dbManager.getConfig();
    if (config && config.export) {
      const exportConfig = config.export;
      if (exportConfig.autoExport && exportConfig.autoExportInterval > 0) {
        if (autoExportInterval) {
          clearInterval(autoExportInterval);
        }
        autoExportInterval = setInterval(() => {
          autoExportData(exportConfig)
        }, exportConfig.autoExportInterval)
      }
    } else {
      console.warn("Could not setup auto-export: analyzerConfig or export config missing from database.");
    }
  }
}

// Update auto-export settings
function updateAutoExport(exportConfig) {
  // Clear existing interval
  if (autoExportInterval) {
    clearInterval(autoExportInterval)
    autoExportInterval = null
  }

  // Set up new interval if enabled
  if (exportConfig.autoExport && exportConfig.autoExportInterval > 0) {
    autoExportInterval = setInterval(() => {
      autoExportData(exportConfig)
    }, exportConfig.autoExportInterval)
  }
}

// Auto-export data
async function autoExportData(exportConfig) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `request-analyzer-export-${timestamp}`

    await exportData({
      format: exportConfig.autoExportFormat,
      filename: filename,
      includeHeaders: exportConfig.includeHeaders,
      prettyPrint: exportConfig.prettyPrint,
      path: exportConfig.autoExportPath,
    })

    // Update last export time in database
    const config = await getConfig()
    config.export.lastExportTime = Date.now()
    if (dbManager && dbManager.updateConfig) {
      dbManager.updateConfig(config)
    }

    // Publish auto-export event
    eventBus.publish("export:auto_completed", {
      timestamp: Date.now(),
      format: exportConfig.autoExportFormat,
      filename: filename,
    })
  } catch (error) {
    console.error("Auto-export failed:", error)
    // Publish error event
    eventBus.publish("export:error", {
      timestamp: Date.now(),
      error: error.message,
    })
  }
}

// Get configuration
async function getConfig() {
  if (dbManager && dbManager.getConfig) {
    return dbManager.getConfig();
  }
  return {};
}

// Export data in specified format
export async function exportData(options) {
  if (!dbManager) {
    throw new ExportError("Database not initialized")
  }

  try {
    const { format, filename, includeHeaders, prettyPrint, path } = options

    // Publish export started event
    eventBus.publish("export:started", {
      timestamp: Date.now(),
      format,
      filename,
    })

    let data
    let mimeType
    let extension

    // Export in specified format
    switch (format) {
      case "csv":
        data = await exportToCsv(includeHeaders)
        mimeType = "text/csv"
        extension = "csv"
        break

      case "json":
        data = await exportToJson(prettyPrint)
        mimeType = "application/json"
        extension = "json"
        break

      case "sqlite":
        data = await exportToSqlite()
        mimeType = "application/x-sqlite3"
        extension = "sqlite"
        break

      case "pdf":
        data = await exportToPdf()
        mimeType = "application/pdf"
        extension = "pdf"
        break

      case "excel":
        data = await exportToExcel()
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"
        break

      default:
        throw new ExportError(`Unsupported export format: ${format}`)
    }

    // Create blob
    const blob = new Blob([data], { type: mimeType })
    const url = URL.createObjectURL(blob)

    // Download file
    const downloadId = await downloadFile(url, `${filename}.${extension}`)

    // Show notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icons/icon128.png"),
      title: "Export Complete",
      message: `Data exported successfully as ${format.toUpperCase()}`,
      priority: 0,
    })

    // Publish export completed event
    eventBus.publish("export:completed", {
      timestamp: Date.now(),
      format,
      filename,
      downloadId,
    })

    return { success: true, downloadId }
  } catch (error) {
    console.error("Export failed:", error)

    // Publish export error event
    eventBus.publish("export:error", {
      timestamp: Date.now(),
      error: error.message,
    })

    throw new ExportError("Export failed", error)
  }
}

// Download file
function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: true,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new ExportError(chrome.runtime.lastError.message))
        } else {
          resolve(downloadId)
        }
      },
    )
  })
}

// Export to CSV
export async function exportToCsv(includeHeaders = true) {
  if (!dbManager) {
    throw new ExportError("Database not initialized")
  }

  try {
    // Build query based on whether to include headers
    const query = `
      SELECT r.*, t.dns, t.tcp, t.ssl, t.ttfb, t.download
      FROM requests r
      LEFT JOIN request_timings t ON r.id = t.requestId
    `

    const result = dbManager.executeQuery(query)

    if (!result[0]) {
      return ""
    }

    const columns = result[0].columns
    let csv = ""

    // Add header row if requested
    if (includeHeaders) {
      csv = columns.join(",") + "\n"
    }

    // Add data rows
    result[0].values.forEach((row) => {
      // Escape fields that might contain commas
      const escapedRow = row.map((field) => {
        if (field === null || field === undefined) return ""
        const str = String(field)
        return str.includes(",") ? `"${str}"` : str
      })

      csv += escapedRow.join(",") + "\n"
    })

    return csv
  } catch (error) {
    console.error("CSV export failed:", error)
    throw new ExportError("CSV export failed", error)
  }
}

// Export to JSON
export async function exportToJson(prettyPrint = true) {
  if (!dbManager) {
    throw new ExportError("Database not initialized")
  }

  try {
    // Get requests
    const requestsResult = dbManager.executeQuery("SELECT * FROM requests")

    // Get timings
    const timingsResult = dbManager.executeQuery("SELECT * FROM request_timings")

    // Get headers if needed
    const headersResult = dbManager.executeQuery("SELECT * FROM request_headers")

    // Build JSON object
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: chrome.runtime.getManifest().version,
        requestCount: requestsResult[0] ? requestsResult[0].values.length : 0,
      },
      requests: [],
      stats: dbManager.getDatabaseStats(),
    }

    // Convert requests to objects
    if (requestsResult[0]) {
      const requestColumns = requestsResult[0].columns

      requestsResult[0].values.forEach((row) => {
        const request = {}

        // Add request properties
        requestColumns.forEach((column, index) => {
          request[column] = row[index]
        })

        // Add timings
        if (timingsResult[0]) {
          const timing = timingsResult[0].values.find((t) => t[0] === request.id)

          if (timing) {
            request.timings = {
              dns: timing[1],
              tcp: timing[2],
              ssl: timing[3],
              ttfb: timing[4],
              download: timing[5],
            }
          }
        }

        // Add headers
        if (headersResult[0]) {
          const headers = headersResult[0].values.filter((h) => h[1] === request.id)

          if (headers.length > 0) {
            request.headers = headers.map((h) => ({
              name: h[2],
              value: h[3],
            }))
          }
        }

        exportData.requests.push(request)
      })
    }

    // Convert to JSON string
    return JSON.stringify(exportData, null, prettyPrint ? 2 : 0)
  } catch (error) {
    console.error("JSON export failed:", error)
    throw new ExportError("JSON export failed", error)
  }
}

// Export to SQLite
export async function exportToSqlite() {
  if (!dbManager) {
    throw new ExportError("Database not initialized")
  }

  try {
    // Export database
    return dbManager.exportDatabase("sqlite")
  } catch (error) {
    console.error("SQLite export failed:", error)
    throw new ExportError("SQLite export failed", error)
  }
}

// Export to PDF
export async function exportToPdf() {
  if (!dbManager) {
    throw new ExportError("Database not initialized")
  }

  try {
    // For PDF export, we would typically use a library like jsPDF
    // Since we don't have that available, we'll throw an error
    throw new ExportError("PDF export is not implemented yet")
  } catch (error) {
    console.error("PDF export failed:", error)
    throw new ExportError("PDF export failed", error)
  }
}

// Export to Excel
export async function exportToExcel() {
  if (!dbManager) {
    throw new ExportError("Database not initialized")
  }

  try {
    // For Excel export, we would typically use a library like SheetJS
    // Since we don't have that available, we'll throw an error
    throw new ExportError("Excel export is not implemented yet")
  } catch (error) {
    console.error("Excel export failed:", error)
    throw new ExportError("Excel export failed", error)
  }
}

