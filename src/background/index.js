// Main entry point for background script
import { initDatabase } from "./database/db-manager.js"
import { setupRequestCapture } from "./capture/request-capture.js"
import { setupMessageHandlers } from "./messaging/message-handler.js"
import { setupNotifications } from "./notifications/notification-manager.js"
import { setupAuthSystem } from "./auth/auth-manager.js"
import { setupRemoteAuthService } from "./auth/remote-auth-service.js"
import { setupEncryption } from "./security/encryption-manager.js"
import { setupRemoteSyncService } from "./sync/remote-sync-service.js"
import { setupErrorMonitoring } from "./monitoring/error-monitor.js"
import { loadConfig, setupConfigWatcher } from "./config/config-manager.js"
import { setupExportManager } from "./export/export-manager.js"
import { setupEventBus } from "./messaging/event-bus.js"
import { setupCrossBrowserCompat } from "./compat/browser-compat.js"
import { setupApiService } from "./api/api-service.js"

// Initialize the event bus first
const eventBus = setupEventBus()

// Initialize configuration
let config = null

// Main initialization function
async function initialize() {
  try {
    // Load configuration first
    config = await loadConfig()

    // Set up error monitoring
    setupErrorMonitoring(eventBus)

    // Set up cross-browser compatibility layer
    setupCrossBrowserCompat()

    // Initialize encryption system
    const encryptionManager = await setupEncryption(config.security, eventBus)

    // Initialize database
    const dbManager = await initDatabase(config.database, encryptionManager, eventBus)

    // Set up authentication systems
    const localAuthManager = await setupAuthSystem(config.security.auth, eventBus)
    const remoteAuthService = await setupRemoteAuthService(config.security.remoteAuth, eventBus)

    // Choose which auth system to use based on configuration
    const authManager = config.security.useRemoteAuth ? remoteAuthService : localAuthManager

    // Set up request capture
    setupRequestCapture(config.capture, dbManager, eventBus)

    // Set up notification system
    setupNotifications(config.notifications, eventBus)

    // Set up remote sync
    if (config.sync.enabled) {
      setupRemoteSyncService(config.sync, dbManager, authManager, encryptionManager, eventBus)
    }

    // Set up export manager
    setupExportManager(dbManager, encryptionManager, eventBus)

    // Set up API service
    setupApiService(config.api, dbManager, authManager, encryptionManager, eventBus)

    // Set up message handlers (must be last to ensure all systems are initialized)
    setupMessageHandlers(dbManager, authManager, encryptionManager, eventBus)

    // Watch for configuration changes
    setupConfigWatcher((newConfig) => {
      config = newConfig
      eventBus.publish("config:updated", newConfig)
    })

    // Log successful initialization
    console.log("Universal Request Analyzer initialized successfully")

    // Notify that the system is ready
    eventBus.publish("system:ready", { timestamp: Date.now() })
  } catch (error) {
    console.error("Failed to initialize Universal Request Analyzer:", error)

    // Attempt to report the error
    try {
      if (typeof browser !== "undefined" && browser.runtime && browser.runtime.getBackgroundPage) {
        // browser is available
        const backgroundPage = await browser.runtime.getBackgroundPage()
        const errorMonitor = backgroundPage.errorMonitor
        if (errorMonitor) {
          errorMonitor.reportCriticalError("initialization_failed", error)
        }
      } else if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getBackgroundPage) {
        // chrome is available
        const backgroundPage = await chrome.runtime.getBackgroundPage()
        const errorMonitor = backgroundPage.errorMonitor
        if (errorMonitor) {
          errorMonitor.reportCriticalError("initialization_failed", error)
        }
      } else {
        console.warn("Browser runtime not available, cannot report critical error")
      }
    } catch (e) {
      // Last resort error logging
      console.error("Could not report initialization error:", e)
    }
  }
}

// Start initialization
initialize()

