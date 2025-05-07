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
 * Sends a message to the background script.
 * @param {object} message - The message object to send.
 * @returns {Promise<any>} - A promise that resolves with the response.
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error("SettingsManager Error:", chrome.runtime.lastError.message, "for action:", message.action);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          console.error("SettingsManager Background Error:", response.error, "for action:", message.action);
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    } else {
      console.warn("chrome.runtime.sendMessage is not available. Running in a non-extension context?");
      reject(new Error("Extension context not available."));
    }
  });
}

/**
 * Loads all settings data from the background script using event-based messaging.
 * Returns a Promise that resolves with the settings data object.
 */
export function loadSettingsData() {
  return new Promise((resolve) => {
    const requestId = `loadSettings_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function handler(message) {
      if (message && message.requestId === requestId) {
        resolve(message);
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    chrome.runtime.sendMessage({ action: "getSettingsData", requestId });
  });
}

/**
 * Updates the configuration in the background script using event-based messaging.
 * @param {object} newConfig - The partial or full configuration object to update.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export function updateConfig(newConfig) {
  return new Promise((resolve) => {
    const requestId = `updateConfig_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function handler(message) {
      if (message && message.requestId === requestId) {
        resolve(message.success);
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    chrome.runtime.sendMessage({ action: "updateConfig", data: newConfig, requestId });
  });
}

/**
 * Resets the configuration to defaults using event-based messaging.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export function resetConfig() {
  return new Promise((resolve) => {
    const requestId = `resetConfig_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function handler(message) {
      if (message && message.requestId === requestId) {
        resolve(message.success);
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    chrome.runtime.sendMessage({ action: "resetConfig", requestId });
  });
}

// --- Harmonized Config/Filters Sync System ---
// Always fetch config/filters from background on load
export async function getHarmonizedConfig() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
      resolve(response && response.config ? response.config : {});
    });
  });
}

// Always update config/filters via background
export function updateHarmonizedConfig(newConfig, callback) {
  chrome.runtime.sendMessage({ action: "updateConfig", data: newConfig }, callback);
}

// Listen for config updates from background
export function listenForConfigUpdates(onUpdate) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "config:updated" && message.newConfig) {
      onUpdate(message.newConfig);
    }
  });
}

// Specific settings save/reset functions (called by settings-ui.js)

export async function saveGeneralSettings() {
  // 1. Read values from general settings inputs
  const generalSettings = {
    maxStoredRequests: parseInt(document.getElementById('maxStoredRequests')?.value, 10) || 10000,
    autoStartCapture: document.getElementById('autoStartCapture')?.checked ?? false,
    showNotifications: document.getElementById('showNotifications')?.checked ?? true,
    confirmClearRequests: document.getElementById('confirmClearRequests')?.checked ?? true,
    defaultExportFormat: document.getElementById('defaultExportFormat')?.value || 'json',
    dateFormat: document.getElementById('dateFormat')?.value || 'MM/DD/YYYY HH:mm:ss',
    timeZone: document.getElementById('timeZone')?.value || 'local',
  };
  // 2. Call updateConfig
  const success = await updateConfig({ general: generalSettings });
  showNotification(success ? "General settings saved." : "Failed to save general settings.", !success);
}

export async function saveCaptureSettings() {
  const captureSettings = {
    includeHeaders: document.getElementById('includeHeaders')?.checked ?? true,
    includeTiming: document.getElementById('includeTiming')?.checked ?? false,
    includeContent: document.getElementById('includeContent')?.checked ?? false,
    maxContentSize: parseInt(document.getElementById('maxContentSize')?.value, 10) || 1048576, // 1MB default
    captureWebSockets: document.getElementById('captureWebSockets')?.checked ?? false,
    captureServerSentEvents: document.getElementById('captureServerSentEvents')?.checked ?? false,
  };
  const success = await updateConfig({ capture: captureSettings });
   showNotification(success ? "Capture settings saved." : "Failed to save capture settings.", !success);
}

export async function saveDisplaySettings() {
    const displaySettings = {
        requestsPerPage: parseInt(document.getElementById('requestsPerPage')?.value, 10) || 50,
        expandedDetails: document.getElementById('expandedDetails')?.checked ?? false,
        showStatusColors: document.getElementById('showStatusColors')?.checked ?? true,
        showTimingBars: document.getElementById('showTimingBars')?.checked ?? false,
        defaultTab: document.getElementById('defaultTab')?.value || 'requests',
        // columnOrder: ... // Need UI for this
    };
    const success = await updateConfig({ display: displaySettings });
    showNotification(success ? "Display settings saved." : "Failed to save display settings.", !success);
}

export async function saveFeatureSettings() {
    const featureFlags = {};
    document.querySelectorAll('.feature-toggle input[type="checkbox"]').forEach(checkbox => {
        // Only include flags that the user has permission to change (not disabled)
        if (!checkbox.disabled) {
            featureFlags[checkbox.dataset.featureId] = checkbox.checked;
        }
    });
    // Send message to background to update feature flags
    try {
        const response = await sendMessage({ action: "updateFeatureFlags", flags: featureFlags });
        showNotification(response?.success ? "Feature flags saved." : "Failed to save feature flags.", !response?.success);
        // Optionally reload the section to reflect dependency changes
    } catch (error) {
        showNotification("Error saving feature flags.", true);
    }
}

export async function resetFeatureSettings() {
    if (!confirm("Reset feature flags to defaults?")) return;
    try {
        const response = await sendMessage({ action: "resetFeatureFlags" });
        if (response?.success) {
            showNotification("Feature flags reset to defaults.");
            // Reload UI or update checkboxes based on response.defaultFlags
            // For now, recommend refreshing the extension popup or re-opening settings
            // A full reload might be needed.
        } else {
            showNotification("Failed to reset feature flags.", true);
        }
    } catch (error) {
        showNotification("Error resetting feature flags.", true);
    }
}

export async function savePermissionSettings() {
    // This likely involves setting the current role
    const selectedRole = document.getElementById('currentRole')?.value;
    if (!selectedRole || document.getElementById('currentRole')?.disabled) return;

    try {
        const response = await sendMessage({ action: "setCurrentRole", role: selectedRole });
        showNotification(response?.success ? "Role changed successfully." : "Failed to change role.", !response?.success);
         if (response?.success) {
            // Reload settings UI to reflect new permissions/features state
            showNotification("Reloading settings to apply new role...", false);
            // Find the settings tab content and re-initialize
            const settingsTabContent = document.querySelector('.tab-content[data-tab="settings"]');
            if (settingsTabContent && typeof window.initSettingsUI === 'function') {
                await window.initSettingsUI(); // Re-run init function if available globally
            }
         }
    } catch (error) {
        showNotification("Error changing role.", true);
    }
}

export async function resetPermissionSettings() {
     if (!confirm("Reset permissions/roles to defaults? (Requires Admin privileges)")) return;
     try {
        const response = await sendMessage({ action: "resetAcl" });
        showNotification(response?.success ? "Permissions reset to defaults." : "Failed to reset permissions.", !response?.success);
        // Reload UI
        if (response?.success) {
             const settingsTabContent = document.querySelector('.tab-content[data-tab="settings"]');
            if (settingsTabContent && typeof window.initSettingsUI === 'function') {
                await window.initSettingsUI();
            }
        }
     } catch (error) {
        showNotification("Error resetting permissions.", true);
     }
}

export async function saveThemeSettings() {
    const selectedTheme = document.getElementById('currentTheme')?.value;
    if (!selectedTheme) return;
    try {
        const response = await sendMessage({ action: "setTheme", theme: selectedTheme });
        showNotification(response?.success ? "Theme applied." : "Failed to apply theme.", !response?.success);
        // Theme application should happen automatically via themeManager applying styles
    } catch (error) {
        showNotification("Error applying theme.", true);
    }
}

export async function resetThemeSettings() {
    if (!confirm("Reset theme to default (System Preference)?")) return;
    try {
        const response = await sendMessage({ action: "resetThemes" });
        showNotification(response?.success ? "Theme reset to default." : "Failed to reset theme.", !response?.success);
        // Update dropdown selection
        const themeSelect = document.getElementById('currentTheme');
        if (themeSelect) themeSelect.value = 'system';
    } catch (error) {
        showNotification("Error resetting theme.", true);
    }
}

export async function saveAdvancedSettings() {
    const advancedSettings = {
        enableDebugMode: document.getElementById('enableDebugMode')?.checked ?? false,
        persistFilters: document.getElementById('persistFilters')?.checked ?? true,
        useCompression: document.getElementById('useCompression')?.checked ?? false,
        backgroundMode: document.getElementById('backgroundMode')?.value || 'default',
        syncInterval: parseInt(document.getElementById('syncInterval')?.value, 10) || 60,
    };
    const success = await updateConfig({ advanced: advancedSettings });
    showNotification(success ? "Advanced settings saved." : "Failed to save advanced settings.", !success);
}

// Reset All Settings
export async function resetAllSettings() {
    const success = await resetConfig(); // Uses the generic resetConfig
    showNotification(success ? "All settings reset to defaults." : "Failed to reset settings.", !success);
    if (success) {
        // Reload the entire settings UI to reflect defaults
         const settingsTabContent = document.querySelector('.tab-content[data-tab="settings"]');
        if (settingsTabContent && typeof window.initSettingsUI === 'function') {
            await window.initSettingsUI();
        }
    }
}


// Helper function to show notifications (assuming popup.js has one)
function showNotification(message, isError = false) {
  // Use the globally exposed function from popup.js
  if (typeof window.showNotification === 'function') {
      window.showNotification(message, isError);
  } else {
      // Fallback to console if global function not found
      if (isError) {
          console.error("Notification:", message);
      } else {
          console.log("Notification:", message);
      }
  }
}

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

