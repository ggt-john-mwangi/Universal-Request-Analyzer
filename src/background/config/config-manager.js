// Configuration manager - handles all extension settings and configurations

import { storage } from "../compat/browser-compat.js";
import { ConfigError } from "../errors/error-types.js";

class ConfigManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.config = new Map();
    this.defaults = new Map();
    this.validators = new Map();
    this.migrations = [];
    this.version = "1.0.0";
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Initialize configuration system
  async initialize() {
    // Register default configurations
    this.registerDefaults();

    // Load saved configuration
    await this.loadConfig();

    // Run migrations if needed
    await this.checkMigrations();

    // Set up storage change listener
    this.setupStorageListener();

    console.log("Configuration system initialized");
  }

  // Register default configuration values
  registerDefaults() {
    // Core settings
    this.setDefault("core.version", this.version);
    this.setDefault("core.debug", false);
    this.setDefault("core.autoUpdate", true);

    // Capture settings
    this.setDefault("capture.enabled", true);
    this.setDefault("capture.filters", {
      includePatterns: ["*://*/*"],
      excludePatterns: [],
      resourceTypes: [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "csp_report",
        "media",
        "websocket",
        "other",
      ],
    });
    this.setDefault("capture.maxSize", 5242880); // 5MB
    this.setDefault("capture.truncateBody", true);

    // Storage settings
    this.setDefault("storage.maxRequests", 10000);
    this.setDefault("storage.autoCleanup", true);
    this.setDefault("storage.retentionDays", 30);

    // Export settings
    this.setDefault("export.format", "json");
    this.setDefault("export.compression", true);
    this.setDefault("export.maxSize", 104857600); // 100MB

    // UI settings
    this.setDefault("ui.theme", "system");
    this.setDefault("ui.density", "comfortable");
    this.setDefault("ui.timezone", "local");
    this.setDefault("ui.dateFormat", "yyyy-MM-dd HH:mm:ss");

    // Notification settings
    this.setDefault("notifications.enabled", true);
    this.setDefault("notifications.sound", false);
    this.setDefault("notifications.types", {
      error: true,
      warning: true,
      info: false,
    });

    // Security settings
    this.setDefault("security.encryption", true);
    this.setDefault("security.autoLock", true);
    this.setDefault("security.lockTimeout", 3600); // 1 hour

    // Performance settings
    this.setDefault("performance.batchSize", 100);
    this.setDefault("performance.workerThreads", 2);
    this.setDefault("performance.cacheSize", 1000);
  }

  // Register configuration validators
  registerValidators() {
    // Core validators
    this.setValidator("core.version", (value) => {
      if (typeof value !== "string") {
        throw new ConfigError("Version must be a string");
      }
    });

    // Capture validators
    this.setValidator("capture.maxSize", (value) => {
      if (typeof value !== "number" || value <= 0) {
        throw new ConfigError("Max size must be a positive number");
      }
    });

    // Storage validators
    this.setValidator("storage.maxRequests", (value) => {
      if (typeof value !== "number" || value <= 0) {
        throw new ConfigError("Max requests must be a positive number");
      }
    });

    // UI validators
    this.setValidator("ui.theme", (value) => {
      if (!["light", "dark", "system"].includes(value)) {
        throw new ConfigError("Invalid theme value");
      }
    });
  }

  // Set a default configuration value
  setDefault(key, value) {
    this.defaults.set(key, value);
    if (!this.config.has(key)) {
      this.config.set(key, value);
    }
  }

  // Set a configuration validator
  setValidator(key, validator) {
    this.validators.set(key, validator);
  }

  // Get a configuration value with caching
  get(key) {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    const value = this.config.get(key) ?? this.defaults.get(key);
    this.cache.set(key, {
      value,
      expires: Date.now() + this.cacheTimeout,
    });
    return value;
  }

  // Set a configuration value
  async set(key, value) {
    // Validate the value if a validator exists
    const validator = this.validators.get(key);
    if (validator) {
      try {
        await validator(value);
      } catch (error) {
        throw new ConfigError(
          `Invalid configuration value for ${key}: ${error.message}`
        );
      }
    }

    // Update the value
    this.config.set(key, value);
    this.cache.set(key, {
      value,
      expires: Date.now() + this.cacheTimeout,
    });

    // Save to storage
    await this.saveConfig();

    // Publish change event
    this.eventBus.publish("config:changed", {
      key,
      value,
      timestamp: Date.now(),
    });
  }

  // Clear the cache
  clearCache() {
    this.cache.clear();
  }

  // Set cache timeout
  setCacheTimeout(timeoutMs) {
    this.cacheTimeout = timeoutMs;
    this.clearCache();
  }

  // Load configuration from storage
  async loadConfig() {
    try {
      const stored = await storage.get("config");
      if (stored && stored.config) {
        // Merge stored config with defaults
        for (const [key, value] of Object.entries(stored.config)) {
          this.config.set(key, value);
        }
      }
    } catch (error) {
      console.error("Failed to load configuration:", error);
      this.eventBus.publish("config:error", {
        error: error.message,
        operation: "load",
      });
    }
  }

  // Save configuration to storage
  async saveConfig() {
    try {
      await storage.set({
        config: Object.fromEntries(this.config),
      });
    } catch (error) {
      console.error("Failed to save configuration:", error);
      this.eventBus.publish("config:error", {
        error: error.message,
        operation: "save",
      });
    }
  }

  // Register a configuration migration
  registerMigration(fromVersion, toVersion, migrateFn) {
    this.migrations.push({
      fromVersion,
      toVersion,
      migrate: migrateFn,
    });
  }

  // Check and run necessary migrations
  async checkMigrations() {
    const currentVersion = this.get("core.version");

    // Sort migrations by version
    const pendingMigrations = this.migrations
      .filter((m) => m.fromVersion === currentVersion)
      .sort((a, b) => a.toVersion.localeCompare(b.toVersion));

    // Run pending migrations
    for (const migration of pendingMigrations) {
      try {
        await migration.migrate(this.config);
        await this.set("core.version", migration.toVersion);

        this.eventBus.publish("config:migrated", {
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("Migration failed:", error);
        this.eventBus.publish("config:error", {
          error: error.message,
          operation: "migration",
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
        });
      }
    }
  }

  // Set up storage change listener
  setupStorageListener() {
    storage.onChanged.addListener((changes) => {
      if (changes.config) {
        const newConfig = changes.config.newValue;
        for (const [key, value] of Object.entries(newConfig)) {
          if (this.config.get(key) !== value) {
            this.config.set(key, value);
            this.eventBus.publish("config:changed", {
              key,
              value,
              timestamp: Date.now(),
            });
          }
        }
      }
    });
  }

  // Reset configuration to defaults
  async reset() {
    this.config = new Map(this.defaults);
    this.clearCache();
    await this.saveConfig();

    this.eventBus.publish("config:reset", {
      timestamp: Date.now(),
    });
  }

  // Get all configuration
  getAll() {
    return Object.fromEntries(this.config);
  }

  // Get configuration schema
  getSchema() {
    return {
      version: this.version,
      defaults: Object.fromEntries(this.defaults),
      validators: Array.from(this.validators.keys()),
    };
  }
}

// Create and export config manager
export function setupConfigManager(eventBus) {
  const configManager = new ConfigManager(eventBus);
  return configManager;
}
