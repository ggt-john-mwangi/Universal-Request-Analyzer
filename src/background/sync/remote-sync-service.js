// Remote sync service - handles synchronization with remote server

import { SyncError } from "../errors/error-types.js";

let dbManager = null;
let authService = null;
let encryptionManager = null;
let eventBus = null;
let config = null;
let syncInterval = null;
let syncQueue = [];
let isSyncing = false;

// Set up remote sync service
export function setupRemoteSyncService(
  syncConfig,
  database,
  auth,
  encryption,
  events
) {
  config = syncConfig;
  dbManager = database;
  authService = auth;
  encryptionManager = encryption;
  eventBus = events;

  // Set up sync interval if enabled
  if (config.enabled && config.interval > 0) {
    syncInterval = setInterval(syncData, config.interval);
  }

  // Subscribe to events that should trigger sync
  setupSyncSubscriptions();

  // Load pending sync queue from storage
  loadSyncQueue();

  console.log("Remote sync service initialized");

  return {
    syncNow,
    updateSyncConfig,
    getSyncStatus,
    clearSyncQueue,
    uploadData,
    downloadData,
    syncSpecificData,
  };
}

// Set up event subscriptions for sync
function setupSyncSubscriptions() {
  // Sync when a certain number of requests are captured
  let requestCount = 0;

  eventBus.subscribe("request:captured", () => {
    requestCount++;

    if (
      config.enabled &&
      config.syncAfterRequests > 0 &&
      requestCount >= config.syncAfterRequests
    ) {
      syncData();
      requestCount = 0;
    }
  });

  // Sync when user logs in
  eventBus.subscribe("auth:login", () => {
    if (config.enabled && config.syncOnLogin) {
      syncData();
    }
  });

  // Sync when configuration is updated
  eventBus.subscribe("config:updated", (newConfig) => {
    if (newConfig.sync) {
      updateSyncConfig(newConfig.sync);
    }
  });

  // Add to sync queue when database is modified
  eventBus.subscribe("request:saved", (data) => {
    if (config.enabled && config.syncOnChange) {
      addToSyncQueue({
        type: "request",
        action: "save",
        id: data.id,
        timestamp: Date.now(),
      });
    }
  });

  eventBus.subscribe("request:updated", (data) => {
    if (config.enabled && config.syncOnChange) {
      addToSyncQueue({
        type: "request",
        action: "update",
        id: data.id,
        timestamp: Date.now(),
      });
    }
  });

  eventBus.subscribe("request:deleted", (data) => {
    if (config.enabled && config.syncOnChange) {
      addToSyncQueue({
        type: "request",
        action: "delete",
        id: data.id,
        timestamp: Date.now(),
      });
    }
  });

  // Sync when network connection is restored
  // Use self instead of window in service worker context
  if (typeof self !== "undefined" && typeof window === "undefined") {
    // Service worker context - use self
    self.addEventListener("online", () => {
      if (config.enabled && config.syncOnNetworkRestore) {
        syncData();
      }
    });
  } else if (typeof window !== "undefined") {
    // Browser context - use window
    window.addEventListener("online", () => {
      if (config.enabled && config.syncOnNetworkRestore) {
        syncData();
      }
    });
  }
}

// Load sync queue from storage
async function loadSyncQueue() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("syncQueue", (result) => {
        if (result.syncQueue && Array.isArray(result.syncQueue)) {
          syncQueue = result.syncQueue;
        }
        resolve(syncQueue);
      });
    } else {
      resolve(syncQueue);
    }
  });
}

// Save sync queue to storage
async function saveSyncQueue() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ syncQueue }, () => {
        resolve(true);
      });
    } else {
      resolve(false);
    }
  });
}

// Add item to sync queue
function addToSyncQueue(item) {
  // Check if similar item already exists in queue
  const existingIndex = syncQueue.findIndex(
    (queueItem) => queueItem.type === item.type && queueItem.id === item.id
  );

  if (existingIndex !== -1) {
    // Update existing item
    syncQueue[existingIndex] = {
      ...syncQueue[existingIndex],
      action: item.action,
      timestamp: item.timestamp,
    };
  } else {
    // Add new item
    syncQueue.push(item);
  }

  // Save updated queue
  saveSyncQueue();

  // Trigger sync if immediate sync is enabled
  if (config.syncImmediately) {
    syncData();
  }
}

