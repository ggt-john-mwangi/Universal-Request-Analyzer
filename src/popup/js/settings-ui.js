/**
 * Settings UI for Universal Request Analyzer
 *
 * This module provides the UI for managing settings, feature flags, ACLs, and themes.
 */

import settingsManager from "./settings-manager.js"
import featureFlags from "../../config/feature-flags.js"
import aclManager from "../../auth/acl-manager.js"
import themeManager from "../../config/theme-manager.js"

/**
 * Initialize the settings UI
 */
export function initSettingsUI() {
  // Add settings tab button if it doesn't exist
  if (!document.querySelector('.tab-btn[data-tab="settings"]')) {
    const tabsContainer = document.querySelector(".tabs")
    const settingsTabBtn = document.createElement("button")
    settingsTabBtn.className = "tab-btn"
    settingsTabBtn.setAttribute("data-tab", "settings")
    settingsTabBtn.textContent = "Settings"
    tabsContainer.appendChild(settingsTabBtn)

    // Add click event
    settingsTabBtn.addEventListener("click", () => {
      // Update active tab button
      document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"))
      settingsTabBtn.classList.add("active")

      // Update active tab content
      document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))
      document.getElementById("settings-tab").classList.add("active")

      // Load settings data
      loadSettingsData()
    })
  }

  // Create settings tab content if it doesn't exist
  if (!document.getElementById("settings-tab")) {
    const tabsContent = document.querySelector(".tab-content").parentNode
    const settingsTab = document.createElement("div")
    settingsTab.className = "tab-content"
    settingsTab.id = "settings-tab"

    settingsTab.innerHTML = `
      <div class="settings-container">
        <div class="settings-sidebar">
          <div class="settings-nav">
            <button class="settings-nav-item active" data-section="general">General</button>
            <button class="settings-nav-item" data-section="capture">Capture</button>
            <button class="settings-nav-item" data-section="display">Display</button>
            <button class="settings-nav-item" data-section="features">Features</button>
            <button class="settings-nav-item" data-section="permissions">Permissions</button>
            <button class="settings-nav-item" data-section="themes">Themes</button>
            <button class="settings-nav-item" data-section="advanced">Advanced</button>
          </div>
          <div class="settings-actions">
            <button id="resetSettingsBtn" class="danger-btn">Reset All Settings</button>
          </div>
        </div>
        <div class="settings-content">
          <!-- General Settings -->
          <div class="settings-section active" data-section="general">
            <h2>General Settings</h2>
            <div class="settings-group">
              <div class="setting-item">
                <label for="maxStoredRequests">Maximum Stored Requests:</label>
                <input type="number" id="maxStoredRequests" min="100" max="100000" step="100">
              </div>
              <div class="setting-item">
                <label for="autoStartCapture">
                  <input type="checkbox" id="autoStartCapture">
                  Automatically start capturing requests
                </label>
              </div>
              <div class="setting-item">
                <label for="showNotifications">
                  <input type="checkbox" id="showNotifications">
                  Show notifications
                </label>
              </div>
              <div class="setting-item">
                <label for="confirmClearRequests">
                  <input type="checkbox" id="confirmClearRequests">
                  Confirm before clearing requests
                </label>
              </div>
              <div class="setting-item">
                <label for="defaultExportFormat">Default Export Format:</label>
                <select id="defaultExportFormat">
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="sqlite">SQLite</option>
                </select>
              </div>
              <div class="setting-item">
                <label for="dateFormat">Date Format:</label>
                <select id="dateFormat">
                  <option value="yyyy-MM-dd HH:mm:ss">yyyy-MM-dd HH:mm:ss</option>
                  <option value="MM/dd/yyyy HH:mm:ss">MM/dd/yyyy HH:mm:ss</option>
                  <option value="dd/MM/yyyy HH:mm:ss">dd/MM/yyyy HH:mm:ss</option>
                  <option value="HH:mm:ss yyyy-MM-dd">HH:mm:ss yyyy-MM-dd</option>
                </select>
              </div>
              <div class="setting-item">
                <label for="timeZone">Time Zone:</label>
                <select id="timeZone">
                  <option value="local">Local Time Zone</option>
                  <option value="utc">UTC</option>
                </select>
              </div>
            </div>
            <div class="settings-actions">
              <button id="saveGeneralSettingsBtn" class="primary-btn">Save Changes</button>
            </div>
          </div>
          
          <!-- Capture Settings -->
          <div class="settings-section" data-section="capture">
            <h2>Capture Settings</h2>
            <div class="settings-group">
              <div class="setting-item">
                <label for="includeHeaders">
                  <input type="checkbox" id="includeHeaders">
                  Capture request and response headers
                </label>
              </div>
              <div class="setting-item">
                <label for="includeTiming">
                  <input type="checkbox" id="includeTiming">
                  Capture detailed timing information
                </label>
              </div>
              <div class="setting-item">
                <label for="includeContent">
                  <input type="checkbox" id="includeContent">
                  Capture request and response content
                </label>
              </div>
              <div class="setting-item">
                <label for="maxContentSize">Maximum Content Size (bytes):</label>
                <input type="number" id="maxContentSize" min="1024" max="10485760" step="1024">
              </div>
              <div class="setting-item">
                <label for="captureWebSockets">
                  <input type="checkbox" id="captureWebSockets">
                  Capture WebSocket connections
                </label>
              </div>
              <div class="setting-item">
                <label for="captureServerSentEvents">
                  <input type="checkbox" id="captureServerSentEvents">
                  Capture Server-Sent Events
                </label>
              </div>
            </div>
            <div class="settings-actions">
              <button id="saveCaptureSettingsBtn" class="primary-btn">Save Changes</button>
            </div>
          </div>
          
          <!-- Display Settings -->
          <div class="settings-section" data-section="display">
            <h2>Display Settings</h2>
            <div class="settings-group">
              <div class="setting-item">
                <label for="requestsPerPage">Requests Per Page:</label>
                <select id="requestsPerPage">
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>
              <div class="setting-item">
                <label for="expandedDetails">
                  <input type="checkbox" id="expandedDetails">
                  Show expanded details by default
                </label>
              </div>
              <div class="setting-item">
                <label for="showStatusColors">
                  <input type="checkbox" id="showStatusColors">
                  Show status code colors
                </label>
              </div>
              <div class="setting-item">
                <label for="showTimingBars">
                  <input type="checkbox" id="showTimingBars">
                  Show timing bars in details view
                </label>
              </div>
              <div class="setting-item">
                <label for="defaultTab">Default Tab:</label>
                <select id="defaultTab">
                  <option value="requests">Requests</option>
                  <option value="stats">Statistics</option>
                  <option value="plots">Plots</option>
                  <option value="visualization">Visualization</option>
                </select>
              </div>
              <div class="setting-item">
                <label>Column Order:</label>
                <div class="column-order-container" id="columnOrderContainer">
                  <!-- Column order items will be added dynamically -->
                </div>
              </div>
            </div>
            <div class="settings-actions">
              <button id="saveDisplaySettingsBtn" class="primary-btn">Save Changes</button>
            </div>
          </div>
          
          <!-- Features Settings -->
          <div class="settings-section" data-section="features">
            <h2>Feature Flags</h2>
            <p class="settings-description">Enable or disable features based on your needs.</p>
            
            <div class="features-container">
              <!-- Feature categories will be added dynamically -->
            </div>
            
            <div class="settings-actions">
              <button id="saveFeatureSettingsBtn" class="primary-btn">Save Changes</button>
              <button id="resetFeatureSettingsBtn">Reset to Defaults</button>
            </div>
          </div>
          
          <!-- Permissions Settings -->
          <div class="settings-section" data-section="permissions">
            <h2>Permissions</h2>
            <p class="settings-description">Manage roles and permissions for the extension.</p>
            
            <div class="setting-item">
              <label for="currentRole">Current Role:</label>
              <select id="currentRole">
                <!-- Roles will be added dynamically -->
              </select>
            </div>
            
            <h3>Role Permissions</h3>
            <div class="permissions-container">
              <!-- Permission categories will be added dynamically -->
            </div>
            
            <div class="settings-actions">
              <button id="savePermissionSettingsBtn" class="primary-btn">Save Changes</button>
              <button id="resetPermissionSettingsBtn">Reset to Defaults</button>
            </div>
          </div>
          
          <!-- Themes Settings -->
          <div class="settings-section" data-section="themes">
            <h2>Themes</h2>
            <p class="settings-description">Customize the appearance of the extension.</p>
            
            <div class="setting-item">
              <label for="currentTheme">Current Theme:</label>
              <select id="currentTheme">
                <option value="system">System Preference</option>
                <!-- Themes will be added dynamically -->
              </select>
            </div>
            
            <h3>Available Themes</h3>
            <div class="themes-container">
              <!-- Theme cards will be added dynamically -->
            </div>
            
            <div class="settings-actions">
              <button id="saveThemeSettingsBtn" class="primary-btn">Save Changes</button>
              <button id="resetThemeSettingsBtn">Reset to Defaults</button>
            </div>
          </div>
          
          <!-- Advanced Settings -->
          <div class="settings-section" data-section="advanced">
            <h2>Advanced Settings</h2>
            <p class="settings-description">These settings are for advanced users and may affect performance.</p>
            
            <div class="settings-group">
              <div class="setting-item">
                <label for="enableDebugMode">
                  <input type="checkbox" id="enableDebugMode">
                  Enable debug mode
                </label>
              </div>
              <div class="setting-item">
                <label for="persistFilters">
                  <input type="checkbox" id="persistFilters">
                  Persist filters between sessions
                </label>
              </div>
              <div class="setting-item">
                <label for="useCompression">
                  <input type="checkbox" id="useCompression">
                  Use compression for stored data
                </label>
              </div>
              <div class="setting-item">
                <label for="backgroundMode">Background Mode:</label>
                <select id="backgroundMode">
                  <option value="persistent">Persistent (Always Running)</option>
                  <option value="on-demand">On-Demand (Only When Needed)</option>
                </select>
              </div>
              <div class="setting-item">
                <label for="syncInterval">Sync Interval (seconds):</label>
                <input type="number" id="syncInterval" min="10" max="3600" step="10">
              </div>
            </div>
            
            <div class="settings-actions">
              <button id="saveAdvancedSettingsBtn" class="primary-btn">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    `

    tabsContent.appendChild(settingsTab)

    // Add event listeners for settings navigation
    document.querySelectorAll(".settings-nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        // Update active nav item
        document.querySelectorAll(".settings-nav-item").forEach((navItem) => navItem.classList.remove("active"))
        item.classList.add("active")

        // Update active section
        const section = item.getAttribute("data-section")
        document.querySelectorAll(".settings-section").forEach((section) => section.classList.remove("active"))
        document.querySelector(`.settings-section[data-section="${section}"]`).classList.add("active")
      })
    })

    // Add event listeners for settings actions
    document.getElementById("resetSettingsBtn").addEventListener("click", resetAllSettings)
    document.getElementById("saveGeneralSettingsBtn").addEventListener("click", saveGeneralSettings)
    document.getElementById("saveCaptureSettingsBtn").addEventListener("click", saveCaptureSettings)
    document.getElementById("saveDisplaySettingsBtn").addEventListener("click", saveDisplaySettings)
    document.getElementById("saveFeatureSettingsBtn").addEventListener("click", saveFeatureSettings)
    document.getElementById("resetFeatureSettingsBtn").addEventListener("click", resetFeatureSettings)
    document.getElementById("savePermissionSettingsBtn").addEventListener("click", savePermissionSettings)
    document.getElementById("resetPermissionSettingsBtn").addEventListener("click", resetPermissionSettings)
    document.getElementById("saveThemeSettingsBtn").addEventListener("click", saveThemeSettings)
    document.getElementById("resetThemeSettingsBtn").addEventListener("click", resetThemeSettings)
    document.getElementById("saveAdvancedSettingsBtn").addEventListener("click", saveAdvancedSettings)

    // Add CSS for settings UI
    addSettingsStyles()
  }
}

