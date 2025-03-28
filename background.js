// Import SQL.js for SQLite database
importScripts("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js")

// Global variables
let db = null
let capturedRequests = []
let config = {
  maxStoredRequests: 10000,
  captureEnabled: true,
  autoExport: false,
  exportFormat: "json",
  exportInterval: 3600000, // 1 hour in milliseconds
  plotEnabled: true,
  plotTypes: ["responseTime", "statusCodes", "domains"],
  captureFilters: {
    includeDomains: [],
    excludeDomains: [],
    includeTypes: ["xmlhttprequest", "fetch", "script", "stylesheet", "image", "font", "other"],
  },
}

// Initialize SQLite database
async function initDatabase() {
  try {
    const SQL = await initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`,
    })

    db = new SQL.Database()

    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        url TEXT,
        method TEXT,
        type TEXT,
        status INTEGER,
        statusText TEXT,
        domain TEXT,
        path TEXT,
        startTime INTEGER,
        endTime INTEGER,
        duration INTEGER,
        size INTEGER,
        timestamp INTEGER,
        tabId INTEGER,
        pageUrl TEXT,
        error TEXT
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS request_timings (
        requestId TEXT PRIMARY KEY,
        dns INTEGER,
        tcp INTEGER,
        ssl INTEGER,
        ttfb INTEGER,
        download INTEGER,
        FOREIGN KEY(requestId) REFERENCES requests(id)
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS request_headers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requestId TEXT,
        name TEXT,
        value TEXT,
        FOREIGN KEY(requestId) REFERENCES requests(id)
      )
    `)

    console.log("SQLite database initialized")

    // Load configuration from storage
    chrome.storage.local.get("analyzerConfig", (data) => {
      if (data.analyzerConfig) {
        config = { ...config, ...data.analyzerConfig }
      }

      // Save default config if none exists
      chrome.storage.local.set({ analyzerConfig: config })
    })

    // Set up auto-export if enabled
    if (config.autoExport) {
      setInterval(autoExportData, config.exportInterval)
    }
  } catch (error) {
    console.error("Failed to initialize SQLite database:", error)
  }
}

// Parse URL to extract domain and path
function parseUrl(url) {
  try {
    const parsedUrl = new URL(url)
    return {
      domain: parsedUrl.hostname,
      path: parsedUrl.pathname,
    }
  } catch (e) {
    return {
      domain: "",
      path: "",
    }
  }
}

// Listen for web requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!config.captureEnabled) return

    // Check if we should capture this request type
    if (!config.captureFilters.includeTypes.includes(details.type)) return

    const { domain, path } = parseUrl(details.url)

    // Check domain filters
    if (config.captureFilters.excludeDomains.includes(domain)) return
    if (config.captureFilters.includeDomains.length > 0 && !config.captureFilters.includeDomains.includes(domain))
      return

    const request = {
      id: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      domain: domain,
      path: path,
      startTime: details.timeStamp,
      timestamp: Date.now(),
      tabId: details.tabId,
      status: "pending",
      size: 0,
      timings: {
        startTime: details.timeStamp,
        endTime: null,
        duration: null,
        dns: 0,
        tcp: 0,
        ssl: 0,
        ttfb: 0,
        download: 0,
      },
    }

    // Get the page URL
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError) {
        // Tab might not exist anymore
        return
      }

      if (tab && tab.url) {
        request.pageUrl = tab.url
        updateRequestData(details.requestId, request)
      }
    })
  },
  { urls: ["<all_urls>"] },
)

// Listen for headers received
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!config.captureEnabled) return

    const request = capturedRequests.find((req) => req.id === details.requestId)
    if (!request) return

    // Extract content length from headers
    const contentLengthHeader = details.responseHeaders.find((h) => h.name.toLowerCase() === "content-length")

    if (contentLengthHeader) {
      request.size = Number.parseInt(contentLengthHeader.value, 10) || 0
    }

    // Store headers if needed
    if (db) {
      details.responseHeaders.forEach((header) => {
        db.run("INSERT INTO request_headers (requestId, name, value) VALUES (?, ?, ?)", [
          details.requestId,
          header.name,
          header.value,
        ])
      })
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"],
)