// Process sync queue
async function processSyncQueue() {
  if (syncQueue.length === 0) {
    return { processed: 0 };
  }

  // Group queue items by type for batch processing
  const requestItems = syncQueue.filter((item) => item.type === "request");

  let processed = 0;
  let failed = 0;

  // Process request items
  if (requestItems.length > 0) {
    try {
      const result = await syncRequests(requestItems);
      processed += result.processed;
      failed += result.failed;

      // Remove processed items from queue
      syncQueue = syncQueue.filter(
        (item) =>
          item.type !== "request" ||
          !requestItems.some((reqItem) => reqItem.id === item.id)
      );
    } catch (error) {
      console.error("Error processing request sync items:", error);
      failed += requestItems.length;
    }
  }

  // Save updated queue
  saveSyncQueue();

  return { processed, failed };
}

// Sync requests to server
async function syncRequests(items) {
  if (!authService || !authService.isAuthenticated()) {
    throw new SyncError("Authentication required for sync");
  }

  try {
    // Get unique request IDs
    const requestIds = [...new Set(items.map((item) => item.id))];

    // Get requests from database
    const requests = [];

    for (const id of requestIds) {
      const query = `
        SELECT * FROM requests
        WHERE id = ?
        LIMIT 1
      `;

      const result = dbManager.executeQuery(query, [id]);

      if (result[0] && result[0].values.length > 0) {
        const request = {};

        // Convert to object
        result[0].columns.forEach((column, index) => {
          request[column] = result[0].values[0][index];
        });

        // Get timings
        const timings = dbManager.getRequestTimings(id);
        if (timings) {
          request.timings = timings;
        }

        // Get headers if needed
        if (config.includeHeaders) {
          const headers = dbManager.getRequestHeaders(id);
          if (headers && headers.length > 0) {
            request.headers = headers;
          }
        }

        requests.push(request);
      }
    }

    // Prepare data for sync
    const syncData = {
      requests,
      timestamp: Date.now(),
      deviceId: await getDeviceId(),
      version:
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.getManifest
          ? chrome.runtime.getManifest().version
          : "0.0.0",
    };

    // Encrypt data if needed
    let dataToSend;
    if (
      config.encryptData &&
      encryptionManager &&
      encryptionManager.isEnabled()
    ) {
      dataToSend = encryptionManager.encrypt(JSON.stringify(syncData));
      dataToSend = { encrypted: true, data: dataToSend };
    } else {
      dataToSend = syncData;
    }

    // Get JWT token
    const token = authService.getJwtToken();

    // Send data to server
    const response = await fetch(`${config.serverUrl}/api/sync/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dataToSend),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new SyncError(
        errorData.message || `Server responded with ${response.status}`
      );
    }

    const responseData = await response.json();

    // Update last sync timestamp
    await saveLastSyncTimestamp(Date.now());

    return {
      processed: requests.length,
      failed: 0,
      response: responseData,
    };
  } catch (error) {
    console.error("Error syncing requests:", error);
    throw new SyncError("Failed to sync requests", error);
  }
}

// Sync data with remote server
async function syncData() {
  if (!config.enabled || !config.serverUrl) {
    return;
  }

  // Check if already syncing
  if (isSyncing) {
    return;
  }

  // Check if user is authenticated
  if (config.requireAuth && (!authService || !authService.isAuthenticated())) {
    console.log("Sync skipped: Authentication required");
    return;
  }

  // Check if online
  if (!navigator.onLine) {
    console.log("Sync skipped: Offline");
    return;
  }

  try {
    isSyncing = true;
    eventBus.publish("sync:started", { timestamp: Date.now() });

    // Process sync queue
    const queueResult = await processSyncQueue();

    // Get last sync timestamp
    const lastSync = await getLastSyncTimestamp();

    // Get new requests since last sync
    const newRequests = await getRequestsSinceLastSync(lastSync);

    if (newRequests.length === 0 && queueResult.processed === 0) {
      console.log("No new data to sync");
      eventBus.publish("sync:completed", {
        timestamp: Date.now(),
        itemCount: 0,
      });
      isSyncing = false;
      return;
    }

    // Prepare data for sync
    const syncData = {
      requests: newRequests,
      timestamp: Date.now(),
      deviceId: await getDeviceId(),
      version:
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.getManifest
          ? chrome.runtime.getManifest().version
          : "0.0.0",
    };

    // Encrypt data if needed
    let dataToSend;
    if (
      config.encryptData &&
      encryptionManager &&
      encryptionManager.isEnabled()
    ) {
      dataToSend = encryptionManager.encrypt(JSON.stringify(syncData));
      dataToSend = { encrypted: true, data: dataToSend };
    } else {
      dataToSend = syncData;
    }

    // Get JWT token
    const token = authService.getJwtToken();

    // Send data to server
    const response = await fetch(`${config.serverUrl}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dataToSend),
    });

    if (!response.ok) {
      throw new Error(
        `Server responded with ${response.status}: ${response.statusText}`
      );
    }

    const responseData = await response.json();

    // Process server response (e.g., handle conflicts, updates from server)
    if (responseData.updates && responseData.updates.length > 0) {
      await processServerUpdates(responseData.updates);
    }

    // Update last sync timestamp
    await saveLastSyncTimestamp(Date.now());

    console.log(
      `Synced ${newRequests.length} requests and processed ${queueResult.processed} queue items`
    );

    // Publish sync completed event
    eventBus.publish("sync:completed", {
      timestamp: Date.now(),
      itemCount: newRequests.length + queueResult.processed,
      response: responseData,
    });

    isSyncing = false;
    return responseData;
  } catch (error) {
    console.error("Sync failed:", error);

    // Publish sync error event
    eventBus.publish("sync:error", {
      timestamp: Date.now(),
      error: error.message,
    });

    isSyncing = false;
    throw error;
  }
}