/**
 * Load settings data into the UI
 */
function loadSettingsData() {
  const allSettings = settingsManager.getAllSettings()

  // Load general settings
  document.getElementById("maxStoredRequests").value = allSettings.settings.general.maxStoredRequests
  document.getElementById("autoStartCapture").checked = allSettings.settings.general.autoStartCapture
  document.getElementById("showNotifications").checked = allSettings.settings.general.showNotifications
  document.getElementById("confirmClearRequests").checked = allSettings.settings.general.confirmClearRequests
  document.getElementById("defaultExportFormat").value = allSettings.settings.general.defaultExportFormat
  document.getElementById("dateFormat").value = allSettings.settings.general.dateFormat
  document.getElementById("timeZone").value = allSettings.settings.general.timeZone

  // Load capture settings
  document.getElementById("includeHeaders").checked = allSettings.settings.capture.includeHeaders
  document.getElementById("includeTiming").checked = allSettings.settings.capture.includeTiming
  document.getElementById("includeContent").checked = allSettings.settings.capture.includeContent
  document.getElementById("maxContentSize").value = allSettings.settings.capture.maxContentSize
  document.getElementById("captureWebSockets").checked = allSettings.settings.capture.captureWebSockets
  document.getElementById("captureServerSentEvents").checked = allSettings.settings.capture.captureServerSentEvents

  // Load display settings
  document.getElementById("requestsPerPage").value = allSettings.settings.display.requestsPerPage
  document.getElementById("expandedDetails").checked = allSettings.settings.display.expandedDetails
  document.getElementById("showStatusColors").checked = allSettings.settings.display.showStatusColors
  document.getElementById("showTimingBars").checked = allSettings.settings.display.showTimingBars
  document.getElementById("defaultTab").value = allSettings.settings.display.defaultTab

  // Load column order
  const columnOrderContainer = document.getElementById("columnOrderContainer")
  columnOrderContainer.innerHTML = ""

  allSettings.settings.display.columnOrder.forEach((column, index) => {
    const columnItem = document.createElement("div")
    columnItem.className = "column-order-item"
    columnItem.setAttribute("data-column", column)

    columnItem.innerHTML = `
      <span class="column-name">${formatColumnName(column)}</span>
      <div class="column-actions">
        <button class="column-move-up" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="column-move-down" ${index === allSettings.settings.display.columnOrder.length - 1 ? "disabled" : ""}>↓</button>
      </div>
    `

    columnOrderContainer.appendChild(columnItem)

    // Add event listeners for column reordering
    columnItem.querySelector(".column-move-up").addEventListener("click", () => moveColumn(column, "up"))
    columnItem.querySelector(".column-move-down").addEventListener("click", () => moveColumn(column, "down"))
  })

  // Load feature flags
  const featuresContainer = document.querySelector(".features-container")
  featuresContainer.innerHTML = ""

  for (const [category, features] of Object.entries(allSettings.featureFlags)) {
    const categorySection = document.createElement("div")
    categorySection.className = "feature-category"

    categorySection.innerHTML = `
      <h3>${formatCategoryName(category)}</h3>
      <div class="feature-list" data-category="${category}"></div>
    `

    featuresContainer.appendChild(categorySection)

    const featureList = categorySection.querySelector(".feature-list")

    features.forEach((feature) => {
      const featureItem = document.createElement("div")
      featureItem.className = "feature-item"

      featureItem.innerHTML = `
        <div class="feature-header">
          <label for="feature-${feature.id}">
            <input type="checkbox" id="feature-${feature.id}" data-feature="${feature.id}" 
              ${feature.enabled ? "checked" : ""} ${!feature.hasPermission ? "disabled" : ""}>
            <span class="feature-name">${feature.name}</span>
          </label>
          <button class="feature-info-btn" data-feature="${feature.id}">ⓘ</button>
        </div>
        <div class="feature-description">${feature.description}</div>
        ${!feature.hasPermission ? `<div class="feature-permission-notice">Requires ${feature.requiredPermission} permission</div>` : ""}
        ${feature.dependencies.length > 0 ? `<div class="feature-dependencies">Depends on: ${feature.dependencies.join(", ")}</div>` : ""}
      `

      featureList.appendChild(featureItem)

      // Add event listener for feature info button
      featureItem.querySelector(".feature-info-btn").addEventListener("click", () => showFeatureInfo(feature))
    })
  }

  // Load roles and permissions
  const currentRoleSelect = document.getElementById("currentRole")
  currentRoleSelect.innerHTML = '<option value="">Select a role</option>'

  for (const [roleName, roleData] of Object.entries(allSettings.acl.roles)) {
    const option = document.createElement("option")
    option.value = roleName
    option.textContent = roleData.name
    option.selected = roleData.isCurrentRole
    currentRoleSelect.appendChild(option)
  }

  // Load permissions
  const permissionsContainer = document.querySelector(".permissions-container")
  permissionsContainer.innerHTML = ""

  for (const [category, permissions] of Object.entries(allSettings.acl.permissions)) {
    const categorySection = document.createElement("div")
    categorySection.className = "permission-category"

    categorySection.innerHTML = `
      <h4>${formatCategoryName(category)}</h4>
      <div class="permission-list" data-category="${category}"></div>
    `

    permissionsContainer.appendChild(categorySection)

    const permissionList = categorySection.querySelector(".permission-list")

    permissions.forEach((permission) => {
      const permissionItem = document.createElement("div")
      permissionItem.className = "permission-item"

      permissionItem.innerHTML = `
        <div class="permission-header">
          <span class="permission-status ${permission.hasPermission ? "has-permission" : "no-permission"}">
            ${permission.hasPermission ? "✓" : "✗"}
          </span>
          <span class="permission-name">${permission.action}</span>
        </div>
        <div class="permission-description">${permission.description}</div>
      `

      permissionList.appendChild(permissionItem)
    })
  }

  // Load themes
  const currentThemeSelect = document.getElementById("currentTheme")
  currentThemeSelect.innerHTML = '<option value="system">System Preference</option>'

  const themesContainer = document.querySelector(".themes-container")
  themesContainer.innerHTML = ""

  allSettings.theme.themes.forEach((theme) => {
    // Add to dropdown
    const option = document.createElement("option")
    option.value = theme.id
    option.textContent = theme.name
    option.selected = theme.isCurrentTheme
    currentThemeSelect.appendChild(option)

    // Add theme card
    const themeCard = document.createElement("div")
    themeCard.className = `theme-card ${theme.isCurrentTheme ? "current-theme" : ""}`
    themeCard.setAttribute("data-theme", theme.id)

    themeCard.innerHTML = `
      <div class="theme-preview" style="background-color: ${theme.previewColors.background};">
        <div class="theme-preview-header" style="background-color: ${theme.previewColors.surface}; color: ${theme.previewColors.text};">
          ${theme.name}
        </div>
        <div class="theme-preview-button" style="background-color: ${theme.previewColors.primary}; color: white;">
          Button
        </div>
      </div>
      <div class="theme-info">
        <div class="theme-name">${theme.name}</div>
        <div class="theme-description">${theme.description}</div>
      </div>
      <div class="theme-actions">
        <button class="theme-apply-btn" data-theme="${theme.id}" ${theme.isCurrentTheme ? "disabled" : ""}>
          ${theme.isCurrentTheme ? "Current" : "Apply"}
        </button>
      </div>
    `

    themesContainer.appendChild(themeCard)

    // Add event listener for theme apply button
    themeCard.querySelector(".theme-apply-btn").addEventListener("click", () => applyTheme(theme.id))
  })

  // Load advanced settings
  document.getElementById("enableDebugMode").checked = allSettings.settings.advanced.enableDebugMode
  document.getElementById("persistFilters").checked = allSettings.settings.advanced.persistFilters
  document.getElementById("useCompression").checked = allSettings.settings.advanced.useCompression
  document.getElementById("backgroundMode").value = allSettings.settings.advanced.backgroundMode
  document.getElementById("syncInterval").value = allSettings.settings.advanced.syncInterval
}

