// Configuration manager

import { ConfigError } from "../errors/error-types.js";
import { saveConfigToDb, loadConfigFromDb } from "../database/db-manager.js";
import { defaultConfig } from "../utils/utils.js";

// Load configuration from DB, fallback to default if not found
export async function loadConfig() {
  try {
    let dbConfig = null;
    try {
      dbConfig = loadConfigFromDb && loadConfigFromDb("main");
      if (dbConfig instanceof Promise) dbConfig = await dbConfig;
    } catch (e) {
      dbConfig = null;
    }
    if (!dbConfig) {
      try {
        saveConfigToDb && saveConfigToDb(defaultConfig, "main");
      } catch (e) {}
      dbConfig = defaultConfig;
    }
    // Merge loaded config with defaults to ensure all sections exist
    const config = mergeConfigs(defaultConfig, dbConfig);
    // Save merged config to DB if it was missing sections
    try {
      saveConfigToDb && saveConfigToDb(config, "main");
    } catch (e) {}
    return config;
  } catch (error) {
    console.error("Failed to load configuration:", error);
    return defaultConfig;
  }
}

// Get current configuration - alias for loadConfig for backward compatibility
export async function getConfig() {
  return loadConfig();
}

// Save configuration to DB
async function saveConfig(config) {
  try {
    saveConfigToDb(config, "main");
    return config;
  } catch (error) {
    throw new ConfigError("Failed to save configuration", error);
  }
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

// Update configuration in DB
export async function updateConfig(newConfig) {
  try {
    const currentConfig = await loadConfig();
    const updatedConfig = mergeConfigs(currentConfig, newConfig);
    saveConfigToDb(updatedConfig, "main");
    return updatedConfig;
  } catch (error) {
    console.error("Failed to update configuration:", error);
    throw new ConfigError("Failed to update configuration", error);
  }
}

// Reset configuration to defaults in DB
export async function resetConfig() {
  try {
    saveConfigToDb(defaultConfig, "main");
    return defaultConfig;
  } catch (error) {
    console.error("Failed to reset configuration:", error);
    throw new ConfigError("Failed to reset configuration", error);
  }
}

// Export configuration (download as JSON)
export async function exportConfig() {
  try {
    const config = await loadConfig();
    const configJson = JSON.stringify(config, null, 2);
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    if (typeof chrome !== "undefined" && chrome.downloads) {
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

// Import configuration (from JSON)
export async function importConfig(configJson) {
  try {
    const config = JSON.parse(configJson);
    if (!validateConfig(config)) {
      throw new ConfigError("Invalid configuration format");
    }
    saveConfigToDb(config, "main");
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