// Process updates from server
async function processServerUpdates(updates) {
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return;
  }

  try {
    // Group updates by type
    const requestUpdates = updates.filter(
      (update) => update.type === "request"
    );

    // Process request updates
    for (const update of requestUpdates) {
      switch (update.action) {
        case "create":
        case "update":
          if (update.data) {
            await dbManager.saveRequest(update.data);

            // Save timings if available
            if (update.data.timings) {
              await dbManager.saveRequestTimings(
                update.data.id,
                update.data.timings
              );
            }

            // Save headers if available
            if (update.data.headers) {
              await dbManager.saveRequestHeaders(
                update.data.id,
                update.data.headers
              );
            }
          }
          break;

        case "delete":
          if (update.id) {
            await dbManager.deleteRequest(update.id);
          }
          break;
      }
    }

    // Publish updates processed event
    eventBus.publish("sync:updates_processed", {
      timestamp: Date.now(),
      count: updates.length,
    });
  } catch (error) {
    console.error("Error processing server updates:", error);
    throw new SyncError("Failed to process server updates", error);
  }
}

// Get requests since last sync
async function getRequestsSinceLastSync(lastSync) {
  if (!dbManager) {
    return [];
  }

  try {
    const query = `
      SELECT * FROM requests
      WHERE timestamp > ?
      ORDER BY timestamp ASC
    `;

    const result = dbManager.executeQuery(query, [lastSync || 0]);

    if (!result[0]) {
      return [];
    }

    // Convert to array of objects
    const requests = [];
    const columns = result[0].columns;

    for (const row of result[0].values) {
      const request = {};

      columns.forEach((column, index) => {
        request[column] = row[index];
      });

      // Get timings
      const timings = dbManager.getRequestTimings(request.id);
      if (timings) {
        request.timings = timings;
      }

      // Get headers if needed
      if (config.includeHeaders) {
        const headers = dbManager.getRequestHeaders(request.id);
        if (headers && headers.length > 0) {
          request.headers = headers;
        }
      }

      requests.push(request);
    }

    return requests;
  } catch (error) {
    console.error("Error getting requests since last sync:", error);
    return [];
  }
}

// Get last sync timestamp
async function getLastSyncTimestamp() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("lastSyncTimestamp", (result) => {
        resolve(result.lastSyncTimestamp || 0);
      });
    } else {
      resolve(0);
    }
  });
}