/**
 * Format a column name for display
 * @param {string} column - Column name
 * @returns {string} - Formatted name
 */
function formatColumnName(column) {
  return column.charAt(0).toUpperCase() + column.slice(1)
}

/**
 * Format a category name for display
 * @param {string} category - Category name
 * @returns {string} - Formatted name
 */
function formatCategoryName(category) {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

/**
 * Move a column in the column order
 * @param {string} column - Column to move
 * @param {string} direction - Direction to move ('up' or 'down')
 */
function moveColumn(column, direction) {
  const allSettings = settingsManager.getAllSettings()
  const columnOrder = [...allSettings.settings.display.columnOrder]
  const index = columnOrder.indexOf(column)

  if (direction === "up" && index > 0) {
    // Swap with previous column
    ;[columnOrder[index], columnOrder[index - 1]] = [columnOrder[index - 1], columnOrder[index]]
  } else if (direction === "down" && index < columnOrder.length - 1) {
    // Swap with next column
    ;[columnOrder[index], columnOrder[index + 1]] = [columnOrder[index + 1], columnOrder[index]]
  }

  // Update settings
  settingsManager
    .updateSettings({
      display: {
        columnOrder,
      },
    })
    .then(() => {
      // Reload settings data
      loadSettingsData()
    })
}

/**
 * Show feature information
 * @param {Object} feature - Feature to show info for
 */
function showFeatureInfo(feature) {
  // Create modal
  const modal = document.createElement("div")
  modal.className = "modal"

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${feature.name}</h3>
        <button class="modal-close-btn">×</button>
      </div>
      <div class="modal-body">
        <p>${feature.description}</p>
        
        <h4>Details</h4>
        <ul>
          <li><strong>Status:</strong> ${feature.enabled ? "Enabled" : "Disabled"}</li>
          <li><strong>Required Permission:</strong> ${feature.requiredPermission}</li>
          ${feature.dependencies.length > 0 ? `<li><strong>Dependencies:</strong> ${feature.dependencies.join(", ")}</li>` : ""}
        </ul>
      </div>
      <div class="modal-footer">
        <button class="modal-close-btn-secondary">Close</button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  // Add event listeners for close buttons
  modal.querySelector(".modal-close-btn").addEventListener("click", () => {
    document.body.removeChild(modal)
  })

  modal.querySelector(".modal-close-btn-secondary").addEventListener("click", () => {
    document.body.removeChild(modal)
  })

  // Close modal when clicking outside
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      document.body.removeChild(modal)
    }
  })
}

