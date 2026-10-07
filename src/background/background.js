// Integrated Background Script with Medallion Architecture
// Full implementation connecting all components

import { setupLocalAuth } from "./auth/local-auth-manager.js";
import { initializePopupMessageHandler } from "./messaging/message-router.js";
import { DatabaseManagerMedallion, scheduleSave } from "./database/db-manager-medallion.js";
import { MedallionManager } from "./database/medallion-manager.js";
import { AnalyticsProcessor } from "./database/analytics-processor.js";
import { ConfigSchemaManager } from "./database/config-schema-manager.js";
import { RequestCaptureIntegration } from "./capture/request-capture-integration.js";
import { runtime, downloads, alarms } from "./compat/browser-compat.js";
import settingsManager from "../lib/shared-components/settings-manager.js";
import featureFlags from "../config/feature-flags.js";

class IntegratedExtensionInitializer {
  constructor() {
    this.medallionDb = null;
    this.localAuth = null;
    this.configManager = null;
    this.medallionManager = null;
    this.analyticsProcessor = null;
    this.requestCapture = null;
    this.eventBus = this.createEventBus();
    this.scheduledTasks = [];
    this.initialized = false; // Prevent multiple initializations
  }

  createEventBus() {
    const subscribers = new Map();
    return {
      subscribe: (event, callback) => {
        if (!subscribers.has(event)) {
          subscribers.set(event, []);
        }
        subscribers.get(event).push(callback);
      },
      publish: (event, data) => {
        if (subscribers.has(event)) {
          subscribers.get(event).forEach((callback) => {
            try {
              callback(data);
            } catch (error) {
              console.error(`Event handler error for ${event}:`, error);
            }
          });
        }
      },
    };
  }

  async initialize() {
    // Prevent multiple initializations
    if (this.initialized) {
      console.log("⚠️ Already initialized, skipping...");
      return true;
    }

    try {
      console.log(
        "🚀 Initializing Universal Request Analyzer with Medallion Architecture..."
      );

      // Step 1: Initialize database with medallion architecture
      await this.initializeDatabase();

      // Step 2: Initialize local authentication
      await this.initializeLocalAuth();

      // Step 3: Initialize configuration manager
      await this.initializeConfigManager();

      // Step 4: Initialize medallion manager
      await this.initializeMedallionManager();

      // Step 5: Initialize analytics processor
      await this.initializeAnalyticsProcessor();

      // Step 7: Initialize request capture
      await this.initializeRequestCapture();

      // Step 8: Initialize feature flags
      await this.initializeFeatureFlags();

      // Step 9: Initialize message handlers
      this.initializeMessageHandlers();

      // Step 10: Schedule periodic tasks
      this.schedulePeriodicTasks();

      this.initialized = true; // Mark as initialized
      console.log(
        "✅ Extension initialized successfully with medallion architecture!"
      );
      return true;
    } catch (error) {
      console.error("❌ Extension initialization failed:", error);
      this.initialized = false; // Reset on failure
      return false;
    }
  }

  async initializeDatabase() {
    this.medallionDb = new DatabaseManagerMedallion();
    await this.medallionDb.initialize(null, null, this.eventBus);
  }

  async initializeLocalAuth() {
    this.localAuth = setupLocalAuth(this.medallionDb);
    await this.localAuth.initialize();
  }

  async initializeConfigManager() {
    console.log("→ Initializing Configuration Manager...");

    this.configManager = new ConfigSchemaManager(
      this.medallionDb.db,
      this.eventBus
    );
    await this.configManager.initialize();

    // Set default configurations using the correct method name
    try {
      await this.configManager.setAppSetting("capture.enabled", true);
      await this.configManager.setAppSetting("analytics.enabled", true);
    } catch (error) {
      console.warn("Failed to set default config:", error.message);
    }

    console.log("✓ Configuration Manager initialized");
  }

  async initializeMedallionManager() {
    console.log("→ Initializing Medallion Manager...");

    this.medallionManager = new MedallionManager(
      this.medallionDb.db,
      this.eventBus
    );
    await this.medallionManager.initialize();

    // Subscribe to Bronze layer events for automatic processing
    this.eventBus.subscribe("bronze:new_request", async (data) => {
      try {
        await this.medallionManager.processBronzeToSilver(data.requestId);
      } catch (error) {
        console.error("Failed to process Bronze→Silver:", error);
      }
    });

    console.log("✓ Medallion Manager initialized");
  }

