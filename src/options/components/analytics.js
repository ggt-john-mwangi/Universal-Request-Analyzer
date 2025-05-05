// --- Event-based analytics request/response ---
const pendingAnalyticsRequests = {};
function generateRequestId() {
  return 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

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
  const domainReqId = generateRequestId();
  pendingAnalyticsRequests[domainReqId] = (res) => {
    if (res.success && Array.isArray(res.domains)) {
      const select = filterRow.querySelector('#analytics-domain-select');
      res.domains.forEach(d => {
        const o = document.createElement('option'); o.value = d; o.textContent = d; select.appendChild(o);
      });
    }
  };
  chrome.runtime.sendMessage({ action: 'getDistinctDomains', requestId: domainReqId });

  // Populate API selector when domain changes
  filterRow.querySelector('#analytics-domain-select').addEventListener('change', function() {
    const domain = this.value;
    const apiSelect = filterRow.querySelector('#analytics-api-select');
    apiSelect.innerHTML = '<option value="">All APIs/Pages</option>';
    if (!domain) return;
    const apiReqId = generateRequestId();
    pendingAnalyticsRequests[apiReqId] = (res) => {
      if (res.success && Array.isArray(res.apis)) {
        res.apis.forEach(api => {
          const o = document.createElement('option'); o.value = api; o.textContent = api; apiSelect.appendChild(o);
        });
      }
    };
    chrome.runtime.sendMessage({ action: 'getDistinctApis', domain, requestId: apiReqId });
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

  // Add advanced filter controls to the sidebar
  const advancedFilters = document.createElement('div');
  advancedFilters.className = 'controls-container';
  advancedFilters.innerHTML = `
    <div class="control-group">
      <label for="analytics-method-select">HTTP Method</label>
      <select id="analytics-method-select"><option value="">All Methods</option></select>
    </div>
    <div class="control-group">
      <label for="analytics-status-select">Status Code</label>
      <select id="analytics-status-select"><option value="">All Statuses</option></select>
    </div>
  `;
  container.insertBefore(advancedFilters, controls);

  // Populate HTTP method and status code dropdowns from DB
  function populateMethodAndStatusFilters() {
    // Methods
    const methodReqId = generateRequestId();
    pendingAnalyticsRequests[methodReqId] = (res) => {
      const select = advancedFilters.querySelector('#analytics-method-select');
      if (res.success && Array.isArray(res.values)) {
        res.values.forEach(method => {
          const o = document.createElement('option'); o.value = method; o.textContent = method; select.appendChild(o);
        });
      }
    };
    chrome.runtime.sendMessage({ action: 'getDistinctValues', field: 'method', requestId: methodReqId });
    // Status codes
    const statusReqId = generateRequestId();
    pendingAnalyticsRequests[statusReqId] = (res) => {
      const select = advancedFilters.querySelector('#analytics-status-select');
      if (res.success && Array.isArray(res.values)) {
        res.values.forEach(status => {
          const o = document.createElement('option'); o.value = status; o.textContent = status; select.appendChild(o);
        });
      }
    };
    chrome.runtime.sendMessage({ action: 'getDistinctValues', field: 'status', requestId: statusReqId });
  }
  populateMethodAndStatusFilters();

  // Update analytics when method or status changes
  advancedFilters.querySelector('#analytics-method-select').addEventListener('change', loadAnalytics);
  advancedFilters.querySelector('#analytics-status-select').addEventListener('change', loadAnalytics);

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
  const domainControlReqId = generateRequestId();
  pendingAnalyticsRequests[domainControlReqId] = (res) => {
    if (res.success && Array.isArray(res.domains)) {
      const select = controls.querySelector('#analytics-domain');
      res.domains.forEach(d => {
        const o = document.createElement('option'); o.value = d; o.textContent = d; select.appendChild(o);
      });
    }
  };
  chrome.runtime.sendMessage({ action: 'getDistinctDomains', requestId: domainControlReqId });

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.requestId && pendingAnalyticsRequests[message.requestId]) {
        pendingAnalyticsRequests[message.requestId](message);
        delete pendingAnalyticsRequests[message.requestId];
      }
    });
  }

  // Handler to load and render
  async function loadAnalytics() {
    if (typeof Chart === 'undefined') {
      console.error('Chart.js is not loaded. Please ensure lib/chart.min.js is included in options.html.');
      summary.innerHTML = '<div class="error">Chart.js not loaded. Charts cannot be displayed.</div>';
      return;
    }
    // Fetch config/features for ACL/feature gating
    let features = {}, config = {};
    const configReqId = generateRequestId();
    pendingAnalyticsRequests[configReqId] = (res) => {
      // --- FIX: Always default to all features ON if not present ---
      config = res && res.config ? res.config : {};
      features = res && res.features ? res.features : {
        statistics: true,
        visualization: true,
        performanceTimings: true
      };
      renderAnalytics();
    };
    chrome.runtime.sendMessage({ action: 'getConfig', requestId: configReqId });

    function renderAnalytics() {
      const start = controls.querySelector('#analytics-start-date').value;
      const end = controls.querySelector('#analytics-end-date').value;
      const domain = filterRow.querySelector('#analytics-domain-select').value;
      const api = filterRow.querySelector('#analytics-api-select').value;
      const types = Array.from(controls.querySelectorAll('#analytics-types input:checked')).map(i => i.value);
      const method = advancedFilters.querySelector('#analytics-method-select').value;
      const status = advancedFilters.querySelector('#analytics-status-select').value;
      // If domain is selected, fetch APIs/pages for that domain
      if (domain) {
        const apiReqId = generateRequestId();
        pendingAnalyticsRequests[apiReqId] = (res) => {
          const apiSelect = filterRow.querySelector('#analytics-api-select');
          apiSelect.innerHTML = '<option value="">All APIs/Pages</option>';
          if (res.success && Array.isArray(res.apis)) {
            res.apis.forEach(apiVal => {
              const o = document.createElement('option'); o.value = apiVal; o.textContent = apiVal; apiSelect.appendChild(o);
            });
          }
          if (api) apiSelect.value = api;
        };
        chrome.runtime.sendMessage({ action: 'getDistinctApis', domain, requestId: apiReqId });
      }
      // Filters for stats call
      const filters = { domain, types };
      if (start) filters.startTime = new Date(start).getTime();
      if (end) filters.endTime = new Date(end).getTime() + 86400000 - 1;
      if (domain) filters.domain = domain;
      if (api) filters.api = api;
      if (method) filters.method = method;
      if (status) filters.status = status;
      // Event-based request (no callback)
      const requestId = generateRequestId();
      pendingAnalyticsRequests[requestId] = (stats) => {
        if (!stats || stats.error) {
          summary.innerHTML = `<div class='error'>${stats?.error || 'No analytics data.'}</div>`;
          return;
        }
        // Feature/ACL gating
        const canViewPerf = (features.performanceTimings ?? true) && (config.capture?.includeTiming ?? true);
        const canViewApi = features.statistics ?? true;
        // --- UI/UX: Hide or show plots based on features/ACLs and visualization checkboxes ---
        const showSummary = controls.querySelector('#toggle-summary').checked;
        const showResponse = controls.querySelector('#toggle-response').checked;
        const showStatus = controls.querySelector('#toggle-status').checked;
        const showTypes = controls.querySelector('#toggle-types').checked;
        const showTimeDist = controls.querySelector('#toggle-time-dist').checked;
        const showSizeDist = controls.querySelector('#toggle-size-dist').checked;
        const showPerf = controls.querySelector('#toggle-perf').checked;
        const showTable = controls.querySelector('#toggle-table').checked;
        summary.style.display = showSummary ? 'block' : 'none';
        responseDiv.style.display = canViewApi && showResponse ? 'block' : 'none';
        statusDiv.style.display = canViewApi && showStatus ? 'block' : 'none';
        typesDiv.style.display = canViewApi && showTypes ? 'block' : 'none';
        timeDistDiv.style.display = canViewApi && showTimeDist ? 'block' : 'none';
        sizeDistDiv.style.display = canViewApi && showSizeDist ? 'block' : 'none';
        perfDiv.style.display = canViewPerf && showPerf ? 'block' : 'none';
        tableContainer.style.display = showTable ? 'block' : 'none';
        // --- Summary ---
        summary.innerHTML = `
          <div><strong>Total:</strong> ${stats.requestCount}</div>
          <div><strong>Avg Time:</strong> ${stats.avgResponseTime ? stats.avgResponseTime.toFixed(2) : 0} ms</div>
          <div><strong>Success Rate:</strong> ${stats.successRate ? stats.successRate.toFixed(1) : 0}%</div>
        `;
        // --- Response Time Plot (API/Performance) ---
        const rtCanvas = document.getElementById('analytics-chart-response');
        if (responseChart) responseChart.destroy();
        if (api && stats.apiResponseTimes && stats.apiResponseTimes[api]) {
          const apiData = stats.apiResponseTimes[api];
          responseChart = new Chart(rtCanvas.getContext('2d'), {
            type: 'line',
            data: {
              labels: apiData.timestamps || [],
              datasets: [{ label: api, data: apiData.durations || [], borderColor: '#0066cc', fill: false }]
            },
            options: { plugins: { title: { display: true, text: `Response Time for ${api}` } } }
          });
        } else {
          responseChart = new Chart(rtCanvas.getContext('2d'), {
            type: 'line',
            data: {
              labels: stats.responseTimesData?.timestamps || [],
              datasets: [{ label: 'Response Time', data: stats.responseTimesData?.durations || [], borderColor: '#0066cc', fill: false }]
            },
            options: { plugins: { title: { display: true, text: 'Response Times (Last 100)' } } }
          });
        }
        // --- Status Code Distribution ---
        const scCanvas = document.getElementById('analytics-chart-status');
        if (statusChart) statusChart.destroy();
        statusChart = new Chart(scCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: (stats.statusCodes || []).map(c => c.status),
            datasets: [{ label: 'Count', data: (stats.statusCodes || []).map(c => c.count), backgroundColor: '#4caf50' }]
          },
          options: { plugins: { title: { display: true, text: 'Status Code Distribution' } } }
        });
        // --- Request Type Distribution ---
        const tpCanvas = document.getElementById('analytics-chart-types');
        if (typeChart) typeChart.destroy();
        typeChart = new Chart(tpCanvas.getContext('2d'), {
          type: 'pie',
          data: {
            labels: (stats.requestTypes || []).map(t => t.type),
            datasets: [{ label: 'Count', data: (stats.requestTypes || []).map(t => t.count), backgroundColor: '#ff9800' }]
          },
          options: { plugins: { title: { display: true, text: 'Request Type Distribution' } } }
        });
        // --- Time Distribution (Histogram) ---
        const tdCanvas = document.getElementById('analytics-chart-time-dist');
        if (window.timeDistChart) window.timeDistChart.destroy();
        if (stats.timeDistribution) {
          window.timeDistChart = new Chart(tdCanvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: stats.timeDistribution.bins || [],
              datasets: [{ label: 'Requests', data: stats.timeDistribution.counts || [], backgroundColor: '#2196f3' }]
            },
            options: { plugins: { title: { display: true, text: 'Time Distribution' } } }
          });
        }
        // --- Size Distribution (Histogram) ---
        const szCanvas = document.getElementById('analytics-chart-size-dist');
        if (window.sizeDistChart) window.sizeDistChart.destroy();
        if (stats.sizeDistribution) {
          window.sizeDistChart = new Chart(szCanvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: stats.sizeDistribution.bins || [],
              datasets: [{ label: 'Requests', data: stats.sizeDistribution.counts || [], backgroundColor: '#8bc34a' }]
            },
            options: { plugins: { title: { display: true, text: 'Size Distribution' } } }
          });
        }
        // --- Performance Timings (DNS, TCP, SSL, TTFB, Download) ---
        const pfCanvas = document.getElementById('analytics-chart-perf');
        if (window.perfChart) window.perfChart.destroy();
        if (canViewPerf && stats.avgTimings) {
          window.perfChart = new Chart(pfCanvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: ['DNS', 'TCP', 'SSL', 'TTFB', 'Download'],
              datasets: [{
                label: 'Avg (ms)',
                data: [stats.avgTimings.dns, stats.avgTimings.tcp, stats.avgTimings.ssl, stats.avgTimings.ttfb, stats.avgTimings.download],
                backgroundColor: ['#3f51b5', '#009688', '#e91e63', '#ffc107', '#607d8b']
              }]
            },
            options: { plugins: { title: { display: true, text: 'Avg Performance Timings' } } }
          });
        }
        // --- Table (Raw Requests) ---
        const tbody = tableContainer.querySelector('tbody');
        tbody.innerHTML = '';
        const tableReqId = generateRequestId();
        pendingAnalyticsRequests[tableReqId] = (resp) => {
          if (resp && Array.isArray(resp.requests)) {
            resp.requests.forEach(r => {
              const tr = document.createElement('tr');
              tr.innerHTML = `<td>${new Date(r.timestamp).toLocaleString()}</td><td>${r.domain}</td><td>${r.type}</td><td>${r.status}</td><td>${r.duration}</td>`;
              tbody.appendChild(tr);
            });
          }
        };
        chrome.runtime.sendMessage({ action: 'getRequests', filters, page: 1, limit: 50, requestId: tableReqId });
      };
      chrome.runtime.sendMessage({ action: 'getFilteredStats', filters, requestId });
    }
  }

  // Event
  controls.querySelector('#analytics-apply').addEventListener('click', loadAnalytics);
  // Initial load
  loadAnalytics();

  return container;
}