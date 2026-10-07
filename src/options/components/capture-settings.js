// Capture settings component for options page
import { DEFAULT_SETTINGS } from "../../config/settings-defaults.js";

const XHR_TYPES = ["xmlhttprequest", "fetch"];
const RESOURCE_TYPES = ["script", "image", "stylesheet", "font"];

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
    </div>

    <div class="settings-actions">
      <button id="saveCaptureSettings" class="primary-btn">Save Changes</button>
      <button id="resetCaptureSettings" class="secondary-btn">Reset to Defaults</button>
    </div>

    <div id="captureSettingsStatus" class="status-message" style="display: none;"></div>
  `;

  function attachEventListeners() {
    container.querySelector("#saveCaptureSettings").addEventListener("click", saveCaptureSettings);
    container.querySelector("#resetCaptureSettings").addEventListener("click", () => {
      if (confirm("Reset all capture settings to defaults?")) resetSettings();
    });
    const toggle = container.querySelector("#captureEnabled");
    toggle.addEventListener("change", () => updateSettingsAvailability(toggle.checked));
  }

  function showStatus(message, success = true) {
    const el = container.querySelector("#captureSettingsStatus");
    el.textContent = message;
    el.className = `status-message ${success ? "success" : "error"}`;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 3000);
  }

  function updateSettingsAvailability(enabled) {
    container.querySelectorAll("input:not(#captureEnabled)").forEach((input) => {
      input.disabled = !enabled;
    });
  }

  function sendMessage(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(response);
      });
    });
  }

  async function saveCaptureSettings() {
    const get = (id) => container.querySelector(`#${id}`);

    const types = ["other"];
    if (get("captureXHR").checked) types.push(...XHR_TYPES);
    if (get("captureResources").checked) types.push(...RESOURCE_TYPES);

    const captureUpdate = {
      enabled: get("captureEnabled").checked,
      includeHeaders: get("captureHeaders").checked,
      includeTiming: get("captureTimings").checked,
      includeContent: get("captureRequestBody").checked || get("captureResponseBody").checked,
      maxContentSize: parseInt(get("maxBodySize").value) * 1024,
      captureWebSockets: get("captureWebSocket").checked,
      captureServerSentEvents: get("captureEventSource").checked,
      captureFilters: { includeTypes: types },
    };

    const generalUpdate = {
      maxStoredRequests: parseInt(get("maxStoredRequests").value),
      autoStartCapture: get("autoStartCapture").checked,
    };

    try {
      const response = await sendMessage({
        action: "updateSettings",
        settings: { capture: captureUpdate, general: generalUpdate },
      });
      if (!response?.success) throw new Error(response?.error || "Failed to save settings");
      // Reload the live capture integration so new config takes effect immediately
      await sendMessage({ action: "reloadCaptureSettings" });
      showStatus("Capture settings saved successfully");
    } catch (error) {
      console.error("Failed to save capture settings:", error);
      showStatus("Failed to save capture settings", false);
    }
  }

  async function loadSettings() {
    try {
      const response = await sendMessage({ action: "getSettings" });
      const s = response?.settings || {};
      const capture = s.capture || DEFAULT_SETTINGS.capture;
      const general = s.general || DEFAULT_SETTINGS.general;
      const types = capture.captureFilters?.includeTypes || DEFAULT_SETTINGS.capture.captureFilters.includeTypes;

      const set = (id, val) => {
        const el = container.querySelector(`#${id}`);
        if (!el) return;
        el.type === "checkbox" ? (el.checked = !!val) : (el.value = val);
      };

      set("captureEnabled", capture.enabled ?? true);
      set("maxStoredRequests", general.maxStoredRequests ?? 10000);
      set("autoStartCapture", general.autoStartCapture ?? true);
      set("captureHeaders", capture.includeHeaders ?? true);
      set("captureRequestBody", capture.includeContent ?? false);
      set("captureResponseBody", capture.includeContent ?? false);
      set("maxBodySize", Math.round((capture.maxContentSize ?? 1024 * 1024) / 1024));
      set("captureXHR", types.some((t) => XHR_TYPES.includes(t)));
      set("captureWebSocket", capture.captureWebSockets ?? false);
      set("captureEventSource", capture.captureServerSentEvents ?? false);
      set("captureResources", types.some((t) => RESOURCE_TYPES.includes(t)));
      set("captureTimings", capture.includeTiming ?? true);

      updateSettingsAvailability(capture.enabled ?? true);
    } catch (error) {
      console.error("Failed to load capture settings:", error);
      showStatus("Failed to load capture settings", false);
    }
  }

  async function resetSettings() {
    try {
      const { capture, general } = DEFAULT_SETTINGS;
      const response = await sendMessage({
        action: "updateSettings",
        settings: {
          capture,
          general: {
            maxStoredRequests: general.maxStoredRequests,
            autoStartCapture: general.autoStartCapture,
          },
        },
      });
      if (!response?.success) throw new Error(response?.error || "Failed to reset");
      await sendMessage({ action: "reloadCaptureSettings" });
      await loadSettings();
      showStatus("Settings reset to defaults");
    } catch (error) {
      console.error("Failed to reset capture settings:", error);
      showStatus("Failed to reset settings", false);
    }
  }

  attachEventListeners();
  loadSettings();

  return container;
}