  async initializeAnalyticsProcessor() {
    console.log("→ Initializing Analytics Processor...");

    this.analyticsProcessor = new AnalyticsProcessor(
      this.medallionDb.db,
      this.eventBus
    );

    console.log("✓ Analytics Processor initialized");
  }

  async initializeFeatureFlags() {
    await featureFlags.initialize({
      permissionLevel: "basic",
      onUpdate: (flags) => {
        // Broadcast eventTracking state to content scripts via storage
        chrome.storage.local.get(["settings"], (data) => {
          const current = data.settings || {};
          chrome.storage.local.set({
            settings: {
              ...current,
              settings: {
                ...(current.settings || {}),
                eventTracking: { enabled: flags.eventTracking },
              },
            },
          });
        });
      },
    });
  }

  async initializeRequestCapture() {
    console.log("→ Initializing Request Capture...");

    // Initialize settings manager with database
    settingsManager.setDatabaseManager(this.configManager);
    await settingsManager.initialize();

    // Load capture settings from settings-manager
    const settings = await settingsManager.getSettings();
    const config = {
      enabled: settings.capture?.enabled ?? true,
      filters: {
        includePatterns: ["<all_urls>"],
        excludePatterns:
          settings.capture?.captureFilters?.excludePatterns || [],
      },
      captureFilters: {
        includeTypes: settings.capture?.captureFilters?.includeTypes || [],
        includeDomains: settings.capture?.captureFilters?.includeDomains || [],
        excludeDomains: settings.capture?.captureFilters?.excludeDomains || [],
      },
      trackOnlyConfiguredSites:
        settings.capture?.trackOnlyConfiguredSites ?? false,
    };

    this.requestCapture = new RequestCaptureIntegration(
      this.medallionDb,
      this.eventBus,
      config
    );

    this.requestCapture.initialize();

    console.log("✓ Request Capture initialized");
  }

