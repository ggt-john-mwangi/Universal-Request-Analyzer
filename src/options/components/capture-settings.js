// Capture settings component for options page
import "../../background/storage/storage-manager.js";

export default function renderCaptureSettings() {
  const container = document.createElement("div");
  container.className = "capture-settings-section";

  container.innerHTML = `
    <h2>Capture Settings</h2>

    <div class="settings-group">
      <h3>General Capture Settings</h3>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureEnabled">
          Enable Request Capture
        </label>
        <span class="description">Capture and analyze network requests</span>
      </div>
      <div class="setting-row">
        <label for="maxStoredRequests">Maximum Stored Requests:</label>
        <input type="number" id="maxStoredRequests" min="100" max="100000" step="100">
        <span class="description">Maximum number of requests to keep in storage</span>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="autoStartCapture">
          Auto-start Capture
        </label>
        <span class="description">Automatically start capturing when browser launches</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>Capture Content Settings</h3>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureHeaders">
          Capture Headers
        </label>
        <span class="description">Include request and response headers</span>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureRequestBody">
          Capture Request Body
        </label>
        <span class="description">Include request body data (POST, PUT, etc.)</span>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureResponseBody">
          Capture Response Body
        </label>
        <span class="description">Include response body data</span>
      </div>
      <div class="setting-row">
        <label for="maxBodySize">Maximum Body Size (KB):</label>
        <input type="number" id="maxBodySize" min="0" max="5120" step="64">
        <span class="description">Maximum size for request/response bodies (0 = no limit)</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>Request Types</h3>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureXHR">
          XMLHttpRequest/Fetch
        </label>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureWebSocket">
          WebSocket Connections
        </label>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureEventSource">
          Server-Sent Events
        </label>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureResources">
          Resource Requests
        </label>
        <span class="description">Images, scripts, stylesheets, etc.</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>Performance Monitoring</h3>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureTimings">
          Capture Timing Data
        </label>
        <span class="description">Include detailed network timing information</span>
      </div>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="captureSize">
          Capture Size Information
        </label>
        <span class="description">Track request/response sizes</span>
      </div>
    </div>

    <div class="settings-actions">
      <button id="saveCaptureSettings" class="primary-btn">Save Changes</button>
      <button id="resetCaptureSettings" class="secondary-btn">Reset to Defaults</button>
    </div>

    <div id="captureSettingsStatus" class="status-message" style="display: none;"></div>
  `;

  // Default settings
  const defaultSettings = {
    captureEnabled: true,
    maxStoredRequests: 1000,
    autoStartCapture: false,
    captureHeaders: true,
    captureRequestBody: true,
    captureResponseBody: true,
    maxBodySize: 256, // KB
    captureXHR: true,
    captureWebSocket: true,
    captureEventSource: true,
    captureResources: false,
    captureTimings: true,
    captureSize: true,
  };

  // Initialize event listeners
  function attachEventListeners() {
    const saveBtn = container.querySelector("#saveCaptureSettings");
    const resetBtn = container.querySelector("#resetCaptureSettings");

    saveBtn.addEventListener("click", saveCaptureSettings);
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset all capture settings to defaults?")) {
        resetSettings();
      }
    });

    // Add change listener for capture enabled toggle
    const captureEnabledToggle = container.querySelector("#captureEnabled");
    captureEnabledToggle.addEventListener("change", () => {
      updateSettingsAvailability(captureEnabledToggle.checked);
    });
  }

  // Show status message
  function showStatus(message, success = true) {
    const statusEl = container.querySelector("#captureSettingsStatus");
    statusEl.textContent = message;
    statusEl.className = `status-message ${success ? "success" : "error"}`;
    statusEl.style.display = "block";

    setTimeout(() => {
      statusEl.style.display = "none";
    }, 3000);
  }

  // Enable/disable settings based on capture enabled state
  function updateSettingsAvailability(enabled) {
    const inputs = container.querySelectorAll("input:not(#captureEnabled)");
    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
  }

  // Save settings
  async function saveCaptureSettings() {
    const settings = {
      captureEnabled: container.querySelector("#captureEnabled").checked,
      maxStoredRequests: parseInt(
        container.querySelector("#maxStoredRequests").value
      ),
      autoStartCapture: container.querySelector("#autoStartCapture").checked,
      captureHeaders: container.querySelector("#captureHeaders").checked,
      captureRequestBody: container.querySelector("#captureRequestBody")
        .checked,
      captureResponseBody: container.querySelector("#captureResponseBody")
        .checked,
      maxBodySize: parseInt(container.querySelector("#maxBodySize").value),
      captureXHR: container.querySelector("#captureXHR").checked,
      captureWebSocket: container.querySelector("#captureWebSocket").checked,
      captureEventSource: container.querySelector("#captureEventSource")
        .checked,
      captureResources: container.querySelector("#captureResources").checked,
      captureTimings: container.querySelector("#captureTimings").checked,
      captureSize: container.querySelector("#captureSize").checked,
    };

    try {
      await saveToStorage("captureSettings", settings);

      // Notify background script of settings change
      chrome.runtime.sendMessage(
        {
          action: "updateCaptureSettings",
          settings,
        },
        (response) => {
          if (response && response.success) {
            showStatus("Capture settings saved successfully");
          } else {
            throw new Error(
              response?.error || "Failed to update capture settings"
            );
          }
        }
      );
    } catch (error) {
      console.error("Failed to save capture settings:", error);
      showStatus("Failed to save capture settings", false);
    }
  }

  // Load settings
  async function loadSettings() {
    try {
      const settings =
        (await loadFromStorage("captureSettings")) || defaultSettings;

      // Update UI with loaded settings
      Object.entries(settings).forEach(([key, value]) => {
        const element = container.querySelector(`#${key}`);
        if (element) {
          if (element.type === "checkbox") {
            element.checked = value;
          } else {
            element.value = value;
          }
        }
      });

      // Update settings availability
      updateSettingsAvailability(settings.captureEnabled);
    } catch (error) {
      console.error("Failed to load capture settings:", error);
      showStatus("Failed to load capture settings", false);
    }
  }

  // Reset settings to defaults
  async function resetSettings() {
    try {
      await saveToStorage("captureSettings", defaultSettings);

      // Update UI
      Object.entries(defaultSettings).forEach(([key, value]) => {
        const element = container.querySelector(`#${key}`);
        if (element) {
          if (element.type === "checkbox") {
            element.checked = value;
          } else {
            element.value = value;
          }
        }
      });

      // Notify background script
      chrome.runtime.sendMessage(
        {
          action: "updateCaptureSettings",
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
      console.error("Failed to reset capture settings:", error);
      showStatus("Failed to reset settings", false);
    }
  }

  // Initialize component
  attachEventListeners();
  loadSettings();

  return container;
}
