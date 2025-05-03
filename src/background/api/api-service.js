// API service - handles external API endpoints and integration

import { ApiError } from "../errors/error-types.js"

let dbManager = null
let authService = null
let encryptionManager = null
let eventBus = null
let apiConfig = null

// Set up API service
export function setupApiService(config, database, auth, encryption, events) {
  apiConfig = config
  dbManager = database
  authService = auth
  encryptionManager = encryption
  eventBus = events

  console.log("API service initialized")

  return {
    handleApiRequest,
    registerExternalClient,
    revokeExternalClient,
    getApiStatus,
    getApiDocumentation,
  }
}

// Handle API request
function handleApiRequest(request, sender) {
  // Validate sender
  if (!isValidSender(sender)) {
    return { error: "Unauthorized sender" }
  }

  // Validate authentication if required
  if (apiConfig.requireAuth) {
    if (!request.token || !authService.validateToken(request.token)) {
      return { error: "Unauthorized" }
    }

    // Validate CSRF token if provided and required
    if (apiConfig.useCsrf && request.csrfToken && !authService.validateCsrfToken(request.csrfToken)) {
      return { error: "Invalid CSRF token" }
    }
  }

  // Apply rate limiting if enabled
  if (apiConfig.rateLimiting.enabled) {
    const rateLimitResult = checkRateLimit(sender.url)
    if (!rateLimitResult.allowed) {
      return { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter }
    }
  }

  // Handle request based on endpoint
  try {
    switch (request.endpoint) {
      case "getRequests":
        return handleGetRequests(request)

      case "getStats":
        return handleGetStats(request)

      case "clearRequests":
        return handleClearRequests(request)

      case "exportData":
        return handleExportData(request)

      case "getConfig":
        return handleGetConfig(request)

      case "updateConfig":
        return handleUpdateConfig(request)

      case "getUser":
        return handleGetUser(request)

      case "getSyncStatus":
        return handleGetSyncStatus(request)

      default:
        return { error: `Unknown endpoint: ${request.endpoint}` }
    }
  } catch (error) {
    console.error(`API error handling ${request.endpoint}:`, error)
    return { error: error.message }
  }
}

// Check if sender is valid
function isValidSender(sender) {
  try {
    if (!apiConfig.enabled) {
      return false
    }

    if (!sender || !sender.url) {
      return false
    }

    const url = new URL(sender.url)

    // Check if domain or subdomain is allowed
    return apiConfig.allowedDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
  } catch (error) {
    return false
  }
}

// Check rate limit
function checkRateLimit(senderUrl) {
  try {
    if (!apiConfig.rateLimiting.enabled) {
      return { allowed: true }
    }

    const domain = new URL(senderUrl).hostname
    const now = Date.now()

    // Get rate limit data from storage
    const rateLimitKey = `rateLimit:${domain}`
    let rateLimitData = sessionStorage.getItem(rateLimitKey)

    if (rateLimitData) {
      rateLimitData = JSON.parse(rateLimitData)

      // Check if time window has passed
      if (now - rateLimitData.timestamp > apiConfig.rateLimiting.timeWindow) {
        // Reset rate limit
        rateLimitData = {
          count: 1,
          timestamp: now,
        }
      } else {
        // Increment count
        rateLimitData.count++
      }

      // Check if rate limit exceeded
      if (rateLimitData.count > apiConfig.rateLimiting.maxRequests) {
        const retryAfter = Math.ceil((rateLimitData.timestamp + apiConfig.rateLimiting.timeWindow - now) / 1000)

        return { allowed: false, retryAfter }
      }
    } else {
      // First request
      rateLimitData = {
        count: 1,
        timestamp: now,
      }
    }

    // Save rate limit data
    sessionStorage.setItem(rateLimitKey, JSON.stringify(rateLimitData))

    return { allowed: true }
  } catch (error) {
    console.error("Error checking rate limit:", error)
    return { allowed: true } // Allow on error
  }
}

// Handle getRequests endpoint
function handleGetRequests(request) {
  if (!dbManager) {
    throw new ApiError("Database not initialized")
  }

  try {
    const filters = request.filters || {}
    const page = request.page || 1
    const limit = request.limit || 100

    const result = dbManager.getRequests({ page, limit, filters })
    return result
  } catch (error) {
    console.error("API error getting requests:", error)
    throw new ApiError("Failed to get requests", error)
  }
}

// Handle getStats endpoint
function handleGetStats(request) {
  if (!dbManager) {
    throw new ApiError("Database not initialized")
  }

  try {
    const stats = dbManager.getDatabaseStats()
    return { stats }
  } catch (error) {
    console.error("API error getting stats:", error)
    throw new ApiError("Failed to get stats", error)
  }
}

