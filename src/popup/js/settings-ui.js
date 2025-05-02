import * as optionsManager from './settings-manager.js';

/**
 * Settings UI for Universal Request Analyzer
 *
 * This module provides the UI for managing settings, feature flags, ACLs, and themes.
 */

/**
 * Initialize the settings UI
 */
export async function initSettingsUI() {
  const tabsContent = document.querySelector('.tab-content[data-tab="settings"]');
  if (!tabsContent) {
    console.error("Settings tab content area not found.");
    return;
  }

  // Add CSS for settings UI first
  addSettingsStyles();

  // Show loading state
  tabsContent.innerHTML = '<div class="loading-indicator">Loading settings...</div>';

  try {
    // Load initial data (config, features, permissions, themes)
    const { config, features: featuresInfo, permissions: permissionsInfo, themes: themesInfo } = await optionsManager.loadSettingsData();

    if (!config || Object.keys(config).length === 0) {
      console.error("Failed to load configuration object.");
      tabsContent.innerHTML = '<div class="error-message">Failed to load configuration. Please try again later or reset settings.</div>';
      return;
    }

    // Clear loading state
    tabsContent.innerHTML = '';

    // Create settings container
    const settingsContainer = document.createElement("div");
    settingsContainer.className = "settings-container";
    tabsContent.appendChild(settingsContainer);

    // Create sidebar navigation (Tabs)
    const sidebar = document.createElement("div");
    sidebar.className = "settings-sidebar";
    sidebar.innerHTML = `
      <div class="settings-nav">
        <h3>Settings</h3>
        <button class="settings-nav-item active" data-section="general">General</button>
        <button class="settings-nav-item" data-section="capture">Capture</button>
        <button class="settings-nav-item" data-section="display">Display</button>
        <button class="settings-nav-item" data-section="features">Features</button>
        <button class="settings-nav-item" data-section="permissions">Permissions</button>
        <button class="settings-nav-item" data-section="themes">Appearance</button>
        <button class="settings-nav-item" data-section="advanced">Advanced</button>
      </div>
      <div class="settings-actions">
        <button id="resetSettingsBtn" class="danger-btn">Reset All Settings</button>
      </div>`;
    settingsContainer.appendChild(sidebar);

    // Create content area
    const contentArea = document.createElement("div");
    contentArea.className = "settings-content";
    settingsContainer.appendChild(contentArea);

    // General Settings
    const generalSection = document.createElement("div");
    generalSection.className = "settings-section active";
    generalSection.dataset.section = "general";
    const generalConf = config.general || {};
    generalSection.innerHTML = `
      <h2>General Settings</h2>
      <div class="settings-group">
        <div class="setting-item">
          <label for="maxStoredRequests">Maximum Stored Requests:</label>
          <input type="number" id="maxStoredRequests" min="100" max="100000" step="100" value="${generalConf.maxStoredRequests ?? 10000}">
        </div>
        <div class="setting-item">
          <label for="autoStartCapture">
            <input type="checkbox" id="autoStartCapture" ${generalConf.autoStartCapture ? 'checked' : ''}>
            Automatically start capturing requests
          </label>
        </div>
        <div class="setting-item">
          <label for="showNotifications">
            <input type="checkbox" id="showNotifications" ${generalConf.showNotifications ?? true ? 'checked' : ''}>
            Show notifications
          </label>
        </div>
        <div class="setting-item">
          <label for="confirmClearRequests">
            <input type="checkbox" id="confirmClearRequests" ${generalConf.confirmClearRequests ?? true ? 'checked' : ''}>
            Confirm before clearing requests
          </label>
        </div>
        <div class="setting-item">
          <label for="defaultExportFormat">Default Export Format:</label>
          <select id="defaultExportFormat">
            <option value="json" ${generalConf.defaultExportFormat === 'json' ? 'selected' : ''}>JSON</option>
            <option value="csv" ${generalConf.defaultExportFormat === 'csv' ? 'selected' : ''}>CSV</option>
            <option value="sqlite" ${generalConf.defaultExportFormat === 'sqlite' ? 'selected' : ''}>SQLite</option>
            <option value="har" ${generalConf.defaultExportFormat === 'har' ? 'selected' : ''}>HAR</option>
          </select>
        </div>
        <div class="setting-item">
          <label for="dateFormat">Date Format:</label>
          <select id="dateFormat">
            <option value="MM/DD/YYYY HH:mm:ss" ${generalConf.dateFormat === 'MM/DD/YYYY HH:mm:ss' ? 'selected' : ''}>MM/DD/YYYY HH:mm:ss</option>
            <option value="DD/MM/YYYY HH:mm:ss" ${generalConf.dateFormat === 'DD/MM/YYYY HH:mm:ss' ? 'selected' : ''}>DD/MM/YYYY HH:mm:ss</option>
            <option value="YYYY-MM-DD HH:mm:ss" ${generalConf.dateFormat === 'YYYY-MM-DD HH:mm:ss' ? 'selected' : ''}>YYYY-MM-DD HH:mm:ss</option>
            <option value="HH:mm:ss YYYY-MM-DD" ${generalConf.dateFormat === 'HH:mm:ss YYYY-MM-DD' ? 'selected' : ''}>HH:mm:ss YYYY-MM-DD</option>
          </select>
        </div>
        <div class="setting-item">
          <label for="timeZone">Time Zone:</label>
          <select id="timeZone">
            <option value="local" ${generalConf.timeZone === 'local' ? 'selected' : ''}>Local Time Zone</option>
            <option value="utc" ${generalConf.timeZone === 'utc' ? 'selected' : ''}>UTC</option>
          </select>
        </div>
      </div>
      <div class="settings-actions">
        <button id="saveGeneralSettingsBtn" class="primary-btn">Save Changes</button>
      </div>
    `;
    contentArea.appendChild(generalSection);

    // Capture Settings
    const captureSection = document.createElement("div");
    captureSection.className = "settings-section";
    captureSection.dataset.section = "capture";
    const captureConf = config.capture || {};
    captureSection.innerHTML = `
      <h2>Capture Settings</h2>
      <div class="settings-group">
        <div class="setting-item">
          <label for="includeHeaders">
            <input type="checkbox" id="includeHeaders" ${captureConf.includeHeaders ?? true ? 'checked' : ''}>
            Capture request and response headers
          </label>
        </div>
        <div class="setting-item">
          <label for="includeTiming">
            <input type="checkbox" id="includeTiming" ${captureConf.includeTiming ?? false ? 'checked' : ''}>
            Capture detailed timing information
          </label>
        </div>
        <div class="setting-item">
          <label for="includeContent">
            <input type="checkbox" id="includeContent" ${captureConf.includeContent ?? false ? 'checked' : ''}>
            Capture request and response content
          </label>
        </div>
        <div class="setting-item">
          <label for="maxContentSize">Maximum Content Size (bytes):</label>
          <input type="number" id="maxContentSize" min="1024" max="10485760" step="1024" value="${captureConf.maxContentSize ?? 1048576}">
        </div>
        <div class="setting-item">
          <label for="captureWebSockets">
            <input type="checkbox" id="captureWebSockets" ${captureConf.captureWebSockets ?? false ? 'checked' : ''}>
            Capture WebSocket connections
          </label>
        </div>
        <div class="setting-item">
          <label for="captureServerSentEvents">
            <input type="checkbox" id="captureServerSentEvents" ${captureConf.captureServerSentEvents ?? false ? 'checked' : ''}>
            Capture Server-Sent Events
          </label>
        </div>
      </div>
      <div class="settings-actions">
        <button id="saveCaptureSettingsBtn" class="primary-btn">Save Changes</button>
      </div>
    `;
    contentArea.appendChild(captureSection);

    // Display Settings
    const displaySection = document.createElement("div");
    displaySection.className = "settings-section";
    displaySection.dataset.section = "display";
    const displayConf = config.display || {};
    displaySection.innerHTML = `
      <h2>Display Settings</h2>
      <div class="settings-group">
        <div class="setting-item">
          <label for="requestsPerPage">Requests Per Page:</label>
          <select id="requestsPerPage">
            <option value="10" ${displayConf.requestsPerPage === 10 ? 'selected' : ''}>10</option>
            <option value="25" ${displayConf.requestsPerPage === 25 ? 'selected' : ''}>25</option>
            <option value="50" ${displayConf.requestsPerPage === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${displayConf.requestsPerPage === 100 ? 'selected' : ''}>100</option>
            <option value="200" ${displayConf.requestsPerPage === 200 ? 'selected' : ''}>200</option>
          </select>
        </div>
        <div class="setting-item">
          <label for="expandedDetails">
            <input type="checkbox" id="expandedDetails" ${displayConf.expandedDetails ?? false ? 'checked' : ''}>
            Show expanded details by default
          </label>
        </div>
        <div class="setting-item">
          <label for="showStatusColors">
            <input type="checkbox" id="showStatusColors" ${displayConf.showStatusColors ?? true ? 'checked' : ''}>
            Show status code colors
          </label>
        </div>
        <div class="setting-item">
          <label for="showTimingBars">
            <input type="checkbox" id="showTimingBars" ${displayConf.showTimingBars ?? false ? 'checked' : ''}>
            Show timing bars in details view
          </label>
        </div>
        <div class="setting-item">
          <label for="defaultTab">Default Tab:</label>
          <select id="defaultTab">
            <option value="requests" ${displayConf.defaultTab === 'requests' ? 'selected' : ''}>Requests</option>
            <option value="stats" ${displayConf.defaultTab === 'stats' ? 'selected' : ''}>Statistics</option>
            <option value="plots" ${displayConf.defaultTab === 'plots' ? 'selected' : ''}>Plots</option>
            <option value="visualization" ${displayConf.defaultTab === 'visualization' ? 'selected' : ''}>Visualization</option>
          </select>
        </div>
      </div>
      <div class="settings-actions">
        <button id="saveDisplaySettingsBtn" class="primary-btn">Save Changes</button>
      </div>
    `;
    contentArea.appendChild(displaySection);

    // Features Settings
    const featuresSection = document.createElement("div");
    featuresSection.className = "settings-section";
    featuresSection.dataset.section = "features";
    let featuresHtml = `
      <h2>Feature Flags</h2>
      <p class="settings-description">Enable or disable features based on your needs. Some features may require specific permissions or have dependencies.</p>
      <div class="features-container">`;

    if (featuresInfo && Object.keys(featuresInfo).length > 0) {
      for (const [category, features] of Object.entries(featuresInfo)) {
        features.sort((a, b) => a.name.localeCompare(b.name));
        featuresHtml += `<div class="settings-group feature-category"><h4>${category}</h4>`;
        features.forEach(feature => {
          const disabled = !feature.hasPermission ? 'disabled title="Requires ' + feature.requiredPermission + ' role"' : '';
          const checked = feature.enabled ? 'checked' : '';
          featuresHtml += `
            <div class="setting-item feature-toggle">
              <label for="feature-${feature.id}" title="${feature.description || feature.name}">
                <input type="checkbox" id="feature-${feature.id}" data-feature-id="${feature.id}" ${checked} ${disabled}>
                <span>${feature.name}</span>
              </label>
              ${feature.dependencies.length > 0 ? `<span class="feature-deps">(Requires: ${feature.dependencies.join(', ')})</span>` : ''}
            </div>`;
        });
        featuresHtml += `</div>`;
      }
    } else {
      featuresHtml += `<p>No feature information available or failed to load.</p>`;
    }

    featuresHtml += `
      </div>
      <div class="settings-actions">
        <button id="saveFeatureSettingsBtn" class="primary-btn">Save Changes</button>
        <button id="resetFeatureSettingsBtn">Reset to Defaults</button>
      </div>
    `;
    featuresSection.innerHTML = featuresHtml;
    contentArea.appendChild(featuresSection);

    // Permissions Settings
    const permissionsSection = document.createElement("div");
    permissionsSection.className = "settings-section";
    permissionsSection.dataset.section = "permissions";
    let permissionsHtml = `
      <h2>Permissions</h2>
      <p class="settings-description">View your current role and associated permissions.</p>
      <div class="settings-group">
        <div class="setting-item">
          <label for="currentRole">Current Role:</label>
          <select id="currentRole" ${permissionsInfo?.canChangeRole ? '' : 'disabled title="You do not have permission to change roles."'}>`;

    if (permissionsInfo && permissionsInfo.roles && permissionsInfo.roles.length > 0) {
      permissionsInfo.roles.sort((a, b) => a.name.localeCompare(b.name));
      permissionsInfo.roles.forEach(role => {
        permissionsHtml += `<option value="${role.id}" ${role.id === permissionsInfo.currentRole ? 'selected' : ''}>${role.name}</option>`;
      });
    } else {
      permissionsHtml += `<option value="">No roles available</option>`;
    }

    permissionsHtml += `
          </select>
        </div>
      </div>
      <h3>Permissions for Role: <span id="selectedRoleName">${permissionsInfo?.currentRoleName || 'N/A'}</span></h3>
      <div class="permissions-container">`;

    if (permissionsInfo && permissionsInfo.permissionsByCategory && Object.keys(permissionsInfo.permissionsByCategory).length > 0) {
      for (const [category, permissions] of Object.entries(permissionsInfo.permissionsByCategory)) {
        permissions.sort((a, b) => a.name.localeCompare(b.name));
        permissionsHtml += `<div class="settings-group permission-category"><h4>${category}</h4>`;
        permissions.forEach(perm => {
          permissionsHtml += `
            <div class="setting-item permission-item ${perm.granted ? 'granted' : 'denied'}" title="${perm.description || perm.name}">
              <i class="fas ${perm.granted ? 'fa-check-circle' : 'fa-times-circle'}"></i>
              <span>${perm.name}</span>
            </div>`;
        });
        permissionsHtml += `</div>`;
      }
    } else {
      permissionsHtml += `<p>No permission information available or failed to load.</p>`;
    }

    permissionsHtml += `
      </div>
      <div class="settings-actions">
        <button id="savePermissionSettingsBtn" class="primary-btn" ${permissionsInfo?.canChangeRole ? '' : 'disabled title="You do not have permission to change roles."'}>Apply Role Change</button>
        <button id="resetPermissionSettingsBtn" ${permissionsInfo?.canResetPermissions ? '' : 'disabled title="You do not have permission to reset permissions."'}>Reset Permissions to Defaults</button>
      </div>
    `;
    permissionsSection.innerHTML = permissionsHtml;
    contentArea.appendChild(permissionsSection);

    // Themes (Appearance) Settings
    const themesSection = document.createElement("div");
    themesSection.className = "settings-section";
    themesSection.dataset.section = "themes";
    let themesHtml = `
      <h2>Appearance</h2>
      <p class="settings-description">Customize the appearance of the extension.</p>
      <div class="settings-group">
        <div class="setting-item">
          <label for="currentTheme">Current Theme:</label>
          <select id="currentTheme">
            <option value="system" ${themesInfo?.currentTheme === 'system' ? 'selected' : ''}>System Preference</option>`;

    if (themesInfo && themesInfo.availableThemes && themesInfo.availableThemes.length > 0) {
      themesInfo.availableThemes
        .filter(theme => theme.id !== 'system')
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(theme => {
          themesHtml += `<option value="${theme.id}" ${theme.id === themesInfo.currentTheme ? 'selected' : ''}>${theme.name}</option>`;
        });
    } else {
      themesHtml += `<option value="light" ${themesInfo?.currentTheme === 'light' ? 'selected' : ''}>Light</option>`;
      themesHtml += `<option value="dark" ${themesInfo?.currentTheme === 'dark' ? 'selected' : ''}>Dark</option>`;
    }

    themesHtml += `
          </select>
        </div>
      </div>
      <div class="settings-actions">
        <button id="saveThemeSettingsBtn" class="primary-btn">Apply Theme</button>
        <button id="resetThemeSettingsBtn">Reset to Default Theme</button>
      </div>
    `;
    themesSection.innerHTML = themesHtml;
    contentArea.appendChild(themesSection);

    // Advanced Settings
    const advancedSection = document.createElement("div");
    advancedSection.className = "settings-section";
    advancedSection.dataset.section = "advanced";
    const advancedConf = config.advanced || {};
    advancedSection.innerHTML = `
      <h2>Advanced Settings</h2>
      <p class="settings-description">These settings are for advanced users and may affect performance or stability.</p>
      <div class="settings-group">
        <div class="setting-item">
          <label for="enableDebugMode">
            <input type="checkbox" id="enableDebugMode" ${advancedConf.enableDebugMode ? 'checked' : ''}>
            Enable debug mode (more console logging)
          </label>
        </div>
        <div class="setting-item">
          <label for="persistFilters">
            <input type="checkbox" id="persistFilters" ${advancedConf.persistFilters ?? true ? 'checked' : ''}>
            Persist filters between sessions (Popup)
          </label>
        </div>
        <div class="setting-item">
          <label for="useCompression">
            <input type="checkbox" id="useCompression" ${advancedConf.useCompression ? 'checked' : ''}>
            Use compression for stored data (Experimental)
          </label>
        </div>
        <div class="setting-item">
          <label for="backgroundMode">Background Mode:</label>
          <select id="backgroundMode">
            <option value="default" ${advancedConf.backgroundMode === 'default' ? 'selected' : ''}>Default</option>
            <option value="persistent" ${advancedConf.backgroundMode === 'persistent' ? 'selected' : ''}>Persistent</option>
            <option value="on-demand" ${advancedConf.backgroundMode === 'on-demand' ? 'selected' : ''}>On-Demand</option>
            <option value="optimized" ${advancedConf.backgroundMode === 'optimized' ? 'selected' : ''}>Optimized</option>
          </select>
        </div>
        <div class="setting-item">
          <label for="syncInterval">Sync Interval (minutes):</label>
          <input type="number" id="syncInterval" min="1" max="1440" step="1" value="${advancedConf.syncInterval ?? 60}">
        </div>
      </div>
      <div class="settings-actions">
        <button id="saveAdvancedSettingsBtn" class="primary-btn">Save Changes</button>
      </div>
    `;
    contentArea.appendChild(advancedSection);

    // Navigation Listener (Tab Switching)
    sidebar.querySelectorAll(".settings-nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        const currentActiveButton = sidebar.querySelector(".settings-nav-item.active");
        const currentActiveSection = contentArea.querySelector(".settings-section.active");
        const sectionId = item.getAttribute("data-section");
        const newActiveSection = contentArea.querySelector(`.settings-section[data-section="${sectionId}"]`);

        if (item === currentActiveButton) return;

        if (currentActiveButton) currentActiveButton.classList.remove("active");
        if (currentActiveSection) currentActiveSection.classList.remove("active");

        item.classList.add("active");
        if (newActiveSection) newActiveSection.classList.add("active");
      });
    });

    // Action Button Listeners
    document.getElementById("resetSettingsBtn")?.addEventListener("click", optionsManager.resetAllSettings);
    document.getElementById("saveGeneralSettingsBtn")?.addEventListener("click", optionsManager.saveGeneralSettings);
    document.getElementById("saveCaptureSettingsBtn")?.addEventListener("click", optionsManager.saveCaptureSettings);
    document.getElementById("saveDisplaySettingsBtn")?.addEventListener("click", optionsManager.saveDisplaySettings);
    document.getElementById("saveFeatureSettingsBtn")?.addEventListener("click", optionsManager.saveFeatureSettings);
    document.getElementById("resetFeatureSettingsBtn")?.addEventListener("click", optionsManager.resetFeatureSettings);
    document.getElementById("savePermissionSettingsBtn")?.addEventListener("click", optionsManager.savePermissionSettings);
    document.getElementById("resetPermissionSettingsBtn")?.addEventListener("click", optionsManager.resetPermissionSettings);
    document.getElementById("saveThemeSettingsBtn")?.addEventListener("click", optionsManager.saveThemeSettings);
    document.getElementById("resetThemeSettingsBtn")?.addEventListener("click", optionsManager.resetThemeSettings);
    document.getElementById("saveAdvancedSettingsBtn")?.addEventListener("click", optionsManager.saveAdvancedSettings);

    const currentRoleSelect = document.getElementById('currentRole');
    if (currentRoleSelect) {
      currentRoleSelect.addEventListener('change', async (event) => {
        const selectedRoleId = event.target.value;
        const selectedRoleName = event.target.options[event.target.selectedIndex].text;
        const roleNameSpan = document.getElementById('selectedRoleName');
        if (roleNameSpan) roleNameSpan.textContent = selectedRoleName;
        console.log(`Role selection changed to ${selectedRoleId}.`);
      });
    }

  } catch (error) {
    console.error("Error initializing settings UI:", error);
    tabsContent.innerHTML = `<div class="error-message">Error loading settings: ${error.message}. Please try again later or reset settings.</div>`;
  }
}

