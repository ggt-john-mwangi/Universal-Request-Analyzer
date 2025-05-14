// Sync manager - handles synchronization with remote server

let dbManager = null
let authManager = null
let encryptionManager = null
let eventBus = null
let config = null
let syncInterval = null

// Set up remote sync
export function setupRemoteSync(syncConfig, database, auth, encryption, events) {
  config = syncConfig
  dbManager = database
  authManager = auth
  encryptionManager = encryption
  eventBus = events

  // Set up sync interval if enabled
  if (config.enabled && config.interval > 0) {
    syncInterval = setInterval(syncData, config.interval)
  }

  // Subscribe to events that should trigger sync
  setupSyncSubscriptions()

  console.log("Remote sync initialized")

  return {
    syncNow,
    updateSyncConfig,
  }
}

// Set up event subscriptions for sync
function setupSyncSubscriptions() {
  // Sync when a certain number of requests are captured
  let requestCount = 0

  eventBus.subscribe("request:captured", () => {
    requestCount++

    if (config.enabled && config.syncAfterRequests > 0 && requestCount >= config.syncAfterRequests) {
      syncData()
      requestCount = 0
    }
  })

  // Sync when user logs in
  eventBus.subscribe("auth:login", () => {
    if (config.enabled && config.syncOnLogin) {
      syncData()
    }
  })

  // Sync when configuration is updated
  eventBus.subscribe("config:updated", (newConfig) => {
    if (newConfig.sync) {
      updateSyncConfig(newConfig.sync)
    }
  })
}

// Sync data with remote server
async function syncData() {
  if (!config.enabled || !config.serverUrl) {
    return
  }

  // Check if user is authenticated
  if (config.requireAuth && (!authManager || !authManager.isAuthenticated())) {
    console.log("Sync skipped: Authentication required")
    return
  }

  try {
    eventBus.publish("sync:started", { timestamp: Date.now() })

    // Get last sync timestamp
    const lastSync = await getLastSyncTimestamp()

    // Get new requests since last sync
    const newRequests = await getRequestsSinceLastSync(lastSync)

    if (newRequests.length === 0) {
      console.log("No new requests to sync")
      eventBus.publish("sync:completed", {
        timestamp: Date.now(),
        itemCount: 0,
      })
      return
    }

    // Prepare data for sync
    const syncData = {
      requests: newRequests,
      timestamp: Date.now(),
      deviceId: await getDeviceId(),
      version: chrome && chrome.runtime ? chrome.runtime.getManifest().version : "0.0.0",
    }

    // Encrypt data if needed
    let dataToSend
    if (config.encryptData && encryptionManager && encryptionManager.isEnabled()) {
      dataToSend = encryptionManager.encrypt(JSON.stringify(syncData))
      dataToSend = { encrypted: true, data: dataToSend }
    } else {
      dataToSend = syncData
    }

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
    }

    // Add authentication if available
    if (authManager && authManager.isAuthenticated()) {
      const user = authManager.getCurrentUser()
      headers["Authorization"] = `Bearer ${user.token}`

      // Add CSRF token if needed
      if (config.useCsrf) {
        headers["X-CSRF-Token"] = authManager.generateCsrfToken()
      }
    }

    // Send data to server
    const response = await fetch(config.serverUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(dataToSend),
    })

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`)
    }

    const responseData = await response.json()

    // Update last sync timestamp
    await saveLastSyncTimestamp(Date.now())

    console.log(`Synced ${newRequests.length} requests`)

    // Publish sync completed event
    eventBus.publish("sync:completed", {
      timestamp: Date.now(),
      itemCount: newRequests.length,
      response: responseData,
    })

    return responseData
  } catch (error) {
    console.error("Sync failed:", error)

    // Publish sync error event
    eventBus.publish("sync:error", {
      timestamp: Date.now(),
      error: error.message,
    })

    throw error
  }
}

// Get requests since last sync
async function getRequestsSinceLastSync(lastSync) {
  if (!dbManager) {
    return []
  }

  try {
    const query = `
      SELECT * FROM requests
      WHERE timestamp > ?
      ORDER BY timestamp ASC
    `

    const result = dbManager.executeQuery(query, [lastSync || 0])

    if (!result[0]) {
      return []
    }

    // Convert to array of objects
    const requests = []
    const columns = result[0].columns

    for (const row of result[0].values) {
      const request = {}

      columns.forEach((column, index) => {
        request[column] = row[index]
      })

      // Get timings
      const timings = dbManager.getRequestTimings(request.id)
      if (timings) {
        request.timings = timings
      }

      // Get headers if needed
      if (config.includeHeaders) {
        const headers = dbManager.getRequestHeaders(request.id)
        if (headers && headers.length > 0) {
          request.headers = headers
        }
      }

      requests.push(request)
    }

    return requests
  } catch (error) {
    console.error("Error getting requests since last sync:", error)
    return []
  }
}

// Get last sync timestamp
async function getLastSyncTimestamp() {
  if (dbManager && dbManager.getLastSyncTimestamp) {
    return dbManager.getLastSyncTimestamp();
  }
  return 0;
}

// Save last sync timestamp
async function saveLastSyncTimestamp(timestamp) {
  if (dbManager && dbManager.saveLastSyncTimestamp) {
    dbManager.saveLastSyncTimestamp(timestamp);
    return true;
  }
  return false;
}

// Get device ID
async function getDeviceId() {
  if (dbManager && dbManager.getDeviceId) {
    let deviceId = dbManager.getDeviceId();
    if (deviceId) {
      return deviceId;
    } else {
      // Generate a new device ID
      deviceId = generateDeviceId();
      if (dbManager.saveDeviceId) dbManager.saveDeviceId(deviceId);
      return deviceId;
    }
  }
  return null;
}

// Generate a device ID
function generateDeviceId() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// Sync now (manual trigger)
function syncNow() {
  return syncData()
}

// Update sync configuration
function updateSyncConfig(newConfig) {
  // Clear existing interval if it exists
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }

  // Update config
  config = { ...config, ...newConfig }

  // Set up new interval if enabled
  if (config.enabled && config.interval > 0) {
    syncInterval = setInterval(syncData, config.interval)
  }

  // Publish config updated event
  eventBus.publish("sync:config_updated", {
    timestamp: Date.now(),
    config: config,
  })
}