/**
 * Apply a theme
 * @param {string} themeId - Theme ID to apply
 */
function applyTheme(themeId) {
  themeManager.setTheme(themeId).then(() => {
    // Reload settings data
    loadSettingsData()

    // Show notification
    showNotification(`Theme "${themeId}" applied successfully`)
  })
}

/**
 * Save general settings
 */
function saveGeneralSettings() {
  settingsManager
    .updateSettings({
      general: {
        maxStoredRequests: Number.parseInt(document.getElementById("maxStoredRequests").value, 10),
        autoStartCapture: document.getElementById("autoStartCapture").checked,
        showNotifications: document.getElementById("showNotifications").checked,
        confirmClearRequests: document.getElementById("confirmClearRequests").checked,
        defaultExportFormat: document.getElementById("defaultExportFormat").value,
        dateFormat: document.getElementById("dateFormat").value,
        timeZone: document.getElementById("timeZone").value,
      },
    })
    .then(() => {
      showNotification("General settings saved successfully")
    })
}

/**
 * Save capture settings
 */
function saveCaptureSettings() {
  settingsManager
    .updateSettings({
      capture: {
        includeHeaders: document.getElementById("includeHeaders").checked,
        includeTiming: document.getElementById("includeTiming").checked,
        includeContent: document.getElementById("includeContent").checked,
        maxContentSize: Number.parseInt(document.getElementById("maxContentSize").value, 10),
        captureWebSockets: document.getElementById("captureWebSockets").checked,
        captureServerSentEvents: document.getElementById("captureServerSentEvents").checked,
      },
    })
    .then(() => {
      showNotification("Capture settings saved successfully")
    })
}

