// Capture settings component for options page
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
    captureEnabled: false, // Changed from true to false - disabled by default
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
    // ...existing code...
  }

  // Show status message
  function showStatus(message, success = true) {
    // ...existing code...
  }

  // Enable/disable settings based on capture enabled state
  function updateSettingsAvailability(enabled) {
    // ...existing code...
  }

  // Save settings
  async function saveCaptureSettings() {
    // ...existing code...
  }

  // Load settings
  async function loadSettings() {
    // ...existing code...
  }

  // Reset settings to defaults
  async function resetSettings() {
    // ...existing code...
  }

  // Initialize component
  attachEventListeners();
  loadSettings();

  return container;
}
