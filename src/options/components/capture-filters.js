export default function renderCaptureFilters() {
  const container = document.createElement("div");
  container.innerHTML = `
    <h2>Capture Filters</h2>
    <div class="option-row">
      <label>Request Types to Capture:</label>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="xmlhttprequest"> XHR
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="fetch"> Fetch
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="script"> Script
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="stylesheet"> Stylesheet
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="image"> Image
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="font"> Font
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="other"> Other
        </label>
      </div>
    </div>
    <div class="option-row">
      <label for="includeDomains">Include Domains (comma separated):</label>
      <input type="text" id="includeDomains" placeholder="Leave empty to include all">
    </div>
    <div class="option-row">
      <label for="excludeDomains">Exclude Domains (comma separated):</label>
      <input type="text" id="excludeDomains" placeholder="Leave empty to exclude none">
    </div>
  `;

  // --- Event-based Save/Load for Capture Filters ---
  function showStatus(message, success = true) {
    let status = document.getElementById('captureFiltersStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'captureFiltersStatus';
      status.className = 'status-message';
      container.appendChild(status);
    }
    status.textContent = message;
    status.style.display = 'block';
    status.style.color = success ? 'green' : 'red';
    setTimeout(() => { status.style.display = 'none'; }, 3000);
  }

  function saveCaptureFilters() {
    const types = Array.from(container.querySelectorAll('input[name="captureType"]:checked')).map(i => i.value);
    const includeDomains = container.querySelector('#includeDomains').value;
    const excludeDomains = container.querySelector('#excludeDomains').value;
    const filters = { includeTypes: types, includeDomains: includeDomains.split(',').map(s => s.trim()).filter(Boolean), excludeDomains: excludeDomains.split(',').map(s => s.trim()).filter(Boolean) };
    const requestId = 'saveFilters_' + Date.now();
    chrome.runtime.sendMessage({ action: 'updateConfig', data: { captureFilters: filters }, requestId });
    function handler(msg) {
      if (msg.requestId === requestId) {
        showStatus(msg.success ? 'Capture filters saved.' : ('Error: ' + (msg.error || 'Failed to save')), msg.success);
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  }

  function loadCaptureFilters() {
    const requestId = 'loadFilters_' + Date.now();
    chrome.runtime.sendMessage({ action: 'getConfig', requestId });
    function handler(msg) {
      if (msg.requestId === requestId && msg.config) {
        const filters = msg.config.captureFilters || {};
        (filters.includeTypes || []).forEach(type => {
          const cb = container.querySelector(`input[name="captureType"][value="${type}"]`);
          if (cb) cb.checked = true;
        });
        container.querySelector('#includeDomains').value = (filters.includeDomains || []).join(', ');
        container.querySelector('#excludeDomains').value = (filters.excludeDomains || []).join(', ');
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  }

  // Attach event listeners for Save/Reset (event-based)
  let saveBtn = container.querySelector('#saveCaptureFilters');
  let resetBtn = container.querySelector('#resetCaptureFilters');
  if (!saveBtn || !resetBtn) {
    const actions = document.createElement('div');
    actions.className = 'settings-actions';
    actions.innerHTML = `
      <button id="saveCaptureFilters" class="primary-btn">Save Filters</button>
      <button id="resetCaptureFilters" class="secondary-btn">Reset Filters</button>
    `;
    container.appendChild(actions);
    saveBtn = actions.querySelector('#saveCaptureFilters');
    resetBtn = actions.querySelector('#resetCaptureFilters');
  }
  saveBtn.addEventListener('click', saveCaptureFilters);
  resetBtn.addEventListener('click', () => { loadCaptureFilters(); showStatus('Filters reset to last saved.', true); });

  // Initial load
  loadCaptureFilters();

  return container;
}
