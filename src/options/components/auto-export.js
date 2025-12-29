// Auto export component for options page
import "../../background/storage/storage-manager.js";

export default function renderAutoExport() {
  const container = document.createElement("div");
  container.className = "auto-export-section";

  container.innerHTML = `
    <h2>Auto Export Settings</h2>

    <div class="settings-group">
      <h3>Export Configuration</h3>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="autoExport">
          Enable Automatic Export
        </label>
        <span class="description">Automatically export captured data on schedule</span>
      </div>

      <div class="setting-row">
        <label for="exportFormat">Export Format:</label>
        <select id="exportFormat">
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="sqlite">SQLite Database</option>
          <option value="har">HAR (HTTP Archive)</option>
        </select>
        <span class="description">File format for exported data</span>
      </div>

      <div class="setting-row">
        <label for="compressionType">Compression:</label>
        <select id="compressionType">
          <option value="none">None</option>
          <option value="gzip">GZIP</option>
          <option value="zip">ZIP</option>
        </select>
        <span class="description">Compress exported files to save space</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>Export Schedule</h3>
      <div class="setting-row">
        <label for="exportInterval">Export Interval:</label>
        <select id="exportInterval">
          <option value="300000">5 minutes</option>
          <option value="900000">15 minutes</option>
          <option value="1800000">30 minutes</option>
          <option value="3600000">1 hour</option>
          <option value="7200000">2 hours</option>
          <option value="14400000">4 hours</option>
          <option value="28800000">8 hours</option>
          <option value="43200000">12 hours</option>
          <option value="86400000">24 hours</option>
        </select>
      </div>

      <div class="setting-row">
        <label>
          <input type="checkbox" id="exportOnlyWhenNew">
          Export Only When New Data Available
        </label>
        <span class="description">Skip export if no new requests captured</span>
      </div>

      <div class="setting-row">
        <label>
          <input type="checkbox" id="exportOnClose">
          Export on Browser Close
        </label>
        <span class="description">Export data when closing the browser</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>Export Location</h3>
      <div class="setting-row">
        <label for="exportPath">Export Directory:</label>
        <div class="path-input-container">
          <input type="text" id="exportPath" placeholder="Default downloads directory">
          <button id="browseExportPath" class="secondary-btn">Browse...</button>
        </div>
      </div>

      <div class="setting-row">
        <label for="fileNamePattern">File Name Pattern:</label>
        <input type="text" id="fileNamePattern" 
               placeholder="requests_{datetime}_{counter}"
               title="Available variables: {datetime}, {counter}, {format}">
        <span class="description">Pattern for exported file names</span>
      </div>

      <div class="setting-row file-handling">
        <label>When file exists:</label>
        <div class="radio-group">
          <label>
            <input type="radio" name="fileExistsAction" value="increment">
            Add Counter
          </label>
          <label>
            <input type="radio" name="fileExistsAction" value="overwrite">
            Overwrite
          </label>
          <label>
            <input type="radio" name="fileExistsAction" value="timestamp">
            Add Timestamp
          </label>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <h3>Export Filters</h3>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="excludeErrors">
          Exclude Failed Requests
        </label>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="excludeResources">
          Exclude Resource Requests
        </label>
        <span class="description">Skip images, scripts, stylesheets, etc.</span>
      </div>
      <div class="setting-row domain-filters">
        <label>Domain Filters:</label>
        <div class="tag-input-container">
          <input type="text" id="domainFilter" placeholder="Enter domain and press Enter">
          <div id="domainTags" class="tag-list"></div>
        </div>
      </div>
    </div>

    <div class="settings-actions">
      <button id="saveAutoExportSettings" class="primary-btn">Save Changes</button>
      <button id="resetAutoExportSettings" class="secondary-btn">Reset to Defaults</button>
      <button id="testExport" class="secondary-btn">Test Export</button>
    </div>

    <div id="autoExportStatus" class="status-message" style="display: none;"></div>
  `;

  // Default settings
  const defaultSettings = {
    autoExport: false,
    exportFormat: "json",
    compressionType: "none",
    exportInterval: "3600000", // 1 hour
    exportOnlyWhenNew: true,
    exportOnClose: true,
    exportPath: "",
    fileNamePattern: "requests_{datetime}_{counter}",
    fileExistsAction: "increment",
    excludeErrors: false,
    excludeResources: true,
    domainFilters: [],
  };

  // Initialize event listeners
  function attachEventListeners() {
    const saveBtn = container.querySelector("#saveAutoExportSettings");
    const resetBtn = container.querySelector("#resetAutoExportSettings");
    const testBtn = container.querySelector("#testExport");
    const browseBtn = container.querySelector("#browseExportPath");
    const autoExportToggle = container.querySelector("#autoExport");
    const domainFilterInput = container.querySelector("#domainFilter");

    saveBtn.addEventListener("click", saveAutoExportSettings);
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset all auto-export settings to defaults?")) {
        resetSettings();
      }
    });

    testBtn.addEventListener("click", testExport);
    browseBtn.addEventListener("click", browsePath);

    // Add change listener for auto export toggle
    autoExportToggle.addEventListener("change", () => {
      updateSettingsAvailability(autoExportToggle.checked);
    });

    // Domain filter tag input
    domainFilterInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        addDomainTag(e.target.value.trim());
        e.target.value = "";
      }
    });
  }

  // Add domain filter tag
  function addDomainTag(domain) {
    const tagList = container.querySelector("#domainTags");
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.innerHTML = `
      ${domain}
      <button class="remove-tag">×</button>
    `;
    tagList.appendChild(tag);

    // Add event listener for the remove button
    tag.querySelector(".remove-tag").addEventListener("click", function () {
      tag.remove();
    });
  }

  // Show status message
  function showStatus(message, success = true) {
    const statusEl = container.querySelector("#autoExportStatus");
    statusEl.textContent = message;
    statusEl.className = `status-message ${success ? "success" : "error"}`;
    statusEl.style.display = "block";

    setTimeout(() => {
      statusEl.style.display = "none";
    }, 3000);
  }

  // Enable/disable settings based on auto export enabled state
  function updateSettingsAvailability(enabled) {
    const inputs = container.querySelectorAll(
      "input:not(#autoExport), select, button:not(#saveAutoExportSettings):not(#resetAutoExportSettings)"
    );
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
  }

  // Save settings
  async function saveAutoExportSettings() {
    const settings = {
      autoExport: container.querySelector("#autoExport").checked,
      exportFormat: container.querySelector("#exportFormat").value,
      compressionType: container.querySelector("#compressionType").value,
      exportInterval: container.querySelector("#exportInterval").value,
      exportOnlyWhenNew: container.querySelector("#exportOnlyWhenNew").checked,
      exportOnClose: container.querySelector("#exportOnClose").checked,
      exportPath: container.querySelector("#exportPath").value,
      fileNamePattern: container.querySelector("#fileNamePattern").value,
      fileExistsAction: container.querySelector(
        'input[name="fileExistsAction"]:checked'
      ).value,
      excludeErrors: container.querySelector("#excludeErrors").checked,
      excludeResources: container.querySelector("#excludeResources").checked,
      domainFilters: Array.from(
        container.querySelectorAll("#domainTags .tag")
      ).map((tag) => tag.textContent.trim()),
    };

    try {
      await saveToStorage("autoExportSettings", settings);

      // Notify background script of settings change
      chrome.runtime.sendMessage(
        {
          action: "updateAutoExportSettings",
          settings,
        },
        (response) => {
          if (response && response.success) {
            showStatus("Auto-export settings saved successfully");
          } else {
            throw new Error(
              response?.error || "Failed to update auto-export settings"
            );
          }
        }
      );
    } catch (error) {
      console.error("Failed to save auto-export settings:", error);
      showStatus("Failed to save auto-export settings", false);
    }
  }

  // Test export
  async function testExport() {
    try {
      chrome.runtime.sendMessage(
        {
          action: "testExport",
        },
        (response) => {
          if (response && response.success) {
            showStatus("Test export completed successfully");
          } else {
            throw new Error(response?.error || "Test export failed");
          }
        }
      );
    } catch (error) {
      console.error("Test export failed:", error);
      showStatus("Test export failed", false);
    }
  }

  // Browse for export path
  function browsePath() {
    chrome.runtime.sendMessage(
      {
        action: "browseDirectory",
      },
      (response) => {
        if (response && response.path) {
          container.querySelector("#exportPath").value = response.path;
        }
      }
    );
  }

  // Load settings
  async function loadSettings() {
    try {
      const settings =
        (await loadFromStorage("autoExportSettings")) || defaultSettings;

      // Update UI with loaded settings
      Object.entries(settings).forEach(([key, value]) => {
        if (key === "domainFilters") {
          value.forEach((domain) => addDomainTag(domain));
        } else if (key === "fileExistsAction") {
          const radio = container.querySelector(
            `input[name="fileExistsAction"][value="${value}"]`
          );
          if (radio) radio.checked = true;
        } else {
          const element = container.querySelector(`#${key}`);
          if (element) {
            if (element.type === "checkbox") {
              element.checked = value;
            } else {
              element.value = value;
            }
          }
        }
      });

      // Update settings availability
      updateSettingsAvailability(settings.autoExport);
    } catch (error) {
      console.error("Failed to load auto-export settings:", error);
      showStatus("Failed to load auto-export settings", false);
    }
  }

  // Reset settings to defaults
  async function resetSettings() {
    try {
      await saveToStorage("autoExportSettings", defaultSettings);

      // Update UI
      container.querySelector("#domainTags").innerHTML = "";
      Object.entries(defaultSettings).forEach(([key, value]) => {
        if (key === "domainFilters") {
          value.forEach((domain) => addDomainTag(domain));
        } else if (key === "fileExistsAction") {
          const radio = container.querySelector(
            `input[name="fileExistsAction"][value="${value}"]`
          );
          if (radio) radio.checked = true;
        } else {
          const element = container.querySelector(`#${key}`);
          if (element) {
            if (element.type === "checkbox") {
              element.checked = value;
            } else {
              element.value = value;
            }
          }
        }
      });

      // Notify background script
      chrome.runtime.sendMessage(
        {
          action: "updateAutoExportSettings",
          settings: defaultSettings,
        },
        (response) => {
          if (response && response.success) {
            showStatus("Settings reset to defaults");
          } else {
            throw new Error(response?.error || "Failed to reset settings");
          }
        }
      );
    } catch (error) {
      console.error("Failed to reset auto-export settings:", error);
      showStatus("Failed to reset settings", false);
    }
  }

  // Initialize component
  attachEventListeners();
  loadSettings();

  return container;
}
