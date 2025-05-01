// Main entry point for background script
import { initDatabase } from "./database/db-manager";
import { setupRequestCapture } from "./capture/request-capture";
import { setupMessageHandlers } from "./messaging/message-handler";
import { setupNotifications } from "./notifications/notification-manager";
import { setupAuthSystem } from "./auth/auth-manager";
import { setupRemoteAuthService } from "./auth/remote-auth-service";
import { setupEncryption } from "./security/encryption-manager";
import { setupRemoteSyncService } from "./sync/remote-sync-service";
import { setupErrorMonitoring } from "./monitoring/error-monitor.js";
import { loadConfig, setupConfigWatcher } from "./config/config-manager";
import { setupExportManager } from "./export/export-manager";
import { setupImportManager } from "./import/import-manager.js";
import { setupEventBus } from "./messaging/event-bus";
import { setupCrossBrowserCompat } from "./compat/browser-compat";
import { setupApiService } from "./api/api-service";
import { setupApiEndpoints } from "./api/api-manager.js";

// Initialize the database when the extension starts
chrome.runtime.onStartup.addListener(async () => {
  try {
    await initDatabase();
    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
});

// Initialize the event bus first
const eventBus = setupEventBus();

// Initialize configuration
let config = null;

// Parse URL to extract domain and path
function parseUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return {
      domain: parsedUrl.hostname,
      path: parsedUrl.pathname,
    };
  } catch (e) {
    return {
      domain: "",
      path: "",
    };
  }
}

// Listen for web requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!config.captureEnabled) return;

    // Check if we should capture this request type
    if (!config.captureFilters.includeTypes.includes(details.type)) return;

    const { domain, path } = parseUrl(details.url);

    // Check domain filters
    if (config.captureFilters.excludeDomains.includes(domain)) return;
    if (
      config.captureFilters.includeDomains.length > 0 &&
      !config.captureFilters.includeDomains.includes(domain)
    )
      return;

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
    };

    // Get the page URL
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError) {
        // Tab might not exist anymore
        return;
      }

      if (tab && tab.url) {
        request.pageUrl = tab.url;
        dbManager.saveRequest(request);
      }
    });
  },
  { urls: ["<all_urls>"] }
);

// Listen for headers received
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!config.captureEnabled) return;

    const request = capturedRequests.find(
      (req) => req.id === details.requestId
    );
    if (!request) return;

    // Extract content length from headers
    const contentLengthHeader = details.responseHeaders.find(
      (h) => h.name.toLowerCase() === "content-length"
    );

    if (contentLengthHeader) {
      request.size = Number.parseInt(contentLengthHeader.value, 10) || 0;
    }

    // Store headers if needed
    dbManager.saveRequestHeaders(details.requestId, details.responseHeaders);
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Listen for completed requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!config.captureEnabled) return;

    const endTime = details.timeStamp;
    const request = capturedRequests.find(
      (req) => req.id === details.requestId
    );

    if (request) {
      request.status = "completed";
      request.statusCode = details.statusCode;
      request.statusText = details.statusLine;
      request.timings.endTime = endTime;
      request.timings.duration = endTime - request.timings.startTime;

      dbManager.updateRequest(request);

      // Send updated data to popup if open
      chrome.runtime
        .sendMessage({
          action: "requestUpdated",
          request: request,
        })
        .catch(() => {
          // Popup might not be open, ignore error
        });
    }
  },
  { urls: ["<all_urls>"] }
);

// Listen for error requests
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (!config.captureEnabled) return;

    const request = capturedRequests.find(
      (req) => req.id === details.requestId
    );

    if (request) {
      request.status = "error";
      request.error = details.error;
      request.timings.endTime = details.timeStamp;
      request.timings.duration = details.timeStamp - request.timings.startTime;

      dbManager.updateRequest(request);
    }
  },
  { urls: ["<all_urls>"] }
);

// Main initialization function
async function initialize() {
  console.log("Initializing background script...");

  try {
    const eventBus = setupEventBus();
    const configManager = await setupConfigManager(eventBus); // Wait for config to load
    const encryptionManager = setupEncryptionManager(configManager); // Pass config if needed for keys etc.
    const dbManager = await initDatabase(
      configManager.getConfigValue("database"), // Pass DB specific config
      encryptionManager,
      eventBus,
      configManager // Pass config manager
    );
    const authManager = setupAuthManager(dbManager, configManager, eventBus); // Pass dbManager for user/token checks
    const errorMonitor = setupErrorMonitoring(eventBus, configManager); // Pass config manager
    const captureManager = setupRequestCapture(dbManager, configManager, eventBus);
    const exportManager = setupExportManager(dbManager, encryptionManager, eventBus); // Pass dbManager
    const importManager = setupImportManager(dbManager, eventBus); // Pass dbManager
    const apiManager = setupApiEndpoints(dbManager, authManager, encryptionManager, eventBus); // Setup API endpoints

    // Setup message handler last, passing all managers
    setupMessageHandlers(
      dbManager,
      configManager,
      captureManager,
      exportManager,
      importManager,
      authManager,
      encryptionManager,
      errorMonitor,
      apiManager // Pass API manager
    );

    // Watch for configuration changes
    setupConfigWatcher((newConfig) => {
      config = newConfig;
      eventBus.publish("config:updated", newConfig);
    });

    // Log successful initialization
    console.log("Background script initialized successfully.");

    // Notify that the system is ready
    eventBus.publish("system:ready", { timestamp: Date.now() });
  } catch (error) {
    console.error("Background script initialization failed:", error);
    // Use error monitor if available, otherwise basic console log
    if (typeof errorMonitor !== 'undefined' && errorMonitor.reportCriticalError) {
        errorMonitor.reportCriticalError("initialization_failed", error);
    }
  }
}

// Start initialization
initialize();