  initializeMessageHandlers() {
    console.log("→ Initializing Message Handlers...");

    // Get popup message handler function
    this.popupMessageHandler = initializePopupMessageHandler(
      this.localAuth,
      this.medallionDb
    );

    // Single consolidated message listener for better browser compatibility
    runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleAllMessages(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    console.log("✓ Message Handlers initialized");
  }

  async handleAllMessages(message, sender, sendResponse) {
    try {
      // First try popup/options handlers (register, login, getPageStats, query, etc.)
      if (this.popupMessageHandler) {
        const popupResponse = await this.popupMessageHandler(message, sender);

        // If popup handler returned a response (not null), send it
        if (popupResponse !== null && popupResponse !== undefined) {
          sendResponse(popupResponse);
          return;
        }
      }

      await this.handleMedallionMessages(message, sender, sendResponse);
    } catch (error) {
      console.error("Message handling error:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleMedallionMessages(message, sender, sendResponse) {
    try {
      switch (message.action) {
        // Content-script telemetry — resource timing and nav stored silently
        case "performanceData":
        case "batchResourceTiming":
        case "pageLoad":
        case "pageNavigation":
          sendResponse({ success: true });
          break;

        // Content-script XHR/Fetch intercepts — store to Bronze alongside webRequest data
        case "xhrCompleted":
        case "fetchCompleted":
        case "fetchError": {
          try {
            const { url, method, status, statusText, duration, responseSize, startTime, endTime, error: reqError } = message;
            const pageUrl = sender.tab?.url || null;
            let domain = null, path = null, queryString = null, protocol = null;
            try {
              const u = new URL(url);
              domain = u.hostname; path = u.pathname;
              queryString = u.search; protocol = u.protocol;
            } catch {}
            await this.medallionManager.insertBronzeRequest({
              id: crypto.randomUUID(),
              url, method: method || "GET",
              type: message.action === "xhrCompleted" ? "xmlhttprequest" : "fetch",
              status: status || 0, statusText,
              domain, path, queryString, protocol,
              startTime, endTime, duration,
              sizeBytes: responseSize || 0,
              timestamp: endTime || Date.now(),
              tabId: sender.tab?.id,
              pageUrl,
              error: reqError || null,
              fromCache: false,
            });
            scheduleSave();
            sendResponse({ success: true });
          } catch (e) {
            sendResponse({ success: true }); // non-fatal
          }
          break;
        }

        case "processToSilver": {
          const count = await this.medallionManager.processAllPendingToSilver();
          sendResponse({ success: true, processed: count });
          break;
        }

        case "configureAutoExport": {
          await this.setupAutoExport(message.config);
          sendResponse({ success: true });
          break;
        }

        case "getDomainStats": {
          const stats = await this.medallionManager.getDomainStatistics(
            message.domain
          );
          sendResponse({ success: true, data: stats });
          break;
        }

        case "ping":
          sendResponse({ success: true, message: "pong" });
          break;

        case "reloadCaptureSettings": {
          // Reload settings and reinitialize request capture
          await this.initializeRequestCapture();
          sendResponse({ success: true, message: "Capture settings reloaded" });
          break;
        }

        case "vacuumDatabase":
          try {
            console.log("[Background] Vacuum database requested");
            await this.medallionDb.vacuumDatabase();
            sendResponse({
              success: true,
              message: "Database compacted successfully",
            });
          } catch (vacuumError) {
            console.error("[Background] Vacuum failed:", vacuumError);
            sendResponse({ success: false, error: vacuumError.message });
          }
          break;

        case "getDatabaseSize":
          try {
            const size = await this.medallionDb.getDatabaseSize();
            const stats = await this.medallionDb.getDatabaseStats();
            sendResponse({
              success: true,
              size: size,
              records: stats?.totalRequests || 0,
              oldestDate: stats?.oldestDate || null,
            });
          } catch (sizeError) {
            sendResponse({ success: false, error: sizeError.message });
          }
          break;

        case "createBackup": {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `ura_backup_${timestamp}.sqlite`;

            const data = this.medallionDb.exportDatabase();

            // Convert to base64 in chunks to avoid stack overflow
            let binary = "";
            const chunkSize = 8192;
            for (let i = 0; i < data.length; i += chunkSize) {
              const chunk = data.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, chunk);
            }
            const base64 = btoa(binary);
            const dataUrl = `data:application/x-sqlite3;base64,${base64}`;

            await downloads.download({
              url: dataUrl,
              filename: filename,
              saveAs: true,
            });

            sendResponse({
              success: true,
              filename: filename,
              size: data.length,
            });
          } catch (backupError) {
            console.error("Backup error:", backupError);
            sendResponse({ success: false, error: backupError.message });
          }
          break;
        }

        case "exportDatabase": {
          try {
            const format = message.format || "json";
            let exportResponse;

            switch (format) {
              case "json":
                exportResponse = await this.popupMessageHandler({ action: "exportToJSON", options: { prettify: true } });
                break;
              case "csv":
                exportResponse = await this.popupMessageHandler({ action: "exportAllTablesToCSV", options: {} });
                break;
              case "sqlite":
              default:
                exportResponse = await this.popupMessageHandler({ action: "exportToSQLite", options: {} });
                break;
            }

            if (!exportResponse?.success) throw new Error(exportResponse?.error || "Export failed");

            const data = new Uint8Array(exportResponse.data);
            let binary = "";
            const chunkSize = 8192;
            for (let i = 0; i < data.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, data.subarray(i, i + chunkSize));
            }
            const mimeType = exportResponse.mimeType || "application/octet-stream";
            const filename = exportResponse.filename || message.filename;
            await downloads.download({ url: `data:${mimeType};base64,${btoa(binary)}`, filename, saveAs: true });
            sendResponse({ success: true, filename, size: data.length, format });
          } catch (exportError) {
            console.error("[Background] Export error:", exportError);
            sendResponse({ success: false, error: exportError.message });
          }
          break;
        }

        case "importDatabase": {
          try {
            console.log("[Background] Import database requested");

            if (!message.data || !Array.isArray(message.data)) {
              throw new Error("Invalid database data");
            }

            // Convert array back to Uint8Array
            const uint8Array = new Uint8Array(message.data);

            // Import database
            await this.medallionDb.importDatabase(uint8Array);

            sendResponse({
              success: true,
              message: "Database imported successfully",
            });
          } catch (importError) {
            console.error("[Background] Import error:", importError);
            sendResponse({ success: false, error: importError.message });
          }
          break;
        }

        case "webVital": {
          try {
            const url = message.url || sender.tab?.url || sender.url;

            // Content script sends 'metric', not 'name'
            const metricName = message.metric || message.name;

            // Validate required fields
            if (!metricName) {
              console.error("Web vital missing 'metric' field:", message);
              sendResponse({ success: false, error: "Missing metric name" });
              break;
            }

            // Store web vital - map to insertWebVital expected fields
            const vitalData = {
              url: url,
              metric: metricName,
              value: message.value,
              rating: message.rating || "needs-improvement",
              timestamp: message.timestamp || Date.now(),
              viewport_width: message.viewportWidth,
              viewport_height: message.viewportHeight,
            };

            const result = await this.medallionManager.insertWebVital(vitalData);
            sendResponse({ success: true, id: result });
          } catch (vitalError) {
            console.error("Web vital capture error:", vitalError);
            sendResponse({ success: false, error: vitalError.message });
          }
          break;
        }

        case "userEvent": {
          try {
            const url = message.url || sender.tab?.url || sender.url;

            // Store event in database without session
            const eventData = {
              event_type: message.eventType,
              event_name: message.eventType,
              source: "content_script",
              data: message.eventData,
              request_id: null,
              user_id: null,
              session_id: null,
              timestamp: message.timestamp || Date.now(),
            };

            const result = await this.medallionManager.insertEvent(eventData);
            sendResponse({ success: true, id: result });
          } catch (eventError) {
            console.error("User event capture error:", eventError);
            sendResponse({ success: false, error: eventError.message });
          }
          break;
        }

        case "recordResourceTiming": {
          try {
            const success = await this.medallionManager.insertResourceTiming(
              message.timing
            );
            sendResponse({ success });
          } catch (timingError) {
            console.error("Resource timing capture error:", timingError);
            sendResponse({ success: false, error: timingError.message });
          }
          break;
        }

        case "getResourceCompressionStats": {
          try {
            const stats =
              await this.medallionManager.getResourceCompressionStats(
                message.filters || {}
              );
            sendResponse({ success: true, data: stats });
          } catch (statsError) {
            console.error("Compression stats error:", statsError);
            sendResponse({ success: false, error: statsError.message });
          }
          break;
        }

        default:
          sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      console.error("Message handler error:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  schedulePeriodicTasks() {
    console.log("→ Scheduling Periodic Tasks...");

    if (alarms) {
      // Bronze→Silver every 2 minutes — survives SW restarts unlike setInterval
      alarms.create("bronzeToSilver", { periodInMinutes: 2 });

      // Silver→Gold daily at midnight
      alarms.create("dailyGoldProcessing", {
        when: this.getNextMidnight(),
        periodInMinutes: 24 * 60,
      });

      // Data retention cleanup — purges records older than configured retention period
      alarms.create("dataCleanup", {
        when: this.getNextMidnight(),
        periodInMinutes: 24 * 60,
      });

      alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === "bronzeToSilver") {
          try {
            const count = await this.medallionManager.processAllPendingToSilver();
            if (count > 0) console.log(`[Medallion] Bronze→Silver: ${count} records`);
          } catch (error) {
            console.error("Bronze→Silver failed:", error);
          }
        } else if (alarm.name === "dailyGoldProcessing") {
          try {
            await this.medallionManager.processDailyAnalytics();
          } catch (error) {
            console.error("Silver→Gold failed:", error);
          }
        } else if (alarm.name === "dataCleanup") {
          try {
            if (this.medallionDb?.isReady) {
              const settings = await this.medallionDb.executeQuery(
                "SELECT value FROM config_settings WHERE key = 'retentionPeriodDays' LIMIT 1"
              );
              const days = settings?.[0]?.values?.[0]?.[0] ? parseInt(settings[0].values[0][0]) : 30;
              await this.medallionDb.cleanupOldRecords(days);
            }
          } catch (error) {
            console.error("Data cleanup failed:", error);
          }
        } else if (alarm.name === "autoExport") {
          try {
            await this.handleAutoExport();
          } catch (error) {
            console.error("Auto-export failed:", error);
          }
        }
      });
    } else {
      // Fallback for browsers without alarms API
      const bronzeToSilver = setInterval(async () => {
        try {
          await this.medallionManager.processAllPendingToSilver();
        } catch (error) {
          console.error("Bronze→Silver failed:", error);
        }
      }, 2 * 60 * 1000);
      this.scheduledTasks.push(bronzeToSilver);
    }

    console.log("✓ Periodic Tasks scheduled (Bronze→Silver: alarms every 2min, Silver→Gold: daily)");
  }

