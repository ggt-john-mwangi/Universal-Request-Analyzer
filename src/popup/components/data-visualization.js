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
  let activeChart = "responseTime";
  let overlayEnabled = false;

  // Container setup
  const container = document.createElement("div");
  container.className = "data-visualization plots-ui";

  // Controls row (dropdowns and overlay/export)
  const controlsRow = document.createElement("div");
  controlsRow.className = "plots-controls-row";
  controlsRow.style.display = "flex";
  controlsRow.style.alignItems = "center";
  controlsRow.style.gap = "12px";
  controlsRow.style.marginBottom = "10px";
  controlsRow.style.flexWrap = "wrap";

  // Metric selector (domain/type/time)
  const metricDropdown = document.createElement("select");
  metricDropdown.className = "plots-metric-dropdown";
  metricDropdown.title = "Select metric to plot";
  [
    { value: "domain", label: "By Domain (Status Codes)" },
    { value: "type", label: "By Type" },
    { value: "statusCode", label: "By Status Code" },
    { value: "time", label: "By Time" },
    { value: "size", label: "By Size" },
  ].forEach(({ value, label }) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    metricDropdown.appendChild(opt);
  });
  controlsRow.appendChild(metricDropdown);

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
    { value: "responseTime", label: "Response Time" },
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
    fetchPlotDataForMetric((stats) => {
      const canvas = document.createElement('canvas');
      canvas.width = 700;
      canvas.height = 320;
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '340px';
      chartContent.appendChild(canvas);
      let chartInstance = null;
      // Use existing chart-renderer.js logic for all chart types
      if (activeChart === 'responseTime' && typeof window.renderResponseTimeChart === 'function') {
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

  // Helper: fetch plot data for selected metric using global filters
  function fetchPlotDataForMetric(cb) {
    const filtersToUse = { ...globalFilters };
    const requestId = `plots_data_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    chrome.runtime.sendMessage({ action: "getFilteredStats", filters: filtersToUse, requestId });
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

export default DataVisualization;
