import "../../styles.css"; // Import the global styles.css
import "../css/popup.css"; // Ensure the CSS file is imported
import "../css/themes.css";
import "../css/data-visualization.css";

import { Chart } from "../../ui/chart.js";
// Import settings UI
import { initSettingsUI } from "./settings-ui.js";
import settingsManager from "./settings-manager.js";
import themeManager from "../../config/theme-manager.js";

// DOM elements
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize settings manager
  await settingsManager.initialize();

  // Initialize theme manager and apply theme
  await themeManager.initialize({
    initialTheme: "light",
  });

  // Initialize settings UI
  initSettingsUI();

  // Rest of the popup.js code...
  // DOM elements
  const requestsTableBody = document.getElementById("requestsTableBody");
  const totalRequestsEl = document.getElementById("totalRequests");
  const avgResponseTimeEl = document.getElementById("avgResponseTime");
  const successRateEl = document.getElementById("successRate");
  const filterBtn = document.getElementById("filterBtn");
  const filterPanel = document.getElementById("filterPanel");
  const clearBtn = document.getElementById("clearBtn");
  const exportBtn = document.getElementById("exportBtn");
  const exportPanel = document.getElementById("exportPanel");
  const configBtn = document.getElementById("configBtn");
  const configPanel = document.getElementById("configPanel");
  const requestDetails = document.getElementById("requestDetails");
  const closeDetails = document.getElementById("closeDetails");
  const applyFilterBtn = document.getElementById("applyFilterBtn");
  const resetFilterBtn = document.getElementById("resetFilterBtn");
  const doExportBtn = document.getElementById("doExportBtn");
  const cancelExportBtn = document.getElementById("cancelExportBtn");
  const saveConfigBtn = document.getElementById("saveConfigBtn");
  const cancelConfigBtn = document.getElementById("cancelConfigBtn");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageInfoEl = document.getElementById("pageInfo");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const OptionsPage = document.getElementById("openOptions");
  const closeBtn = document.getElementById("closeBtn");
  // Filter elements
  const statusFilter = document.getElementById("statusFilter");
  const typeFilter = document.getElementById("typeFilter");
  const domainFilter = document.getElementById("domainFilter");
  const urlFilter = document.getElementById("urlFilter");
  const startDateFilter = document.getElementById("startDateFilter");
  const endDateFilter = document.getElementById("endDateFilter");

  // Export elements
  const exportFormat = document.getElementById("exportFormat");
  const exportFilename = document.getElementById("exportFilename");

  // Config elements
  const captureEnabled = document.getElementById("captureEnabled");
  const maxStoredRequests = document.getElementById("maxStoredRequests");
  const captureTypeCheckboxes = document.querySelectorAll(
    'input[name="captureType"]'
  );
  const includeDomains = document.getElementById("includeDomains");
  const excludeDomains = document.getElementById("excludeDomains");

  // Visualization elements
  const chartTabs = document.querySelectorAll(".chart-tab");
  const chartPanels = document.querySelectorAll(".chart-panel");
  const vizApplyFilterBtn = document.getElementById("vizApplyFilterBtn");
  const vizResetFilterBtn = document.getElementById("vizResetFilterBtn");

  // Chart elements
  const responseTimePlot = document.getElementById("responseTimePlot");
  const statusCodePlot = document.getElementById("statusCodePlot");
  const domainPlot = document.getElementById("domainPlot");
  const requestTypePlot = document.getElementById("requestTypePlot");
  const timeDistributionPlot = document.getElementById("timeDistributionPlot");
  const vizResponseTimePlot = document.getElementById("vizResponseTimePlot");
  const vizStatusCodePlot = document.getElementById("vizStatusCodePlot");
  const vizRequestTypePlot = document.getElementById("vizRequestTypePlot");
  const vizTimeDistributionPlot = document.getElementById(
    "vizTimeDistributionPlot"
  );
  const vizSizeDistributionPlot = document.getElementById(
    "vizSizeDistributionPlot"
  );

  // Store all requests and filtered requests
  const allRequests = [];
  let filteredRequests = [];
  let activeFilters = {
    status: "all",
    type: "all",
    domain: "",
    url: "",
    startDate: "",
    endDate: "",
  };

  // Pagination
  let currentPage = 1;
  let totalPages = 1;
  const itemsPerPage = 50;
  let totalItems = 0;

  // Charts
  const charts = {
    responseTime: null,
    statusCode: null,
    domain: null,
    requestType: null,
    timeDistribution: null,
    vizResponseTime: null,
    vizStatusCode: null,
    vizRequestType: null,
    vizTimeDistribution: null,
    vizSizeDistribution: null,
  };

  // Config
  let config = {
    maxStoredRequests: 10000,
    captureEnabled: true,
    captureFilters: {
      includeDomains: [],
      excludeDomains: [],
      includeTypes: [
        "xmlhttprequest",
        "fetch",
        "script",
        "stylesheet",
        "image",
        "font",
        "other",
      ],
    },
  };

  // Set default export filename
  exportFilename.value = `request-analyzer-export-${new Date()
    .toISOString()
    .slice(0, 10)}`;

  // Load config
  loadConfig();

  // Load requests
  loadRequests();

  // Set up event listeners
  filterBtn.addEventListener("click", toggleFilterPanel);
  clearBtn.addEventListener("click", clearRequests);
  exportBtn.addEventListener("click", toggleExportPanel);
  configBtn.addEventListener("click", toggleConfigPanel);
  closeDetails.addEventListener("click", hideRequestDetails);
  applyFilterBtn.addEventListener("click", applyFilters);
  resetFilterBtn.addEventListener("click", resetFilters);
  doExportBtn.addEventListener("click", exportData);
  cancelExportBtn.addEventListener("click", toggleExportPanel);
  saveConfigBtn.addEventListener("click", saveConfig);
  cancelConfigBtn.addEventListener("click", toggleConfigPanel);
  prevPageBtn.addEventListener("click", () => changePage(currentPage - 1));
  nextPageBtn.addEventListener("click", () => changePage(currentPage + 1));
  vizApplyFilterBtn.addEventListener("click", applyVisualizationFilters);
  vizResetFilterBtn.addEventListener("click", resetVisualizationFilters);
  OptionsPage.addEventListener("click", () => openOptionsPage);
  closeBtn.addEventListener("click", () => closeBtnClick());
  // Close button click event
  closeBtnClick = () => {
    window.close();
  };
  // Open options page
  openOptionsPage = () => {
    document.getElementById("open-options").addEventListener("click", () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL("options.html"));
      }
    });
  };
  // Tab navigation
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;

      // Update active tab button
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update active tab content
      tabContents.forEach((content) => {
        content.classList.remove("active");
        if (content.id === `${tabName}-tab`) {
          content.classList.add("active");
        }
      });

      // Load tab-specific data
      if (tabName === "stats") {
        loadStats();
      } else if (tabName === "plots") {
        loadPlots();
      } else if (tabName === "visualization") {
        loadVisualizationData();
      }
    });
  });

  // Chart tab navigation
  chartTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const chartType = tab.dataset.chart;

      // Update active tab
      chartTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Update active panel
      chartPanels.forEach((panel) => {
        panel.classList.remove("active");
        if (panel.id === `${chartType}Chart`) {
          panel.classList.add("active");
        }
      });
    });
  });

  // Listen for updates from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "requestUpdated") {
      // Reload data instead of updating in-place to ensure consistency with SQLite
      loadRequests();
    }
  });

  // Load configuration from background script
  function loadConfig() {
    chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
      if (response && response.config) {
        config = response.config;

        // Update UI with config values
        captureEnabled.checked = config.captureEnabled;
        maxStoredRequests.value = config.maxStoredRequests;

        // Update capture type checkboxes
        captureTypeCheckboxes.forEach((checkbox) => {
          checkbox.checked = config.captureFilters.includeTypes.includes(
            checkbox.value
          );
        });

        // Update domain filters
        includeDomains.value = config.captureFilters.includeDomains.join(", ");
        excludeDomains.value = config.captureFilters.excludeDomains.join(", ");
      }
    });
  }

  // Save configuration to background script
  function saveConfig() {
    // Get values from UI
    const newConfig = {
      captureEnabled: captureEnabled.checked,
      maxStoredRequests: Number.parseInt(maxStoredRequests.value, 10),
      captureFilters: {
        includeDomains: includeDomains.value
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d),
        excludeDomains: excludeDomains.value
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d),
        includeTypes: Array.from(captureTypeCheckboxes)
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => checkbox.value),
      },
    };

    // Save to background script
    chrome.runtime.sendMessage(
      {
        action: "updateConfig",
        config: newConfig,
      },
      (response) => {
        if (response && response.success) {
          // Update local config
          config = newConfig;

          // Hide config panel
          toggleConfigPanel();

          // Show success message
          showNotification("Configuration saved successfully");
        }
      }
    );
  }

  // Load requests from background script
  function loadRequests() {
    // Get filters for database query
    const filters = {
      status: activeFilters.status !== "all" ? activeFilters.status : null,
      type: activeFilters.type !== "all" ? activeFilters.type : null,
      domain: activeFilters.domain || null,
      url: activeFilters.url || null,
      startDate: activeFilters.startDate || null,
      endDate: activeFilters.endDate || null,
    };

    chrome.runtime.sendMessage(
      {
        action: "getRequestsFromDB",
        page: currentPage,
        limit: itemsPerPage,
        filters: filters,
      },
      (response) => {
        if (response && !response.error) {
          // Convert array of arrays to array of objects
          const requests = response.requests.map((row) => {
            const obj = {};
            response.columns.forEach((col, i) => {
              obj[col] = row[i];
            });
            return obj;
          });

          filteredRequests = requests;
          totalItems = response.total;
          totalPages = Math.ceil(totalItems / itemsPerPage);

          // Update pagination UI
          updatePagination();

          // Render the table
          renderRequestsTable();

          // Update stats
          updateStats();
        } else if (response && response.error) {
          console.error("Error loading requests:", response.error);
          showNotification("Error loading requests: " + response.error);
        }
      }
    );
  }

  // Update pagination UI
  function updatePagination() {
    pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  // Change page
  function changePage(page) {
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    loadRequests();
  }

  // Render the requests table
  function renderRequestsTable() {
    requestsTableBody.innerHTML = "";

    if (filteredRequests.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `<td colspan="8" class="empty-message">No requests captured yet</td>`;
      requestsTableBody.appendChild(emptyRow);
      return;
    }

    filteredRequests.forEach((request) => {
      const row = document.createElement("tr");
      row.dataset.requestId = request.id;

      // Determine status class
      let statusClass = "status-pending";
      if (request.status === "completed" || request.status > 0) {
        const statusCode = request.statusCode || request.status;
        statusClass =
          statusCode >= 200 && statusCode < 400
            ? "status-success"
            : "status-error";
      } else if (request.status === "error") {
        statusClass = "status-error";
      }

      // Format duration
      const duration = request.duration
        ? `${Math.round(request.duration)}ms`
        : "-";

      // Format time
      const time = new Date(
        request.timestamp || request.startTime
      ).toLocaleTimeString();

      // Format size
      const size = request.size ? formatBytes(request.size) : "-";

      row.innerHTML = `
        <td>${request.method}</td>
        <td>${request.domain || "-"}</td>
        <td title="${request.path}">${
        request.path
          ? request.path.length > 30
            ? request.path.substring(0, 30) + "..."
            : request.path
          : "-"
      }</td>
        <td class="${statusClass}">${
        request.statusCode || request.status || "-"
      }</td>
        <td>${request.type || "-"}</td>
        <td>${size}</td>
        <td>${duration}</td>
        <td>${time}</td>
      `;

      // Add click event to show details
      row.addEventListener("click", () => showRequestDetails(request));

      requestsTableBody.appendChild(row);
    });
  }

  // Format bytes to human-readable format
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
    );
  }

  // Show request details panel
  function showRequestDetails(request) {
    // Set basic details
    document.getElementById("detailUrl").textContent = request.url;
    document.getElementById("detailMethod").textContent = request.method;

    document.getElementById("detailStatus").textContent =
      request.statusCode || request.status || "-";
    document.getElementById("detailType").textContent = request.type || "-";
    document.getElementById("detailDomain").textContent = request.domain || "-";
    document.getElementById("detailPath").textContent = request.path || "-";
    document.getElementById("detailSize").textContent = request.size
      ? formatBytes(request.size)
      : "-";
    document.getElementById("detailStartTime").textContent = request.startTime
      ? new Date(request.startTime).toLocaleTimeString()
      : "-";
    document.getElementById("detailEndTime").textContent = request.endTime
      ? new Date(request.endTime).toLocaleTimeString()
      : "-";
    document.getElementById("detailDuration").textContent = request.duration
      ? `${Math.round(request.duration)}ms`
      : "-";

    // Set timing bars if available
    const timings = request.timings || {};
    const maxDuration = request.duration || 0;

    // Update timing bars
    updateTimingBar("dnsBar", "dnsTime", timings.dns || 0, maxDuration);
    updateTimingBar("tcpBar", "tcpTime", timings.tcp || 0, maxDuration);
    updateTimingBar("sslBar", "sslTime", timings.ssl || 0, maxDuration);
    updateTimingBar("ttfbBar", "ttfbTime", timings.ttfb || 0, maxDuration);
    updateTimingBar(
      "downloadBar",
      "downloadTime",
      timings.download || 0,
      maxDuration
    );

    // Load headers if available
    const headersContainer = document.getElementById("headersContainer");
    headersContainer.innerHTML = "";

    // Fetch headers from database
    chrome.runtime.sendMessage(
      {
        action: "getRequestHeaders",
        requestId: request.id,
      },
      (response) => {
        if (response && response.headers && response.headers.length > 0) {
          const table = document.createElement("table");
          table.className = "headers-table";

          const thead = document.createElement("thead");
          thead.innerHTML = "<tr><th>Name</th><th>Value</th></tr>";
          table.appendChild(thead);

          const tbody = document.createElement("tbody");

          response.headers.forEach((header) => {
            const row = document.createElement("tr");
            row.innerHTML = `
              <td>${header.name}</td>
              <td>${header.value}</td>
            `;
            tbody.appendChild(row);
          });

          table.appendChild(tbody);
          headersContainer.appendChild(table);
        } else {
          headersContainer.innerHTML =
            '<p class="no-data">No headers available</p>';
        }
      }
    );

    // Show the details panel
    requestDetails.classList.add("visible");
  }

  // Update a timing bar
  function updateTimingBar(barId, timeId, duration, maxDuration) {
    const bar = document.getElementById(barId);
    const timeEl = document.getElementById(timeId);

    if (maxDuration > 0) {
      const percentage = Math.min((duration / maxDuration) * 100, 100);
      bar.style.width = `${percentage}%`;
    } else {
      bar.style.width = "0%";
    }

    timeEl.textContent = `${Math.round(duration)}ms`;
  }

  // Hide request details panel
  function hideRequestDetails() {
    requestDetails.classList.remove("visible");
  }

  // Toggle filter panel visibility
  function toggleFilterPanel() {
    filterPanel.classList.toggle("visible");
    exportPanel.classList.remove("visible");
    configPanel.classList.remove("visible");
  }

  // Toggle export panel visibility
  function toggleExportPanel() {
    exportPanel.classList.toggle("visible");
    filterPanel.classList.remove("visible");
    configPanel.classList.remove("visible");
  }

  // Toggle config panel visibility
  function toggleConfigPanel() {
    configPanel.classList.toggle("visible");
    filterPanel.classList.remove("visible");
    exportPanel.classList.remove("visible");
  }

  // Apply filters to requests
  function applyFilters() {
    // Get filter values
    activeFilters.status = statusFilter.value;
    activeFilters.type = typeFilter.value;
    activeFilters.domain = domainFilter.value;
    activeFilters.url = urlFilter.value;
    activeFilters.startDate = startDateFilter.value;
    activeFilters.endDate = endDateFilter.value;

    // Reset to first page
    currentPage = 1;

    // Load filtered requests
    loadRequests();

    // Hide filter panel
    filterPanel.classList.remove("visible");
  }

  // Reset filters
  function resetFilters() {
    statusFilter.value = "all";
    typeFilter.value = "all";
    domainFilter.value = "";
    urlFilter.value = "";
    startDateFilter.value = "";
    endDateFilter.value = "";

    activeFilters = {
      status: "all",
      type: "all",
      domain: "",
      url: "",
      startDate: "",
      endDate: "",
    };

    // Reset to first page
    currentPage = 1;

    // Load all requests
    loadRequests();

    // Hide filter panel
    filterPanel.classList.remove("visible");
  }

  // Apply visualization filters
  function applyVisualizationFilters() {
    loadVisualizationData();
  }

  // Reset visualization filters
  function resetVisualizationFilters() {
    document.getElementById("vizDomainFilter").value = "";
    document.getElementById("vizMethodFilter").value = "";
    document.getElementById("vizStatusFilter").value = "";

    loadVisualizationData();
  }

  // Clear all requests
  function clearRequests() {
    if (
      confirm(
        "Are you sure you want to clear all captured requests? This cannot be undone."
      )
    ) {
      chrome.runtime.sendMessage({ action: "clearRequests" }, (response) => {
        if (response && response.success) {
          // Reload requests
          loadRequests();

          // Hide details panel
          hideRequestDetails();

          // Show notification
          showNotification("All requests cleared successfully");
        }
      });
    }
  }

  // Export data
  function exportData() {
    const format = exportFormat.value;
    const filename =
      exportFilename.value ||
      `request-analyzer-export-${new Date().toISOString().slice(0, 10)}`;

    chrome.runtime.sendMessage(
      {
        action: "exportData",
        format: format,
        filename: filename,
      },
      (response) => {
        if (response && response.success) {
          // Hide export panel
          toggleExportPanel();

          // Show notification
          showNotification(
            `Data exported successfully as ${format.toUpperCase()}`
          );
        }
      }
    );
  }

  // Update statistics
  function updateStats() {
    // Calculate stats from filtered requests
    const totalRequests = filteredRequests.length;
    totalRequestsEl.textContent = totalRequests;

    // Calculate average response time
    let totalDuration = 0;
    let completedCount = 0;

    filteredRequests.forEach((req) => {
      if (req.duration) {
        totalDuration += req.duration;
        completedCount++;
      }
    });

    const avgResponseTime =
      completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;
    avgResponseTimeEl.textContent = `${avgResponseTime} ms`;

    // Calculate success rate
    const successfulRequests = filteredRequests.filter((req) => {
      const status = req.statusCode || req.status;
      return status >= 200 && status < 400;
    }).length;

    const successRate =
      totalRequests > 0
        ? Math.round((successfulRequests / totalRequests) * 100)
        : 0;
    successRateEl.textContent = `${successRate}%`;
  }

  // Load statistics for stats tab
  function loadStats() {
    chrome.runtime.sendMessage({ action: "getStats" }, (response) => {
      if (response && response.stats) {
        const stats = response.stats;

        // Update summary stats
        document.getElementById("statsTotalRequests").textContent =
          stats.totalRequests;
        document.getElementById(
          "statsAvgResponseTime"
        ).textContent = `${stats.avgResponseTime} ms`;

        // Calculate successful and failed requests
        let successfulCount = 0;
        let failedCount = 0;

        Object.entries(stats.statusCodes).forEach(([code, count]) => {
          if (code >= 200 && code < 400) {
            successfulCount += count;
          } else {
            failedCount += count;
          }
        });

        document.getElementById("statsSuccessfulRequests").textContent =
          successfulCount;
        document.getElementById("statsFailedRequests").textContent =
          failedCount;

        // Update status codes
        const statusCodesEl = document.getElementById("statsStatusCodes");
        statusCodesEl.innerHTML = "";

        Object.entries(stats.statusCodes)
          .sort(([a], [b]) => Number.parseInt(a) - Number.parseInt(b))
          .forEach(([code, count]) => {
            const row = document.createElement("div");
            row.className = "stat-row";

            let statusClass = "";
            if (code >= 200 && code < 300) statusClass = "status-success";
            else if (code >= 300 && code < 400) statusClass = "status-redirect";
            else if (code >= 400) statusClass = "status-error";

            row.innerHTML = `
              <span class="stat-name ${statusClass}">${code}:</span>
              <span class="stat-value">${count}</span>
            `;

            statusCodesEl.appendChild(row);
          });

        // Update top domains
        const topDomainsEl = document.getElementById("statsTopDomains");
        topDomainsEl.innerHTML = "";

        stats.topDomains.forEach(({ domain, count }) => {
          const row = document.createElement("div");
          row.className = "stat-row";
          row.innerHTML = `
            <span class="stat-name">${domain}:</span>
            <span class="stat-value">${count}</span>
          `;

          topDomainsEl.appendChild(row);
        });

        // Update request types
        const requestTypesEl = document.getElementById("statsRequestTypes");
        requestTypesEl.innerHTML = "";

        Object.entries(stats.requestTypes).forEach(([type, count]) => {
          const row = document.createElement("div");
          row.className = "stat-row";
          row.innerHTML = `
            <span class="stat-name">${type}:</span>
            <span class="stat-value">${count}</span>
          `;

          requestTypesEl.appendChild(row);
        });
      }
    });
  }

  // Load plots for plots tab
  function loadPlots() {
    chrome.runtime.sendMessage({ action: "getStats" }, (response) => {
      if (response && response.stats) {
        const stats = response.stats;

        // Create or update charts
        createResponseTimeChart(stats);
        createStatusCodeChart(stats);
        createDomainChart(stats);
        createRequestTypeChart(stats);
        createTimeDistributionChart(stats);
      }
    });
  }

  // Load visualization data
  function loadVisualizationData() {
    // Get filter values
    const domain = document.getElementById("vizDomainFilter").value;
    const method = document.getElementById("vizMethodFilter").value;
    const statusCode = document.getElementById("vizStatusFilter").value;

    // Build filters object
    const filters = {};
    if (domain) filters.domain = domain;
    if (method) filters.method = method;
    if (statusCode) filters.statusCode = statusCode;

    // Request filtered stats from background script
    chrome.runtime.sendMessage(
      {
        action: "getFilteredStats",
        filters: filters,
      },
      (response) => {
        if (response && !response.error) {
          // Create or update visualization charts
          createVizResponseTimeChart(response);
          createVizStatusCodeChart(response);
          createVizRequestTypeChart(response);
          createVizTimeDistributionChart(response);
          createVizSizeDistributionChart(response);
        } else {
          console.error("Error loading visualization data:", response?.error);
        }
      }
    );

    // Load domain options if not already loaded
    if (document.getElementById("vizDomainFilter").options.length <= 1) {
      chrome.runtime.sendMessage(
        { action: "getDistinctValues", field: "domain" },
        (response) => {
          if (response && response.values) {
            const select = document.getElementById("vizDomainFilter");
            response.values.forEach((domain) => {
              const option = document.createElement("option");
              option.value = domain;
              option.textContent = domain;
              select.appendChild(option);
            });
          }
        }
      );
    }
  }

  // Create response time distribution chart
  function createResponseTimeChart(stats) {
    if (!responseTimePlot) return;

    // Define bins for response time (in ms)
    const bins = [
      { label: "0-100ms", min: 0, max: 100 },
      { label: "100-300ms", min: 100, max: 300 },
      { label: "300-500ms", min: 300, max: 500 },
      { label: "500ms-1s", min: 500, max: 1000 },
      { label: "1s-3s", min: 1000, max: 3000 },
      { label: "3s+", min: 3000, max: Number.POSITIVE_INFINITY },
    ];

    // Request response time distribution from background script
    chrome.runtime.sendMessage(
      { action: "getResponseTimeDistribution" },
      (response) => {
        // Dummy data if no response
        const responseTimes = response?.distribution || [];

        // Count requests in each bin
        const data = bins.map((bin) => {
          return responseTimes.filter(
            (time) => time >= bin.min && time < bin.max
          ).length;
        });

        // Destroy existing chart
        if (charts.responseTime) {
          charts.responseTime.destroy();
        }

        // Create new chart
        charts.responseTime = new Chart(responseTimePlot.getContext("2d"), {
          type: "bar",
          data: {
            labels: bins.map((bin) => bin.label),
            datasets: [
              {
                label: "Number of Requests",
                data: data,
                backgroundColor: "rgba(54, 162, 235, 0.5)",
                borderColor: "rgba(54, 162, 235, 1)",
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
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
    );
  }

  // Create status code distribution chart
  function createStatusCodeChart(stats) {
    if (!statusCodePlot) return;

    // Group status codes by category
    const statusGroups = {
      "2xx": 0,
      "3xx": 0,
      "4xx": 0,
      "5xx": 0,
      Other: 0,
    };

    // Count status codes
    Object.entries(stats.statusCodes).forEach(([code, count]) => {
      const codeNum = Number.parseInt(code, 10);
      if (codeNum >= 200 && codeNum < 300) statusGroups["2xx"] += count;
      else if (codeNum >= 300 && codeNum < 400) statusGroups["3xx"] += count;
      else if (codeNum >= 400 && codeNum < 500) statusGroups["4xx"] += count;
      else if (codeNum >= 500 && codeNum < 600) statusGroups["5xx"] += count;
      else statusGroups["Other"] += count;
    });

    // Define colors for each category
    const colors = {
      "2xx": "rgba(75, 192, 192, 0.5)",
      "3xx": "rgba(255, 206, 86, 0.5)",
      "4xx": "rgba(255, 99, 132, 0.5)",
      "5xx": "rgba(153, 102, 255, 0.5)",
      Other: "rgba(201, 203, 207, 0.5)",
    };

    const borderColors = {
      "2xx": "rgba(75, 192, 192, 1)",
      "3xx": "rgba(255, 206, 86, 1)",
      "4xx": "rgba(255, 99, 132, 1)",
      "5xx": "rgba(153, 102, 255, 1)",
      Other: "rgba(201, 203, 207, 1)",
    };

    // Destroy existing chart
    if (charts.statusCode) {
      charts.statusCode.destroy();
    }

    // Create new chart
    charts.statusCode = new Chart(statusCodePlot.getContext("2d"), {
      type: "pie",
      data: {
        labels: Object.keys(statusGroups),
        datasets: [
          {
            data: Object.values(statusGroups),
            backgroundColor: Object.keys(statusGroups).map(
              (key) => colors[key]
            ),
            borderColor: Object.keys(statusGroups).map(
              (key) => borderColors[key]
            ),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || "";
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage =
                  total > 0 ? Math.round((value / total) * 100) : 0;
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  }

  // Create domain distribution chart
  function createDomainChart(stats) {
    if (!domainPlot) return;

    const topDomains = stats.topDomains || [];

    // Destroy existing chart
    if (charts.domain) {
      charts.domain.destroy();
    }

    // Create new chart
    charts.domain = new Chart(domainPlot.getContext("2d"), {
      type: "bar",
      data: {
        labels: topDomains.map((d) => d.domain),
        datasets: [
          {
            label: "Number of Requests",
            data: topDomains.map((d) => d.count),
            backgroundColor: "rgba(255, 159, 64, 0.5)",
            borderColor: "rgba(255, 159, 64, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Number of Requests",
            },
          },
        },
      },
    });
  }

  // Create request type distribution chart
  function createRequestTypeChart(stats) {
    if (!requestTypePlot) return;

    const requestTypes = stats.requestTypes || {};

    // Destroy existing chart
    if (charts.requestType) {
      charts.requestType.destroy();
    }

    // Create new chart
    charts.requestType = new Chart(requestTypePlot.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: Object.keys(requestTypes),
        datasets: [
          {
            data: Object.values(requestTypes),
            backgroundColor: [
              "rgba(255, 99, 132, 0.5)",
              "rgba(54, 162, 235, 0.5)",
              "rgba(255, 206, 86, 0.5)",
              "rgba(75, 192, 192, 0.5)",
              "rgba(153, 102, 255, 0.5)",
              "rgba(255, 159, 64, 0.5)",
              "rgba(201, 203, 207, 0.5)",
            ],
            borderColor: [
              "rgba(255, 99, 132, 1)",
              "rgba(54, 162, 235, 1)",
              "rgba(255, 206, 86, 1)",
              "rgba(75, 192, 192, 1)",
              "rgba(153, 102, 255, 1)",
              "rgba(255, 159, 64, 1)",
              "rgba(201, 203, 207, 1)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || "";
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage =
                  total > 0 ? Math.round((value / total) * 100) : 0;
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  }

  // Create time distribution chart
  function createTimeDistributionChart(stats) {
    if (!timeDistributionPlot) return;

    const timeDistribution = stats.timeDistribution || {};

    // Create labels for each hour
    const labels = [];
    for (let i = 0; i < 24; i++) {
      labels.push(`${i}:00`);
    }

    // Create data array
    const data = [];
    for (let i = 0; i < 24; i++) {
      data.push(timeDistribution[i] || 0);
    }

    // Destroy existing chart
    if (charts.timeDistribution) {
      charts.timeDistribution.destroy();
    }

    // Create new chart
    charts.timeDistribution = new Chart(timeDistributionPlot.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Number of Requests",
            data: data,
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
              text: "Time (Last 24 Hours)",
            },
          },
        },
      },
    });
  }

  // Create visualization charts
  function createVizResponseTimeChart(data) {
    if (!vizResponseTimePlot) return;

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
      return data.responseTimes.filter(
        (time) => time >= bin.min && time < bin.max
      ).length;
    });

    // Destroy existing chart
    if (charts.vizResponseTime) {
      charts.vizResponseTime.destroy();
    }

    // Create new chart
    charts.vizResponseTime = new Chart(vizResponseTimePlot.getContext("2d"), {
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

  // Create visualization status code chart
  function createVizStatusCodeChart(data) {
    if (!vizStatusCodePlot) return;

    // Group status codes by category
    const statusGroups = {
      "2xx": 0,
      "3xx": 0,
      "4xx": 0,
      "5xx": 0,
      Other: 0,
    };

    // Count status codes
    Object.entries(data.statusCodes).forEach(([code, count]) => {
      const codeNum = Number.parseInt(code, 10);
      if (codeNum >= 200 && codeNum < 300) statusGroups["2xx"] += count;
      else if (codeNum >= 300 && codeNum < 400) statusGroups["3xx"] += count;
      else if (codeNum >= 400 && codeNum < 500) statusGroups["4xx"] += count;
      else if (codeNum >= 500 && codeNum < 600) statusGroups["5xx"] += count;
      else statusGroups["Other"] += count;
    });

    // Define colors for each category
    const colors = {
      "2xx": "rgba(75, 192, 192, 0.5)",
      "3xx": "rgba(255, 206, 86, 0.5)",
      "4xx": "rgba(255, 99, 132, 0.5)",
      "5xx": "rgba(153, 102, 255, 0.5)",
      Other: "rgba(201, 203, 207, 0.5)",
    };

    const borderColors = {
      "2xx": "rgba(75, 192, 192, 1)",
      "3xx": "rgba(255, 206, 86, 1)",
      "4xx": "rgba(255, 99, 132, 1)",
      "5xx": "rgba(153, 102, 255, 1)",
      Other: "rgba(201, 203, 207, 1)",
    };

    // Destroy existing chart
    if (charts.vizStatusCode) {
      charts.vizStatusCode.destroy();
    }

    // Create new chart
    charts.vizStatusCode = new Chart(vizStatusCodePlot.getContext("2d"), {
      type: "pie",
      data: {
        labels: Object.keys(statusGroups),
        datasets: [
          {
            data: Object.values(statusGroups),
            backgroundColor: Object.keys(statusGroups).map(
              (key) => colors[key]
            ),
            borderColor: Object.keys(statusGroups).map(
              (key) => borderColors[key]
            ),
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
            text: "Status Code Distribution",
          },
          legend: {
            position: "right",
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || "";
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage =
                  total > 0 ? Math.round((value / total) * 100) : 0;
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  }

  // Create visualization request type chart
  function createVizRequestTypeChart(data) {
    if (!vizRequestTypePlot) return;

    // Destroy existing chart
    if (charts.vizRequestType) {
      charts.vizRequestType.destroy();
    }

    // Create new chart
    charts.vizRequestType = new Chart(vizRequestTypePlot.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: Object.keys(data.requestTypes),
        datasets: [
          {
            data: Object.values(data.requestTypes),
            backgroundColor: [
              "rgba(255, 99, 132, 0.5)",
              "rgba(54, 162, 235, 0.5)",
              "rgba(255, 206, 86, 0.5)",
              "rgba(75, 192, 192, 0.5)",
              "rgba(153, 102, 255, 0.5)",
              "rgba(255, 159, 64, 0.5)",
              "rgba(201, 203, 207, 0.5)",
            ],
            borderColor: [
              "rgba(255, 99, 132, 1)",
              "rgba(54, 162, 235, 1)",
              "rgba(255, 206, 86, 1)",
              "rgba(75, 192, 192, 1)",
              "rgba(153, 102, 255, 1)",
              "rgba(255, 159, 64, 1)",
              "rgba(201, 203, 207, 1)",
            ],
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
            text: "Request Type Distribution",
          },
          legend: {
            position: "right",
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || "";
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage =
                  total > 0 ? Math.round((value / total) * 100) : 0;
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  }

  // Create visualization time distribution chart
  function createVizTimeDistributionChart(data) {
    if (!vizTimeDistributionPlot) return;

    // Create labels for each hour
    const labels = [];
    for (let i = 0; i < 24; i++) {
      labels.push(`${i}:00`);
    }

    // Create data array
    const timeData = [];
    for (let i = 0; i < 24; i++) {
      timeData.push(data.timeDistribution[i] || 0);
    }

    // Destroy existing chart
    if (charts.vizTimeDistribution) {
      charts.vizTimeDistribution.destroy();
    }

    // Create new chart
    charts.vizTimeDistribution = new Chart(
      vizTimeDistributionPlot.getContext("2d"),
      {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Number of Requests",
              data: timeData,
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              borderColor: "rgba(75, 192, 192, 1)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Requests Over Time (Last 24 Hours)",
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
                text: "Time",
              },
            },
          },
        },
      }
    );
  }

  // Create visualization size distribution chart
  function createVizSizeDistributionChart(data) {
    if (!vizSizeDistributionPlot) return;

    // Define bins for size (in KB)
    const sizeBins = [
      { label: "0-10KB", min: 0, max: 10 * 1024 },
      { label: "10-50KB", min: 10 * 1024, max: 50 * 1024 },
      { label: "50-100KB", min: 50 * 1024, max: 100 * 1024 },
      { label: "100-500KB", min: 100 * 1024, max: 500 * 1024 },
      { label: "500KB-1MB", min: 500 * 1024, max: 1024 * 1024 },
      { label: "1MB+", min: 1024 * 1024, max: Number.POSITIVE_INFINITY },
    ];

    // Count requests in each bin
    const sizeCounts = sizeBins.map((bin) => {
      return data.sizes.filter((size) => size >= bin.min && size < bin.max)
        .length;
    });

    // Destroy existing chart
    if (charts.vizSizeDistribution) {
      charts.vizSizeDistribution.destroy();
    }

    // Create new chart
    charts.vizSizeDistribution = new Chart(
      vizSizeDistributionPlot.getContext("2d"),
      {
        type: "bar",
        data: {
          labels: sizeBins.map((bin) => bin.label),
          datasets: [
            {
              label: "Number of Requests",
              data: sizeCounts,
              backgroundColor: "rgba(153, 102, 255, 0.5)",
              borderColor: "rgba(153, 102, 255, 1)",
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
              text: "Response Size Distribution",
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
                text: "Response Size",
              },
            },
          },
        },
      }
    );
  }

  // Show notification
  function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
      notification.classList.add("visible");
    }, 10);

    // Hide notification after 3 seconds
    setTimeout(() => {
      notification.classList.remove("visible");

      // Remove from DOM after animation
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }
});
