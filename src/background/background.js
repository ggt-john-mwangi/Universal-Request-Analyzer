// Main entry point for background script
import { initDatabase } from "./database/db-manager";
import { setupRequestCapture } from "./capture/request-capture";
import { setupMessageHandlers } from "./messaging/message-handler";
import { setupNotifications } from "./notifications/notification-manager";
import { setupAuthSystem } from "./auth/auth-manager";
import { setupRemoteAuthService } from "./auth/remote-auth-service";
import { setupEncryption } from "./security/encryption-manager";
import { setupRemoteSyncService } from "./sync/remote-sync-service";
import { setupErrorMonitoring } from "./monitoring/error-monitor";
import { loadConfig, setupConfigWatcher } from "./config/config-manager";
import { setupExportManager } from "./export/export-manager";
import { setupEventBus } from "./messaging/event-bus";
import { setupCrossBrowserCompat } from "./compat/browser-compat";
import { setupApiService } from "./api/api-service";
// import { getInitSqlJs } from "./database/sql-js-loader.js";
import initSqlJs from "../assets/wasm/sql-wasm.js";
// Initialize the event bus first
const eventBus = setupEventBus();

// Initialize configuration
let config = null;

// Initialize SQLite database
async function initSQLiteDatabase() {
  try {
    const SQL = await initSqlJs({
      locateFile: (file) => {
        if (typeof chrome !== "undefined" && chrome.runtime) {
          return chrome.runtime.getURL(`assets/wasm/${file}`);
        } else if (typeof browser !== "undefined" && browser.runtime) {
          return browser.runtime.getURL(`assets/wasm/${file}`);
        } else {
          console.warn(
            "chrome.runtime.getURL is not available. Using a fallback URL."
          );
          return `assets/wasm/${file}`; // Or a different fallback strategy
        }
      },
      instantiateWasm: async (imports, successCallback) => {
        const wasmFileUrl =
          typeof chrome !== "undefined" && chrome.runtime
            ? chrome.runtime.getURL("assets/wasm/sql-wasm.wasm")
            : "assets/wasm/sql-wasm.wasm";

        const response = await fetch(wasmFileUrl);
        const buffer = await response.arrayBuffer();
        const wasmModule = await WebAssembly.instantiate(buffer, imports);
        successCallback(wasmModule.instance);
        return wasmModule.instance.exports;
      },
    });

    const db = new SQL.Database();

    // Create tables
    db.exec(`
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
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS request_timings (
        requestId TEXT PRIMARY KEY,
        dns INTEGER,
        tcp INTEGER,
        ssl INTEGER,
        ttfb INTEGER,
        download INTEGER,
        FOREIGN KEY(requestId) REFERENCES requests(id)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS request_headers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requestId TEXT,
        name TEXT,
        value TEXT,
        FOREIGN KEY(requestId) REFERENCES requests(id)
      );
    `);

    console.log("SQLite database initialized");

    return db;
  } catch (error) {
    console.error("Failed to initialize SQLite database:", error);
    throw error;
  }
}

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
        updateRequestData(details.requestId, request);
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
    if (db) {
      details.responseHeaders.forEach((header) => {
        db.run(
          "INSERT INTO request_headers (requestId, name, value) VALUES (?, ?, ?)",
          [details.requestId, header.name, header.value]
        );
      });
    }
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

      updateRequestData(details.requestId, request);

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

      updateRequestData(details.requestId, request);
    }
  },
  { urls: ["<all_urls>"] }
);

// Helper function to update request data
function updateRequestData(requestId, requestData) {
  const index = capturedRequests.findIndex((req) => req.id === requestId);

  if (index !== -1) {
    capturedRequests[index] = requestData;
  } else {
    capturedRequests.unshift(requestData);

    // Limit the number of stored requests in memory
    if (capturedRequests.length > config.maxStoredRequests) {
      capturedRequests = capturedRequests.slice(0, config.maxStoredRequests);
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
        ]
      );

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
          ]
        );
      }
    } catch (error) {
      console.error("Error saving request to database:", error);
    }
  }
}

// Main initialization function
async function initialize() {
  try {
    // Load configuration first
    config = await loadConfig();

    // Set up error monitoring
    setupErrorMonitoring(eventBus);

    // Set up cross-browser compatibility layer
    setupCrossBrowserCompat();

    // Initialize encryption system
    const encryptionManager = await setupEncryption(config.security, eventBus);

    // Initialize SQLite database
    const sqliteDb = await initSQLiteDatabase();

    // Initialize database manager with SQLite database
    const dbManager = await initDatabase(
      config.database,
      encryptionManager,
      eventBus,
      sqliteDb
    );

    // Set up authentication systems
    const localAuthManager = await setupAuthSystem(
      config.security.auth,
      eventBus
    );
    const remoteAuthService = await setupRemoteAuthService(
      config.security.remoteAuth,
      eventBus
    );

    // Choose which auth system to use based on configuration
    const authManager = config.security.useRemoteAuth
      ? remoteAuthService
      : localAuthManager;

    // Set up request capture
    setupRequestCapture(config.capture, dbManager, eventBus);

    // Set up notification system
    setupNotifications(config.notifications, eventBus);

    // Set up remote sync
    if (config.sync.enabled) {
      setupRemoteSyncService(
        config.sync,
        dbManager,
        authManager,
        encryptionManager,
        eventBus
      );
    }

    // Set up export manager
    setupExportManager(dbManager, encryptionManager, eventBus);

    // Set up API service
    setupApiService(
      config.api,
      dbManager,
      authManager,
      encryptionManager,
      eventBus
    );

    // Set up message handlers (must be last to ensure all systems are initialized)
    setupMessageHandlers(dbManager, authManager, encryptionManager, eventBus);

    // Watch for configuration changes
    setupConfigWatcher((newConfig) => {
      config = newConfig;
      eventBus.publish("config:updated", newConfig);
    });

    // Log successful initialization
    console.log("Universal Request Analyzer initialized successfully");

    // Notify that the system is ready
    eventBus.publish("system:ready", { timestamp: Date.now() });
  } catch (error) {
    console.error("Failed to initialize Universal Request Analyzer:", error);

    // Attempt to report the error
    try {
      if (
        typeof browser !== "undefined" &&
        browser.runtime &&
        browser.runtime.getBackgroundPage
      ) {
        // browser is available
        const backgroundPage = await browser.runtime.getBackgroundPage();
        const errorMonitor = backgroundPage.errorMonitor;
        if (errorMonitor) {
          errorMonitor.reportCriticalError("initialization_failed", error);
        }
      } else if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.getBackgroundPage
      ) {
        // chrome is available
        const backgroundPage = await chrome.runtime.getBackgroundPage();
        const errorMonitor = backgroundPage.errorMonitor;
        if (errorMonitor) {
          errorMonitor.reportCriticalError("initialization_failed", error);
        }
      } else {
        console.warn(
          "Browser runtime not available, cannot report critical error"
        );
      }
    } catch (e) {
      // Last resort error logging
      console.error("Could not report initialization error:", e);
    }
  }
}

// Start initialization
initialize();