// Listen for completed requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!config.captureEnabled) return

    const endTime = details.timeStamp
    const request = capturedRequests.find((req) => req.id === details.requestId)

    if (request) {
      request.status = "completed"
      request.statusCode = details.statusCode
      request.statusText = details.statusLine
      request.timings.endTime = endTime
      request.timings.duration = endTime - request.timings.startTime

      updateRequestData(details.requestId, request)

      // Send updated data to popup if open
      chrome.runtime
        .sendMessage({
          action: "requestUpdated",
          request: request,
        })
        .catch(() => {
          // Popup might not be open, ignore error
        })
    }
  },
  { urls: ["<all_urls>"] },
)

// Listen for error requests
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (!config.captureEnabled) return

    const request = capturedRequests.find((req) => req.id === details.requestId)

    if (request) {
      request.status = "error"
      request.error = details.error
      request.timings.endTime = details.timeStamp
      request.timings.duration = details.timeStamp - request.timings.startTime

      updateRequestData(details.requestId, request)
    }
  },
  { urls: ["<all_urls>"] },
)

// Helper function to update request data
function updateRequestData(requestId, requestData) {
  const index = capturedRequests.findIndex((req) => req.id === requestId)

  if (index !== -1) {
    capturedRequests[index] = requestData
  } else {
    capturedRequests.unshift(requestData)

    // Limit the number of stored requests in memory
    if (capturedRequests.length > config.maxStoredRequests) {
      capturedRequests = capturedRequests.slice(0, config.maxStoredRequests)
    }
  }

  // Save to SQLite database
  if (db) {
    try {
      // Insert or update request in database
      db.run(
        `
        INSERT OR REPLACE INTO requests (
          id, url, method, type, status, statusText, domain, path, 
          startTime, endTime, duration, size, timestamp, tabId, pageUrl, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          requestData.id,
          requestData.url,
          requestData.method,
          requestData.type,
          requestData.statusCode || 0,
          requestData.statusText || "",
          requestData.domain || "",
          requestData.path || "",
          requestData.timings.startTime || 0,
          requestData.timings.endTime || 0,
          requestData.timings.duration || 0,
          requestData.size || 0,
          requestData.timestamp || Date.now(),
          requestData.tabId || 0,
          requestData.pageUrl || "",
          requestData.error || "",
        ],
      )

      // Insert or update timing data
      if (requestData.timings) {
        db.run(
          `
          INSERT OR REPLACE INTO request_timings (
            requestId, dns, tcp, ssl, ttfb, download
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
          [
            requestData.id,
            requestData.timings.dns || 0,
            requestData.timings.tcp || 0,
            requestData.timings.ssl || 0,
            requestData.timings.ttfb || 0,
            requestData.timings.download || 0,
          ],
        )
      }
    } catch (error) {
      console.error("Error saving request to database:", error)
    }
  }
}

// Auto-export data based on configuration
function autoExportData() {
  if (!config.autoExport || !db) return

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `request-analyzer-export-${timestamp}`

  switch (config.exportFormat) {
    case "sqlite":
      exportSQLite(filename)
      break
    case "csv":
      exportCSV(filename)
      break
    case "json":
    default:
      exportJSON(filename)
      break
  }
}

// Export database as SQLite file
function exportSQLite(filename) {
  if (!db) return

  const data = db.export()
  const blob = new Blob([data], { type: "application/x-sqlite3" })

  chrome.downloads.download({
    url: URL.createObjectURL(blob),
    filename: `${filename}.sqlite`,
    saveAs: false,
  })
}

// Export data as JSON
function exportJSON(filename) {
  if (!db) return

  try {
    // Get all requests
    const requests = db.exec("SELECT * FROM requests")
    const timings = db.exec("SELECT * FROM request_timings")
    const headers = db.exec("SELECT * FROM request_headers")

    const data = {
      requests: requests[0] ? requests[0].values : [],
      timings: timings[0] ? timings[0].values : [],
      headers: headers[0] ? headers[0].values : [],
      exportDate: new Date().toISOString(),
      config: config,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })

    chrome.downloads.download({
      url: URL.createObjectURL(blob),
      filename: `${filename}.json`,
      saveAs: false,
    })
  } catch (error) {
    console.error("Error exporting JSON:", error)
  }
}

