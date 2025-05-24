import { sendMessageWithResponse } from "../../background/utils/message-handler";

export default function renderCaptureSettings() {
  const container = document.createElement("div");
  container.className = "capture-settings-section";

  container.innerHTML = `
    <h2>Capture Settings</h2>

    <!-- General Settings -->
    <div class="settings-group">
      <h3>General Capture Settings</h3>
      <div class="setting-row">
        <label><input type="checkbox" id="captureEnabled"> Enable Request Capture</label>
        <span class="description">Capture and analyze network requests</span>
      </div>
      <div class="setting-row">
        <label for="maxStoredRequests">Maximum Stored Requests:</label>
        <input type="number" id="maxStoredRequests" min="100" max="100000" step="100">
        <span class="description">Maximum number of requests to keep in storage</span>
      </div>
      <div class="setting-row">
        <label><input type="checkbox" id="autoStartCapture"> Auto-start Capture</label>
        <span class="description">Automatically start capturing when browser launches</span>
      </div>
    </div>

    <!-- Content Settings -->
    <div class="settings-group">
      <h3>Capture Content Settings</h3>
      <div class="setting-row"><label><input type="checkbox" id="captureHeaders"> Capture Headers</label></div>
      <div class="setting-row"><label><input type="checkbox" id="captureRequestBody"> Capture Request Body</label></div>
      <div class="setting-row"><label><input type="checkbox" id="captureResponseBody"> Capture Response Body</label></div>
      <div class="setting-row">
        <label for="maxBodySize">Maximum Body Size (KB):</label>
        <input type="number" id="maxBodySize" min="0" max="5120" step="64">
        <span class="description">Maximum size for request/response bodies (0 = no limit)</span>
      </div>
    </div>

    <!-- Request Types -->
    <div class="settings-group">
      <h3>Request Types</h3>
      <div class="setting-row"><label><input type="checkbox" id="captureXHR"> XMLHttpRequest/Fetch</label></div>
      <div class="setting-row"><label><input type="checkbox" id="captureWebSocket"> WebSocket Connections</label></div>
      <div class="setting-row"><label><input type="checkbox" id="captureEventSource"> Server-Sent Events</label></div>
      <div class="setting-row">
        <label><input type="checkbox" id="captureResources"> Resource Requests</label>
        <span class="description">Images, scripts, stylesheets, etc.</span>
      </div>
    </div>

    <!-- Performance Monitoring -->
    <div class="settings-group">
      <h3>Performance Monitoring</h3>
      <div class="setting-row"><label><input type="checkbox" id="captureTimings"> Capture Timing Data</label></div>
      <div class="setting-row"><label><input type="checkbox" id="captureSize"> Capture Size Information</label></div>
    </div>

    <!-- Actions -->
    <div class="settings-actions">
      <button id="saveCaptureSettings" class="primary-btn">Save Changes</button>
      <button id="resetCaptureSettings" class="secondary-btn">Reset to Defaults</button>
    </div>

    <div id="captureSettingsStatus" class="status-message" style="display: none;"></div>
  `;

  const showStatus = (message, success = true) => {
    const status = container.querySelector("#captureSettingsStatus");
    status.textContent = message;
    status.style.display = "block";
    status.style.color = success ? "green" : "red";
    setTimeout(() => (status.style.display = "none"), 3000);
  };

  const getBoolean = (id, fallback = true) =>
    container.querySelector(`#${id}`)?.checked ?? fallback;

  const getNumber = (id, fallback = 0) =>
    parseInt(container.querySelector(`#${id}`)?.value, 10) || fallback;

  const saveCaptureSettings = async () => {
    const settings = {
      captureEnabled: getBoolean("captureEnabled", false),
      maxStoredRequests: getNumber("maxStoredRequests", 1000),
      autoStartCapture: getBoolean("autoStartCapture", false),
      captureHeaders: getBoolean("captureHeaders"),
      captureRequestBody: getBoolean("captureRequestBody"),
      captureResponseBody: getBoolean("captureResponseBody"),
      maxBodySize: getNumber("maxBodySize", 256),
      captureXHR: getBoolean("captureXHR"),
      captureWebSocket: getBoolean("captureWebSocket"),
      captureEventSource: getBoolean("captureEventSource"),
      captureResources: getBoolean("captureResources", false),
      captureTimings: getBoolean("captureTimings"),
      captureSize: getBoolean("captureSize"),
    };

    try {
      const response = await sendMessageWithResponse("updateConfig", {
        capture: settings,
      });
      showStatus(
        response.success
          ? "Capture settings saved."
          : "Error: " + (response.error || "Failed to save"),
        response.success
      );
    } catch (error) {
      showStatus("Unexpected error: " + error.message, false);
    }
  };

  const loadCaptureSettings = async () => {
    try {
      const response = await sendMessageWithResponse("getConfig");
      const settings = response.config?.capture || {};

      container.querySelector("#captureEnabled").checked =
        settings.captureEnabled ?? false;
      container.querySelector("#maxStoredRequests").value =
        settings.maxStoredRequests ?? 1000;
      container.querySelector("#autoStartCapture").checked =
        settings.autoStartCapture ?? false;
      container.querySelector("#captureHeaders").checked =
        settings.captureHeaders ?? true;
      container.querySelector("#captureRequestBody").checked =
        settings.captureRequestBody ?? true;
      container.querySelector("#captureResponseBody").checked =
        settings.captureResponseBody ?? true;
      container.querySelector("#maxBodySize").value =
        settings.maxBodySize ?? 256;
      container.querySelector("#captureXHR").checked =
        settings.captureXHR ?? true;
      container.querySelector("#captureWebSocket").checked =
        settings.captureWebSocket ?? true;
      container.querySelector("#captureEventSource").checked =
        settings.captureEventSource ?? true;
      container.querySelector("#captureResources").checked =
        settings.captureResources ?? false;
      container.querySelector("#captureTimings").checked =
        settings.captureTimings ?? true;
      container.querySelector("#captureSize").checked =
        settings.captureSize ?? true;
    } catch (error) {
      showStatus("Failed to load settings: " + error.message, false);
    }
  };

  container
    .querySelector("#saveCaptureSettings")
    .addEventListener("click", saveCaptureSettings);
  container
    .querySelector("#resetCaptureSettings")
    .addEventListener("click", () => {
      loadCaptureSettings();
      showStatus("Settings reset to last saved.", true);
    });

  loadCaptureSettings();

  return container;
}
