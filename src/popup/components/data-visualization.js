"use client";

import { handleFilterChange } from "./filters.js";
import { loadData } from "./data-loader.js";
import { renderResponseTimeChart } from "./chart-renderer.js";
import {
  responseTimeChartRef,
  statusCodeChartRef,
  requestTypeChartRef,
  timeDistributionChartRef,
  sizeDistributionChartRef,
  chartInstances,
} from "./chart-components.js";

// Main entry point for data visualization
function DataVisualization(globalFilters = {}) {
  let filters = { ...globalFilters };
  let activeChart = "apiOverTime"; // Default to API over time
  let overlayEnabled = false;

  // Container setup
  const container = document.createElement("div");
  container.className = "data-visualization plots-ui";

  // --- Filter Controls ---
  const filterPanel = document.createElement("div");
  filterPanel.className = "plots-filter-panel";
  filterPanel.style.display = "flex";
  filterPanel.style.gap = "10px";
  filterPanel.style.margin = "10px 0";

  // Page (URL) filter as select
  const pageSelect = document.createElement("select");
  pageSelect.style.width = "220px";
  pageSelect.title = "Filter by page (URL)";
  const defaultPageOpt = document.createElement("option");
  defaultPageOpt.value = "";
  defaultPageOpt.textContent = "All Pages";
  pageSelect.appendChild(defaultPageOpt);
  filterPanel.appendChild(pageSelect);

  // Type filter (XHR/fetch/script/...) as before
  const typeSelect = document.createElement("select");
  ["", "xhr", "fetch", "script", "stylesheet", "image", "font", "other"].forEach(type => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type ? type.charAt(0).toUpperCase() + type.slice(1) : "All Types";
    typeSelect.appendChild(opt);
  });
  filterPanel.appendChild(typeSelect);

  // Method filter (GET/POST/PUT/DELETE...)
  const methodSelect = document.createElement("select");
  ["", "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"].forEach(method => {
    const opt = document.createElement("option");
    opt.value = method;
    opt.textContent = method || "All Methods";
    methodSelect.appendChild(opt);
  });
  filterPanel.appendChild(methodSelect);

  // Min time filter
  const minTimeInput = document.createElement("input");
  minTimeInput.type = "number";
  minTimeInput.placeholder = "Min ms";
  minTimeInput.style.width = "70px";
  filterPanel.appendChild(minTimeInput);

  // Max time filter
  const maxTimeInput = document.createElement("input");
  maxTimeInput.type = "number";
  maxTimeInput.placeholder = "Max ms";
  maxTimeInput.style.width = "70px";
  filterPanel.appendChild(maxTimeInput);

  // Average time filter
  const avgTimeInput = document.createElement("input");
  avgTimeInput.type = "number";
  avgTimeInput.placeholder = "Avg ms (min)";
  avgTimeInput.style.width = "90px";
  filterPanel.appendChild(avgTimeInput);

  // Apply filter button
  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Apply Filters";
  applyBtn.className = "apply-filter-btn";
  filterPanel.appendChild(applyBtn);

  // Add filter panel to container (above controlsRow)
  container.appendChild(filterPanel);

  // --- Populate pageSelect with distinct pages for selected domain ---
  function populatePageSelectForDomain(domain) {
    const requestId = `pagesel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const filters = {};
    if (domain) filters.domain = domain;
    chrome.runtime.sendMessage({ action: "getDistinctValues", field: "pageUrl", filters, requestId });
    function handler(message) {
      if (message && message.requestId === requestId) {
        if (message.success && Array.isArray(message.values)) {
          // Remove all except default
          while (pageSelect.options.length > 1) pageSelect.remove(1);
          message.values.forEach(url => {
            const opt = document.createElement("option");
            opt.value = url;
            opt.textContent = url.length > 60 ? url.slice(0, 57) + "..." : url;
            pageSelect.appendChild(opt);
          });
        }
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  }

  // Controls row (dropdowns and overlay/export)
  const controlsRow = document.createElement("div");
  controlsRow.className = "plots-controls-row";
  controlsRow.style.display = "flex";
  controlsRow.style.alignItems = "center";
  controlsRow.style.gap = "12px";
  controlsRow.style.marginBottom = "10px";
  controlsRow.style.flexWrap = "wrap";

  // --- Add domain dropdown for filtering ---
  const domainSelect = document.createElement("select");
  domainSelect.className = "plots-domain-dropdown";
  domainSelect.title = "Filter by domain";
  domainSelect.innerHTML = '<option value="">All Domains</option>';
  controlsRow.prepend(domainSelect);

  // --- Populate domain dropdown from backend (with lastActiveDomain support) ---
  const requestId = `popup_domains_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  function handleDomains(message) {
    if (message && message.requestId === requestId && message.action === "getDistinctDomainsResult") {
      chrome.runtime.onMessage.removeListener(handleDomains);
      domainSelect.innerHTML = '<option value="">All Domains</option>';
      (message.domains || []).forEach(domain => {
        const opt = document.createElement("option");
        opt.value = domain;
        opt.textContent = domain;
        domainSelect.appendChild(opt);
      });
      // Try to set lastActiveDomain as default
      if (chrome.storage && chrome.storage.local && chrome.storage.local.get) {
        chrome.storage.local.get(["lastActiveDomain"], (result) => {
          const lastDomain = result.lastActiveDomain;
          if (lastDomain && message.domains && message.domains.includes(lastDomain)) {
            domainSelect.value = lastDomain;
          } else {
            domainSelect.value = "";
          }
          domainSelect.disabled = false;
          // Populate pages for this domain
          populatePageSelectForDomain(domainSelect.value);
          // Trigger initial chart render and change event for correct domain
          selectedDomain = domainSelect.value;
          domainSelect.dispatchEvent(new Event('change'));
        });
      } else {
        domainSelect.disabled = false;
        populatePageSelectForDomain(domainSelect.value);
        domainSelect.dispatchEvent(new Event('change'));
      }
    }
  }
  chrome.runtime.onMessage.addListener(handleDomains);
  chrome.runtime.sendMessage({ action: "getDistinctDomains", requestId });

  // Metric selector (domain/type/time)
  const metricDropdown = document.createElement("select");
  metricDropdown.className = "plots-metric-dropdown";
  metricDropdown.title = "Select metric to plot";
  [
    { value: "apiOverTime", label: "API Performance Over Time" },
    { value: "statusCode", label: "By Status Code" },
    { value: "type", label: "By Type" },
    { value: "time", label: "By Time" },
    { value: "size", label: "By Size" },
  ].forEach(({ value, label }) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    metricDropdown.appendChild(opt);
  });
  controlsRow.appendChild(metricDropdown);

  // --- Metric selection for API over time chart ---
  let apiMetric = 'avgDuration';
  const apiMetricDropdown = document.createElement('select');
  apiMetricDropdown.className = 'plots-metric-dropdown';
  apiMetricDropdown.title = 'Metric to plot';
  [
    { value: 'count', label: 'Count' },
    { value: 'avgDuration', label: 'Avg Duration (ms)' },
    { value: 'minDuration', label: 'Min Duration (ms)' },
    { value: 'maxDuration', label: 'Max Duration (ms)' }
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    apiMetricDropdown.appendChild(opt);
  });
  apiMetricDropdown.value = apiMetric;
  apiMetricDropdown.onchange = () => {
    apiMetric = apiMetricDropdown.value;
    renderCurrentChart();
  };
  // Only show for apiOverTime chart
  controlsRow.appendChild(apiMetricDropdown);

  // Overlay toggle
  const overlayToggle = document.createElement("label");
  overlayToggle.style.margin = "0 8px";
  overlayToggle.innerHTML = `<input type="checkbox" id="overlayToggle"> Overlay Previous Period`;
  controlsRow.appendChild(overlayToggle);

  // Export buttons
  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Export PNG";
  exportBtn.className = "export-chart-btn";
  controlsRow.appendChild(exportBtn);
  const svgExportBtn = document.createElement("button");
  svgExportBtn.textContent = "Export SVG";
  svgExportBtn.className = "export-chart-btn";
  controlsRow.appendChild(svgExportBtn);

  container.appendChild(controlsRow);

  // Chart content
  const chartContent = document.createElement("div");
  chartContent.className = "chart-content";
  chartContent.style.background = "var(--surface-color)";
  chartContent.style.borderRadius = "8px";
  chartContent.style.padding = "16px";
  chartContent.style.minHeight = "340px";
  chartContent.style.display = "flex";
  chartContent.style.justifyContent = "center";
  chartContent.style.alignItems = "center";
  chartContent.style.height = "360px";
  chartContent.style.position = "relative";
  container.appendChild(chartContent);

  // Chart tabs (at the bottom)
  const chartTabs = document.createElement("div");
  chartTabs.className = "chart-tabs chart-tabs-bottom";
  chartTabs.style.display = "flex";
  chartTabs.style.justifyContent = "center";
  chartTabs.style.gap = "16px";
  chartTabs.style.marginTop = "18px";
  chartTabs.style.marginBottom = "0";

  const chartTypes = [
    { value: "apiOverTime", label: "API Performance Over Time" },
    { value: "statusCode", label: "Status Codes" },
    { value: "type", label: "Request Types" },
    { value: "time", label: "Time Distribution" },
    { value: "size", label: "Size Distribution" },
  ];
  chartTypes.forEach(({ value, label }) => {
    const tab = document.createElement("button");
    tab.className = `chart-tab${activeChart === value ? " active" : ""}`;
    tab.textContent = label;
    tab.onclick = () => {
      activeChart = value;
      metricDropdown.value = value;
      renderCurrentChart();
      updateTabActive();
    };
    chartTabs.appendChild(tab);
  });
  container.appendChild(chartTabs);

  function updateTabActive() {
    const tabs = chartTabs.querySelectorAll(".chart-tab");
    tabs.forEach((tab, idx) => {
      tab.classList.toggle("active", chartTypes[idx].value === activeChart);
    });
  }

  // Render chart for current metric
  function renderCurrentChart() {
    chartContent.innerHTML = '';
    if (activeChart === 'apiOverTime') {
      apiMetricDropdown.style.display = '';
    } else {
      apiMetricDropdown.style.display = 'none';
    }
    fetchPlotDataForMetric((stats) => {
      const canvas = document.createElement('canvas');
      canvas.width = 700;
      canvas.height = 320;
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '340px';
      chartContent.appendChild(canvas);
      let chartInstance = null;
      if (activeChart === 'apiOverTime' && typeof window.renderApiOverTimeChart === 'function') {
        chartInstance = window.renderApiOverTimeChart(canvas.getContext('2d'), stats, apiMetric);
      } else if (activeChart === 'responseTime' && typeof window.renderResponseTimeChart === 'function') {
        chartInstance = window.renderResponseTimeChart(canvas.getContext('2d'), stats);
      } else if (activeChart === 'type' && typeof window.renderRequestTypeChart === 'function') {
        chartInstance = window.renderRequestTypeChart(canvas.getContext('2d'), stats);
      } else if (activeChart === 'statusCode' && typeof window.renderStatusCodeChart === 'function') {
        chartInstance = window.renderStatusCodeChart(canvas.getContext('2d'), stats);
      } else if (activeChart === 'time' && typeof window.renderTimeDistributionChart === 'function') {
        chartInstance = window.renderTimeDistributionChart(canvas.getContext('2d'), stats);
      } else if (activeChart === 'size' && typeof window.renderSizeDistributionChart === 'function') {
        chartInstance = window.renderSizeDistributionChart(canvas.getContext('2d'), stats);
      }
      // Export buttons
      exportBtn.onclick = () => {
        if (canvas) {
          const url = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = url;
          a.download = `${activeChart}-chart.png`;
          a.click();
        }
      };
      svgExportBtn.onclick = () => {
        if (canvas) {
          const svgData = canvas.toDataURL("image/svg+xml");
          const a = document.createElement("a");
          a.href = svgData;
          a.download = `${activeChart}-chart.svg`;
          a.click();
        }
      };
      // Overlay logic (if enabled)
      if (overlayToggle.querySelector('input').checked) {
        // Fetch previous period and overlay (implement as needed)
        // ...
      }
      // Tooltips and click-to-filter are handled by Chart.js config in chart-renderer.js
    });
    updateTabActive();
  }

  // --- Filter logic ---
  function getFiltersFromUI() {
    const filters = { ...globalFilters };
    if (domainSelect.value) filters.domain = domainSelect.value;
    if (pageSelect.value) filters.pageUrl = pageSelect.value;
    if (typeSelect.value) filters.type = typeSelect.value;
    if (methodSelect.value) filters.method = methodSelect.value;
    if (minTimeInput.value) filters.minTime = Number(minTimeInput.value);
    if (maxTimeInput.value) filters.maxTime = Number(maxTimeInput.value);
    if (avgTimeInput.value) filters.avgTime = Number(avgTimeInput.value);
    return filters;
  }

  applyBtn.onclick = () => {
    filters = getFiltersFromUI();
    renderCurrentChart();
  };

  // Helper: fetch plot data for selected metric using global filters
  async function fetchPlotDataForMetric(cb) {
    const filtersToUse = { ...filters };
    if (domainSelect.value) filtersToUse.domain = domainSelect.value;
    if (pageSelect.value) filtersToUse.pageUrl = pageSelect.value;
    if (typeSelect.value) filtersToUse.type = typeSelect.value;
    if (methodSelect.value) filtersToUse.method = methodSelect.value;
    if (minTimeInput.value) filtersToUse.minTime = Number(minTimeInput.value);
    if (maxTimeInput.value) filtersToUse.maxTime = Number(maxTimeInput.value);
    if (avgTimeInput.value) filtersToUse.avgTime = Number(avgTimeInput.value);
    const requestId = `plots_data_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    chrome.runtime.sendMessage({ action: activeChart === 'apiOverTime' ? "getApiPerformanceOverTime" : "getFilteredStats", filters: filtersToUse, requestId });
    function handler(message) {
      if (message && message.requestId === requestId) {
        cb(message.stats || {});
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  }

  // Event listeners
  metricDropdown.onchange = () => {
    activeChart = metricDropdown.value;
    renderCurrentChart();
    updateTabActive();
  };
  domainSelect.onchange = () => {
    populatePageSelectForDomain(domainSelect.value);
    renderCurrentChart();
  };
  pageSelect.onchange = () => {
    renderCurrentChart();
  };
  overlayToggle.querySelector('input').onchange = (e) => {
    renderCurrentChart();
  };

  // Initial render
  setTimeout(() => {
    metricDropdown.value = activeChart;
    renderCurrentChart();
    updateTabActive();
  }, 300);

  return container;
}

// New chart: API performance over time (multi-line)
function renderApiOverTimeChart(ctx, stats, metric = 'avgDuration') {
  // stats.apiOverTime: { [apiPath]: [{time, count, avgDuration, minDuration, maxDuration}, ...] }
  const apiData = stats.apiOverTime || {};
  const allTimes = new Set();
  Object.values(apiData).forEach(arr => arr.forEach(d => allTimes.add(d.time)));
  const sortedTimes = Array.from(allTimes).sort();
  const datasets = Object.entries(apiData).map(([api, arr], idx) => {
    // Map time to selected metric for this API
    const timeMap = {};
    arr.forEach(d => { timeMap[d.time] = d[metric]; });
    return {
      label: api,
      data: sortedTimes.map(t => timeMap[t] !== undefined ? timeMap[t] : null),
      borderColor: `hsl(${(idx*47)%360},70%,50%)`,
      backgroundColor: 'rgba(0,0,0,0)',
      spanGaps: true,
      tension: 0.2,
      pointRadius: 1.5,
    };
  });
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedTimes.map(t => new Date(Number(t)).toLocaleTimeString()),
      datasets,
    },
    options: {
      plugins: {
        tooltip: { enabled: true },
        legend: { display: true, position: 'bottom' },
      },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        y: { title: { display: true, text: metric === 'count' ? 'Count' : 'Duration (ms)' } },
        x: { title: { display: true, text: 'Time' } }
      },
      elements: { line: { borderWidth: 2 } },
    }
  });
}

// Export for use in popup.js
window.renderApiOverTimeChart = renderApiOverTimeChart;

export default DataVisualization;
