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

    // Reset chart instances
    Object.keys(chartInstances).forEach((key) => {
      delete chartInstances[key];
    });

    // Render response time chart
    if (responseTimeChartRef) {
      const ctx = responseTimeChartRef.getContext("2d");
      chartInstances.responseTime = renderResponseTimeChart(ctx, data);
    }

    // Additional chart rendering logic for other charts can be added here
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
    button.textContent = chartType;
    button.addEventListener("click", () => {
      activeChart = chartType;
      showActiveChart();
    });
    chartTabs.appendChild(button);
  });

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
    ].forEach((chart, idx) => {
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
    // Update tab active state
    const tabs = chartTabs.querySelectorAll(".chart-tab");
    tabs.forEach((tab, idx) => {
      tab.classList.toggle("active", tab.textContent === activeChart);
    });
  }

  // Initial chart display
  showActiveChart();

  // Load data initially
  loadData(filters, renderCharts, setError, setLoading);

  // Expose a reload method for tab activation and filter changes
  container.reload = (newFilters) => {
    filters = { ...newFilters };
    loadData(filters, renderCharts, setError, setLoading);
  };

  return container;
}

export default DataVisualization;
