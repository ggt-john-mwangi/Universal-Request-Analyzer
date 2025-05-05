// Configuration manager

import { ConfigError } from "../errors/error-types.js";
import { saveConfigToDb, loadConfigFromDb } from "../database/db-manager.js";

// Default configuration
const defaultConfig = {
  // General user settings
  general: {
    maxStoredRequests: 10000,
    autoStartCapture: true,
    showNotifications: true,
    confirmClearRequests: true,
    defaultExportFormat: "json", // json, csv, sqlite
    dateFormat: "MM/DD/YYYY HH:mm:ss",
    timeZone: "local", // local, utc, or specific timezone
  },

  // Database configuration
  database: {
    autoSaveInterval: 60000, // 1 minute
    autoVacuum: true,
    vacuumInterval: 3600000, // 1 hour
    maxSize: 100 * 1024 * 1024, // 100 MB
  },

  // Capture configuration
  capture: {
    enabled: true,
    maxStoredRequests: 10000,
    captureHeaders: true,
    captureFilters: {
      includeDomains: [],
      excludeDomains: [],
      includeTypes: [
        "xmlhttprequest",
        "fetch",
        "script",
        "stylesheet",
        "image",
        "font",
        "other",
      ],
    },
  },

  // Security configuration
  security: {
    encryption: {
      enabled: false,
      algorithm: "aes-256-gcm",
    },
    auth: {
      required: false,
      sessionDuration: 86400000, // 24 hours
    },
  },

  // Sync configuration
  sync: {
    enabled: false,
    serverUrl: "",
    interval: 3600000, // 1 hour
    syncOnLogin: true,
    syncAfterRequests: 100,
    requireAuth: true,
    encryptData: true,
    includeHeaders: true,
    useCsrf: true,
  },

  // Notification configuration
  notifications: {
    enabled: true,
    notifyOnExport: true,
    notifyOnError: true,
    notifyOnAuth: true,
    notifyOnEncryption: true,
    notifyOnSync: true,
    autoClose: true,
    autoCloseTimeout: 5000, // 5 seconds
  },

  // UI configuration (now only UI-specific fields)
  ui: {
    theme: "system", // system, light, dark
    accentColor: "#0066cc",
    fontSize: "medium", // small, medium, large
    defaultTab: "requests", // requests, stats, plots
    requestsPerPage: 50,
    expandedView: false,
    showStatusColors: true,
  },

  // Export configuration
  export: {
    defaultFormat: "json", // json, csv, sqlite
    includeHeaders: true,
    prettyPrint: true,
    autoExport: false,
    autoExportInterval: 86400000, // 24 hours
    autoExportFormat: "json",
    autoExportPath: "",
    enableSqliteExport: true, // Default to enabled
  },

  // API configuration
  api: {
    enabled: false,
    requireAuth: true,
    allowedDomains: ["example.com"],
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      timeWindow: 3600000, // 1 hour
    },
  },
};

// Load configuration from DB, fallback to default if not found
export async function loadConfig() {
  try {
    // Try to load config from the database table
    let dbConfig = null;
    try {
      dbConfig = loadConfigFromDb && loadConfigFromDb("main");
      // If loadConfigFromDb is async, await it
      if (dbConfig instanceof Promise) dbConfig = await dbConfig;
    } catch (e) {
      dbConfig = null;
    }
    if (!dbConfig) {
      // Save default config to DB if not found
      try {
        saveConfigToDb && saveConfigToDb(defaultConfig, "main");
      } catch (e) {}
      dbConfig = defaultConfig;
    }
    // Optionally, merge with Chrome storage config for backward compatibility
    const storedConfig = await getStoredConfig();
    const config = mergeConfigs(dbConfig, storedConfig);
    // Save merged config to DB
    try {
      saveConfigToDb && saveConfigToDb(config, "main");
    } catch (e) {}
    return config;
  } catch (error) {
    console.error("Failed to load configuration:", error);
    // Show notification if available
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "showNotification", message: "Failed to load configuration.", isError: true });
    }
    return defaultConfig;
  }
}

// Get current configuration - alias for loadConfig for backward compatibility
export async function getConfig() {
  return loadConfig();
}

// Get stored configuration
async function getStoredConfig() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("analyzerConfig", (result) => {
        resolve(result.analyzerConfig || {});
      });
    } else {
      resolve({});
    }
  });
}

