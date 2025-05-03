// Configuration manager

import { ConfigError } from "../errors/error-types.js";

// Default configuration
const defaultConfig = {
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

  // UI configuration
  ui: {
    theme: "system", // system, light, dark
    accentColor: "#0066cc",
    fontSize: "medium", // small, medium, large
    dateFormat: "MM/DD/YYYY HH:mm:ss",
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

// Load configuration
export async function loadConfig() {
  try {
    // Load from storage
    const storedConfig = await getStoredConfig();

    // Merge with default config
    const config = mergeConfigs(defaultConfig, storedConfig);

    // Save merged config
    await saveConfig(config);

    return config;
  } catch (error) {
    console.error("Failed to load configuration:", error);

    // Return default config as fallback
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
          reject(new ConfigError(chrome.runtime.lastError.message));
        } else {
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

    return updatedConfig;
  } catch (error) {
    console.error("Failed to update configuration:", error);
    throw new ConfigError("Failed to update configuration", error);
  }
}

// Reset configuration to defaults
export async function resetConfig() {
  try {
    // Save default config
    await saveConfig(defaultConfig);

    return defaultConfig;
  } catch (error) {
    console.error("Failed to reset configuration:", error);
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

    return true;
  } catch (error) {
    console.error("Failed to export configuration:", error);
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
      throw new ConfigError("Invalid configuration format");
    }

    // Save config
    await saveConfig(config);

    return config;
  } catch (error) {
    console.error("Failed to import configuration:", error);
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