// Export data as CSV
function exportCSV(filename) {
  if (!db) return

  try {
    // Get all requests
    const result = db.exec(`
      SELECT r.id, r.url, r.method, r.type, r.status, r.domain, r.path, 
             r.startTime, r.endTime, r.duration, r.size, r.timestamp, 
             r.pageUrl, r.error, 
             t.dns, t.tcp, t.ssl, t.ttfb, t.download
      FROM requests r
      LEFT JOIN request_timings t ON r.id = t.requestId
    `)

    if (!result[0]) {
      console.log("No data to export")
      return
    }

    const columns = [
      "ID",
      "URL",
      "Method",
      "Type",
      "Status",
      "Domain",
      "Path",
      "Start Time",
      "End Time",
      "Duration",
      "Size",
      "Timestamp",
      "Page URL",
      "Error",
      "DNS",
      "TCP",
      "SSL",
      "TTFB",
      "Download",
    ]

    let csv = columns.join(",") + "\n"

    result[0].values.forEach((row) => {
      // Escape fields that might contain commas
      const escapedRow = row.map((field) => {
        if (field === null || field === undefined) return ""
        const str = String(field)
        return str.includes(",") ? `"${str}"` : str
      })

      csv += escapedRow.join(",") + "\n"
    })

    const blob = new Blob([csv], { type: "text/csv" })

    chrome.downloads.download({
      url: URL.createObjectURL(blob),
      filename: `${filename}.csv`,
      saveAs: false,
    })
  } catch (error) {
    console.error("Error exporting CSV:", error)
  }
}

