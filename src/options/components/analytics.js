// --- Event-based analytics request/response ---
const pendingAnalyticsRequests = {};
function generateRequestId() {
  return 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Ensure main analytics section uses the correct container
const analyticsSection = document.getElementById('analytics-section');
if (analyticsSection) {
  analyticsSection.classList.add('analytics-container');
}

// Analytics component for Options page
export default function renderAnalyticsSection() {
  console.log('[Analytics] renderAnalyticsSection mounted');
  // Container
  const container = document.createElement('div');
  container.className = 'analytics-container';

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
      <label for="analytics-domain-select">Domain</label>
      <select id="analytics-domain-select" class="analytics-select"><option value="">All Domains</option></select>
    </div>
    <div class="control-group">
      <label for="analytics-api-select">API/Page</label>
      <select id="analytics-api-select" class="analytics-select"><option value="">All APIs/Pages</option></select>
    </div>
    <div class="control-group">
      <label for="analytics-method-select">HTTP Method</label>
      <select id="analytics-method-select"><option value="">All Methods</option></select>
    </div>
    <div class="control-group">
      <label for="analytics-status-select">Status Code</label>
      <select id="analytics-status-select"><option value="">All Statuses</option></select>
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
      <button id="analytics-apply">Apply Filters</button>
    </div>
  `;
  container.appendChild(controls);

  // --- Section containers for each tab ---
  const analysisSection = document.createElement('div');
  analysisSection.className = 'analytics-tab-section';
  analysisSection.style.display = 'block';
  const perfSection = document.createElement('div');
  perfSection.className = 'analytics-tab-section';
  perfSection.style.display = 'none';
  container.appendChild(analysisSection);
  container.appendChild(perfSection);

  // --- Chart tabs for analysis ---
  const analysisChartTabs = document.createElement('div');
  analysisChartTabs.className = 'chart-tabs';
  const analysisCharts = [
    { id: 'apiOverTime', label: 'API Requests Over Time' },
    { id: 'status', label: 'Status Codes' },
    { id: 'type', label: 'Request Types' },
    { id: 'timeDist', label: 'Time Distribution' },
    { id: 'sizeDist', label: 'Size Distribution' }
  ];
  let activeAnalysisChart = 'apiOverTime';
  // Store refs for logic
  const visualizationCheckboxes = {};
  analysisCharts.forEach(chart => {
    const btn = document.createElement('button');
    btn.textContent = chart.label;
    btn.className = 'chart-tab-btn' + (chart.id === activeAnalysisChart ? ' active' : '');
    btn.onclick = () => {
      if (!visualizationCheckboxes[chart.id] || !visualizationCheckboxes[chart.id].checked) return; // Only allow if enabled
      activeAnalysisChart = chart.id;
      updateAnalysisChartUI();
    };
    btn.id = 'analysis-' + chart.id;
    analysisChartTabs.appendChild(btn);
  });
  analysisSection.appendChild(analysisChartTabs);

  // --- Visualizations filter group (dynamic, aligned with analysisCharts) ---
  const visualizationsGroup = document.createElement('div');
  visualizationsGroup.className = 'controls-container';
  const visControlGroup = document.createElement('div');
  visControlGroup.className = 'control-group';
  const visLabel = document.createElement('label');
  visLabel.textContent = 'Visualizations';
  visControlGroup.appendChild(visLabel);
  const visCheckboxGroup = document.createElement('div');
  visCheckboxGroup.className = 'checkbox-group';
  analysisCharts.forEach(chart => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'toggle-' + chart.id;
    checkbox.checked = true;
    visualizationCheckboxes[chart.id] = checkbox;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + chart.label));
    visCheckboxGroup.appendChild(label);
    checkbox.addEventListener('change', () => {
      // If disabling the active chart, switch to the next enabled one
      if (!checkbox.checked && activeAnalysisChart === chart.id) {
        const next = analysisCharts.find(c => visualizationCheckboxes[c.id].checked);
        if (next) {
          activeAnalysisChart = next.id;
        } else {
          activeAnalysisChart = null;
        }
      }
      updateAnalysisChartUI();
    });
  });
  visControlGroup.appendChild(visCheckboxGroup);
  visualizationsGroup.appendChild(visControlGroup);
  analysisSection.appendChild(visualizationsGroup);

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

  // --- Chart tabs for performance ---
  const perfChartTabs = document.createElement('div');
  perfChartTabs.className = 'chart-tabs';
  const perfCharts = [
    { id: 'summary', label: 'Summary Stats' },
    { id: 'perf', label: 'Performance Timings' },
    { id: 'waterfall', label: 'Waterfall' },
    { id: 'pageload', label: 'Page Load' },
    { id: 'resource', label: 'Resource Breakdown' }
  ];
  let activePerfChart = 'summary';
  perfCharts.forEach(chart => {
    const btn = document.createElement('button');
    btn.textContent = chart.label;
    btn.className = 'chart-tab-btn' + (chart.id === activePerfChart ? ' active' : '');
    btn.onclick = () => {
      activePerfChart = chart.id;
      updatePerfChartUI();
    };
    btn.id = 'perf-' + chart.id;
    perfChartTabs.appendChild(btn);
  });
  perfSection.appendChild(perfChartTabs);
  // Chart containers for each performance tab
  const waterfallDiv = document.createElement('div');
  waterfallDiv.id = 'chart-waterfall';
  waterfallDiv.className = 'chart-container';
  perfSection.appendChild(waterfallDiv);
  const pageLoadDiv = document.createElement('div');
  pageLoadDiv.id = 'chart-pageload';
  pageLoadDiv.className = 'chart-container';
  perfSection.appendChild(pageLoadDiv);
  const resourceDiv = document.createElement('div');
  resourceDiv.id = 'chart-resource';
  resourceDiv.className = 'chart-container';
  perfSection.appendChild(resourceDiv);
  // Add missing perfDiv for 'Performance Timings'
  const perfDiv = document.createElement('div');
  perfDiv.id = 'chart-perf';
  perfDiv.className = 'chart-container';
  perfSection.appendChild(perfDiv);

  // Add summary and perfDiv as before
  const perfChartDivs = {
    summary,
    perf: perfDiv,
    waterfall: waterfallDiv,
    pageload: pageLoadDiv,
    resource: resourceDiv
  };
  Object.values(perfChartDivs).forEach(div => div.style.display = 'none');
  Object.values(perfChartDivs).forEach(div => perfSection.appendChild(div));

  // --- Chart rendering for analysis tabs ---
  // Define chartDivs for analysis charts (must be after all divs are created)
  const chartDivs = {
    apiOverTime: responseDiv,
    status: statusDiv,
    type: typesDiv,
    timeDist: timeDistDiv,
    sizeDist: sizeDistDiv
  };

  // State for charts
  let responseChart = null, statusChart = null, typeChart = null, timeDistChart = null, sizeDistChart = null, perfChart = null;

  // Fetch domains
  const domainControlReqId = generateRequestId();
  pendingAnalyticsRequests[domainControlReqId] = (res) => {
    if (res.success && Array.isArray(res.domains)) {
      const select = controls.querySelector('#analytics-domain-select');
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
      const domain = controls.querySelector('#analytics-domain-select').value;
      const api = controls.querySelector('#analytics-api-select').value;
      const types = Array.from(controls.querySelectorAll('#analytics-types input:checked')).map(i => i.value);
      const method = controls.querySelector('#analytics-method-select').value;
      const status = controls.querySelector('#analytics-status-select').value;
      // Filters for stats call
      const filters = { domain, types };
      if (start) filters.startTime = new Date(start).getTime();
      if (end) filters.endTime = new Date(end).getTime() + 86400000 - 1;
      if (domain) filters.domain = domain;
      if (api) filters.api = api;
      if (method) filters.method = method;
      if (status) filters.status = status;
      // Debug: log filters and requestId
      const requestId = generateRequestId();
      console.log('[Analytics] Requesting getFilteredStats', filters, requestId);
      pendingAnalyticsRequests[requestId] = (stats) => {
        console.log('[Analytics] Received getFilteredStats response:', stats);
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
        summary.style.display = showSummary ? 'block' : 'none';
        responseDiv.style.display = canViewApi && showResponse ? 'block' : 'none';
        statusDiv.style.display = canViewApi && showStatus ? 'block' : 'none';
        typesDiv.style.display = canViewApi && showTypes ? 'block' : 'none';
        timeDistDiv.style.display = canViewApi && showTimeDist ? 'block' : 'none';
        sizeDistDiv.style.display = canViewApi && showSizeDist ? 'block' : 'none';
        perfDiv.style.display = canViewPerf && showPerf ? 'block' : 'none';
        // --- Summary ---
        summary.innerHTML = `
          <div><strong>Total:</strong> ${stats.requestCount}</div>
          <div><strong>Avg Time:</strong> ${stats.avgResponseTime ? stats.avgResponseTime.toFixed(2) : 0} ms</div>
          <div><strong>Success Rate:</strong> ${stats.successRate ? stats.successRate.toFixed(1) : 0}%</div>
        `;
        // --- Response Time Plot (API/Performance) ---
        const rtCanvas = document.getElementById('analytics-chart-response');
        if (responseChart) { responseChart.destroy(); responseChart = null; }
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
        if (timeDistChart) timeDistChart.destroy();
        if (stats.timeDistribution) {
          timeDistChart = new Chart(tdCanvas.getContext('2d'), {
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
        if (sizeDistChart) sizeDistChart.destroy();
        if (stats.sizeDistribution) {
          sizeDistChart = new Chart(szCanvas.getContext('2d'), {
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
        if (perfChart) perfChart.destroy();
        if (canViewPerf && stats.avgTimings) {
          perfChart = new Chart(pfCanvas.getContext('2d'), {
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
      };
      chrome.runtime.sendMessage({ action: 'getFilteredStats', filters, requestId });
    }
  }

  // --- Tabs for Analysis vs Performance ---
  const tabBar = document.createElement('div');
  tabBar.className = 'analytics-tab-bar';
  const tabs = [
    { id: 'tab-analysis', label: 'Request Analysis' },
    { id: 'tab-performance', label: 'Performance Metrics' }
  ];
  let activeTab = 'tab-analysis';
  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.className = 'analytics-tab-btn' + (tab.id === activeTab ? ' active' : '');
    btn.onclick = () => {
      activeTab = tab.id;
      updateTabUI();
    };
    btn.id = tab.id;
    tabBar.appendChild(btn);
  });
  container.prepend(tabBar);

  // --- Tab UI update logic ---
  function updateTabUI() {
    tabBar.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.id === activeTab));
    analysisSection.style.display = activeTab === 'tab-analysis' ? 'block' : 'none';
    perfSection.style.display = activeTab === 'tab-performance' ? 'block' : 'none';
    // Show visualizationsGroup only in analysis tab
    visualizationsGroup.style.display = activeTab === 'tab-analysis' ? '' : 'none';
    updateAnalysisChartUI();
    updatePerfChartUI();
  }
  function updateAnalysisChartUI() {
    // Hide all chart containers
    Object.entries(chartDivs).forEach(([id, div]) => {
      div.style.display = 'none';
    });
    // Disable all tab buttons
    analysisChartTabs.querySelectorAll('button').forEach(btn => {
      btn.classList.remove('active');
      btn.disabled = !visualizationCheckboxes[btn.id.replace('analysis-', '')]?.checked;
    });
    // If no chart is enabled, exit
    if (!activeAnalysisChart || !visualizationCheckboxes[activeAnalysisChart]?.checked) {
      return;
    }
    // Show only the active chart container
    const activeDiv = chartDivs[activeAnalysisChart];
    if (activeDiv) {
      activeDiv.style.display = 'block';
      // Re-render the chart for the active tab
      if (typeof Chart === 'undefined') {
        activeDiv.innerHTML = '<div class="error">Chart.js not loaded. Charts cannot be displayed.</div>';
        return;
      }
      // Destroy previous chart instance if exists
      if (activeAnalysisChart === 'apiOverTime' && responseChart) { responseChart.destroy(); responseChart = null; }
      if (activeAnalysisChart === 'status' && statusChart) { statusChart.destroy(); statusChart = null; }
      if (activeAnalysisChart === 'type' && typeChart) { typeChart.destroy(); typeChart = null; }
      if (activeAnalysisChart === 'timeDist' && timeDistChart) { timeDistChart.destroy(); timeDistChart = null; }
      if (activeAnalysisChart === 'sizeDist' && sizeDistChart) { sizeDistChart.destroy(); sizeDistChart = null; }
      // Fetch and render chart data for the active tab
      const filters = getCurrentFilters();
      const requestId = generateRequestId();
      pendingAnalyticsRequests[requestId] = (stats) => {
        if (!stats || stats.error) {
          activeDiv.innerHTML = `<div class='error'>${stats?.error || 'No analytics data.'}</div>`;
          return;
        }
        // Render the correct chart for the active tab
        if (activeAnalysisChart === 'apiOverTime') {
          const canvas = activeDiv.querySelector('canvas') || document.createElement('canvas');
          if (!activeDiv.contains(canvas)) activeDiv.innerHTML = '', activeDiv.appendChild(canvas);
          responseChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
              labels: stats.responseTimesData?.timestamps || [],
              datasets: [{ label: 'Response Time', data: stats.responseTimesData?.durations || [], borderColor: '#0066cc', fill: false }]
            },
            options: { plugins: { title: { display: true, text: 'Response Times (Last 100)' } } }
          });
        } else if (activeAnalysisChart === 'status') {
          const canvas = activeDiv.querySelector('canvas') || document.createElement('canvas');
          if (!activeDiv.contains(canvas)) activeDiv.innerHTML = '', activeDiv.appendChild(canvas);
          statusChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: (stats.statusCodes || []).map(c => c.status),
              datasets: [{ label: 'Count', data: (stats.statusCodes || []).map(c => c.count), backgroundColor: '#4caf50' }]
            },
            options: { plugins: { title: { display: true, text: 'Status Code Distribution' } } }
          });
        } else if (activeAnalysisChart === 'type') {
          const canvas = activeDiv.querySelector('canvas') || document.createElement('canvas');
          if (!activeDiv.contains(canvas)) activeDiv.innerHTML = '', activeDiv.appendChild(canvas);
          typeChart = new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
              labels: (stats.requestTypes || []).map(t => t.type),
              datasets: [{ label: 'Count', data: (stats.requestTypes || []).map(t => t.count), backgroundColor: '#ff9800' }]
            },
            options: { plugins: { title: { display: true, text: 'Request Type Distribution' } } }
          });
        } else if (activeAnalysisChart === 'timeDist') {
          const canvas = activeDiv.querySelector('canvas') || document.createElement('canvas');
          if (!activeDiv.contains(canvas)) activeDiv.innerHTML = '', activeDiv.appendChild(canvas);
          timeDistChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: stats.timeDistribution?.bins || [],
              datasets: [{ label: 'Requests', data: stats.timeDistribution?.counts || [], backgroundColor: '#2196f3' }]
            },
            options: { plugins: { title: { display: true, text: 'Time Distribution' } } }
          });
        } else if (activeAnalysisChart === 'sizeDist') {
          const canvas = activeDiv.querySelector('canvas') || document.createElement('canvas');
          if (!activeDiv.contains(canvas)) activeDiv.innerHTML = '', activeDiv.appendChild(canvas);
          sizeDistChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: stats.sizeDistribution?.bins || [],
              datasets: [{ label: 'Requests', data: stats.sizeDistribution?.counts || [], backgroundColor: '#8bc34a' }]
            },
            options: { plugins: { title: { display: true, text: 'Size Distribution' } } }
          });
        }
      };
      chrome.runtime.sendMessage({ action: activeAnalysisChart === 'apiOverTime' ? 'getApiPerformanceOverTime' : 'getFilteredStats', filters, requestId });
    }
    // Enable only the active tab button
    const activeBtn = analysisChartTabs.querySelector(`#analysis-${activeAnalysisChart}`);
    if (activeBtn) activeBtn.classList.add('active');
  }
  function updatePerfChartUI() {
    perfChartTabs.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.id === 'perf-' + activePerfChart));
    Object.entries(perfChartDivs).forEach(([id, div]) => {
      div.style.display = id === activePerfChart ? 'block' : 'none';
    });
    // Always pass current filters
    const filters = getCurrentFilters();
    renderPerformanceChart(activePerfChart, filters);
  }

  // --- Chart rendering for performance tabs ---
  function renderPerformanceChart(chartId, filters) {
    // Always pass filters
    if (chartId === 'summary') {
      // Already handled by getFilteredStats in loadAnalytics
      summary.style.display = 'block';
      return;
    }
    if (chartId === 'perf') {
      // Already handled by getFilteredStats in loadAnalytics
      perfDiv.style.display = 'block';
      return;
    }
    // --- Waterfall Chart ---
    if (chartId === 'waterfall') {
      // Destroy previous chart if exists
      if (window._waterfallChart) { window._waterfallChart.destroy(); window._waterfallChart = null; }
      const requestId = generateRequestId();
      pendingAnalyticsRequests[requestId] = (res) => {
        waterfallDiv.innerHTML = '';
        if (res && res.success && Array.isArray(res.timings) && res.timings.length > 0) {
          // Prepare data for waterfall chart
          const labels = res.timings.map(t => t.name || t.url || t.initiatorType || '');
          const startTimes = res.timings.map(t => t.startTime || 0);
          const durations = res.timings.map(t => t.duration || 0);
          const dataset = [{
            label: 'Resource Timing',
            data: res.timings.map(t => ({ x: t.startTime, y: labels.indexOf(t.name || t.url || t.initiatorType || ''), x2: t.startTime + t.duration })),
            backgroundColor: 'rgba(33,150,243,0.7)',
            borderColor: 'rgba(33,150,243,1)',
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
          }];
          const canvas = document.createElement('canvas');
          canvas.width = 700;
          canvas.height = 320;
          waterfallDiv.appendChild(canvas);
          // Use horizontal bar chart to simulate waterfall
          window._waterfallChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels,
              datasets: dataset
            },
            options: {
              indexAxis: 'y',
              plugins: {
                title: { display: true, text: 'Resource Waterfall (Start → End)' },
                tooltip: { enabled: true }
              },
              responsive: true,
              maintainAspectRatio: false,
              parsing: {
                xAxisKey: 'x',
                x2AxisKey: 'x2',
                yAxisKey: 'y',
              },
              scales: {
                x: {
                  title: { display: true, text: 'Time (ms)' },
                  min: Math.min(...startTimes),
                  max: Math.max(...startTimes.map((s, i) => s + durations[i]))
                },
                y: {
                  title: { display: true, text: 'Resource' },
                  ticks: { callback: (v, i) => labels[i] }
                }
              }
            }
          });
        } else {
          waterfallDiv.innerHTML = '<div class="error">No waterfall data.</div>';
        }
      };
      chrome.runtime.sendMessage({ action: 'getResourceTimings', filters, requestId });
      return;
    }
    // --- Page Load Chart ---
    if (chartId === 'pageload') {
      if (window._pageLoadChart) { window._pageLoadChart.destroy(); window._pageLoadChart = null; }
      const requestId = generateRequestId();
      pendingAnalyticsRequests[requestId] = (res) => {
        pageLoadDiv.innerHTML = '';
        if (res && res.success && res.metrics) {
          // Render page load metrics as bar chart
          const metrics = res.metrics;
          const labels = Object.keys(metrics);
          const values = Object.values(metrics);
          const canvas = document.createElement('canvas');
          canvas.width = 700;
          canvas.height = 320;
          pageLoadDiv.appendChild(canvas);
          window._pageLoadChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels,
              datasets: [{
                label: 'Page Load Metrics (ms)',
                data: values,
                backgroundColor: '#1976d2',
              }]
            },
            options: {
              plugins: { title: { display: true, text: 'Page Load Metrics' } },
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'ms' } }
              }
            }
          });
        } else {
          pageLoadDiv.innerHTML = '<div class="error">No page load data.</div>';
        }
      };
      chrome.runtime.sendMessage({ action: 'getPageLoadMetrics', filters, requestId });
      return;
    }
    // --- Resource Breakdown Chart ---
    if (chartId === 'resource') {
      if (window._resourceBreakdownChart) { window._resourceBreakdownChart.destroy(); window._resourceBreakdownChart = null; }
      const requestId = generateRequestId();
      pendingAnalyticsRequests[requestId] = (res) => {
        resourceDiv.innerHTML = '';
        if (res && res.success && res.breakdown) {
          // Render resource breakdown as pie chart
          const breakdown = res.breakdown;
          const labels = Object.keys(breakdown);
          const values = Object.values(breakdown);
          const canvas = document.createElement('canvas');
          canvas.width = 700;
          canvas.height = 320;
          resourceDiv.appendChild(canvas);
          window._resourceBreakdownChart = new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
              labels,
              datasets: [{
                label: 'Resource Breakdown',
                data: values,
                backgroundColor: ['#1976d2','#43a047','#fbc02d','#e53935','#8e24aa','#00838f','#f57c00'],
              }]
            },
            options: {
              plugins: { title: { display: true, text: 'Resource Type Breakdown' }, legend: { display: true, position: 'bottom' } },
              responsive: true,
              maintainAspectRatio: false
            }
          });
        } else {
          resourceDiv.innerHTML = '<div class="error">No resource breakdown data.</div>';
        }
      };
      chrome.runtime.sendMessage({ action: 'getResourceBreakdown', filters, requestId });
      return;
    }
  }

  // --- Helper to get current filters from UI ---
  function getCurrentFilters() {
    const start = controls.querySelector('#analytics-start-date').value;
    const end = controls.querySelector('#analytics-end-date').value;
    const domain = controls.querySelector('#analytics-domain-select').value;
    const api = controls.querySelector('#analytics-api-select').value;
    const types = Array.from(controls.querySelectorAll('#analytics-types input:checked')).map(i => i.value);
    const method = controls.querySelector('#analytics-method-select').value;
    const status = controls.querySelector('#analytics-status-select').value;
    const filters = { domain, types };
    if (start) filters.startTime = new Date(start).getTime();
    if (end) filters.endTime = new Date(end).getTime() + 86400000 - 1;
    if (domain) filters.domain = domain;
    if (api) filters.api = api;
    if (method) filters.method = method;
    if (status) filters.status = status;
    return filters;
  }

  // --- Initial UI state ---
  updateTabUI();
  // Initial load
  loadAnalytics();

  return container;
}