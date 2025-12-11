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

// Main entry point for data visualization
function DataVisualization() {
  const filters = {};
  let loading = false;
  let error = null;
  let activeChart = "responseTime";

  function setLoading(value) {
    loading = value;
    loadingOverlay.style.display = value ? "flex" : "none";
  }

  function setError(value) {
    error = value;
    errorMessage.textContent = value || "";
    errorMessage.style.display = value ? "block" : "none";
  }

  function renderCharts(data) {
    // Destroy existing charts
    Object.values(chartInstances).forEach((chart) => {
      if (chart) {
        chart.destroy();
      }
    });

    // Reset chart instances
    Object.keys(chartInstances).forEach((key) => {
      delete chartInstances[key];
    });

    // Render all charts
    if (responseTimeChartRef) {
      const ctx = responseTimeChartRef.getContext("2d");
      chartInstances.responseTime = renderResponseTimeChart(ctx, data);
    }

    if (statusCodeChartRef) {
      const ctx = statusCodeChartRef.getContext("2d");
      chartInstances.statusCode = renderStatusCodeChart(ctx, data);
    }

    if (requestTypeChartRef) {
      const ctx = requestTypeChartRef.getContext("2d");
      chartInstances.requestType = renderRequestTypeChart(ctx, data);
    }

    if (timeDistributionChartRef) {
      const ctx = timeDistributionChartRef.getContext("2d");
      chartInstances.timeDistribution = renderTimeDistributionChart(ctx, data);
    }

    if (sizeDistributionChartRef) {
      const ctx = sizeDistributionChartRef.getContext("2d");
      chartInstances.sizeDistribution = renderSizeDistributionChart(ctx, data);
    }

    // Show active chart
    showActiveChart();
  }

  function showActiveChart() {
    // Hide all charts
    [
      responseTimeChartRef,
      statusCodeChartRef,
      requestTypeChartRef,
      timeDistributionChartRef,
      sizeDistributionChartRef,
    ].forEach((chart) => {
      if (chart) {
        chart.style.display = "none";
      }
    });

    // Show active chart
    const chartRef = {
      responseTime: responseTimeChartRef,
      statusCode: statusCodeChartRef,
      requestType: requestTypeChartRef,
      timeDistribution: timeDistributionChartRef,
      sizeDistribution: sizeDistributionChartRef,
    }[activeChart];

    if (chartRef) {
      chartRef.style.display = "block";
    }

    // Update tab states
    const tabs = chartTabs.querySelectorAll(".chart-tab");
    tabs.forEach((tab) => {
      tab.classList.toggle(
        "active",
        tab.textContent.toLowerCase() === activeChart
      );
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

  [
    "responseTime",
    "statusCode",
    "requestType",
    "timeDistribution",
    "sizeDistribution",
  ].forEach((chartType) => {
    const button = document.createElement("button");
    button.className = `chart-tab ${activeChart === chartType ? "active" : ""}`;
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