/**
 * Save display settings
 */
function saveDisplaySettings() {
  settingsManager
    .updateSettings({
      display: {
        requestsPerPage: Number.parseInt(document.getElementById("requestsPerPage").value, 10),
        expandedDetails: document.getElementById("expandedDetails").checked,
        showStatusColors: document.getElementById("showStatusColors").checked,
        showTimingBars: document.getElementById("showTimingBars").checked,
        defaultTab: document.getElementById("defaultTab").value,
      },
    })
    .then(() => {
      showNotification("Display settings saved successfully")
    })
}

/**
 * Save feature settings
 */
function saveFeatureSettings() {
  const featureUpdates = {}

  // Get all feature checkboxes
  document.querySelectorAll("input[data-feature]").forEach((checkbox) => {
    featureUpdates[checkbox.dataset.feature] = checkbox.checked
  })

  featureFlags.updateFeatures(featureUpdates).then(() => {
    showNotification("Feature settings saved successfully")
    loadSettingsData() // Reload to show dependencies
  })
}

/**
 * Reset feature settings to defaults
 */
function resetFeatureSettings() {
  if (confirm("Are you sure you want to reset all feature flags to defaults?")) {
    featureFlags.resetToDefaults().then(() => {
      showNotification("Feature flags reset to defaults")
      loadSettingsData()
    })
  }
}

