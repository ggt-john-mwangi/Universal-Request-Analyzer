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

// Event-based fetch for plot data (response times, status codes, request types, etc.)
function fetchPlotData(filters = {}, callback) {
  const requestId = `plot_data_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  function handler(message) {
    if (message && message.requestId === requestId) {
      callback(message);
      chrome.runtime.onMessage.removeListener(handler);
    }
  }
  chrome.runtime.onMessage.addListener(handler);
  chrome.runtime.sendMessage({ action: "getFilteredStats", filters, requestId });
}

// Main entry point for data visualization
function DataVisualization(globalFilters = {}) {
  let filters = { ...globalFilters };
  let loading = false;
  let error = null;
  let activeChart = "responseTime";

  function setLoading(value) {
    loading = value;
  }

  function setError(value) {
    error = value;
  }

  function renderCharts(data) {
    // Destroy existing charts
    Object.values(chartInstances).forEach((chart) => {
      if (chart) {
        chart.destroy();
      }
    });
    Object.keys(chartInstances).forEach((key) => {
      delete chartInstances[key];
    });

    // Render response time chart
    if (responseTimeChartRef && data) {
      const ctx = responseTimeChartRef.getContext("2d");
      chartInstances.responseTime = renderResponseTimeChart(ctx, data);
    }
    // Render status code chart
    if (statusCodeChartRef && data) {
      const ctx = statusCodeChartRef.getContext("2d");
      if (typeof window.renderStatusCodeChart === 'function') {
        chartInstances.statusCode = window.renderStatusCodeChart(ctx, data);
      }
    }
    // Render request type chart
    if (requestTypeChartRef && data) {
      const ctx = requestTypeChartRef.getContext("2d");
      if (typeof window.renderRequestTypeChart === 'function') {
        chartInstances.requestType = window.renderRequestTypeChart(ctx, data);
      }
    }
    // Render time distribution chart
    if (timeDistributionChartRef && data) {
      const ctx = timeDistributionChartRef.getContext("2d");
      if (typeof window.renderTimeDistributionChart === 'function') {
        chartInstances.timeDistribution = window.renderTimeDistributionChart(ctx, data);
      }
    }
    // Render size distribution chart
    if (sizeDistributionChartRef && data) {
      const ctx = sizeDistributionChartRef.getContext("2d");
      if (typeof window.renderSizeDistributionChart === 'function') {
        chartInstances.sizeDistribution = window.renderSizeDistributionChart(ctx, data);
      }
    }
  }

  // Create DOM elements
  const container = document.createElement("div");
  container.className = "data-visualization";

  const visualizationContainer = document.createElement("div");
  visualizationContainer.className = "visualization-container";
  container.appendChild(visualizationContainer);

  const chartsContainer = document.createElement("div");
  chartsContainer.className = "charts-container";
  visualizationContainer.appendChild(chartsContainer);

  // Add domain selector for event-based filtering
  const domainSelector = document.createElement("select");
  domainSelector.className = "domain-selector";
  domainSelector.innerHTML = `<option value="">All Domains</option>`;
  chartsContainer.prepend(domainSelector);

  // Fetch domains event-based and set current as default if present
  function fetchDomainsAndSetDefault() {
    const requestId = `popup_domains_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    chrome.runtime.sendMessage({ action: 'getDistinctDomains', requestId });
    function handler(message) {
      if (message && message.requestId === requestId && Array.isArray(message.domains)) {
        domainSelector.innerHTML = `<option value="">All Domains</option>`;
        message.domains.forEach(domain => {
          const opt = document.createElement('option');
          opt.value = domain;
          opt.textContent = domain;
          domainSelector.appendChild(opt);
        });
        // Set default to current domain if present
        const currentDomain = window.location.hostname;
        if (currentDomain && message.domains.includes(currentDomain)) {
          domainSelector.value = currentDomain;
        }
        chrome.runtime.onMessage.removeListener(handler);
        // Trigger initial data load with selected domain
        reloadWithDomain();
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  }

  // Reload data with selected domain
  function reloadWithDomain() {
    const selectedDomain = domainSelector.value;
    const newFilters = { ...filters, domain: selectedDomain };
    loadData(newFilters, renderCharts, setError, setLoading);
  }

  // Listen for domain selection changes
  domainSelector.addEventListener('change', reloadWithDomain);

  // Chart type dropdown
  const chartTypeDropdown = document.createElement("select");
  chartTypeDropdown.className = "chart-type-dropdown";
  const chartTypes = [
    { value: "responseTime", label: "Response Time" },
    { value: "statusCode", label: "Status Codes" },
    { value: "requestType", label: "Request Types" },
    { value: "timeDistribution", label: "Time Distribution" },
    { value: "sizeDistribution", label: "Size Distribution" },
  ];
  chartTypes.forEach(({ value, label }) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    chartTypeDropdown.appendChild(opt);
  });
  chartTypeDropdown.value = activeChart;
  chartTypeDropdown.addEventListener("change", () => {
    activeChart = chartTypeDropdown.value;
    showActiveChart();
  });
  chartsContainer.appendChild(chartTypeDropdown);

  const chartContent = document.createElement("div");
  chartContent.className = "chart-content";
  chartsContainer.appendChild(chartContent);

  // Append chart canvases to chartContent
  chartContent.appendChild(responseTimeChartRef);
  chartContent.appendChild(statusCodeChartRef);
  chartContent.appendChild(requestTypeChartRef);
  chartContent.appendChild(timeDistributionChartRef);
  chartContent.appendChild(sizeDistributionChartRef);

  function showActiveChart() {
    [
      responseTimeChartRef,
      statusCodeChartRef,
      requestTypeChartRef,
      timeDistributionChartRef,
      sizeDistributionChartRef,
    ].forEach((chart) => {
      if (chart) chart.style.display = "none";
    });
    const chartMap = {
      responseTime: responseTimeChartRef,
      statusCode: statusCodeChartRef,
      requestType: requestTypeChartRef,
      timeDistribution: timeDistributionChartRef,
      sizeDistribution: sizeDistributionChartRef,
    };
    if (chartMap[activeChart]) chartMap[activeChart].style.display = "block";
  }

  // Initial chart display
  showActiveChart();

  // Initial fetch of domains and data
  fetchDomainsAndSetDefault();

  // Load data initially
  loadData(filters, renderCharts, setError, setLoading);

  // Expose a reload method for tab activation and filter changes
  container.reload = (newFilters) => {
    filters = { ...newFilters };
    reloadWithDomain();
  };

  return container;
}

export default DataVisualization;
