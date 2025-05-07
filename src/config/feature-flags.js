/**
 * Feature Flags System for Universal Request Analyzer
 *
 * This module provides a centralized way to enable/disable features
 * and control access to functionality based on user permissions.
 */

// Default feature flags configuration
export const defaultFeatureFlags = {
  // Core features
  captureRequests: true,
  filterRequests: true,
  exportData: true,
  statistics: true,
  visualization: true,

  // Online features (disabled by default for local testing)
  onlineSync: false,
  authentication: false,
  remoteStorage: false,
  cloudExport: false,
  teamSharing: false,

  // Advanced features
  requestModification: false,
  requestMocking: false,
  automatedTesting: false,
  performanceAlerts: false,
  customRules: false,

  // Experimental features
  aiAnalysis: false,
  predictiveAnalytics: false,
  securityScanning: false,

  // Logging features
  logErrorsToDatabase: true, // Toggle logging errors to the internal database
  logErrorsToConsole: true, // Toggle logging errors to the browser console

  enableAdvancedSync: false, // Example: Toggle advanced sync features
  enableExperimentalUI: false, // Example: Toggle experimental UI elements
};

export const FEATURE_FLAGS = {
  logErrorsToDatabase: {
    name: "Log Errors to Database",
    description: "Enable logging of internal extension errors to the database.",
    defaultValue: true,
    category: "debugging",
  },
  logErrorsToConsole: {
    name: "Log Errors to Console",
    description: "Enable logging of internal extension errors to the browser console.",
    defaultValue: true,
    category: "debugging",
  },
};

/**
 * Feature flags manager class
 */
class FeatureFlagsManager {
  constructor() {
    this.flags = { ...defaultFeatureFlags }
    this.userPermissionLevel = "basic" // Default permission level
    this.initialized = false
  }

