/**
 * Settings Manager for Universal Request Analyzer
 *
 * This module provides a unified interface for managing all settings,
 * including feature flags, ACLs, themes, and other configuration.
 */

import featureFlags from "../../config/feature-flags.js"
import aclManager from "../../auth/acl-manager.js"
import themeManager from "../../config/theme-manager.js"

/**
 * Settings manager class
 */
class SettingsManager {
  constructor() {
    this.initialized = false
    this.settings = {
      general: {
        maxStoredRequests: 10000,
        autoStartCapture: true,
        showNotifications: true,
        confirmClearRequests: true,
        defaultExportFormat: "json",
        dateFormat: "yyyy-MM-dd HH:mm:ss",
        timeZone: "local", // 'local', 'utc', or specific timezone
      },
      capture: {
        includeHeaders: true,
        includeTiming: true,
        includeContent: false,
        maxContentSize: 1024 * 1024, // 1MB
        captureWebSockets: false,
        captureServerSentEvents: false,
      },
      display: {
        requestsPerPage: 50,
        expandedDetails: false,
        showStatusColors: true,
        showTimingBars: true,
        defaultTab: "requests",
        columnOrder: ["method", "domain", "path", "status", "type", "size", "duration", "time"],
      },
      advanced: {
        enableDebugMode: false,
        persistFilters: true,
        useCompression: true,
        backgroundMode: "persistent", // 'persistent' or 'on-demand'
        syncInterval: 60, // seconds
      },
    }
  }

  /**
   * Initialize the settings manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load saved settings from storage
      const data = await this.loadFromStorage()

      if (data && data.settings) {
        // Merge saved settings with defaults
        this.settings = this.mergeSettings(this.settings, data.settings)
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
      })

      // Initialize ACL manager
      await aclManager.initialize({
        initialRole: "powerUser", // Use powerUser role for testing
        onUpdate: this.handleAclUpdate.bind(this),
      })

      // Initialize theme manager
      await themeManager.initialize({
        initialTheme: "light",
        onUpdate: this.handleThemeUpdate.bind(this),
      })

      this.initialized = true

      // Save the merged settings
      await this.saveToStorage()

      console.log("Settings manager initialized:", {
        settings: this.settings,
        featureFlags: featureFlags.flags,
        role: aclManager.currentRole,
        theme: themeManager.currentTheme,
      })
    } catch (error) {
      console.error("Error initializing settings manager:", error)
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
          resolve(data.settings || null)
        })
      } else {
        resolve(null) // Or handle the case where chrome.storage is not available
      }
    })
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
          resolve,
        )
      } else {
        resolve() // Or handle the case where chrome.storage is not available
      }
    })
  }

  /**
   * Merge settings objects
   * @param {Object} defaultSettings - Default settings
   * @param {Object} userSettings - User settings
   * @returns {Object} - Merged settings
   */
  mergeSettings(defaultSettings, userSettings) {
    const result = { ...defaultSettings }

    for (const [category, values] of Object.entries(userSettings)) {
      if (typeof values === "object" && values !== null && category in defaultSettings) {
        result[category] = { ...defaultSettings[category], ...values }
      }
    }

    return result
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
    }
  }

  /**
   * Update settings
   * @param {Object} newSettings - New settings to apply
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async updateSettings(newSettings) {
    if (!newSettings || typeof newSettings !== "object") {
      return false
    }

    // Update settings by category
    for (const [category, values] of Object.entries(newSettings)) {
      if (category in this.settings && typeof values === "object") {
        this.settings[category] = { ...this.settings[category], ...values }
      }
    }

    await this.saveToStorage()
    return true
  }

  /**
   * Update feature flags
   * @param {Object} flags - Feature flags to update
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async updateFeatureFlags(flags) {
    return await featureFlags.updateFeatures(flags)
  }

  /**
   * Set user role
   * @param {string} role - Role to set
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async setRole(role) {
    return await aclManager.setRole(role)
  }

  /**
   * Set theme
   * @param {string} themeId - Theme ID to set
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async setTheme(themeId) {
    return await themeManager.setTheme(themeId)
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
        },
        capture: {
          includeHeaders: true,
          includeTiming: true,
          includeContent: false,
          maxContentSize: 1024 * 1024,
          captureWebSockets: false,
          captureServerSentEvents: false,
        },
        display: {
          requestsPerPage: 50,
          expandedDetails: false,
          showStatusColors: true,
          showTimingBars: true,
          defaultTab: "requests",
          columnOrder: ["method", "domain", "path", "status", "type", "size", "duration", "time"],
        },
        advanced: {
          enableDebugMode: false,
          persistFilters: true,
          useCompression: true,
          backgroundMode: "persistent",
          syncInterval: 60,
        },
      }

      // Reset feature flags, ACL, and theme
      await featureFlags.resetToDefaults()
      await aclManager.resetToDefaults()
      await themeManager.resetToDefaults()

      // Save settings
      await this.saveToStorage()

      return true
    } catch (error) {
      console.error("Error resetting settings:", error)
      return false
    }
  }

  /**
   * Handle feature flags update
   * @param {Object} flags - Updated feature flags
   */
  handleFeatureFlagsUpdate(flags) {
    console.log("Feature flags updated:", flags)
    // You can add additional logic here if needed
  }

  /**
   * Handle ACL update
   * @param {Object} aclData - Updated ACL data
   */
  handleAclUpdate(aclData) {
    console.log("ACL updated:", aclData)
    // You can add additional logic here if needed
  }

  /**
   * Handle theme update
   * @param {Object} themeData - Updated theme data
   */
  handleThemeUpdate(themeData) {
    console.log("Theme updated:", themeData)
    // You can add additional logic here if needed
  }
}

// Create and export singleton instance
const settingsManager = new SettingsManager()

export default settingsManager