  async handleAutoExport() {
    try {
      // Load auto-export configuration from DB
      const response = await this.popupMessageHandler({
        action: "getSetting",
        category: "export",
        key: "autoExport",
      });

      if (!response || !response.success || !response.value) {
        console.log("[Auto-Export] No auto-export configuration found");
        return;
      }

      const autoExportConfig = response.value;

      if (!autoExportConfig.enabled) {
        console.log("[Auto-Export] Auto-export is disabled");
        return;
      }

      console.log(
        "[Auto-Export] Starting auto-export with config:",
        autoExportConfig
      );

      // Determine export format (default to SQLite)
      const format = autoExportConfig.format || "sqlite";
      let exportResponse;

      // Execute export based on format
      switch (format) {
        case "sqlite":
          exportResponse = await this.popupMessageHandler({
            action: "exportToSQLite",
            options: autoExportConfig.options || {},
          });
          break;
        case "json":
          exportResponse = await this.popupMessageHandler({
            action: "exportToJSON",
            options: autoExportConfig.options || {},
          });
          break;
        case "csv":
          exportResponse = await this.popupMessageHandler({
            action: "exportToCSV",
            options: autoExportConfig.options || {},
          });
          break;
        default:
          console.error("[Auto-Export] Unknown format:", format);
          return;
      }

      if (exportResponse && exportResponse.success) {
        console.log(
          `[Auto-Export] Export completed: ${exportResponse.filename}`
        );

        // Update last export time
        await this.popupMessageHandler({
          action: "saveSetting",
          category: "export",
          key: "lastAutoExport",
          value: Date.now(),
        });

        // TODO: Handle backup rotation if maxBackups is set
        // TODO: Trigger download or save to configured location
      } else {
        console.error("[Auto-Export] Export failed:", exportResponse?.error);
      }
    } catch (error) {
      console.error("[Auto-Export] Error during auto-export:", error);
    }
  }