/**
 * Save permission settings
 */
function savePermissionSettings() {
  const role = document.getElementById("currentRole").value

  if (role) {
    aclManager.setRole(role).then(() => {
      showNotification(`Role changed to "${role}"`)
      loadSettingsData()
    })
  }
}

/**
 * Reset permission settings to defaults
 */
function resetPermissionSettings() {
  if (confirm("Are you sure you want to reset all permissions to defaults?")) {
    aclManager.resetToDefaults().then(() => {
      showNotification("Permissions reset to defaults")
      loadSettingsData()
    })
  }
}

/**
 * Save theme settings
 */
function saveThemeSettings() {
  const theme = document.getElementById("currentTheme").value

  themeManager.setTheme(theme).then(() => {
    showNotification(`Theme changed to "${theme}"`)
    loadSettingsData()
  })
}

/**
 * Reset theme settings to defaults
 */
function resetThemeSettings() {
  if (confirm("Are you sure you want to reset all themes to defaults?")) {
    themeManager.resetToDefaults().then(() => {
      showNotification("Themes reset to defaults")
      loadSettingsData()
    })
  }
}

/**
 * Save advanced settings
 */
function saveAdvancedSettings() {
  settingsManager
    .updateSettings({
      advanced: {
        enableDebugMode: document.getElementById("enableDebugMode").checked,
        persistFilters: document.getElementById("persistFilters").checked,
        useCompression: document.getElementById("useCompression").checked,
        backgroundMode: document.getElementById("backgroundMode").value,
        syncInterval: Number.parseInt(document.getElementById("syncInterval").value, 10),
      },
    })
    .then(() => {
      showNotification("Advanced settings saved successfully")
    })
}

