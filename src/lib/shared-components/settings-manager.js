/**
 * Settings Manager for Universal Request Analyzer
 *
 * This module provides a unified interface for managing all settings,
 * including feature flags, ACLs, themes, and other configuration.
 */

import featureFlags from "../../config/feature-flags.js";
import aclManager from "../../auth/acl-manager.js";
import themeManager from "../../config/theme-manager.js";

// Cross-browser API support
const browserAPI = globalThis.browser || globalThis.chrome;

// Database config manager reference (will be injected)
let configSchemaManager = null;

/**
 * Settings manager class
 */
class SettingsManager {
  constructor() {
    this.initialized = false;
    this.settings = {
      general: {
        maxStoredRequests: 10000,
        autoStartCapture: true,
        showNotifications: true,
        confirmClearRequests: true,
        defaultExportFormat: "json",
        dateFormat: "yyyy-MM-dd HH:mm:ss",
        timeZone: "local",
        autoExport: false,
        autoExportInterval: 3600000, // 1 hour
        exportPath: "",
      },
      capture: {
        enabled: true,
        includeHeaders: true,
        includeTiming: true,
        includeContent: false,
        maxContentSize: 1024 * 1024,
        captureWebSockets: false,
        captureServerSentEvents: false,
        performanceMetrics: {
          enabled: false,
          samplingRate: 100,
          captureNavigationTiming: true,
          captureResourceTiming: true,
          captureServerTiming: false,
          captureCustomMetrics: false,
          retentionPeriod: 7 * 24 * 60 * 60 * 1000,
        },
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
        trackOnlyConfiguredSites: true, // Default: only track configured sites
      },
      display: {
        requestsPerPage: 50,
        expandedDetails: false,
        showStatusColors: true,
        showTimingBars: true,
        defaultTab: "requests",
        showCharts: true,
        enabledCharts: [
          "responseTime",
          "statusCodes",
          "domains",
          "requestTypes",
          "timeDistribution",
        ],
        columnOrder: [
          "method",
          "domain",
          "path",
          "status",
          "type",
          "size",
          "duration",
          "time",
        ],
      },
      advanced: {
        enableDebugMode: false,
        persistFilters: true,
        useCompression: true,
        backgroundMode: "persistent",
        syncInterval: 60,
        sqliteExport: {
          enabled: false,
          autoVacuum: true,
          vacuumInterval: 3600000,
        },
      },
      variables: {
        enabled: true,
        autoDetect: true,
        list: [
          // Example: { id: '1', name: 'API_TOKEN', value: '', description: 'API authentication token', createdAt: Date.now() }
        ],
      },
    };

    // Add event listeners for settings changes
    if (browserAPI && browserAPI.runtime) {
      browserAPI.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {
          if (message.action === "settingsUpdated") {
            this.handleSettingsUpdate(message.settings);
            sendResponse({ success: true });
          }
        }
      );
    }
  }

  /**
   * Initialize the settings manager
   * @returns {Promise<void>}
   */
  /**
   * Set database manager for config persistence
   * @param {Object} dbManager - Database manager instance with config access
   */
  setDatabaseManager(dbManager) {
    configSchemaManager = dbManager;
    console.log("Settings-manager: Database manager injected");
  }

  async initialize() {
    try {
      // Load saved settings from storage first (fast)
      const data = await this.loadFromStorage();

      // If database is available, load from there as source of truth
      if (configSchemaManager) {
        try {
          const dbSettings = await this.loadFromDatabase();
          if (dbSettings && Object.keys(dbSettings).length > 0) {
            // Database is source of truth, merge with defaults
            this.settings = this.mergeSettings(this.settings, dbSettings);
            // Sync to storage for content script access
            await this.saveToStorage();
            console.log("Settings loaded from database and synced to storage");
          } else if (data && data.settings) {
            // No DB settings yet, use storage
            this.settings = this.mergeSettings(this.settings, data.settings);
          }
        } catch (dbError) {
          console.warn("Failed to load from database, using storage:", dbError);
          if (data && data.settings) {
            this.settings = this.mergeSettings(this.settings, data.settings);
          }
        }
      } else {
        // No database available, use storage only
        if (data && data.settings) {
          this.settings = this.mergeSettings(this.settings, data.settings);
        }
      }

      if (data && data.settings) {
        // Merge saved settings with defaults
        this.settings = this.mergeSettings(this.settings, data.settings);
      }

      // Initialize feature flags
      await featureFlags.initialize({
        permissionLevel: "basic",
        initialFlags: {
          // Disable online features by default for testing
          onlineSync: false,
          authentication: false,
          remoteStorage: false,
          cloudExport: false,
          teamSharing: false,
        },
        onUpdate: this.handleFeatureFlagsUpdate.bind(this),
      });

      // Initialize ACL manager
      await aclManager.initialize({
        initialRole: "powerUser", // Use powerUser role for testing
        onUpdate: this.handleAclUpdate.bind(this),
      });

      // Initialize theme manager (only in browser context with document)
      if (typeof document !== "undefined") {
        await themeManager.initialize({
          initialTheme: "light",
          onUpdate: this.handleThemeUpdate.bind(this),
        });
      }

      this.initialized = true;

      // Save the merged settings
      await this.saveToStorage();

      console.log("Settings manager initialized:", {
        settings: this.settings,
        featureFlags: featureFlags.flags,
        role: aclManager.currentRole,
        theme:
          typeof document !== "undefined"
            ? themeManager.currentTheme
            : "N/A (service worker)",
      });
    } catch (error) {
      console.error("Error initializing settings manager:", error);
    }
  }

  /**
   * Load settings from storage
   * @returns {Promise<Object>}
   */
  async loadFromStorage() {
    if (!browserAPI || !browserAPI.storage) {
      return null;
    }

    return new Promise((resolve) => {
      browserAPI.storage.local.get("settings", (data) => {
        resolve(data.settings || null);
      });
    });
  }

  /**
   * Load settings from database config tables
   * @returns {Promise<Object|null>}
   */
  async loadFromDatabase() {
    if (!configSchemaManager) {
      return null;
    }

    try {
      const settings = {
        capture: {},
        general: {},
        display: {},
        advanced: {},
        variables: {
          enabled: true,
          autoDetect: true,
          list: [],
        },
      };

      // Load capture settings
      const captureSettings = await configSchemaManager.getSettingsByCategory(
        "capture"
      );
      if (captureSettings && Object.keys(captureSettings).length > 0) {
        settings.capture = captureSettings;
      }

      // Load general settings
      const generalSettings = await configSchemaManager.getSettingsByCategory(
        "general"
      );
      if (generalSettings && Object.keys(generalSettings).length > 0) {
        settings.general = generalSettings;
      }

      // Load display settings
      const displaySettings = await configSchemaManager.getSettingsByCategory(
        "display"
      );
      if (displaySettings && Object.keys(displaySettings).length > 0) {
        settings.display = displaySettings;
      }

      // Load advanced settings
      const advancedSettings = await configSchemaManager.getSettingsByCategory(
        "advanced"
      );
      if (advancedSettings && Object.keys(advancedSettings).length > 0) {
        settings.advanced = advancedSettings;
      }

      // Load variables settings
      const variablesSettings = await configSchemaManager.getSettingsByCategory(
        "variables"
      );
      if (variablesSettings && Object.keys(variablesSettings).length > 0) {
        settings.variables = variablesSettings;
      }
      console.log(
        "[SettingsManager] Loaded variables from DB:",
        settings.variables
      );

      return settings;
    } catch (error) {
      console.error("Failed to load settings from database:", error);
      return null;
    }
  }

  /**
   * Save settings to storage
   * @returns {Promise<void>}
   */
  async saveToStorage() {
    if (!browserAPI || !browserAPI.storage) {
      return;
    }

    // Save to storage (for content script access)
    await new Promise((resolve) => {
      browserAPI.storage.local.set(
        {
          settings: {
            settings: this.settings,
            timestamp: Date.now(),
          },
        },
        resolve
      );
    });

    // Also save to database (source of truth)
    await this.saveToDatabase();
  }

  /**
   * Sync settings to storage (alias for backward compatibility)
   * @returns {Promise<void>}
   */
  async syncToStorage() {
    return this.saveToStorage();
  }

  /**
   * Save settings to database config tables
   * @returns {Promise<void>}
   */
  async saveToDatabase() {
    if (!configSchemaManager) {
      return;
    }

    try {
      // Save each category of settings to database
      for (const [category, values] of Object.entries(this.settings)) {
        if (typeof values === "object" && values !== null) {
          for (const [key, value] of Object.entries(values)) {
            const fullKey = `${category}.${key}`;
            await configSchemaManager.setAppSetting(fullKey, value, {
              category,
              description: `${category} setting: ${key}`,
            });
          }
        }
      }
      console.log("Settings saved to database");
    } catch (error) {
      console.error("Failed to save settings to database:", error);
    }
  }

  /**
   * Merge settings objects
   * @param {Object} defaultSettings - Default settings
   * @param {Object} userSettings - User settings
   * @returns {Object} - Merged settings
   */
  mergeSettings(defaultSettings, userSettings) {
    const result = { ...defaultSettings };

    for (const [category, values] of Object.entries(userSettings)) {
      if (
        typeof values === "object" &&
        values !== null &&
        category in defaultSettings
      ) {
        result[category] = { ...defaultSettings[category], ...values };
      }
    }

    return result;
  }

  /**
   * Get all settings
   * @returns {Object} - All settings
   */
  getAllSettings() {
    return {
      settings: this.settings,
      featureFlags: featureFlags.getFeatureInfo(),
      acl: {
        role: aclManager.currentRole,
        roles: aclManager.getRolesInfo(),
        permissions: aclManager.getPermissionsInfo(),
      },
      theme: {
        current:
          typeof document !== "undefined" ? themeManager.currentTheme : "light",
        themes:
          typeof document !== "undefined" ? themeManager.getThemesInfo() : [],
      },
    };
  }

  /**
   * Update settings with persistence and synchronization
   * @param {Object} newSettings - New settings to apply
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async updateSettings(newSettings) {
    try {
      this.settings = this.mergeSettings(this.settings, newSettings);
      await this.saveToStorage();
      await this.broadcastSettingsUpdate(this.settings);
      this.notifySettingsListeners();
      return true;
    } catch (error) {
      console.error("Failed to update settings:", error);
      return false;
    }
  }

  /**
   * Broadcast settings update to all extension views
   * @param {Object} settings - Updated settings
   * @returns {Promise<void>}
   */
  async broadcastSettingsUpdate(settings) {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      await chrome.runtime.sendMessage({
        action: "settingsUpdated",
        settings: settings,
      });
    }
  }

  /**
   * Handle settings update from other views
   * @param {Object} settings - Updated settings
   */
  handleSettingsUpdate(settings) {
    this.settings = this.mergeSettings(this.settings, settings);
    this.notifySettingsListeners();
  }

  // Add settings change listener
  addSettingsListener(callback) {
    if (!this.settingsListeners) {
      this.settingsListeners = new Set();
    }
    this.settingsListeners.add(callback);
  }

  // Remove settings change listener
  removeSettingsListener(callback) {
    if (this.settingsListeners) {
      this.settingsListeners.delete(callback);
    }
  }

  // Notify all settings listeners
  notifySettingsListeners() {
    if (this.settingsListeners) {
      this.settingsListeners.forEach((callback) => {
        try {
          callback(this.settings);
        } catch (error) {
          console.error("Error in settings listener:", error);
        }
      });
    }
  }

  /**   * Get all settings
   * @returns {Object} Current settings object
   */
  getSettings() {
    console.log("[SettingsManager] getSettings() called");
    console.log("[SettingsManager] Initialized:", this.initialized);
    console.log("[SettingsManager] Settings keys:", Object.keys(this.settings));
    console.log("[SettingsManager] Variables:", this.settings.variables);
    return this.settings;
  }

  /**   * Update feature flags
   * @param {Object} flags - Feature flags to update
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async updateFeatureFlags(flags) {
    return await featureFlags.updateFeatures(flags);
  }

  /**
   * Set user role
   * @param {string} role - Role to set
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async setRole(role) {
    return await aclManager.setRole(role);
  }

  /**
   * Set theme
   * @param {string} themeId - Theme ID to set
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async setTheme(themeId) {
    if (typeof document === "undefined") {
      console.warn(
        "[SettingsManager] setTheme called in service worker context - skipping"
      );
      return false;
    }
    return await themeManager.setTheme(themeId);
  }

  /**
   * Reset all settings to defaults
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async resetAllToDefaults() {
    try {
      // Reset settings
      this.settings = {
        general: {
          maxStoredRequests: 10000,
          autoStartCapture: true,
          showNotifications: true,
          confirmClearRequests: true,
          defaultExportFormat: "json",
          dateFormat: "yyyy-MM-dd HH:mm:ss",
          timeZone: "local",
          autoExport: false,
          autoExportInterval: 3600000,
          exportPath: "",
        },
        capture: {
          enabled: true,
          includeHeaders: true,
          includeTiming: true,
          includeContent: false,
          maxContentSize: 1024 * 1024,
          captureWebSockets: false,
          captureServerSentEvents: false,
          performanceMetrics: {
            enabled: false,
            samplingRate: 100,
            captureNavigationTiming: true,
            captureResourceTiming: true,
            captureServerTiming: false,
            captureCustomMetrics: false,
            retentionPeriod: 7 * 24 * 60 * 60 * 1000,
          },
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
        display: {
          requestsPerPage: 50,
          expandedDetails: false,
          showStatusColors: true,
          showTimingBars: true,
          defaultTab: "requests",
          showCharts: true,
          enabledCharts: [
            "responseTime",
            "statusCodes",
            "domains",
            "requestTypes",
            "timeDistribution",
          ],
          columnOrder: [
            "method",
            "domain",
            "path",
            "status",
            "type",
            "size",
            "duration",
            "time",
          ],
        },
        advanced: {
          enableDebugMode: false,
          persistFilters: true,
          useCompression: true,
          backgroundMode: "persistent",
          syncInterval: 60,
          sqliteExport: {
            enabled: false,
            autoVacuum: true,
            vacuumInterval: 3600000,
          },
        },
      };

      // Reset feature flags, ACL, and theme
      await featureFlags.resetToDefaults();
      await aclManager.resetToDefaults();
      if (typeof document !== "undefined") {
        await themeManager.resetToDefaults();
      }

      // Save settings
      await this.saveToStorage();

      return true;
    } catch (error) {
      console.error("Error resetting settings:", error);
      return false;
    }
  }

  /**
   * Export settings to a file
   * @returns {Object} Settings data for export
   */
  exportSettings() {
    const exportData = {
      settings: this.settings,
      featureFlags: featureFlags.getFeatureInfo(),
      acl: {
        role: aclManager.currentRole,
        roles: aclManager.getRolesInfo(),
        permissions: aclManager.getPermissionsInfo(),
      },
      theme: {
        current:
          typeof document !== "undefined" ? themeManager.currentTheme : "light",
        themes:
          typeof document !== "undefined" ? themeManager.getThemesInfo() : [],
      },
      exportMeta: {
        version: chrome.runtime.getManifest().version,
        timestamp: Date.now(),
      },
    };
    return exportData;
  }

  /**
   * Import settings from exported data
   * @param {Object} importData - Data to import
   * @returns {Promise<boolean>} Whether the import was successful
   */
  async importSettings(importData) {
    try {
      // Validate import data
      if (!this.validateImportData(importData)) {
        throw new Error("Invalid import data format");
      }

      // Update settings
      this.settings = this.mergeSettings(this.settings, importData.settings);

      // Update feature flags if present
      if (importData.featureFlags) {
        await featureFlags.updateFeatures(importData.featureFlags);
      }

      // Update ACL if present
      if (importData.acl) {
        await aclManager.setRole(importData.acl.role);
      }

      // Update theme if present
      if (importData.theme && typeof document !== "undefined") {
        await themeManager.setTheme(importData.theme.current);
      }

      // Save to storage
      await this.saveToStorage();

      // Broadcast update
      await this.broadcastSettingsUpdate(this.settings);

      // Notify listeners
      this.notifySettingsListeners();

      return true;
    } catch (error) {
      console.error("Failed to import settings:", error);
      return false;
    }
  }

  /**
   * Validate import data format
   * @param {Object} data - Data to validate
   * @returns {boolean} Whether the data is valid
   */
  validateImportData(data) {
    // Check if required properties exist
    if (!data || !data.settings || !data.exportMeta) {
      return false;
    }

    // Check version compatibility
    const currentVersion = chrome.runtime.getManifest().version;
    const importVersion = data.exportMeta.version;

    // Simple version comparison - you might want to make this more sophisticated
    if (currentVersion !== importVersion) {
      console.warn(
        `Version mismatch: current=${currentVersion}, import=${importVersion}`
      );
      // Continue anyway, just log the warning
    }

    // Validate settings structure
    const requiredSections = ["general", "capture", "display", "advanced"];
    return requiredSections.every(
      (section) =>
        typeof data.settings[section] === "object" &&
        data.settings[section] !== null
    );
  }

  /**
   * Handle feature flags update
   * @param {Object} flags - Updated feature flags
   */
  handleFeatureFlagsUpdate(flags) {
    console.log("Feature flags updated:", flags);
    // You can add additional logic here if needed
  }

  /**
   * Handle ACL update
   * @param {Object} aclData - Updated ACL data
   */
  handleAclUpdate(aclData) {
    console.log("ACL updated:", aclData);
    // You can add additional logic here if needed
  }

  /**
   * Handle theme update
   * @param {Object} themeData - Updated theme data
   */
  handleThemeUpdate(themeData) {
    console.log("Theme updated:", themeData);
    // You can add additional logic here if needed
  }

  /**
   * Get all variables
   * @returns {Array} List of variables
   */
  getVariables() {
    return this.settings.variables?.list || [];
  }

  /**
   * Add a new variable
   * @param {Object} variable - Variable object { name, value, description }
   * @returns {Promise<boolean>} Success status
   */
  async addVariable(variable) {
    try {
      console.log("[SettingsManager] addVariable called with:", variable);

      if (!variable.name || !this.isValidVariableName(variable.name)) {
        throw new Error(
          "Invalid variable name. Use alphanumeric characters and underscores only."
        );
      }

      // Check for duplicates
      const existingIndex = this.settings.variables.list.findIndex(
        (v) => v.name === variable.name
      );

      if (existingIndex !== -1) {
        throw new Error(`Variable "${variable.name}" already exists`);
      }

      const newVariable = {
        id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: variable.name,
        value: variable.value || "",
        description: variable.description || "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      console.log(
        "[SettingsManager] Created new variable object:",
        newVariable
      );

      this.settings.variables.list.push(newVariable);

      console.log(
        "[SettingsManager] Total variables now:",
        this.settings.variables.list.length
      );
      console.log("[SettingsManager] Saving to storage...");

      await this.saveToStorage();

      console.log("[SettingsManager] Broadcasting update...");
      await this.broadcastSettingsUpdate(this.settings);

      console.log("[SettingsManager] Variable added successfully");
      return true;
    } catch (error) {
      console.error("Failed to add variable:", error);
      throw error;
    }
  }

  /**
   * Update an existing variable
   * @param {string} id - Variable ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<boolean>} Success status
   */
  async updateVariable(id, updates) {
    try {
      const index = this.settings.variables.list.findIndex((v) => v.id === id);

      if (index === -1) {
        throw new Error(`Variable with ID "${id}" not found`);
      }

      // If changing name, validate and check for duplicates
      if (
        updates.name &&
        updates.name !== this.settings.variables.list[index].name
      ) {
        if (!this.isValidVariableName(updates.name)) {
          throw new Error("Invalid variable name");
        }

        const duplicate = this.settings.variables.list.find(
          (v) => v.name === updates.name && v.id !== id
        );

        if (duplicate) {
          throw new Error(`Variable "${updates.name}" already exists`);
        }
      }

      this.settings.variables.list[index] = {
        ...this.settings.variables.list[index],
        ...updates,
        updatedAt: Date.now(),
      };

      await this.saveToStorage();
      await this.broadcastSettingsUpdate(this.settings);

      return true;
    } catch (error) {
      console.error("Failed to update variable:", error);
      throw error;
    }
  }

  /**
   * Delete a variable
   * @param {string} id - Variable ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteVariable(id) {
    try {
      const index = this.settings.variables.list.findIndex((v) => v.id === id);

      if (index === -1) {
        throw new Error(`Variable with ID "${id}" not found`);
      }

      this.settings.variables.list.splice(index, 1);

      await this.saveToStorage();
      await this.broadcastSettingsUpdate(this.settings);

      return true;
    } catch (error) {
      console.error("Failed to delete variable:", error);
      throw error;
    }
  }

  /**
   * Validate variable name format
   * @param {string} name - Variable name to validate
   * @returns {boolean} Whether the name is valid
   */
  isValidVariableName(name) {
    // Allow alphanumeric characters and underscores, must start with letter or underscore
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
  }

  /**
   * Substitute variables in text
   * @param {string} text - Text containing ${VAR_NAME} placeholders
   * @returns {string} Text with variables substituted
   */
  substituteVariables(text) {
    if (!text) return text;

    let result = text;
    const variables = this.getVariables();

    variables.forEach((variable) => {
      const placeholder = `\${${variable.name}}`;
      const regex = new RegExp(
        placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "g"
      );
      result = result.replace(regex, variable.value);
    });

    return result;
  }

  /**
   * Detect and create variable placeholders in text
   * @param {string} text - Text to analyze
   * @param {Array} patterns - Patterns to detect { regex, variableName }
   * @returns {string} Text with sensitive values replaced by ${VAR_NAME}
   */
  createVariablePlaceholders(text, patterns = []) {
    if (!text) return text;

    let result = text;
    const variables = this.getVariables();

    // Replace known variable values with placeholders
    variables.forEach((variable) => {
      if (variable.value && variable.value.length > 0) {
        const escaped = variable.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "g");
        result = result.replace(regex, `\${${variable.name}}`);
      }
    });

    // Apply custom patterns
    patterns.forEach((pattern) => {
      result = result.replace(pattern.regex, (match) => {
        return `\${${pattern.variableName}}`;
      });
    });

    return result;
  }
}

// Create and export singleton instance
const settingsManager = new SettingsManager();

export default settingsManager;