  async setupAutoExport(config) {
    try {
      if (!config || !config.enabled) {
        // Clear existing auto-export alarm
        if (alarms) {
          await alarms.clear("autoExport");
        }
        console.log("[Auto-Export] Auto-export disabled or no config");
        return;
      }

      // Map frequency to minutes
      const frequencyMap = {
        daily: 24 * 60, // 1440 minutes
        weekly: 7 * 24 * 60, // 10080 minutes
        monthly: 30 * 24 * 60, // 43200 minutes
      };

      const periodInMinutes = frequencyMap[config.frequency] || 24 * 60;

      if (alarms) {
        // Clear existing alarm
        await alarms.clear("autoExport");

        // Create new alarm
        await alarms.create("autoExport", {
          when: Date.now() + 60000, // Start in 1 minute
          periodInMinutes: periodInMinutes,
        });

        console.log(
          `[Auto-Export] Scheduled with frequency: ${config.frequency} (${periodInMinutes} minutes)`
        );
      } else {
        console.warn(
          "[Auto-Export] chrome.alarms not available, auto-export won't work"
        );
      }
    } catch (error) {
      console.error("[Auto-Export] Failed to setup auto-export:", error);
    }
  }

  getNextMidnight() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  async cleanup() {
    console.log("Cleaning up scheduled tasks...");
    this.scheduledTasks.forEach((task) => clearInterval(task));
    this.scheduledTasks = [];

    // Clear alarms
    if (alarms) {
      alarms.clear("bronzeToSilver");
      alarms.clear("dailyGoldProcessing");
      alarms.clear("dataCleanup");
      alarms.clear("autoExport");
    }

    if (this.medallionDb?.isReady) {
      await this.medallionDb.saveDatabase().catch((e) =>
        console.error("Failed to save database during cleanup:", e)
      );
    }
  }
}

// Create and initialize extension (singleton)
let extensionInitializer = null;
let initializationPromise = null;

// Get or create initializer instance
function getInitializer() {
  if (!extensionInitializer) {
    extensionInitializer = new IntegratedExtensionInitializer();
  }
  return extensionInitializer;
}

// Safe initialization that prevents multiple concurrent runs
async function safeInitialize() {
  if (initializationPromise) {
    console.log("⏳ Initialization already in progress, waiting...");
    return initializationPromise;
  }

  const initializer = getInitializer();

  if (initializer.initialized) {
    console.log("✓ Extension already initialized");
    return;
  }

  console.log("🚀 Starting extension initialization...");
  initializationPromise = initializer.initialize();

  try {
    await initializationPromise;
    console.log("✓ Extension initialization complete");
  } finally {
    initializationPromise = null;
  }
}

// Initialize on install or update (only once)
runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed/updated:", details.reason);
  await safeInitialize();
});

// Initialize on browser startup (only once)
runtime.onStartup.addListener(async () => {
  console.log("Extension started on browser startup");
  await safeInitialize();
});

// Initialize immediately if service worker is already running (only once)
safeInitialize();

// Cleanup on suspension (service worker)
if (runtime.onSuspend) {
  runtime.onSuspend.addListener(() => {
    console.log("Service worker suspending, cleaning up...");
    const initializer = getInitializer();
    if (initializer) {
      initializer.cleanup();
    }
  });
}

// Export for testing/debugging
if (typeof globalThis !== "undefined") {
  globalThis.getExtensionInitializer = getInitializer;
}

export { getInitializer };
