// Main entry point for background script
import { initDatabase } from "./database/db-manager";
import { setupRequestCapture } from "./capture/request-capture";
import { setupMessageHandlers } from "./messaging/message-handler";
import { setupNotifications } from "./notifications/notification-manager";
// Import both setupAuthSystem and setDatabaseManager
import { setupAuthSystem, setDatabaseManager } from "./auth/auth-manager";
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

// Global config variable
let config = null;
let dbManager = null; // Make dbManager accessible globally or pass it where needed
let captureManager = null; // Declare captureManager globally
let errorMonitor = null; // Declare errorMonitor globally for use in catch block

// Initialize the database when the extension starts
chrome.runtime.onStartup.addListener(async () => {
  try {
    // Load config first on startup as well, if needed early
    config = await loadConfig();
    dbManager = await initDatabase(config?.database, null, setupEventBus(), { getConfig: () => config }); // Pass minimal dependencies initially
    console.log("Database initialized successfully on startup.");
  } catch (error) {
    console.error("Failed to initialize database on startup:", error);
  }
});

// Initialize the event bus first
const eventBus = setupEventBus();

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

// Main initialization function
async function initialize() {
  console.log("Initializing background script...");

  try {
    // Load configuration first
    config = await loadConfig();
    console.log("Configuration loaded:", config);

    // Setup managers, passing config and eventBus
    const encryptionManager = await setupEncryption(config.security, eventBus);
    // Initialize DB *after* config is loaded
    dbManager = await initDatabase(
      config.database,
      encryptionManager,
      eventBus,
      { getConfig: () => config, getConfigValue: (key) => config[key] } // Provide a minimal config manager interface
    );
    // Setup auth system
    const authManager = await setupAuthSystem(config.security?.auth, eventBus);
    // Inject dbManager dependency into authManager using the imported function
    setDatabaseManager(dbManager);

    // Initialize errorMonitor and captureManager here
    errorMonitor = setupErrorMonitoring(eventBus, { getConfigValue: (key) => config[key] });
    captureManager = setupRequestCapture(dbManager, config.capture, eventBus); // Pass capture config directly
    const exportManager = setupExportManager(dbManager, encryptionManager, eventBus);
    const importManager = setupImportManager(dbManager, eventBus);
    const apiService = setupApiService(config.api, dbManager, authManager, encryptionManager, eventBus); // Use setupApiService

    // Setup message handler last, passing all managers/services
    setupMessageHandlers(
      dbManager,
      { getConfig: () => config, updateConfig: (newConf) => { config = {...config, ...newConf}; /* TODO: Save config */ return config; } }, // Provide config access/update
      captureManager,
      exportManager,
      importManager,
      authManager,
      encryptionManager,
      errorMonitor,
      apiService // Pass apiService
    );

    // Watch for configuration changes
    setupConfigWatcher((newConfig) => {
      console.log("Configuration updated:", newConfig);
      const oldConfig = config;
      config = newConfig;
      // Notify relevant modules about the config change
      eventBus.publish("config:updated", { newConfig, oldConfig });

      // Update capture manager's config
      if (captureManager && typeof captureManager.updateCaptureConfig === 'function') {
        captureManager.updateCaptureConfig(newConfig.capture);
      }
    });

    // Log successful initialization
    console.log("Background script initialized successfully.");

    // Notify that the system is ready
    eventBus.publish("system:ready", { timestamp: Date.now() });
  } catch (error) {
    console.error("Background script initialization failed:", error);
    // Use error monitor if available, otherwise basic console log
    if (errorMonitor && typeof errorMonitor.reportCriticalError === 'function') {
        errorMonitor.reportCriticalError("initialization_failed", error);
    } else {
        console.error("Critical initialization error:", error); // Fallback logging
    }
  }
}

// Start initialization
initialize();
