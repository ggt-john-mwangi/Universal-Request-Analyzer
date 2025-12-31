/**
 * Settings Handlers
 * Handles application settings operations
 * Ported from popup-message-handler.js
 */

import settingsManager from "../../../lib/shared-components/settings-manager-core.js";

/**
 * Handle get settings
 */
async function handleGetSettings(message, sender, context) {
  try {
    // Reload settings from storage to get latest values (e.g., variables added in Options page)
    const storageData = await settingsManager.loadFromStorage();

    // Extract and replace with fresh storage data (storage structure: {settings: {...}, timestamp: ...})
    if (storageData && storageData.settings) {
      settingsManager.settings = storageData.settings;
    }

    const settings = await settingsManager.getSettings();

    return { success: true, settings };
  } catch (error) {
    console.error("[SettingsHandlers] Get settings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle update settings
 */
async function handleUpdateSettings(message, sender, context) {
  try {
    const { settings } = message;

    if (!settings) {
      return { success: false, error: "Settings object is required" };
    }

    const result = await settingsManager.updateSettings(settings);

    return { success: result, message: "Settings updated successfully" };
  } catch (error) {
    console.error("Update settings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle reset settings
 */
async function handleResetSettings(message, sender, context) {
  try {
    const result = await settingsManager.resetSettings();

    return { success: result, message: "Settings reset to defaults" };
  } catch (error) {
    console.error("Reset settings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get settings by category
 */
async function handleGetSettingsByCategory(message, sender, context) {
  try {
    const { category } = message;

    if (!category) {
      return { success: false, error: "Category is required" };
    }

    const allSettings = await settingsManager.getSettings();
    const categorySettings = allSettings[category] || null;

    if (!categorySettings) {
      return { success: false, error: `Category '${category}' not found` };
    }

    return { success: true, settings: categorySettings };
  } catch (error) {
    console.error("Get settings by category error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get capture settings
 */
async function handleGetCaptureSettings(message, sender, context) {
  try {
    const allSettings = await settingsManager.getSettings();
    const captureSettings = allSettings.capture || {};

    return { success: true, settings: captureSettings };
  } catch (error) {
    console.error("Get capture settings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle update capture settings
 */
async function handleUpdateCaptureSettings(message, sender, context) {
  try {
    const { settings } = message;

    if (!settings) {
      return { success: false, error: "Capture settings are required" };
    }

    const result = await settingsManager.updateSettings({
      capture: settings,
    });

    return { success: result, message: "Capture settings updated" };
  } catch (error) {
    console.error("Update capture settings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get filter settings
 */
async function handleGetFilterSettings(message, sender, context) {
  try {
    const allSettings = await settingsManager.getSettings();
    const filterSettings = allSettings.filters || {};

    return { success: true, settings: filterSettings };
  } catch (error) {
    console.error("Get filter settings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle update filter settings
 */
async function handleUpdateFilterSettings(message, sender, context) {
  try {
    const { settings } = message;

    if (!settings) {
      return { success: false, error: "Filter settings are required" };
    }

    const result = await settingsManager.updateSettings({
      filters: settings,
    });

    return { success: result, message: "Filter settings updated" };
  } catch (error) {
    console.error("Update filter settings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle validate settings
 */
async function handleValidateSettings(message, sender, context) {
  try {
    const { settings } = message;

    if (!settings) {
      return { success: false, error: "Settings object is required" };
    }

    // Basic validation
    const errors = [];

    // Validate capture settings
    if (settings.capture) {
      if (typeof settings.capture.enabled !== "boolean") {
        errors.push("capture.enabled must be a boolean");
      }
    }

    // Validate filter settings
    if (settings.filters) {
      if (
        settings.filters.includeDomains &&
        !Array.isArray(settings.filters.includeDomains)
      ) {
        errors.push("filters.includeDomains must be an array");
      }
      if (
        settings.filters.excludeDomains &&
        !Array.isArray(settings.filters.excludeDomains)
      ) {
        errors.push("filters.excludeDomains must be an array");
      }
    }

    const isValid = errors.length === 0;

    return {
      success: true,
      valid: isValid,
      errors: isValid ? null : errors,
    };
  } catch (error) {
    console.error("Validate settings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle save setting to database (legacy support)
 */
async function handleSaveSettingToDb(message, sender, context) {
  try {
    const { key, value } = message;
    const result = await settingsManager.saveSetting(key, value);
    return result;
  } catch (error) {
    console.error("Save setting to DB error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle load settings from database (legacy support)
 */
async function handleLoadSettingsFromDb(message, sender, context) {
  try {
    const settings = await settingsManager.loadSettings();
    return { success: true, settings };
  } catch (error) {
    console.error("Load settings from DB error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle sync settings to storage (legacy support)
 */
async function handleSyncSettingsToStorage(message, sender, context) {
  try {
    await settingsManager.syncToStorage();
    return { success: true };
  } catch (error) {
    console.error("Sync settings to storage error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle save setting (generic - legacy support)
 */
async function handleSaveSetting(message, sender, context) {
  try {
    const { key, value, category } = message;
    const result = await settingsManager.saveSetting(key, value, category);
    return result;
  } catch (error) {
    console.error("Save setting error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get setting (generic - legacy support)
 */
async function handleGetSetting(message, sender, context) {
  try {
    const { key, category } = message;
    const value = await settingsManager.getSetting(key, category);
    return { success: true, value };
  } catch (error) {
    console.error("Get setting error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for settings operations
 */
export const settingsHandlers = new Map([
  ["getSettings", handleGetSettings],
  ["updateSettings", handleUpdateSettings],
  ["resetSettings", handleResetSettings],
  ["getSettingsByCategory", handleGetSettingsByCategory],
  ["getCaptureSettings", handleGetCaptureSettings],
  ["updateCaptureSettings", handleUpdateCaptureSettings],
  ["getFilterSettings", handleGetFilterSettings],
  ["updateFilterSettings", handleUpdateFilterSettings],
  ["validateSettings", handleValidateSettings],
  // Legacy support
  ["saveSettingToDb", handleSaveSettingToDb],
  ["loadSettingsFromDb", handleLoadSettingsFromDb],
  ["syncSettingsToStorage", handleSyncSettingsToStorage],
  ["saveSetting", handleSaveSetting],
  ["getSetting", handleGetSetting],
]);
