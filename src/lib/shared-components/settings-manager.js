/**
 * Settings Manager for Universal Request Analyzer
 *
 * This module provides a unified interface for managing all settings,
 * including feature flags, ACLs, themes, and other configuration.
 */

import featureFlags from "../../config/feature-flags.js";
import aclManager from "../../auth/acl-manager.js";
import themeManager from "../../config/theme-manager.js";

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

    // Add event listeners for settings changes
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "settingsUpdated") {
          this.handleSettingsUpdate(message.settings);
          sendResponse({ success: true });
        }
      });
    }
  }

  /**
   * Initialize the settings manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load saved settings from storage
      const data = await this.loadFromStorage();

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

      // Initialize theme manager
      await themeManager.initialize({
        initialTheme: "light",
        onUpdate: this.handleThemeUpdate.bind(this),
      });

      this.initialized = true;

      // Save the merged settings
      await this.saveToStorage();

      console.log("Settings manager initialized:", {
        settings: this.settings,
        featureFlags: featureFlags.flags,
        role: aclManager.currentRole,
        theme: themeManager.currentTheme,
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
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get("settings", (data) => {
          resolve(data.settings || null);
        });
      } else {
        resolve(null); // Or handle the case where chrome.storage is not available
      }
    });
  }

  /**
   * Save settings to storage
   * @returns {Promise<void>}
   */
  async saveToStorage() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.set(
          {
            settings: {
              settings: this.settings,
              timestamp: Date.now(),
            },
          },
          resolve
        );
      } else {
        resolve(); // Or handle the case where chrome.storage is not available
      }
    });
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
        current: themeManager.currentTheme,
        themes: themeManager.getThemesInfo(),
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

  /**
   * Update feature flags
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
      await themeManager.resetToDefaults();

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
        current: themeManager.currentTheme,
        themes: themeManager.getThemesInfo(),
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
      if (importData.theme) {
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
}

// Create and export singleton instance
const settingsManager = new SettingsManager();

export default settingsManager;
