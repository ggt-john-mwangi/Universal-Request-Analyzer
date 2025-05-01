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
import {
  loadConfig,
  setupConfigWatcher,
  updateConfig,
} from "./config/config-manager";
import { setupExportManager } from "./export/export-manager";
import { setupEventBus } from "./messaging/event-bus";
import { setupCrossBrowserCompat } from "./compat/browser-compat";
import { setupCleanupManager } from "./cleanup/cleanup-manager";
import { setupApiService } from "./api/api-service";

class ExtensionInitializer {
  constructor() {
    this.dbManager = null;
    this.eventBus = null;
    this.config = null;
    this.services = new Map();
    this.initializationState = {
      started: false,
      completed: false,
      failed: false,
      retryCount: 0,
      lastError: null,
    };
    this.serviceStates = new Map();
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  async initialize() {
    if (this.initializationState.started) {
      console.warn("Initialization already in progress");
      return false;
    }

    this.initializationState.started = true;

    try {
      await this.initializeCore();
      await this.initializeServices();
      await this.finalizeInitialization();

      this.initializationState.completed = true;
      return true;
    } catch (error) {
      await this.handleInitializationError(error);
      return await this.retryInitialization();
    }
  }

  async initializeCore() {
    try {
      // Initialize event bus first as other modules depend on it
      this.eventBus = setupEventBus();
      this.updateServiceState("eventBus", "ready");

      this.services.set("errorMonitor", setupErrorMonitoring(this.eventBus));
      this.updateServiceState("errorMonitor", "ready");

      // Load configuration early
      this.config = await loadConfig();
      this.updateServiceState("config", "ready");

      // Set up cross-browser compatibility layer
      setupCrossBrowserCompat();
      this.updateServiceState("browserCompat", "ready");

      // Initialize critical systems
      const encryptionManager = await setupEncryption(
        this.config.security,
        this.eventBus
      );
      this.services.set("encryption", encryptionManager);
      this.updateServiceState("encryption", "ready");

      // Initialize database manager with retry logic
      await this.initializeDatabaseWithRetry();
    } catch (error) {
      this.updateServiceState("core", "failed", error);
      throw error;
    }
  }

  async initializeDatabaseWithRetry(attempt = 1) {
    try {
      this.dbManager = await initDatabase(
        this.config.database,
        this.services.get("encryption"),
        this.eventBus
      );
      this.services.set("database", this.dbManager);
      this.updateServiceState("database", "ready");
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.warn(
          `Database initialization failed, attempt ${attempt}. Retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.initializeDatabaseWithRetry(attempt + 1);
      }
      throw error;
    }
  }

  async initializeServices() {
    if (!this.checkCoreDependencies()) {
      throw new Error("Core dependencies not ready");
    }

    try {
      // Set up authentication with dependency check
      if (await this.initializeAuthServices()) {
        await this.initializeFeatureServices();
        await this.initializeOptionalServices();
      } else {
        throw new Error("Authentication services failed to initialize");
      }
    } catch (error) {
      this.updateServiceState("services", "failed", error);
      throw error;
    }
  }

  async initializeAuthServices() {
    const localAuthManager = await setupAuthSystem(
      this.config.security.auth,
      this.eventBus
    );
    const remoteAuthService = await setupRemoteAuthService(
      this.config.security.remoteAuth,
      this.eventBus
    );
    const authManager = this.config.security.useRemoteAuth
      ? remoteAuthService
      : localAuthManager;
    this.services.set("auth", authManager);
    this.updateServiceState("auth", "ready");
    return true;
  }

  async initializeFeatureServices() {
    const featureServices = [
      {
        name: "capture",
        setup: () =>
          setupRequestCapture(
            this.config.capture,
            this.dbManager,
            this.eventBus
          ),
      },
      {
        name: "notifications",
        setup: () =>
          setupNotifications(this.config.notifications, this.eventBus),
      },
      {
        name: "cleanup",
        setup: () =>
          setupCleanupManager(
            this.config.cleanup,
            this.dbManager,
            this.eventBus
          ),
      },
      {
        name: "export",
        setup: () =>
          setupExportManager(
            this.dbManager,
            this.services.get("encryption"),
            this.eventBus
          ),
      },
    ];

    for (const service of featureServices) {
      try {
        this.services.set(service.name, await service.setup());
        this.updateServiceState(service.name, "ready");
      } catch (error) {
        this.updateServiceState(service.name, "failed", error);
        console.error(`Failed to initialize ${service.name}:`, error);
        // Continue with other services
      }
    }
  }

  async initializeOptionalServices() {
    // Initialize sync service if enabled
    if (this.config.sync.enabled) {
      try {
        this.services.set(
          "sync",
          await setupRemoteSyncService(
            this.config.sync,
            this.dbManager,
            this.services.get("auth"),
            this.services.get("encryption"),
            this.eventBus
          )
        );
        this.updateServiceState("sync", "ready");
      } catch (error) {
        this.updateServiceState("sync", "failed", error);
        console.warn("Sync service failed to initialize:", error);
      }
    }

    // Initialize API service
    try {
      this.services.set(
        "api",
        await setupApiService(
          this.config.api,
          this.dbManager,
          this.services.get("auth"),
          this.services.get("encryption"),
          this.eventBus
        )
      );
      this.updateServiceState("api", "ready");
    } catch (error) {
      this.updateServiceState("api", "failed", error);
      console.warn("API service failed to initialize:", error);
    }

    // Set up message handlers last
    try {
      this.services.set(
        "messaging",
        setupMessageHandlers(
          this.dbManager,
          this.services.get("auth"),
          this.services.get("encryption"),
          this.eventBus
        )
      );
      this.updateServiceState("messaging", "ready");
    } catch (error) {
      this.updateServiceState("messaging", "failed", error);
      console.error("Message handlers failed to initialize:", error);
    }
  }

  async finalizeInitialization() {
    // Watch for configuration changes
    setupConfigWatcher((newConfig) => {
      this.config = newConfig;
      this.eventBus.publish("config:updated", newConfig);
    });

    // Publish initialization complete event with service states
    this.eventBus.publish("system:ready", {
      timestamp: Date.now(),
      services: Array.from(this.serviceStates.entries()).reduce(
        (acc, [name, state]) => {
          acc[name] = state.status;
          return acc;
        },
        {}
      ),
    });

    console.log("Universal Request Analyzer initialized successfully");
  }

  async handleInitializationError(error) {
    this.initializationState.failed = true;
    this.initializationState.lastError = error;

    console.error("Initialization failed:", error);

    this.eventBus?.publish("system:error", {
      error: error.message,
      timestamp: Date.now(),
      stack: error.stack,
      serviceStates: Object.fromEntries(this.serviceStates),
    });

    await this.cleanup();
  }

  async cleanup() {
    for (const [name, service] of this.services.entries()) {
      try {
        if (service && typeof service.cleanup === "function") {
          await service.cleanup();
          this.updateServiceState(name, "cleaned");
        }
      } catch (cleanupError) {
        console.error(`Failed to cleanup service ${name}:`, cleanupError);
        this.updateServiceState(name, "cleanup_failed", cleanupError);
      }
    }
  }

  async retryInitialization() {
    if (this.initializationState.retryCount >= this.maxRetries) {
      console.error("Max retry attempts reached. Initialization failed.");
      return false;
    }

    this.initializationState.retryCount++;
    console.log(
      `Retrying initialization (attempt ${this.initializationState.retryCount})`
    );

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, this.retryDelay));

    // Reset failed states
    this.initializationState.failed = false;
    this.initializationState.lastError = null;

    // Try again
    return this.initialize();
  }

  checkCoreDependencies() {
    const requiredServices = ["eventBus", "config", "encryption", "database"];
    return requiredServices.every(
      (service) => this.serviceStates.get(service)?.status === "ready"
    );
  }

  updateServiceState(serviceName, status, error = null) {
    this.serviceStates.set(serviceName, {
      status,
      timestamp: Date.now(),
      error: error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : null,
    });

    // Publish service state change event
    this.eventBus?.publish("service:stateChanged", {
      service: serviceName,
      status,
      timestamp: Date.now(),
      error: error?.message,
    });
  }

  getService(name) {
    return this.services.get(name);
  }

  getServiceState(name) {
    return this.serviceStates.get(name);
  }

  getAllServiceStates() {
    return Object.fromEntries(this.serviceStates);
  }
}

// Create singleton instance
const extensionInitializer = new ExtensionInitializer();

// Handle installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    try {
      // Initialize database first
      await initDatabase();

      // Load and set default configuration
      const config = await loadConfig();
      config.capture.enabled = true;
      config.capture.performanceMetrics = true;
      config.database.autoSave = true;

      // Save the initial configuration
      await updateConfig(config);

      console.log("Universal Request Analyzer installed successfully");
    } catch (error) {
      console.error("Installation failed:", error);
    }
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  extensionInitializer.initialize().catch((error) => {
    console.error("Startup initialization failed:", error);
  });
});

// Start initialization
extensionInitializer.initialize();
