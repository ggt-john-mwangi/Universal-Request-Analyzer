"use client"

import "../../lib/chart.min.js"

// Data visualization component for displaying filtered data plots

function DataVisualization() {
  const filters = {};
  let data = null;
  let loading = false;
  let error = null;
  let activeChart = "responseTime";

  // Chart references
  const responseTimeChartRef = document.createElement("canvas");
  const statusCodeChartRef = document.createElement("canvas");
  const requestTypeChartRef = document.createElement("canvas");
  const timeDistributionChartRef = document.createElement("canvas");
  const sizeDistributionChartRef = document.createElement("canvas");

  // Chart instances
  const chartInstances = {};

  // Handle filter changes
  function handleFilterChange(newFilters) {
    Object.assign(filters, newFilters);
    loadData();
  }

  // Load data from background script
  function loadData() {
    loading = true;
    error = null;

    try {
      // Convert filters to database query format
      const queryFilters = {};

      if (filters.domain) {
        queryFilters.domain = filters.domain;
      }

      if (filters.page) {
        queryFilters.pageUrl = filters.page;
      }

      if (filters.api) {
        queryFilters.path = filters.api;
      }

      if (filters.method) {
        queryFilters.method = filters.method;
      }

      if (filters.statusCode) {
        // Handle status code ranges (2xx, 3xx, etc.)
        if (filters.statusCode.endsWith("xx")) {
          const statusPrefix = filters.statusCode.charAt(0);
          queryFilters.statusPrefix = statusPrefix;
        } else {
          queryFilters.status = filters.statusCode;
        }
      }

      if (filters.startDate) {
        queryFilters.startDate = new Date(filters.startDate).getTime();
      }

      if (filters.endDate) {
        // Set end date to end of day
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        queryFilters.endDate = endDate.getTime();
      }

      // Request data from background script
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({ action: "getFilteredStats", filters: queryFilters }, (response) => {
          if (response && !response.error) {
            data = response;
            renderCharts(response);
          } else {
            error = response?.error || "Failed to load data";
          }
          loading = false;
        });
      } else {
        error = "Chrome runtime is not available.";
        loading = false;
      }
    } catch (err) {
      error = "An error occurred while loading data";
      loading = false;
      console.error("Error loading data:", err);
    }
  }

  // Render charts based on data
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

    // Render response time distribution chart
    if (responseTimeChartRef) {
      const ctx = responseTimeChartRef.getContext("2d");

      // Define bins for response time (in ms)
      const bins = [
        { label: "0-100ms", min: 0, max: 100 },
        { label: "100-300ms", min: 100, max: 300 },
        { label: "300-500ms", min: 300, max: 500 },
        { label: "500ms-1s", min: 500, max: 1000 },
        { label: "1s-3s", min: 1000, max: 3000 },
        { label: "3s+", min: 3000, max: Number.POSITIVE_INFINITY },
      ];

      // Count requests in each bin
      const responseTimeCounts = bins.map((bin) => {
        return data.responseTimes.filter((time) => time >= bin.min && time < bin.max).length;
      });

      chartInstances.responseTime = new Chart(ctx, {
        type: "bar",
        data: {
          labels: bins.map((bin) => bin.label),
          datasets: [
            {
              label: "Number of Requests",
              data: responseTimeCounts,
              backgroundColor: "rgba(54, 162, 235, 0.5)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Response Time Distribution",
            },
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Number of Requests",
              },
            },
            x: {
              title: {
                display: true,
                text: "Response Time",
              },
            },
          },
        },
      });
    }

    // Additional chart rendering logic for other charts (statusCode, requestType, etc.)
    // Similar to the responseTime chart logic above
  }

  // Switch between charts
  function switchChart(chartType) {
    activeChart = chartType;
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

  const dataFilterPanel = DataFilterPanel({ onFilterChange: handleFilterChange });
  filterContainer.appendChild(dataFilterPanel);

  const chartsContainer = document.createElement("div");
  chartsContainer.className = "charts-container";
  visualizationContainer.appendChild(chartsContainer);

  const chartTabs = document.createElement("div");
  chartTabs.className = "chart-tabs";
  chartsContainer.appendChild(chartTabs);

  ["responseTime", "statusCode", "requestType", "timeDistribution", "sizeDistribution"].forEach((chartType) => {
    const button = document.createElement("button");
    button.className = `chart-tab ${activeChart === chartType ? "active" : ""}`;
    button.textContent = chartType;
    button.addEventListener("click", () => switchChart(chartType));
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

  return container;
}

// Export the function
export default DataVisualization;

