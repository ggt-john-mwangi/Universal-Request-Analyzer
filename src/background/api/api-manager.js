// API manager - handles external API endpoints

let dbManager = null
let authManager = null
let encryptionManager = null
let eventBus = null

// Set up API endpoints
export function setupApiEndpoints(database, auth, encryption, events) {
  dbManager = database
  authManager = auth
  encryptionManager = encryption
  eventBus = events

  console.log("API endpoints initialized")

  return {
    handleApiRequest,
  }
}

// Handle API request
function handleApiRequest(request, sender) {
  // Validate sender
  if (!isValidSender(sender)) {
    return { error: "Unauthorized sender" }
  }

  // Validate authentication
  if (!request.token || !authManager.validateToken(request.token)) {
    return { error: "Unauthorized" }
  }

  // Handle request based on endpoint
  switch (request.endpoint) {
    case "getRequests":
      return handleGetRequests(request)

    case "getStats":
      return handleGetStats(request)

    case "clearRequests":
      return handleClearRequests(request)

    case "exportData":
      return handleExportData(request)

    default:
      return { error: `Unknown endpoint: ${request.endpoint}` }
  }
}

// Check if sender is valid
function isValidSender(sender) {
  try {
    const allowedDomains = ["example.com"]
    const url = new URL(sender.url)

    // Check if domain or subdomain is allowed
    return allowedDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
  } catch (error) {
    return false
  }
}

// Handle getRequests endpoint
function handleGetRequests(request) {
  if (!dbManager) {
    return { error: "Database not initialized" }
  }

  try {
    const filters = request.filters || {}
    const page = request.page || 1
    const limit = request.limit || 100

    const result = dbManager.getRequests({ page, limit, filters })
    return result
  } catch (error) {
    console.error("API error getting requests:", error)
    return { error: error.message }
  }
}

// Handle getStats endpoint
function handleGetStats(request) {
  if (!dbManager) {
    return { error: "Database not initialized" }
  }

  try {
    const stats = dbManager.getDatabaseStats()
    return { stats }
  } catch (error) {
    console.error("API error getting stats:", error)
    return { error: error.message }
  }
}

// Handle clearRequests endpoint
function handleClearRequests(request) {
  if (!dbManager) {
    return { error: "Database not initialized" }
  }

  // Check if user has permission to clear requests
  if (!authManager.hasPermission("delete")) {
    return { error: "Permission denied" }
  }

  try {
    dbManager.clearDatabase()

    // Log the action
    logApiAction(request.token, "clearRequests")

    return { success: true }
  } catch (error) {
    console.error("API error clearing requests:", error)
    return { error: error.message }
  }
}

// Handle exportData endpoint
function handleExportData(request) {
  if (!dbManager) {
    return { error: "Database not initialized" }
  }

  try {
    const format = request.format || "json"

    // Export data
    const data = dbManager.exportDatabase(format)

    // Log the action
    logApiAction(request.token, "exportData")

    return { data }
  } catch (error) {
    console.error("API error exporting data:", error)
    return { error: error.message }
  }
}

// Log API action
function logApiAction(token, action) {
  if (!dbManager) return

  try {
    // Get user ID from token
    const userId = getUserIdFromToken(token)

    if (!userId) return

    // Log to audit log
    dbManager.executeQuery(
      `
      INSERT INTO audit_log (userId, action, resource, resourceId, timestamp, ipAddress)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        userId,
        action,
        "api",
        "",
        Date.now(),
        "unknown", // In a real system, you would get this from the request
      ],
    )
  } catch (error) {
    console.error("Failed to log API action:", error)
  }
}

// Get user ID from token
function getUserIdFromToken(token) {
  try {
    // In a real system, you would decode the token
    // For this example, we'll just query the database

    const result = dbManager.executeQuery("SELECT userId FROM sessions WHERE token = ? LIMIT 1", [token])

    if (!result[0] || result[0].values.length === 0) {
      return null
    }

    return result[0].values[0][0]
  } catch (error) {
    console.error("Error getting user ID from token:", error)
    return null
  }
}