// Save configuration
async function saveConfig(config) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ analyzerConfig: config }, () => {
        if (chrome.runtime.lastError) {
          // Show notification if available
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "showNotification", message: "Error saving configuration: " + chrome.runtime.lastError.message, isError: true });
          }
          reject(new ConfigError(chrome.runtime.lastError.message));
        } else {
          // Show notification if available
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "showNotification", message: "Configuration saved successfully!", isError: false });
          }
          resolve(config);
        }
      });
    } else {
      reject(new ConfigError("Chrome storage is not available."));
    }
  });
}

// Merge configurations
function mergeConfigs(defaultConfig, userConfig) {
  // Deep merge of objects
  const merged = { ...defaultConfig };

  // Recursively merge properties
  for (const key in userConfig) {
    if (userConfig.hasOwnProperty(key)) {
      if (
        typeof userConfig[key] === "object" &&
        userConfig[key] !== null &&
        typeof defaultConfig[key] === "object" &&
        defaultConfig[key] !== null
      ) {
        merged[key] = mergeConfigs(defaultConfig[key], userConfig[key]);
      } else {
        merged[key] = userConfig[key];
      }
    }
  }

  return merged;
}

// Set up configuration watcher
export function setupConfigWatcher(callback) {
  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      // Add check for changes.analyzerConfig
      if (namespace === "local" && changes.analyzerConfig) {
        // Add check for newValue
        if (changes.analyzerConfig.newValue) {
          callback(changes.analyzerConfig.newValue);
        } else {
          console.warn("Config watcher received change event but newValue was missing or falsy.");
        }
      }
    });
  }
}

// Update configuration
export async function updateConfig(newConfig) {
  try {
    // Load current config
    const currentConfig = await loadConfig();

    // Merge with new config
    const updatedConfig = mergeConfigs(currentConfig, newConfig);

    // Save updated config
    await saveConfig(updatedConfig);

    // Show notification if available
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "showNotification", message: "Configuration updated.", isError: false });
    }

    return updatedConfig;
  } catch (error) {
    console.error("Failed to update configuration:", error);
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "showNotification", message: "Failed to update configuration.", isError: true });
    }
    throw new ConfigError("Failed to update configuration", error);
  }
}

// Reset configuration to defaults
export async function resetConfig() {
  try {
    // Save default config
    await saveConfig(defaultConfig);

    // Show notification if available
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "showNotification", message: "Configuration reset to defaults.", isError: false });
    }

    return defaultConfig;
  } catch (error) {
    console.error("Failed to reset configuration:", error);
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "showNotification", message: "Failed to reset configuration.", isError: true });
    }
    throw new ConfigError("Failed to reset configuration", error);
  }
}

// Export configuration
export async function exportConfig() {
  try {
    // Load current config
    const config = await loadConfig();

    // Convert to JSON string
    const configJson = JSON.stringify(config, null, 2);

    // Create blob
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    if (typeof chrome !== "undefined" && chrome.downloads) {
      // Download file
      chrome.downloads.download({
        url: url,
        filename: "request-analyzer-config.json",
        saveAs: true,
      });
    }

    // Show notification if available
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "showNotification", message: "Configuration exported.", isError: false });
    }

    return true;
  } catch (error) {
    console.error("Failed to export configuration:", error);
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "showNotification", message: "Failed to export configuration.", isError: true });
    }
    throw new ConfigError("Failed to export configuration", error);
  }
}

// Import configuration
export async function importConfig(configJson) {
  try {
    // Parse JSON
    const config = JSON.parse(configJson);

    // Validate config
    if (!validateConfig(config)) {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: "showNotification", message: "Invalid configuration format.", isError: true });
      }
      throw new ConfigError("Invalid configuration format");
    }

    // Save config
    await saveConfig(config);

    // Show notification if available
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "showNotification", message: "Configuration imported.", isError: false });
    }

    return config;
  } catch (error) {
    console.error("Failed to import configuration:", error);
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "showNotification", message: "Failed to import configuration.", isError: true });
    }
    throw new ConfigError("Failed to import configuration", error);
  }
}

// Validate configuration
function validateConfig(config) {
  // Basic validation
  if (!config || typeof config !== "object") {
    return false;
  }

  // Check for required sections
  const requiredSections = [
    "general",
    "database",
    "capture",
    "security",
    "sync",
    "notifications",
    "ui",
    "export",
    "api",
  ];

  for (const section of requiredSections) {
    if (!config[section] || typeof config[section] !== "object") {
      return false;
    }
  }

  return true;
}
