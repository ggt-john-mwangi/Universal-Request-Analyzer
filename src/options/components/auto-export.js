// Auto export component for options page
import { DEFAULT_SETTINGS } from "../../config/settings-defaults.js";

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

  function attachEventListeners() {
    container.querySelector("#saveAutoExportSettings").addEventListener("click", saveAutoExportSettings);
    container.querySelector("#resetAutoExportSettings").addEventListener("click", () => {
      if (confirm("Reset all auto-export settings to defaults?")) resetSettings();
    });
    container.querySelector("#testExport").addEventListener("click", testExport);
    container.querySelector("#browseExportPath").addEventListener("click", browsePath);

    const toggle = container.querySelector("#autoExport");
    toggle.addEventListener("change", () => updateSettingsAvailability(toggle.checked));

    container.querySelector("#domainFilter").addEventListener("keyup", (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        addDomainTag(e.target.value.trim());
        e.target.value = "";
      }
    });
  }

  function addDomainTag(domain) {
    const tagList = container.querySelector("#domainTags");
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.innerHTML = `${domain}<button class="remove-tag">×</button>`;
    tag.querySelector(".remove-tag").addEventListener("click", () => tag.remove());
    tagList.appendChild(tag);
  }

  function showStatus(message, success = true) {
    const el = container.querySelector("#autoExportStatus");
    el.textContent = message;
    el.className = `status-message ${success ? "success" : "error"}`;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 3000);
  }

  function updateSettingsAvailability(enabled) {
    container.querySelectorAll(
      "input:not(#autoExport), select, button:not(#saveAutoExportSettings):not(#resetAutoExportSettings)"
    ).forEach((el) => { el.disabled = !enabled; });
  }

  function sendMessage(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(response);
      });
    });
  }

  function collectSettings() {
    const get = (id) => container.querySelector(`#${id}`);
    return {
      general: {
        autoExport: get("autoExport").checked,
        defaultExportFormat: get("exportFormat").value,
        autoExportInterval: parseInt(get("exportInterval").value),
        exportPath: get("exportPath").value,
      },
      export: {
        compressionType: get("compressionType").value,
        exportOnlyWhenNew: get("exportOnlyWhenNew").checked,
        exportOnClose: get("exportOnClose").checked,
        fileNamePattern: get("fileNamePattern").value,
        fileExistsAction: container.querySelector('input[name="fileExistsAction"]:checked')?.value || "increment",
        excludeErrors: get("excludeErrors").checked,
        excludeResources: get("excludeResources").checked,
        domainFilters: Array.from(container.querySelectorAll("#domainTags .tag")).map(
          (tag) => tag.firstChild.textContent.trim()
        ),
      },
    };
  }

  function applyToUI(general, exp) {
    const set = (id, val) => {
      const el = container.querySelector(`#${id}`);
      if (!el) return;
      el.type === "checkbox" ? (el.checked = !!val) : (el.value = val);
    };

    set("autoExport", general.autoExport ?? false);
    set("exportFormat", general.defaultExportFormat ?? "json");
    set("exportInterval", String(general.autoExportInterval ?? 3600000));
    set("exportPath", general.exportPath ?? "");
    set("compressionType", exp.compressionType ?? "none");
    set("exportOnlyWhenNew", exp.exportOnlyWhenNew ?? true);
    set("exportOnClose", exp.exportOnClose ?? true);
    set("fileNamePattern", exp.fileNamePattern ?? "requests_{datetime}_{counter}");
    set("excludeErrors", exp.excludeErrors ?? false);
    set("excludeResources", exp.excludeResources ?? true);

    const radio = container.querySelector(
      `input[name="fileExistsAction"][value="${exp.fileExistsAction ?? "increment"}"]`
    );
    if (radio) radio.checked = true;

    container.querySelector("#domainTags").innerHTML = "";
    (exp.domainFilters ?? []).forEach((d) => addDomainTag(d));
  }

  async function saveAutoExportSettings() {
    try {
      const settings = collectSettings();
      const response = await sendMessage({ action: "updateSettings", settings });
      if (response?.success) {
        showStatus("Auto-export settings saved successfully");
      } else {
        throw new Error(response?.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save auto-export settings:", error);
      showStatus("Failed to save auto-export settings", false);
    }
  }

  async function loadSettings() {
    try {
      const response = await sendMessage({ action: "getSettings" });
      const s = response?.settings || {};
      applyToUI(
        s.general || DEFAULT_SETTINGS.general,
        s.export || DEFAULT_SETTINGS.export
      );
      updateSettingsAvailability(s.general?.autoExport ?? false);
    } catch (error) {
      console.error("Failed to load auto-export settings:", error);
      showStatus("Failed to load auto-export settings", false);
    }
  }

  async function resetSettings() {
    try {
      const response = await sendMessage({
        action: "updateSettings",
        settings: {
          general: {
            autoExport: DEFAULT_SETTINGS.general.autoExport,
            defaultExportFormat: DEFAULT_SETTINGS.general.defaultExportFormat,
            autoExportInterval: DEFAULT_SETTINGS.general.autoExportInterval,
            exportPath: DEFAULT_SETTINGS.general.exportPath,
          },
          export: DEFAULT_SETTINGS.export,
        },
      });
      if (!response?.success) throw new Error(response?.error || "Failed to reset");
      applyToUI(DEFAULT_SETTINGS.general, DEFAULT_SETTINGS.export);
      updateSettingsAvailability(DEFAULT_SETTINGS.general.autoExport);
      showStatus("Settings reset to defaults");
    } catch (error) {
      console.error("Failed to reset auto-export settings:", error);
      showStatus("Failed to reset settings", false);
    }
  }

  async function testExport() {
    try {
      const response = await sendMessage({ action: "testExport" });
      if (response?.success) {
        showStatus("Test export completed successfully");
      } else {
        throw new Error(response?.error || "Test export failed");
      }
    } catch (error) {
      console.error("Test export failed:", error);
      showStatus("Test export failed", false);
    }
  }

  function browsePath() {
    chrome.runtime.sendMessage({ action: "browseDirectory" }, (response) => {
      if (response?.path) container.querySelector("#exportPath").value = response.path;
    });
  }

  attachEventListeners();
  loadSettings();

  return container;
}
