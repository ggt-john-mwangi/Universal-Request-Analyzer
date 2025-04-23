/**
 * Settings UI for Universal Request Analyzer
 *
 * This module provides the UI for managing settings, feature flags, ACLs, and themes.
 */

import optionsManager from "./options.js";

/**
 * Initialize the settings UI
 */
export function initSettingsUI() {
  // Add settings tab button if it doesn't exist
  if (!document.querySelector('.tab-btn[data-tab="settings"]')) {
    const tabsContainer = document.querySelector(".tabs");
    const settingsTabBtn = document.createElement("button");
    settingsTabBtn.className = "tab-btn";
    settingsTabBtn.setAttribute("data-tab", "settings");
    settingsTabBtn.textContent = "Settings";
    tabsContainer.appendChild(settingsTabBtn);

    // Add click event
    settingsTabBtn.addEventListener("click", () => {
      // Update active tab button
      document
        .querySelectorAll(".tab-btn")
        .forEach((btn) => btn.classList.remove("active"));
      settingsTabBtn.classList.add("active");

      // Update active tab content
      document
        .querySelectorAll(".tab-content")
        .forEach((content) => content.classList.remove("active"));
      document.getElementById("settings-tab").classList.add("active");

      // Delegate settings data loading to options.js
      optionsManager.loadSettingsData();
    });
  }

  // Create settings tab content if it doesn't exist
  if (!document.getElementById("settings-tab")) {
    const tabsContent = document.querySelector(".tab-content").parentNode;
    const settingsTab = document.createElement("div");
    settingsTab.className = "tab-content";
    settingsTab.id = "settings-tab";

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
    `;

    tabsContent.appendChild(settingsTab);

    // Add event listeners for settings navigation
    document.querySelectorAll(".settings-nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        // Update active nav item
        document
          .querySelectorAll(".settings-nav-item")
          .forEach((navItem) => navItem.classList.remove("active"));
        item.classList.add("active");

        // Update active section
        const section = item.getAttribute("data-section");
        document
          .querySelectorAll(".settings-section")
          .forEach((section) => section.classList.remove("active"));
        document
          .querySelector(`.settings-section[data-section="${section}"]`)
          .classList.add("active");
      });
    });

    // Add event listeners for settings actions
    document
      .getElementById("resetSettingsBtn")
      .addEventListener("click", optionsManager.resetAllSettings);
    document
      .getElementById("saveGeneralSettingsBtn")
      .addEventListener("click", optionsManager.saveGeneralSettings);
    document
      .getElementById("saveCaptureSettingsBtn")
      .addEventListener("click", optionsManager.saveCaptureSettings);
    document
      .getElementById("saveDisplaySettingsBtn")
      .addEventListener("click", optionsManager.saveDisplaySettings);
    document
      .getElementById("saveFeatureSettingsBtn")
      .addEventListener("click", optionsManager.saveFeatureSettings);
    document
      .getElementById("resetFeatureSettingsBtn")
      .addEventListener("click", optionsManager.resetFeatureSettings);
    document
      .getElementById("savePermissionSettingsBtn")
      .addEventListener("click", optionsManager.savePermissionSettings);
    document
      .getElementById("resetPermissionSettingsBtn")
      .addEventListener("click", optionsManager.resetPermissionSettings);
    document
      .getElementById("saveThemeSettingsBtn")
      .addEventListener("click", optionsManager.saveThemeSettings);
    document
      .getElementById("resetThemeSettingsBtn")
      .addEventListener("click", optionsManager.resetThemeSettings);
    document
      .getElementById("saveAdvancedSettingsBtn")
      .addEventListener("click", optionsManager.saveAdvancedSettings);

    // Add CSS for settings UI
    addSettingsStyles();
  }
}

/**
 * Add CSS styles for settings UI
 */
function addSettingsStyles() {
  const styleElement = document.createElement("style");
  styleElement.textContent = `
   
  `;

  document.head.appendChild(styleElement);
}