// Save last sync timestamp
async function saveLastSyncTimestamp(timestamp) {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ lastSyncTimestamp: timestamp }, () => {
        resolve(true);
      });
    } else {
      resolve(true);
    }
  });
}

// Get device ID
async function getDeviceId() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("deviceId", (result) => {
        if (result.deviceId) {
          resolve(result.deviceId);
        } else {
          // Generate a new device ID
          const deviceId = generateDeviceId();
          chrome.storage.local.set({ deviceId }, () => {
            resolve(deviceId);
          });
        }
      });
    } else {
      resolve("no-chrome-storage");
    }
  });
}

// Generate a device ID
function generateDeviceId() {
  const array = new Uint8Array(16);
  if (typeof crypto !== "undefined") {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

// Sync now (manual trigger)
function syncNow() {
  return syncData();
}

// Update sync configuration
function updateSyncConfig(newConfig) {
  // Clear existing interval if it exists
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  // Update config
  config = { ...config, ...newConfig };

  // Set up new interval if enabled
  if (config.enabled && config.interval > 0) {
    syncInterval = setInterval(syncData, config.interval);
  }

  // Publish config updated event
  eventBus.publish("sync:config_updated", {
    timestamp: Date.now(),
    config: config,
  });
}

// Get sync status
function getSyncStatus() {
  return {
    enabled: config.enabled,
    lastSync: getLastSyncTimestamp(),
    queueSize: syncQueue.length,
    isSyncing: isSyncing,
  };
}

// Clear sync queue
function clearSyncQueue() {
  syncQueue = [];
  saveSyncQueue();

  eventBus.publish("sync:queue_cleared", {
    timestamp: Date.now(),
  });

  return true;
}

// Upload data to server (full upload)
async function uploadData(options = {}) {
  if (!config.enabled || !config.serverUrl) {
    throw new SyncError("Sync is not enabled");
  }

  if (!authService || !authService.isAuthenticated()) {
    throw new SyncError("Authentication required for upload");
  }

  try {
    isSyncing = true;
    eventBus.publish("sync:upload_started", { timestamp: Date.now() });

    // Get all requests or filtered requests
    const filters = options.filters || {};
    const result = dbManager.getRequests({
      page: 1,
      limit: options.limit || 1000000, // High limit to get all
      filters,
    });

    if (!result.requests || result.requests.length === 0) {
      eventBus.publish("sync:upload_completed", {
        timestamp: Date.now(),
        itemCount: 0,
      });
      isSyncing = false;
      return { success: true, count: 0 };
    }

    // Convert to objects
    const requests = [];

    for (const row of result.requests) {
      const request = {};

      result.columns.forEach((column, index) => {
        request[column] = row[index];
      });

      // Get timings
      const timings = dbManager.getRequestTimings(request.id);
      if (timings) {
        request.timings = timings;
      }

      // Get headers if needed
      if (config.includeHeaders) {
        const headers = dbManager.getRequestHeaders(request.id);
        if (headers && headers.length > 0) {
          request.headers = headers;
        }
      }

      requests.push(request);
    }

    // Prepare data for upload
    const uploadData = {
      requests,
      timestamp: Date.now(),
      deviceId: await getDeviceId(),
      version:
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.getManifest
          ? chrome.runtime.getManifest().version
          : "0.0.0",
      fullUpload: true,
    };

    // Encrypt data if needed
    let dataToSend;
    if (
      config.encryptData &&
      encryptionManager &&
      encryptionManager.isEnabled()
    ) {
      dataToSend = encryptionManager.encrypt(JSON.stringify(uploadData));
      dataToSend = { encrypted: true, data: dataToSend };
    } else {
      dataToSend = uploadData;
    }

    // Get JWT token
    const token = authService.getJwtToken();

    // Send data to server
    const response = await fetch(`${config.serverUrl}/api/sync/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dataToSend),
    });

    if (!response.ok) {
      throw new Error(
        `Server responded with ${response.status}: ${response.statusText}`
      );
    }

    const responseData = await response.json();

    // Update last sync timestamp
    await saveLastSyncTimestamp(Date.now());

    // Publish upload completed event
    eventBus.publish("sync:upload_completed", {
      timestamp: Date.now(),
      itemCount: requests.length,
      response: responseData,
    });

    isSyncing = false;
    return {
      success: true,
      count: requests.length,
      response: responseData,
    };
  } catch (error) {
    console.error("Upload failed:", error);

    // Publish upload error event
    eventBus.publish("sync:upload_error", {
      timestamp: Date.now(),
      error: error.message,
    });

    isSyncing = false;
    throw new SyncError("Upload failed", error);
  }
}

// Download data from server
async function downloadData(options = {}) {
  if (!config.enabled || !config.serverUrl) {
    throw new SyncError("Sync is not enabled");
  }

  if (!authService || !authService.isAuthenticated()) {
    throw new SyncError("Authentication required for download");
  }

  try {
    isSyncing = true;
    eventBus.publish("sync:download_started", { timestamp: Date.now() });

    // Prepare request parameters
    const params = new URLSearchParams();

    if (options.since) {
      params.append("since", options.since);
    }

    if (options.limit) {
      params.append("limit", options.limit);
    }

    if (options.filters) {
      params.append("filters", JSON.stringify(options.filters));
    }

    // Get JWT token
    const token = authService.getJwtToken();

    // Send request to server
    const response = await fetch(
      `${config.serverUrl}/api/sync/download?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Server responded with ${response.status}: ${response.statusText}`
      );
    }

    const responseData = await response.json();

    // Process downloaded data
    let requests = [];

    if (
      responseData.encrypted &&
      encryptionManager &&
      encryptionManager.isEnabled()
    ) {
      // Decrypt data
      const decrypted = encryptionManager.decrypt(responseData.data);
      requests = JSON.parse(decrypted).requests || [];
    } else {
      requests = responseData.requests || [];
    }

    // Save requests to database
    let savedCount = 0;

    for (const request of requests) {
      try {
        // Save request
        dbManager.saveRequest(request);

        // Save timings if available
        if (request.timings) {
          dbManager.saveRequestTimings(request.id, request.timings);
        }

        // Save headers if available
        if (request.headers) {
          dbManager.saveRequestHeaders(request.id, request.headers);
        }

        savedCount++;
      } catch (error) {
        console.error(`Error saving downloaded request ${request.id}:`, error);
      }
    }

    // Update last sync timestamp
    await saveLastSyncTimestamp(Date.now());

    // Publish download completed event
    eventBus.publish("sync:download_completed", {
      timestamp: Date.now(),
      itemCount: savedCount,
      totalItems: requests.length,
    });

    isSyncing = false;
    return {
      success: true,
      count: savedCount,
      total: requests.length,
    };
  } catch (error) {
    console.error("Download failed:", error);

    // Publish download error event
    eventBus.publish("sync:download_error", {
      timestamp: Date.now(),
      error: error.message,
    });

    isSyncing = false;
    throw new SyncError("Download failed", error);
  }
}

// Sync specific data types
async function syncSpecificData(dataType, options = {}) {
  if (!config.enabled || !config.serverUrl) {
    throw new SyncError("Sync is not enabled");
  }

  if (!authService || !authService.isAuthenticated()) {
    throw new SyncError("Authentication required for sync");
  }

  try {
    isSyncing = true;
    eventBus.publish(`sync:${dataType}_started`, { timestamp: Date.now() });

    // Get JWT token
    const token = authService.getJwtToken();

    // Send request to server
    const response = await fetch(`${config.serverUrl}/api/sync/${dataType}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new Error(
        `Server responded with ${response.status}: ${response.statusText}`
      );
    }

    const responseData = await response.json();

    // Update last sync timestamp
    await saveLastSyncTimestamp(Date.now());

    // Publish sync completed event
    eventBus.publish(`sync:${dataType}_completed`, {
      timestamp: Date.now(),
      response: responseData,
    });

    isSyncing = false;
    return responseData;
  } catch (error) {
    console.error(`${dataType} sync failed:`, error);

    // Publish sync error event
    eventBus.publish(`sync:${dataType}_error`, {
      timestamp: Date.now(),
      error: error.message,
    });

    isSyncing = false;
    throw new SyncError(`${dataType} sync failed`, error);
  }
}