/**
 * Reset all settings to defaults
 */
function resetAllSettings() {
  if (confirm("Are you sure you want to reset ALL settings to defaults? This cannot be undone.")) {
    settingsManager.resetAllToDefaults().then(() => {
      showNotification("All settings reset to defaults")
      loadSettingsData()
    })
  }
}

/**
 * Show a notification
 * @param {string} message - Message to show
 */
function showNotification(message) {
  const notification = document.createElement("div")
  notification.className = "notification"
  notification.textContent = message

  document.body.appendChild(notification)

  // Show notification
  setTimeout(() => {
    notification.classList.add("visible")
  }, 10)

  // Hide notification after 3 seconds
  setTimeout(() => {
    notification.classList.remove("visible")

    // Remove from DOM after animation
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 300)
  }, 3000)
}

/**
 * Add CSS styles for settings UI
 */
function addSettingsStyles() {
  const styleElement = document.createElement("style")
  styleElement.textContent = `
    /* Settings Container */
    .settings-container {
      display: flex;
      height: 100%;
    }

    /* Settings Sidebar */
    .settings-sidebar {
      width: 200px;
      background-color: var(--surface-color, #f5f5f5);
      border-right: 1px solid var(--border-color, #ddd);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .settings-nav {
      padding: 16px 0;
    }

    .settings-nav-item {
      display: block;
      width: 100%;
      padding: 10px 16px;
      text-align: left;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      border-left: 3px solid transparent;
    }

    .settings-nav-item:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    .settings-nav-item.active {
      border-left-color: var(--primary-color, #0066cc);
      background-color: rgba(0, 0, 0, 0.05);
      font-weight: 500;
    }

    .settings-actions {
      padding: 16px;
      border-top: 1px solid var(--border-color, #ddd);
    }

    /* Settings Content */
    .settings-content {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }

    .settings-section {
      display: none;
    }

    .settings-section.active {
      display: block;
    }

    .settings-section h2 {
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 20px;
      font-weight: 600;
    }

    .settings-description {
      margin-bottom: 20px;
      color: var(--text-secondary-color, #666);
    }

    .settings-group {
      margin-bottom: 24px;
      padding: 16px;
      background-color: var(--surface-color, #f5f5f5);
      border-radius: 4px;
    }

    .setting-item {
      margin-bottom: 16px;
    }

    .setting-item:last-child {
      margin-bottom: 0;
    }

    .setting-item label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .setting-item input[type="checkbox"] {
      margin-right: 8px;
    }

    .setting-item input[type="text"],
    .setting-item input[type="number"],
    .setting-item select {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--border-color, #ddd);
      border-radius: 4px;
    }

    /* Column Order */
    .column-order-container {
      border: 1px solid var(--border-color, #ddd);
      border-radius: 4px;
      max-height: 300px;
      overflow-y: auto;
    }

    .column-order-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color, #ddd);
    }

    .column-order-item:last-child {
      border-bottom: none;
    }

    .column-actions {
      display: flex;
      gap: 4px;
    }

    .column-move-up,
    .column-move-down {
      padding: 2px 6px;
      background: none;
      border: 1px solid var(--border-color, #ddd);
      border-radius: 4px;
      cursor: pointer;
    }

    .column-move-up:hover,
    .column-move-down:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    /* Features */
    .feature-category {
      margin-bottom: 24px;
    }

    .feature-category h3 {
      margin-bottom: 12px;
      font-size: 16px;
      font-weight: 600;
    }

    .feature-list {
      background-color: var(--surface-color, #f5f5f5);
      border-radius: 4px;
      padding: 8px;
    }

    .feature-item {
      margin-bottom: 12px;
      padding: 12px;
      background-color: var(--background-color, #fff);
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .feature-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .feature-name {
      font-weight: 500;
    }

    .feature-info-btn {
      padding: 2px 8px;
      background: none;
      border: 1px solid var(--border-color, #ddd);
      border-radius: 50%;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-secondary-color, #666);
    }

    .feature-info-btn:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    .feature-description {
      margin-bottom: 8px;
      font-size: 13px;
      color: var(--text-secondary-color, #666);
    }

    .feature-permission-notice {
      font-size: 12px;
      color: var(--error-color, #dc3545);
      margin-top: 4px;
    }

    .feature-dependencies {
      font-size: 12px;
      color: var(--text-secondary-color, #666);
      margin-top: 4px;
    }

    /* Permissions */
    .permission-category {
      margin-bottom: 20px;
    }

    .permission-category h4 {
      margin-bottom: 8px;
      font-size: 15px;
      font-weight: 600;
    }

    .permission-list {
      background-color: var(--surface-color, #f5f5f5);
      border-radius: 4px;
      padding: 8px;
    }

    .permission-item {
      margin-bottom: 8px;
      padding: 10px;
      background-color: var(--background-color, #fff);
      border-radius: 4px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .permission-header {
      display: flex;
      align-items: center;
      margin-bottom: 4px;
    }

    .permission-status {
      display: inline-block;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      text-align: center;
      line-height: 20px;
      margin-right: 8px;
      font-size: 12px;
    }

    .has-permission {
      background-color: var(--success-color, #28a745);
      color: white;
    }

    .no-permission {
      background-color: var(--error-color, #dc3545);
      color: white;
    }

    .permission-name {
      font-weight: 500;
    }

    .permission-description {
      font-size: 13px;
      color: var(--text-secondary-color, #666);
    }

    /* Themes */
    .themes-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }

    .theme-card {
      border: 1px solid var(--border-color, #ddd);
      border-radius: 4px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .theme-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .theme-card.current-theme {
      border-color: var(--primary-color, #0066cc);
      box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
    }

    .theme-preview {
      height: 100px;
      padding: 10px;
    }

    .theme-preview-header {
      padding: 5px 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      font-weight: 500;
    }

    .theme-preview-button {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
    }

    .theme-info {
      padding: 10px;
      border-top: 1px solid var(--border-color, #ddd);
    }

    .theme-name {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .theme-description {
      font-size: 12px;
      color: var(--text-secondary-color, #666);
    }

    .theme-actions {
      padding: 10px;
      border-top: 1px solid var(--border-color, #ddd);
      text-align: right;
    }

    .theme-apply-btn {
      padding: 4px 8px;
      background-color: var(--primary-color, #0066cc);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .theme-apply-btn:disabled {
      background-color: var(--text-disabled-color, #adb5bd);
      cursor: not-allowed;
    }

    /* Buttons */
    .primary-btn {
      padding: 8px 16px;
      background-color: var(--primary-color, #0066cc);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .primary-btn:hover {
      background-color: var(--primary-color, #0056b3);
    }

    .danger-btn {
      padding: 8px 16px;
      background-color: var(--error-color, #dc3545);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .danger-btn:hover {
      background-color: var(--error-color, #c82333);
    }

    /* Modal */
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal-content {
      background-color: var(--background-color, #fff);
      border-radius: 4px;
      width: 400px;
      max-width: 90%;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #ddd);
    }

    .modal-header h3 {
      margin: 0;
      font-size: 18px;
    }

    .modal-close-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: var(--text-secondary-color, #666);
    }

    .modal-body {
      padding: 16px;
    }

    .modal-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--border-color, #ddd);
      text-align: right;
    }

    .modal-close-btn-secondary {
      padding: 6px 12px;
      background-color: var(--surface-color, #f5f5f5);
      border: 1px solid var(--border-color, #ddd);
      border-radius: 4px;
      cursor: pointer;
    }
  `

  document.head.appendChild(styleElement)
}

