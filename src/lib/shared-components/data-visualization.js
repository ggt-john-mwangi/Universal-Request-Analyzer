"use client";

import { handleFilterChange } from "./filters.js";
import { loadData } from "./data-loader.js";
import {
  renderResponseTimeChart,
  renderStatusCodeChart,
  renderRequestTypeChart,
  renderTimeDistributionChart,
  renderSizeDistributionChart,
} from "./chart-renderer.js";
import {
  responseTimeChartRef,
  statusCodeChartRef,
  requestTypeChartRef,
  timeDistributionChartRef,
  sizeDistributionChartRef,
  chartInstances,
} from "./chart-components.js";

const CHART_RENDERERS = {
  responseTime: (ctx, data) => renderResponseTimeChart(ctx, data),
  statusCode: (ctx, data) => renderStatusCodeChart(ctx, data),
  requestType: (ctx, data) => renderRequestTypeChart(ctx, data),
  timeDistribution: (ctx, data) => renderTimeDistributionChart(ctx, data),
  sizeDistribution: (ctx, data) => renderSizeDistributionChart(ctx, data),
};

const CHART_REFS = {
  responseTime: responseTimeChartRef,
  statusCode: statusCodeChartRef,
  requestType: requestTypeChartRef,
  timeDistribution: timeDistributionChartRef,
  sizeDistribution: sizeDistributionChartRef,
};

// Main entry point for data visualization
function DataVisualization() {
  const filters = {};
  let loading = false;
  let error = null;
  let activeChart = "responseTime";
  let lastData = null; // cached so tab switches don't re-fetch

  function setLoading(value) {
    loading = value;
    loadingOverlay.style.display = value ? "flex" : "none";
  }

  function setError(value) {
    error = value;
    errorMessage.textContent = value || "";
    errorMessage.style.display = value ? "block" : "none";
  }

  function renderActiveChart() {
    if (!lastData) return;
    const ref = CHART_REFS[activeChart];
    if (!ref) return;

    // Destroy stale instance for this chart only
    if (chartInstances[activeChart]) {
      chartInstances[activeChart].destroy();
      delete chartInstances[activeChart];
    }

    chartInstances[activeChart] = CHART_RENDERERS[activeChart](ref.getContext("2d"), lastData);
  }

  function renderCharts(data) {
    lastData = data;

    // Destroy all existing instances (data changed — all stale)
    Object.keys(chartInstances).forEach((key) => {
      chartInstances[key]?.destroy();
      delete chartInstances[key];
    });

    // Render only the active chart; others are lazy on tab switch
    renderActiveChart();
    showActiveChart();
  }

  function showActiveChart() {
    Object.values(CHART_REFS).forEach((ref) => {
      if (ref) ref.style.display = "none";
    });

    const ref = CHART_REFS[activeChart];
    if (ref) ref.style.display = "block";

    // Render if not yet created (lazy tab switch)
    if (!chartInstances[activeChart]) renderActiveChart();

    const tabs = chartTabs.querySelectorAll(".chart-tab");
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.chart === activeChart);
    });
  }

  // Create DOM elements
  const container = document.createElement("div");
  container.className = "data-visualization";

  const visualizationContainer = document.createElement("div");
  visualizationContainer.className = "visualization-container";
  container.appendChild(visualizationContainer);

  const filterContainer = document.createElement("div");
  filterContainer.className = "filter-container";
  visualizationContainer.appendChild(filterContainer);

  const chartsContainer = document.createElement("div");
  chartsContainer.className = "charts-container";
  visualizationContainer.appendChild(chartsContainer);

  const chartTabs = document.createElement("div");
  chartTabs.className = "chart-tabs";
  chartsContainer.appendChild(chartTabs);

  Object.keys(CHART_RENDERERS).forEach((chartType) => {
    const button = document.createElement("button");
    button.className = `chart-tab ${activeChart === chartType ? "active" : ""}`;
    button.dataset.chart = chartType;
    button.textContent = getChartDisplayName(chartType);
    button.addEventListener("click", () => {
      activeChart = chartType;
      showActiveChart();
    });
    chartTabs.appendChild(button);
  });

  function getChartDisplayName(chartType) {
    const displayNames = {
      responseTime: "Response Time",
      statusCode: "Status Codes",
      requestType: "Request Types",
      timeDistribution: "Time Distribution",
      sizeDistribution: "Size Distribution",
    };
    return displayNames[chartType] || chartType;
  }

  const chartContent = document.createElement("div");
  chartContent.className = "chart-content";
  chartsContainer.appendChild(chartContent);

  // Append chart canvases to chartContent
  chartContent.appendChild(responseTimeChartRef);
  chartContent.appendChild(statusCodeChartRef);
  chartContent.appendChild(requestTypeChartRef);
  chartContent.appendChild(timeDistributionChartRef);
  chartContent.appendChild(sizeDistributionChartRef);

  // Create loading overlay
  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "loading-overlay";
  loadingOverlay.style.display = "none";

  const loadingSpinner = document.createElement("div");
  loadingSpinner.className = "loading-spinner";
  loadingOverlay.appendChild(loadingSpinner);

  chartContent.appendChild(loadingOverlay);

  // Create error message element
  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.style.display = "none";
  container.insertBefore(errorMessage, visualizationContainer);

  // Create and add filter panel
  const filterPanel = DataFilterPanel({
    onFilterChange: (newFilters) => {
      Object.assign(filters, newFilters);
      loadData(filters, renderCharts, setError, setLoading);
    },
    initialFilters: filters,
  });

  filterContainer.appendChild(filterPanel);

  // Add resize observer for chart responsiveness
  const resizeObserver = new ResizeObserver(() => {
    const activeChartInstance = chartInstances[activeChart];
    if (activeChartInstance) {
      activeChartInstance.resize();
    }
  });

  resizeObserver.observe(chartContent);

  // Cleanup function
  function cleanup() {
    resizeObserver.disconnect();
    Object.values(chartInstances).forEach((chart) => {
      if (chart) {
        chart.destroy();
      }
    });
  }

  // Attach cleanup to container
  container.cleanup = cleanup;

  // Load data initially
  loadData(filters, renderCharts, setError, setLoading);

  return container;
}

export default DataVisualization;