  /**
   * Initialize the feature flags system
   * @param {Object} options - Initialization options
   * @param {string} options.permissionLevel - User permission level
   * @param {Object} options.initialFlags - Initial feature flag values
   * @param {Function} options.onUpdate - Callback when flags are updated
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    // Set user permission level
    if (options.permissionLevel) {
      this.userPermissionLevel = options.permissionLevel
    }

    // Load saved flags from storage
    try {
      const data = await this.loadFromStorage();
      // Defensive: data may be undefined or not have .flags
      if (data && typeof data === 'object' && data.flags && typeof data.flags === 'object') {
        this.flags = { ...defaultFeatureFlags, ...data.flags };
      } else {
        // Fallback to defaults if not present
        this.flags = { ...defaultFeatureFlags };
      }

      // Override with initial flags if provided
      if (options.initialFlags) {
        this.flags = { ...this.flags, ...options.initialFlags }
      }

      // Store callback
      this.onUpdateCallback = options.onUpdate

      // Validate dependencies and permissions
      this.validateFlags()

      this.initialized = true

      // Save the validated flags
      await this.saveToStorage()

      console.log("Feature flags initialized:", this.flags)
    } catch (error) {
      console.error("Error initializing feature flags:", error)
      // Fall back to defaults
      this.flags = { ...defaultFeatureFlags }
      if (options.initialFlags) {
        this.flags = { ...this.flags, ...options.initialFlags }
      }
      this.initialized = true
    }
  }

  /**
   * Load feature flags from storage
   * @returns {Promise<Object>}
   */
  async loadFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get("featureFlags", (data) => {
        resolve(data.featureFlags || {})
      })
    })
  }

  /**
   * Save feature flags to storage
   * @returns {Promise<void>}
   */
  async saveToStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ featureFlags: { flags: this.flags, timestamp: Date.now() } }, resolve)
    })
  }

  /**
   * Check if a feature is enabled
   * @param {string} featureName - Name of the feature to check
   * @returns {boolean} - Whether the feature is enabled
   */
  isEnabled(featureName) {
    if (!this.initialized) {
      console.warn("Feature flags not initialized, using defaults")
      return defaultFeatureFlags[featureName] || false
    }

    return this.flags[featureName] || false
  }

  /**
   * Enable a feature
   * @param {string} featureName - Name of the feature to enable
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async enableFeature(featureName) {
    if (!this.hasPermission(featureName)) {
      console.warn(`User does not have permission to enable ${featureName}`)
      return false
    }

    this.flags[featureName] = true

    // Enable dependencies
    if (FEATURE_DEPENDENCIES[featureName]) {
      for (const dependency of FEATURE_DEPENDENCIES[featureName]) {
        if (!this.flags[dependency]) {
          console.log(`Enabling dependency: ${dependency} for ${featureName}`)
          this.flags[dependency] = true
        }
      }
    }

    await this.saveToStorage()

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.flags)
    }

    return true
  }

  /**
   * Disable a feature
   * @param {string} featureName - Name of the feature to disable
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async disableFeature(featureName) {
    this.flags[featureName] = false

    // Disable dependent features
    for (const [feature, dependencies] of Object.entries(FEATURE_DEPENDENCIES)) {
      if (dependencies.includes(featureName) && this.flags[feature]) {
        console.log(`Disabling dependent feature: ${feature} because ${featureName} was disabled`)
        this.flags[feature] = false
      }
    }

    await this.saveToStorage()

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.flags)
    }

    return true
  }

  /**
   * Update multiple features at once
   * @param {Object} updates - Object with feature names as keys and boolean values
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async updateFeatures(updates) {
    let changed = false

    for (const [feature, enabled] of Object.entries(updates)) {
      if (enabled && !this.hasPermission(feature)) {
        console.warn(`User does not have permission to enable ${feature}`)
        continue
      }

      if (this.flags[feature] !== enabled) {
        this.flags[feature] = enabled
        changed = true
      }
    }

    if (changed) {
      this.validateFlags()
      await this.saveToStorage()

      if (this.onUpdateCallback) {
        this.onUpdateCallback(this.flags)
      }
    }

    return changed
  }

  /**
   * Check if user has permission for a feature
   * @param {string} featureName - Name of the feature to check
   * @returns {boolean} - Whether the user has permission
   */
  hasPermission(featureName) {
    const requiredLevel = FEATURE_PERMISSIONS[featureName] || "admin"
    const userLevelIndex = PERMISSION_LEVELS.indexOf(this.userPermissionLevel)
    const requiredLevelIndex = PERMISSION_LEVELS.indexOf(requiredLevel)

    return userLevelIndex >= requiredLevelIndex
  }

  /**
   * Set user permission level
   * @param {string} level - New permission level
   * @returns {Promise<void>}
   */
  async setPermissionLevel(level) {
    if (!PERMISSION_LEVELS.includes(level)) {
      console.error(`Invalid permission level: ${level}`)
      return
    }

    this.userPermissionLevel = level
    this.validateFlags()
    await this.saveToStorage()

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.flags)
    }
  }

  /**
   * Validate flags to ensure dependencies and permissions are respected
   */
  validateFlags() {
    // Disable features the user doesn't have permission for
    for (const [feature, permission] of Object.entries(FEATURE_PERMISSIONS)) {
      if (this.flags[feature] && !this.hasPermission(feature)) {
        console.log(`Disabling ${feature} due to insufficient permissions`)
        this.flags[feature] = false
      }
    }

    // Ensure dependencies are met
    for (const [feature, dependencies] of Object.entries(FEATURE_DEPENDENCIES)) {
      if (this.flags[feature]) {
        for (const dependency of dependencies) {
          if (!this.flags[dependency]) {
            console.log(`Enabling dependency: ${dependency} for ${feature}`)
            this.flags[dependency] = true
          }
        }
      }
    }

    // Disable dependent features when dependencies are disabled
    let changed = true
    while (changed) {
      changed = false
      for (const [feature, dependencies] of Object.entries(FEATURE_DEPENDENCIES)) {
        if (this.flags[feature]) {
          for (const dependency of dependencies) {
            if (!this.flags[dependency]) {
              console.log(`Disabling ${feature} because dependency ${dependency} is disabled`)
              this.flags[feature] = false
              changed = true
              break
            }
          }
        }
      }
    }
  }

  /**
   * Get all feature information for UI display
   * @returns {Object} - Feature information organized by category
   */
  getFeatureInfo() {
    const result = {}

    for (const [category, features] of Object.entries(FEATURE_CATEGORIES)) {
      result[category] = features.map((feature) => ({
        id: feature,
        name: feature.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
        description: FEATURE_DESCRIPTIONS[feature] || "",
        enabled: this.flags[feature] || false,
        hasPermission: this.hasPermission(feature),
        requiredPermission: FEATURE_PERMISSIONS[feature] || "admin",
        dependencies: FEATURE_DEPENDENCIES[feature] || [],
      }))
    }

    return result
  }

  /**
   * Reset all feature flags to defaults
   * @returns {Promise<void>}
   */
  async resetToDefaults() {
    this.flags = { ...defaultFeatureFlags }
    this.validateFlags()
    await this.saveToStorage()

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.flags)
    }
  }
}

// Create and export singleton instance
const featureFlags = new FeatureFlagsManager()

export default featureFlags

