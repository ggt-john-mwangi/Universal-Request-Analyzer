export default function renderAutoExport() {
  const container = document.createElement("div");
  container.innerHTML = `
    <h2>Auto Export</h2>
    <div class="option-row">
      <label>
        <input type="checkbox" id="autoExport">
        Enable Auto Export
      </label>
    </div>
    <div class="option-row">
      <label for="exportFormat">Export Format:</label>
      <select id="autoExportFormat">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        <option value="sqlite">SQLite</option>
      </select>
    </div>
    <div class="option-row">
      <label for="exportInterval">Export Interval (minutes):</label>
      <input type="number" id="autoExportInterval" min="5" max="1440" step="5">
    </div>
    <div class="option-row">
      <label for="exportPath">Export Directory (optional):</label>
      <input type="text" id="autoExportPath" placeholder="Default downloads directory">
    </div>
  `;

  // --- Event-based Save/Load for Auto Export Settings ---
  function showStatus(message, success = true) {
    let status = document.getElementById('autoExportStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'autoExportStatus';
      status.className = 'status-message';
      container.appendChild(status);
    }
    status.textContent = message;
    status.style.display = 'block';
    status.style.color = success ? 'green' : 'red';
    setTimeout(() => { status.style.display = 'none'; }, 3000);
  }

  function saveAutoExportSettings() {
    const settings = {
      autoExport: document.getElementById('autoExport').checked,
      exportFormat: document.getElementById('autoExportFormat').value,
      exportInterval: parseInt(document.getElementById('autoExportInterval').value, 10) * 60000,
      exportPath: document.getElementById('autoExportPath').value.trim(),
    };
    const requestId = 'saveAutoExport_' + Date.now();
    chrome.runtime.sendMessage({ action: 'updateConfig', data: { export: settings }, requestId });
    function handler(msg) {
      if (msg.requestId === requestId) {
        showStatus(msg.success ? 'Auto export settings saved.' : ('Error: ' + (msg.error || 'Failed to save')), msg.success);
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  }

  function loadAutoExportSettings() {
    const requestId = 'loadAutoExport_' + Date.now();
    chrome.runtime.sendMessage({ action: 'getConfig', requestId });
    function handler(msg) {
      if (msg.requestId === requestId && msg.config) {
        const settings = msg.config.export || {};
        document.getElementById('autoExport').checked = settings.autoExport ?? false;
        document.getElementById('autoExportFormat').value = settings.exportFormat || 'json';
        document.getElementById('autoExportInterval').value = (settings.exportInterval || 86400000) / 60000;
        document.getElementById('autoExportPath').value = settings.exportPath || '';
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  }

  // Attach event listeners
  container.querySelector('#autoExport').addEventListener('change', saveAutoExportSettings);
  container.querySelector('#autoExportFormat').addEventListener('change', saveAutoExportSettings);
  container.querySelector('#autoExportInterval').addEventListener('change', saveAutoExportSettings);
  container.querySelector('#autoExportPath').addEventListener('change', saveAutoExportSettings);

  // Initial load
  loadAutoExportSettings();

  return container;
}