// Handle clearRequests endpoint
function handleClearRequests(request) {
  if (!dbManager) {
    throw new ApiError("Database not initialized")
  }

  // Check if user has permission to clear requests
  if (!authService.hasPermission("delete")) {
    throw new ApiError("Permission denied")
  }

  try {
    dbManager.clearDatabase()

    // Log the action
    logApiAction(request.token, "clearRequests")

    return { success: true }
  } catch (error) {
    console.error("API error clearing requests:", error)
    throw new ApiError("Failed to clear requests", error)
  }
}

// Handle exportData endpoint
function handleExportData(request) {
  if (!dbManager) {
    throw new ApiError("Database not initialized")
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
    throw new ApiError("Failed to export data", error)
  }
}

// Handle getConfig endpoint
function handleGetConfig(request) {
  // Check if user has permission to get config
  if (!authService.hasPermission("read")) {
    throw new ApiError("Permission denied")
  }

  try {
    // Get config from storage
    return new Promise((resolve, reject) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get("analyzerConfig", (result) => {
          if (chrome.runtime.lastError) {
            reject(new ApiError(chrome.runtime.lastError.message))
          } else {
            // Add check for result
            const config = result?.analyzerConfig || {}

            // Remove sensitive fields
            const filteredConfig = { ...config }

            if (filteredConfig.security) {
              delete filteredConfig.security.encryption
            }

            if (filteredConfig.sync) {
              delete filteredConfig.sync.serverUrl
            }

            resolve({ config: filteredConfig })
          }
        })
      } else {
        reject(new ApiError("Chrome storage API not available."))
      }
    })
  } catch (error) {
    console.error("API error getting config:", error)
    throw new ApiError("Failed to get config", error)
  }
}

// Handle updateConfig endpoint
function handleUpdateConfig(request) {
  // Check if user has permission to update config
  if (!authService.hasPermission("write")) {
    throw new ApiError("Permission denied")
  }

  try {
    // Get current config
    return new Promise((resolve, reject) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get("analyzerConfig", (result) => {
          if (chrome.runtime.lastError) {
            reject(new ApiError(chrome.runtime.lastError.message))
          } else {
            // Add check for result
            const currentConfig = result?.analyzerConfig || {}

            // Merge with new config
            const newConfig = { ...currentConfig }

            // Only allow updating certain sections
            const allowedSections = ["ui", "capture", "export", "notifications"]

            for (const section of allowedSections) {
              if (request.config && request.config[section]) {
                newConfig[section] = {
                  ...newConfig[section],
                  ...request.config[section],
                }
              }
            }

            // Save updated config
            chrome.storage.local.set({ analyzerConfig: newConfig }, () => {
              if (chrome.runtime.lastError) {
                reject(new ApiError(chrome.runtime.lastError.message))
              } else {
                // Log the action
                logApiAction(request.token, "updateConfig")

                // Publish config updated event
                eventBus.publish("config:updated", newConfig)

                resolve({ success: true })
              }
            })
          }
        })
      } else {
        reject(new ApiError("Chrome storage API not available."))
      }
    })
  } catch (error) {
    console.error("API error updating config:", error)
    throw new ApiError("Failed to update config", error)
  }
}

// Handle getUser endpoint
function handleGetUser(request) {
  try {
    const user = authService.getCurrentUser()

    if (!user) {
      return { authenticated: false }
    }

    // Filter sensitive information
    const filteredUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    }

    return {
      authenticated: true,
      user: filteredUser,
    }
  } catch (error) {
    console.error("API error getting user:", error)
    throw new ApiError("Failed to get user", error)
  }
}

// Handle getSyncStatus endpoint
function handleGetSyncStatus(request) {
  try {
    // Get last sync timestamp
    return new Promise((resolve, reject) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get(["lastSyncTimestamp", "syncQueue"], (result) => {
          if (chrome.runtime.lastError) {
            reject(new ApiError(chrome.runtime.lastError.message))
          } else {
            resolve({
              lastSync: result.lastSyncTimestamp || 0,
              queueSize: result.syncQueue ? result.syncQueue.length : 0,
              enabled: apiConfig.sync && apiConfig.sync.enabled,
            })
          }
        })
      } else {
        reject(new ApiError("Chrome storage API not available."))
      }
    })
  } catch (error) {
    console.error("API error getting sync status:", error)
    throw new ApiError("Failed to get sync status", error)
  }
}