// Export data as PDF (requires additional libraries)
function exportPDF(filename) {
  // This would require a PDF generation library
  // For simplicity, we'll just notify that it's not implemented
  chrome.runtime.sendMessage({
    action: "notification",
    message: "PDF export is not implemented yet",
  })
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getRequests") {
    // Return in-memory requests for quick access
    sendResponse({ requests: capturedRequests })
  } else if (message.action === "getRequestsFromDB") {
    // Query the database for requests with pagination
    if (!db) {
      sendResponse({ error: "Database not initialized" })
      return true
    }

    const { page = 1, limit = 100, filters = {} } = message
    const offset = (page - 1) * limit

    try {
      let query = `
        SELECT r.*, t.dns, t.tcp, t.ssl, t.ttfb, t.download
        FROM requests r
        LEFT JOIN request_timings t ON r.id = t.requestId
        WHERE 1=1
      `

      const params = []

      // Apply filters
      if (filters.domain) {
        query += " AND r.domain LIKE ?"
        params.push(`%${filters.domain}%`)
      }

      if (filters.status) {
        query += " AND r.status = ?"
        params.push(filters.status)
      }

      if (filters.type) {
        query += " AND r.type = ?"
        params.push(filters.type)
      }

      if (filters.startDate) {
        query += " AND r.timestamp >= ?"
        params.push(new Date(filters.startDate).getTime())
      }

      if (filters.endDate) {
        query += " AND r.timestamp <= ?"
        params.push(new Date(filters.endDate).getTime())
      }

      // Add order and pagination
      query += " ORDER BY r.timestamp DESC LIMIT ? OFFSET ?"
      params.push(limit, offset)

      // Execute query
      const results = db.exec(query, params)

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as count
        FROM requests r
        WHERE 1=1
      `

      // Apply the same filters to count query
      if (filters.domain) {
        countQuery += " AND r.domain LIKE ?"
      }

      if (filters.status) {
        countQuery += " AND r.status = ?"
      }

      if (filters.type) {
        countQuery += " AND r.type = ?"
      }

      if (filters.startDate) {
        countQuery += " AND r.timestamp >= ?"
      }

      if (filters.endDate) {
        countQuery += " AND r.timestamp <= ?"
      }

      const countResult = db.exec(countQuery, params.slice(0, -2))

      sendResponse({
        requests: results[0] ? results[0].values : [],
        columns: results[0] ? results[0].columns : [],
        total: countResult[0] ? countResult[0].values[0][0] : 0,
        page,
        limit,
      })
    } catch (error) {
      console.error("Error querying database:", error)
      sendResponse({ error: "Error querying database" })
    }
  } else if (message.action === "clearRequests") {
    capturedRequests = []

    // Clear database tables
    if (db) {
      db.run("DELETE FROM request_headers")
      db.run("DELETE FROM request_timings")
      db.run("DELETE FROM requests")
    }

    sendResponse({ success: true })
  } else if (message.action === "exportData") {
    const { format, filename } = message

    switch (format) {
      case "sqlite":
        exportSQLite(filename)
        break
      case "csv":
        exportCSV(filename)
        break
      case "pdf":
        exportPDF(filename)
        break
      case "json":
      default:
        exportJSON(filename)
        break
    }

    sendResponse({ success: true })
  } else if (message.action === "updateConfig") {
    config = { ...config, ...message.config }
    chrome.storage.local.set({ analyzerConfig: config })
    sendResponse({ success: true })
  } else if (message.action === "getConfig") {
    sendResponse({ config })
  } else if (message.action === "getStats") {
    if (!db) {
      sendResponse({ error: "Database not initialized" })
      return true
    }

    try {
      const stats = {
        totalRequests: 0,
        avgResponseTime: 0,
        statusCodes: {},
        topDomains: [],
        requestTypes: {},
        timeDistribution: {},
      }

      // Get total requests
      const totalResult = db.exec("SELECT COUNT(*) FROM requests")
      stats.totalRequests = totalResult[0] ? totalResult[0].values[0][0] : 0

      // Get average response time
      const avgResult = db.exec("SELECT AVG(duration) FROM requests WHERE duration > 0")
      stats.avgResponseTime = avgResult[0] ? Math.round(avgResult[0].values[0][0] || 0) : 0

      // Get status code distribution
      const statusResult = db.exec(`
        SELECT status, COUNT(*) as count
        FROM requests
        WHERE status > 0
        GROUP BY status
        ORDER BY count DESC
      `)

      if (statusResult[0]) {
        statusResult[0].values.forEach((row) => {
          stats.statusCodes[row[0]] = row[1]
        })
      }

      // Get top domains
      const domainResult = db.exec(`
        SELECT domain, COUNT(*) as count
        FROM requests
        WHERE domain != ''
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 10
      `)

      if (domainResult[0]) {
        stats.topDomains = domainResult[0].values.map((row) => ({
          domain: row[0],
          count: row[1],
        }))
      }

      // Get request type distribution
      const typeResult = db.exec(`
        SELECT type, COUNT(*) as count
        FROM requests
        GROUP BY type
        ORDER BY count DESC
      `)

      if (typeResult[0]) {
        typeResult[0].values.forEach((row) => {
          stats.requestTypes[row[0]] = row[1]
        })
      }

      // Get time distribution (last 24 hours by hour)
      const now = Date.now()
      const oneDayAgo = now - 24 * 60 * 60 * 1000

      const timeResult = db.exec(`
        SELECT 
          CAST((timestamp - ${oneDayAgo}) / (3600 * 1000) AS INTEGER) as hour,
          COUNT(*) as count
        FROM requests
        WHERE timestamp >= ${oneDayAgo}
        GROUP BY hour
        ORDER BY hour
      `)

      if (timeResult[0]) {
        // Initialize all hours with 0
        for (let i = 0; i < 24; i++) {
          stats.timeDistribution[i] = 0
        }

        // Fill in actual data
        timeResult[0].values.forEach((row) => {
          const hour = Math.min(Math.max(0, row[0]), 23)
          stats.timeDistribution[hour] = row[1]
        })
      }

      sendResponse({ stats })
    } catch (error) {
      console.error("Error getting stats:", error)
      sendResponse({ error: "Error getting stats" })
    }
  }

  return true // Required for async response
})

// Initialize database when extension loads
initDatabase()

// Listen for configuration changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.analyzerConfig) {
    config = changes.analyzerConfig.newValue
  }
})

