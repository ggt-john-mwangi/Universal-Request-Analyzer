// Analytics component for Options page
export default function renderAnalyticsSection() {
  // Container
  const container = document.createElement('div');
  container.className = 'analytics-container';

  // Add domain and API/page selectors at the top
  const filterRow = document.createElement('div');
  filterRow.className = 'controls-container';
  filterRow.innerHTML = `
    <div class="control-group">
      <label for="analytics-domain-select">Domain</label>
      <select id="analytics-domain-select"><option value="">All Domains</option></select>
    </div>
    <div class="control-group">
      <label for="analytics-api-select">API/Page</label>
      <select id="analytics-api-select"><option value="">All APIs/Pages</option></select>
    </div>
  `;
  container.prepend(filterRow);

  // Populate domain selector
  chrome.runtime.sendMessage({ action: 'getDistinctDomains' }, res => {
    if (res.success && Array.isArray(res.domains)) {
      const select = filterRow.querySelector('#analytics-domain-select');
      res.domains.forEach(d => {
        const o = document.createElement('option'); o.value = d; o.textContent = d; select.appendChild(o);
      });
    }
  });

  // Populate API selector when domain changes
  filterRow.querySelector('#analytics-domain-select').addEventListener('change', function() {
    const domain = this.value;
    const apiSelect = filterRow.querySelector('#analytics-api-select');
    apiSelect.innerHTML = '<option value="">All APIs/Pages</option>';
    if (!domain) return;
    chrome.runtime.sendMessage({ action: 'getDistinctApis', domain }, res => {
      if (res.success && Array.isArray(res.apis)) {
        res.apis.forEach(api => {
          const o = document.createElement('option'); o.value = api; o.textContent = api; apiSelect.appendChild(o);
        });
      }
    });
  });

  // Update analytics when domain or API changes
  filterRow.querySelector('#analytics-domain-select').addEventListener('change', loadAnalytics);
  filterRow.querySelector('#analytics-api-select').addEventListener('change', loadAnalytics);

  // Controls: date range, domain filter, request type filter
  const controls = document.createElement('div');
  controls.className = 'controls-container';
  controls.innerHTML = `
    <div class="control-group">
      <label for="analytics-start-date">Start Date</label>
      <input type="date" id="analytics-start-date">
    </div>
    <div class="control-group">
      <label for="analytics-end-date">End Date</label>
      <input type="date" id="analytics-end-date">
    </div>
    <div class="control-group">
      <label for="analytics-domain">Domain</label>
      <select id="analytics-domain">
        <option value="">All Domains</option>
      </select>
    </div>
    <div class="control-group">
      <label>Request Types</label>
      <div id="analytics-types" class="checkbox-group">
        <label class="checkbox-label"><input type="checkbox" value="xmlhttprequest" checked>XHR</label>
        <label class="checkbox-label"><input type="checkbox" value="fetch" checked>Fetch</label>
        <label class="checkbox-label"><input type="checkbox" value="script" checked>Script</label>
        <label class="checkbox-label"><input type="checkbox" value="stylesheet" checked>Stylesheet</label>
        <label class="checkbox-label"><input type="checkbox" value="image" checked>Image</label>
        <label class="checkbox-label"><input type="checkbox" value="font" checked>Font</label>
        <label class="checkbox-label"><input type="checkbox" value="other" checked>Other</label>
      </div>
    </div>
    <div class="control-group">
      <label>Visualizations</label>
      <div class="checkbox-group">
        <label class="checkbox-label"><input type="checkbox" id="toggle-summary" checked> Summary Stats</label>
        <label class="checkbox-label"><input type="checkbox" id="toggle-response" checked> Response Time Chart</label>
        <label class="checkbox-label"><input type="checkbox" id="toggle-status" checked> Status Codes Chart</label>
        <label class="checkbox-label"><input type="checkbox" id="toggle-types" checked> Request Types Chart</label>
        <label class="checkbox-label"><input type="checkbox" id="toggle-time-dist" checked> Time Distribution Chart</label>
        <label class="checkbox-label"><input type="checkbox" id="toggle-size-dist" checked> Size Distribution Chart</label>
        <label class="checkbox-label"><input type="checkbox" id="toggle-perf" checked> Performance Timings Chart</label>
        <label class="checkbox-label"><input type="checkbox" id="toggle-table" checked> Raw Data Table</label>
      </div>
    </div>
    <div class="control-group">
      <button id="analytics-apply">Apply Filters</button>
    </div>
  `;
  container.appendChild(controls);

  // Summary stats
  const summary = document.createElement('div');
  summary.id = 'analytics-summary';
  summary.className = 'chart-container';
  container.appendChild(summary);

  // Individual chart containers for toggle control
  const responseDiv = document.createElement('div');
  responseDiv.id = 'chart-response';
  responseDiv.className = 'chart-container';
  responseDiv.innerHTML = `<canvas id="analytics-chart-response"></canvas>`;
  container.appendChild(responseDiv);

  const statusDiv = document.createElement('div');
  statusDiv.id = 'chart-status';
  statusDiv.className = 'chart-container';
  statusDiv.innerHTML = `<canvas id="analytics-chart-status"></canvas>`;
  container.appendChild(statusDiv);

  const typesDiv = document.createElement('div');
  typesDiv.id = 'chart-types';
  typesDiv.className = 'chart-container';
  typesDiv.innerHTML = `<canvas id="analytics-chart-types"></canvas>`;
  container.appendChild(typesDiv);

  const timeDistDiv = document.createElement('div');
  timeDistDiv.id = 'chart-time-dist';
  timeDistDiv.className = 'chart-container';
  timeDistDiv.innerHTML = `<canvas id="analytics-chart-time-dist"></canvas>`;
  container.appendChild(timeDistDiv);

  const sizeDistDiv = document.createElement('div');
  sizeDistDiv.id = 'chart-size-dist';
  sizeDistDiv.className = 'chart-container';
  sizeDistDiv.innerHTML = `<canvas id="analytics-chart-size-dist"></canvas>`;
  container.appendChild(sizeDistDiv);

  const perfDiv = document.createElement('div');
  perfDiv.id = 'chart-perf';
  perfDiv.className = 'chart-container';
  perfDiv.innerHTML = `<canvas id="analytics-chart-perf"></canvas>`;
  container.appendChild(perfDiv);

  // Raw data table
  const tableContainer = document.createElement('div');
  tableContainer.id = 'table-raw';
  tableContainer.className = 'chart-container';
  tableContainer.innerHTML = `
    <h3>Raw Requests</h3>
    <table id="analytics-table">
      <thead><tr><th>Time</th><th>Domain</th><th>Type</th><th>Status</th><th>Duration (ms)</th></tr></thead>
      <tbody></tbody>
    </table>
  `;
  container.appendChild(tableContainer);

  // State for charts
  let responseChart, statusChart, typeChart;

  // Fetch domains
  chrome.runtime.sendMessage({ action: 'getDistinctDomains' }, res => {
    if (res.success && Array.isArray(res.domains)) {
      const select = controls.querySelector('#analytics-domain');
      res.domains.forEach(d => {
        const o = document.createElement('option'); o.value = d; o.textContent = d; select.appendChild(o);
      });
    }
  });

  // Handler to load and render
  async function loadAnalytics() {
    const start = controls.querySelector('#analytics-start-date').value;
    const end = controls.querySelector('#analytics-end-date').value;
    const domain = filterRow.querySelector('#analytics-domain-select').value;
    const api = filterRow.querySelector('#analytics-api-select').value;
    const types = Array.from(controls.querySelectorAll('#analytics-types input:checked')).map(i => i.value);

    const filters = { domain, types };
    if (start) filters.startTime = new Date(start).getTime();
    if (end) filters.endTime = new Date(end).getTime() + 86400000 - 1;
    if (domain) filters.domain = domain;
    if (api) filters.api = api;

    chrome.runtime.sendMessage({ action: 'getFilteredStats', filters }, stats => {
      if (!stats || stats.error) return;
      // Summary
      summary.innerHTML = `
        <div><strong>Total:</strong> ${stats.requestCount}</div>
        <div><strong>Avg Time:</strong> ${stats.avgResponseTime.toFixed(2)} ms</div>
        <div><strong>Success Rate:</strong> ${stats.successRate.toFixed(1)}%</div>
      `;
      // Charts
      const rtCtx = document.getElementById('analytics-chart-response').getContext('2d');
      const scCtx = document.getElementById('analytics-chart-status').getContext('2d');
      const tpCtx = document.getElementById('analytics-chart-types').getContext('2d');
      if (responseChart) responseChart.destroy();
      responseChart = new Chart(rtCtx, { type: 'line', data: { labels: stats.responseTimesData.timestamps, datasets: [{ label: 'Response Time', data: stats.responseTimesData.durations, borderColor: '#0066cc' }] } });
      if (statusChart) statusChart.destroy();
      statusChart = new Chart(scCtx, { type: 'bar', data: { labels: stats.statusCodes.map(c => c.status), datasets: [{ label: 'Count', data: stats.statusCodes.map(c => c.count), backgroundColor: '#4caf50' }] } });
      if (typeChart) typeChart.destroy();
      typeChart = new Chart(tpCtx, { type: 'bar', data: { labels: stats.requestTypes.map(t => t.type), datasets: [{ label: 'Count', data: stats.requestTypes.map(t => t.count), backgroundColor: '#ff9800' }] } });

      // TODO: Add chart rendering for timeDistDiv, sizeDistDiv, perfDiv if data available

      // Toggle display based on checkboxes
      const showSummary = controls.querySelector('#toggle-summary').checked;
      const showResponse = controls.querySelector('#toggle-response').checked;
      const showStatus = controls.querySelector('#toggle-status').checked;
      const showTypes = controls.querySelector('#toggle-types').checked;
      const showTimeDist = controls.querySelector('#toggle-time-dist').checked;
      const showSizeDist = controls.querySelector('#toggle-size-dist').checked;
      const showPerf = controls.querySelector('#toggle-perf').checked;
      const showTable = controls.querySelector('#toggle-table').checked;
      summary.style.display = showSummary ? 'block' : 'none';
      responseDiv.style.display = showResponse ? 'block' : 'none';
      statusDiv.style.display = showStatus ? 'block' : 'none';
      typesDiv.style.display = showTypes ? 'block' : 'none';
      timeDistDiv.style.display = showTimeDist ? 'block' : 'none';
      sizeDistDiv.style.display = showSizeDist ? 'block' : 'none';
      perfDiv.style.display = showPerf ? 'block' : 'none';
      tableContainer.style.display = showTable ? 'block' : 'none';

      // Table
      const tbody = tableContainer.querySelector('tbody');
      tbody.innerHTML = '';
      // get raw requests for table – use limited SQL call
      chrome.runtime.sendMessage({ action: 'getRequests', filters, page: 1, limit: 50 }, resp => {
        if (resp && Array.isArray(resp)) {
          resp.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date(r.timestamp).toLocaleString()}</td><td>${r.domain}</td><td>${r.type}</td><td>${r.status}</td><td>${r.duration}</td>`;
            tbody.appendChild(tr);
          });
        }
      });
    });
  }

  // Event
  controls.querySelector('#analytics-apply').addEventListener('click', loadAnalytics);
  // Initial load
  loadAnalytics();

  return container;
}