// Register external client
function registerExternalClient(clientInfo) {
  if (!apiConfig.enabled) {
    throw new ApiError("API is not enabled")
  }

  if (!authService || !authService.isAuthenticated()) {
    throw new ApiError("Authentication required")
  }

  try {
    // Generate client ID and secret
    const clientId = generateClientId()
    const clientSecret = generateClientSecret()

    // Save client info
    const client = {
      id: clientId,
      secret: clientSecret,
      name: clientInfo.name,
      description: clientInfo.description,
      domain: clientInfo.domain,
      createdAt: Date.now(),
      createdBy: authService.getCurrentUser().id,
    }

    // Save to storage
    return new Promise((resolve, reject) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get("apiClients", (result) => {
          const clients = result.apiClients || []
          clients.push(client)

          chrome.storage.local.set({ apiClients: clients }, () => {
            if (chrome.runtime.lastError) {
              reject(new ApiError(chrome.runtime.lastError.message))
            } else {
              // Log the action
              logApiAction(authService.getJwtToken(), "registerClient")

              // Return client credentials
              resolve({
                clientId,
                clientSecret,
                name: client.name,
              })
            }
          })
        })
      } else {
        reject(new ApiError("Chrome storage API not available."))
      }
    })
  } catch (error) {
    console.error("Error registering external client:", error)
    throw new ApiError("Failed to register client", error)
  }
}

// Revoke external client
function revokeExternalClient(clientId) {
  if (!apiConfig.enabled) {
    throw new ApiError("API is not enabled")
  }

  if (!authService || !authService.isAuthenticated()) {
    throw new ApiError("Authentication required")
  }

  try {
    // Remove client from storage
    return new Promise((resolve, reject) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get("apiClients", (result) => {
          const clients = result.apiClients || []
          const updatedClients = clients.filter((client) => client.id !== clientId)

          chrome.storage.local.set({ apiClients: updatedClients }, () => {
            if (chrome.runtime.lastError) {
              reject(new ApiError(chrome.runtime.lastError.message))
            } else {
              // Log the action
              logApiAction(authService.getJwtToken(), "revokeClient")

              resolve({ success: true })
            }
          })
        })
      } else {
        reject(new ApiError("Chrome storage API not available."))
      }
    })
  } catch (error) {
    console.error("Error revoking external client:", error)
    throw new ApiError("Failed to revoke client", error)
  }
}

// Get API status
function getApiStatus() {
  return {
    enabled: apiConfig.enabled,
    requireAuth: apiConfig.requireAuth,
    allowedDomains: apiConfig.allowedDomains,
    rateLimiting: apiConfig.rateLimiting,
  }
}

// Get API documentation
function getApiDocumentation() {
  return {
    version: "1.0.0",
    endpoints: [
      {
        name: "getRequests",
        description: "Get captured requests",
        parameters: {
          page: "Page number (default: 1)",
          limit: "Items per page (default: 100)",
          filters: "Filter criteria",
        },
      },
      {
        name: "getStats",
        description: "Get request statistics",
        parameters: {},
      },
      {
        name: "clearRequests",
        description: "Clear all requests",
        parameters: {},
        requiresPermission: "delete",
      },
      {
        name: "exportData",
        description: "Export data in specified format",
        parameters: {
          format: "Export format (json, csv, sqlite)",
        },
      },
      {
        name: "getConfig",
        description: "Get extension configuration",
        parameters: {},
        requiresPermission: "read",
      },
      {
        name: "updateConfig",
        description: "Update extension configuration",
        parameters: {
          config: "Configuration object",
        },
        requiresPermission: "write",
      },
      {
        name: "getUser",
        description: "Get current user information",
        parameters: {},
      },
      {
        name: "getSyncStatus",
        description: "Get synchronization status",
        parameters: {},
      },
    ],
  }
}

// Generate client ID
function generateClientId() {
  const array = new Uint8Array(8)
  crypto.getRandomValues(array)
  return "client_" + Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// Generate client secret
function generateClientSecret() {
  const array = new Uint8Array(24)
  crypto.getRandomValues(array)
  return "secret_" + Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// Log API action
function logApiAction(token, action) {
  try {
    // Get user ID from token
    let userId = "unknown"

    if (token && authService) {
      const user = authService.getCurrentUser()
      if (user) {
        userId = user.id
      }
    }

    // Log to database if available
    if (dbManager) {
      dbManager.executeQuery(
        `
        INSERT INTO audit_log (userId, action, resource, resourceId, timestamp, ipAddress)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [userId, action, "api", "", Date.now(), "unknown"],
      )
    }
  } catch (error) {
    console.error("Failed to log API action:", error)
  }
}