/**
 * Add CSS styles for settings UI
 */
function addSettingsStyles() {
  const styleId = "settings-ui-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .settings-container {
      display: flex;
      height: 100%;
      overflow: hidden;
    }
    .settings-sidebar {
      width: 180px;
      flex-shrink: 0;
      background-color: var(--surface-color, #f8f9fa);
      padding: 15px 0px 15px 15px;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--divider-color, #dee2e6);
    }
    .settings-nav {
      flex-grow: 1;
    }
    .settings-nav h3 {
      margin: 0 0 15px 0;
      padding: 0 15px;
      font-size: 1.1em;
      color: var(--text-primary-color, #333);
    }
    .settings-nav-item {
      display: block;
      width: calc(100% - 15px);
      text-align: left;
      background: none;
      color: var(--text-secondary-color, #555);
      border: none;
      padding: 10px 15px;
      cursor: pointer;
      border-radius: 4px 0 0 4px;
      transition: background-color 0.2s ease, color 0.2s ease;
      margin-bottom: 5px;
      font-size: 0.95em;
    }
    .settings-nav-item:hover {
      background-color: var(--surface-hover-color, #e9ecef);
      color: var(--accent-color, #0056b3);
    }
    .settings-nav-item.active {
      background-color: var(--accent-color, #0066cc);
      color: white;
      font-weight: bold;
    }
    .settings-actions {
      margin-top: 20px;
      padding-top: 15px;
      padding-right: 15px;
      border-top: 1px solid var(--divider-color, #ccc);
    }
    .settings-actions button, .settings-section .settings-actions button {
      display: block;
      width: 100%;
      margin-bottom: 8px;
      border: 1px solid var(--border-color, #ccc);
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1em;
      text-align: center;
      background-color: var(--surface-color, #fff);
      color: var(--text-primary-color, #333);
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }
    .settings-actions button:hover, .settings-section .settings-actions button:hover {
      background-color: var(--surface-hover-color, #f1f1f1);
      border-color: #aaa;
    }
    .settings-actions button.primary-btn, .settings-section .settings-actions button.primary-btn {
      background-color: var(--primary-color, #007bff);
      color: white;
      border-color: var(--primary-color, #007bff);
    }
    .settings-actions button.primary-btn:hover, .settings-section .settings-actions button.primary-btn:hover {
      background-color: #0056b3;
      border-color: #0056b3;
    }
    .settings-sidebar .settings-actions .danger-btn {
      background-color: var(--error-color, #dc3545);
      color: white;
      border: 1px solid var(--error-color, #dc3545);
    }
    .settings-sidebar .settings-actions .danger-btn:hover {
      background-color: #c82333;
      border-color: #bd2130;
    }
    .settings-content {
      flex-grow: 1;
      padding: 15px 20px;
      overflow-y: auto;
      background-color: var(--background-color, #fff);
    }
    .settings-section {
      display: none;
      margin-bottom: 30px;
      border-bottom: 1px solid var(--divider-color, #eee);
      padding-bottom: 20px;
    }
    .settings-section.active {
      display: block;
    }
    .settings-section:last-child {
      border-bottom: none;
    }
    .settings-section h2 {
      margin-top: 0;
      margin-bottom: 10px;
      font-size: 1.3em;
      color: var(--text-primary-color, #333);
      border-bottom: 1px solid var(--divider-color, #eee);
      padding-bottom: 10px;
    }
    .settings-group {
      margin-bottom: 25px;
    }
    .settings-group h4 {
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 1.05em;
      font-weight: bold;
      color: var(--text-secondary-color, #555);
      border-bottom: 1px solid var(--divider-color, #eee);
      padding-bottom: 5px;
    }
    .setting-item {
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 15px;
    }
    .setting-item label:has(input[type="checkbox"]),
    .setting-item label:has(input[type="radio"]) {
      flex-basis: auto;
      flex-grow: 1;
      cursor: pointer;
    }
    .setting-item label {
      flex-basis: 200px;
      flex-shrink: 0;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: default;
      color: var(--text-primary-color, #444);
    }
    .setting-item label input[type="checkbox"],
    .setting-item label input[type="radio"] {
      margin-right: 5px;
      cursor: pointer;
      width: 16px;
      height: 16px;
    }
    .setting-item input[type="text"],
    .setting-item input[type="number"],
    .setting-item select {
      flex-grow: 1;
      padding: 8px;
      border: 1px solid var(--border-color, #ccc);
      border-radius: 3px;
      min-width: 150px;
      background-color: var(--background-color, #fff);
      color: var(--text-primary-color, #333);
    }
    .setting-item input:disabled, .setting-item select:disabled {
      background-color: var(--surface-hover-color, #eee);
      cursor: not-allowed;
    }
    .settings-description {
      font-size: 0.9em;
      color: var(--text-secondary-color, #666);
      margin-bottom: 20px;
      margin-top: -5px;
    }
    .features-container, .permissions-container {
      margin-top: 10px;
    }
    .feature-category, .permission-category {
    }
    .feature-toggle label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1em;
      cursor: pointer;
      width: 100%;
    }
    .feature-toggle label span {
      flex-grow: 1;
    }
    .feature-toggle input[disabled] + span {
      color: var(--text-disabled-color, #999);
      cursor: not-allowed;
    }
    .feature-toggle label[title] {
      cursor: help;
    }
    .feature-deps {
      font-size: 0.85em;
      color: var(--text-secondary-color, #777);
      margin-left: 29px;
      display: block;
      margin-top: -10px;
      margin-bottom: 10px;
    }
    .permission-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95em;
      padding: 5px 0;
      color: var(--text-secondary-color, #555);
    }
    .permission-item[title] {
      cursor: help;
    }
    .permission-item i {
      width: 18px;
      text-align: center;
      font-size: 1.1em;
    }
    .permission-item.granted i { color: var(--success-color, #28a745); }
    .permission-item.denied i { color: var(--error-color, #dc3545); }
    .permission-item.granted span { color: var(--text-primary-color, #333); }
    .loading-indicator, .error-message {
      padding: 20px;
      text-align: center;
      font-size: 1.1em;
      color: var(--text-secondary-color, #666);
    }
    .error-message {
      color: var(--error-color, #dc3545);
    }
  `;
  document.head.appendChild(style);
}
