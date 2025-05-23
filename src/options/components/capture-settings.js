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

  // Show status message
  function showStatus(message, success = true) {
    let status = document.getElementById('captureSettingsStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'captureSettingsStatus';
      status.className = 'status-message';
      container.appendChild(status);
    }
    status.textContent = message;
    status.style.display = 'block';
    status.style.color = success ? 'green' : 'red';
    setTimeout(() => { status.style.display = 'none'; }, 3000);
  }

  // Save settings
  function saveCaptureSettings() {
    const settings = {
      captureEnabled: document.getElementById('captureEnabled').checked,
      maxStoredRequests: parseInt(document.getElementById('maxStoredRequests').value, 10),
      autoStartCapture: document.getElementById('autoStartCapture').checked,
      captureHeaders: document.getElementById('captureHeaders')?.checked ?? true,
      captureRequestBody: document.getElementById('captureRequestBody')?.checked ?? true,
      captureResponseBody: document.getElementById('captureResponseBody')?.checked ?? true,
      maxBodySize: parseInt(document.getElementById('maxBodySize')?.value, 10) || 0,
      captureXHR: document.getElementById('captureXHR')?.checked ?? true,
      captureWebSocket: document.getElementById('captureWebSocket')?.checked ?? true,
      captureEventSource: document.getElementById('captureEventSource')?.checked ?? true,
      captureResources: document.getElementById('captureResources')?.checked ?? false,
      captureTimings: document.getElementById('captureTimings')?.checked ?? true,
      captureSize: document.getElementById('captureSize')?.checked ?? true,
    };
    const requestId = 'saveCapture_' + Date.now();
    chrome.runtime.sendMessage({ action: 'updateConfig', data: { capture: settings }, requestId });
    function handler(msg) {
      if (msg.requestId === requestId) {
        showStatus(msg.success ? 'Capture settings saved.' : ('Error: ' + (msg.error || 'Failed to save')), msg.success);
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  }

  // Load settings
  function loadCaptureSettings() {
    const requestId = 'loadCapture_' + Date.now();
    chrome.runtime.sendMessage({ action: 'getConfig', requestId });
    function handler(msg) {
      if (msg.requestId === requestId && msg.config) {
        const settings = msg.config.capture || {};
        document.getElementById('captureEnabled').checked = settings.captureEnabled ?? false;
        document.getElementById('maxStoredRequests').value = settings.maxStoredRequests ?? 1000;
        document.getElementById('autoStartCapture').checked = settings.autoStartCapture ?? false;
        document.getElementById('captureHeaders').checked = settings.captureHeaders ?? true;
        document.getElementById('captureRequestBody').checked = settings.captureRequestBody ?? true;
        document.getElementById('captureResponseBody').checked = settings.captureResponseBody ?? true;
        document.getElementById('maxBodySize').value = settings.maxBodySize ?? 256;
        document.getElementById('captureXHR').checked = settings.captureXHR ?? true;
        document.getElementById('captureWebSocket').checked = settings.captureWebSocket ?? true;
        document.getElementById('captureEventSource').checked = settings.captureEventSource ?? true;
        document.getElementById('captureResources').checked = settings.captureResources ?? false;
        document.getElementById('captureTimings').checked = settings.captureTimings ?? true;
        document.getElementById('captureSize').checked = settings.captureSize ?? true;
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  }

  // Reset settings to defaults
  function resetSettings() {
    loadCaptureSettings();
    showStatus('Settings reset to last saved.', true);
  }

  // Initialize component
  container.querySelector('#saveCaptureSettings').addEventListener('click', saveCaptureSettings);
  container.querySelector('#resetCaptureSettings').addEventListener('click', resetSettings);

  // Initial load
  loadCaptureSettings();
  // Always reload from backend/database on reset
  container.querySelector('#resetCaptureSettings').addEventListener('click', resetSettings);

  return container;
}
