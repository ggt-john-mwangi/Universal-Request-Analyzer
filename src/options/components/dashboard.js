// Dashboard Component
// Manages the dashboard visualization and real-time metrics

import Chart from "../../lib/chart.min.js";

class Dashboard {
  constructor() {
    this.charts = {};
    this.refreshInterval = null;
    this.timeRange = 86400; // Default 24 hours
    this.currentRequests = []; // Store current requests for cURL export
    this.currentErrors = []; // Store current errors for actions
    this.searchTimeout = null; // Debounce search input
  }

  async initialize() {
    console.log("Initializing Dashboard...");

    // Load domain filter first
    await this.loadDomainFilter();

    // Setup event listeners
    this.setupEventListeners();

    // Initialize charts
    this.initializeCharts();

    // Load initial data
    await this.refreshDashboard();

    // Start auto-refresh
    this.startAutoRefresh();

    console.log("✓ Dashboard initialized");
  }

  setupEventListeners() {
    // Dashboard Sub-Tabs Navigation
    const tabButtons = document.querySelectorAll(".dashboard-tab-btn");
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        this.switchDashboardTab(tab);
      });
    });

    const domainFilter = document.getElementById("dashboardDomainFilter");
    if (domainFilter) {
      domainFilter.addEventListener("change", () =>
        this.onDomainFilterChange()
      );
    }

    const pageFilter = document.getElementById("dashboardPageFilter");
    if (pageFilter) {
      pageFilter.addEventListener("change", () => this.refreshDashboard());
    }

    const requestTypeFilter = document.getElementById(
      "dashboardRequestTypeFilter"
    );
    if (requestTypeFilter) {
      requestTypeFilter.addEventListener("change", () =>
        this.refreshDashboard()
      );
    }

    const timeRangeSelect = document.getElementById("dashboardTimeRange");
    if (timeRangeSelect) {
      timeRangeSelect.addEventListener("change", (e) => {
        this.timeRange = parseInt(e.target.value);
        this.refreshDashboard();
      });
    }

    const refreshBtn = document.getElementById("dashboardRefresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.refreshDashboard());
    }

    // Endpoint Performance Over Time controls
    const loadHistoryBtn = document.getElementById("dashboardLoadHistoryBtn");
    if (loadHistoryBtn) {
      loadHistoryBtn.addEventListener("click", () =>
        this.loadEndpointPerformanceHistory()
      );
    }

    const endpointTypeFilter = document.getElementById(
      "dashboardEndpointTypeFilter"
    );
    if (endpointTypeFilter) {
      endpointTypeFilter.addEventListener("change", () =>
        this.loadEndpointPerformanceHistory()
      );
    }

    const endpointPattern = document.getElementById("dashboardEndpointPattern");
    if (endpointPattern) {
      endpointPattern.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.loadEndpointPerformanceHistory();
      });
      endpointPattern.addEventListener("blur", () => {
        const val = endpointPattern.value.trim();
        if (val) this.loadEndpointPerformanceHistory();
      });
    }

    // Requests Table controls
    const searchRequests = document.getElementById("dashboardSearchRequests");
    if (searchRequests) {
      searchRequests.addEventListener("input", () => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.loadRequestsTable(1), 500);
      });
    }

    const requestsPerPage = document.getElementById("dashboardRequestsPerPage");
    if (requestsPerPage) {
      requestsPerPage.addEventListener("change", () =>
        this.loadRequestsTable(1)
      );
    }

    const exportHAR = document.getElementById("dashboardExportHAR");
    if (exportHAR) {
      exportHAR.addEventListener("click", () => this.exportAsHAR());
    }

    // Requests table event delegation
    const requestsTableBody = document.getElementById(
      "dashboardRequestsTableBody"
    );
    if (requestsTableBody) {
      requestsTableBody.addEventListener("click", (e) => {
        const viewBtn = e.target.closest(".btn-view-details");
        if (viewBtn) {
          const requestId = viewBtn.dataset.requestId;
          this.viewRequestDetails(requestId);
          return;
        }

        const curlBtn = e.target.closest(".btn-copy-curl");
        if (curlBtn) {
          const requestId = curlBtn.dataset.requestId;
          const requestData = this.currentRequests?.find(
            (r) => r.id === requestId
          );
          if (requestData) {
            this.copyAsCurl(requestData);
          }
          return;
        }
      });
    }

    // Errors list event delegation
    const errorsList = document.getElementById("dashboardErrorsList");
    if (errorsList) {
      errorsList.addEventListener("click", (e) => {
        const detailsBtn = e.target.closest(".btn-error-details");
        if (detailsBtn) {
          const requestId = detailsBtn.dataset.requestId;
          const request = this.currentErrors?.find((r) => r.id === requestId);
          if (request) {
            this.viewRequestDetails(requestId);
          }
          return;
        }

        const curlBtn = e.target.closest(".btn-error-curl");
        if (curlBtn) {
          const requestId = curlBtn.dataset.requestId;
          const request = this.currentErrors?.find((r) => r.id === requestId);
          if (request) {
            this.copyAsCurl(request);
          }
          return;
        }
      });
    }
  }

  // Helper to get theme colors from CSS variables
  getThemeColor(colorName) {
    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue(colorName).trim();
  }

  // Get chart colors from theme
  getChartColors() {
    return {
      success: this.getThemeColor("--success-color"),
      info: this.getThemeColor("--info-color"),
      warning: this.getThemeColor("--warning-color"),
      error: this.getThemeColor("--error-color"),
      primary: this.getThemeColor("--primary-color"),
    };
  }

  initializeCharts() {
    const colors = this.getChartColors();

    // Volume Chart - Line chart for request volume over time
    const volumeCanvas = document.getElementById("dashboardVolumeChart");
    if (volumeCanvas) {
      const ctx = volumeCanvas.getContext("2d");
      this.charts.volume = new Chart(ctx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Requests",
              data: [],
              borderColor: colors.success,
              backgroundColor: "transparent",
              tension: 0.4,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: "top",
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
          },
        },
      });
    }

    // Status Chart - Doughnut chart for status distribution
    const statusCanvas = document.getElementById("dashboardStatusChart");
    if (statusCanvas) {
      const ctx = statusCanvas.getContext("2d");
      this.charts.status = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: [
            "2xx Success",
            "3xx Redirect",
            "4xx Client Error",
            "5xx Server Error",
          ],
          datasets: [
            {
              data: [],
              backgroundColor: [
                colors.success,
                colors.info,
                colors.warning,
                colors.error,
              ],
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
          },
        },
      });
    }

    // Domains Chart - Horizontal bar chart for top domains
    const domainsCanvas = document.getElementById("dashboardDomainsChart");
    if (domainsCanvas) {
      const ctx = domainsCanvas.getContext("2d");
      this.charts.domains = new Chart(ctx, {
        type: "bar",
        data: {
          labels: [],
          datasets: [
            {
              label: "Requests",
              data: [],
              backgroundColor: colors.primary,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            x: {
              beginAtZero: true,
            },
          },
        },
      });
    }

    // Performance Chart - Line chart for performance trends
    const perfCanvas = document.getElementById("dashboardPerformanceChart");
    if (perfCanvas) {
      const ctx = perfCanvas.getContext("2d");
      this.charts.performance = new Chart(ctx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Avg Response Time (ms)",
              data: [],
              borderColor: colors.info,
              backgroundColor: "transparent",
              tension: 0.4,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: "top",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Response Time (ms)",
              },
            },
          },
        },
      });
    }
  }

  async refreshDashboard() {
    console.log("Refreshing dashboard...");

    // Show loading state
    this.showLoadingState(true);

    try {
      // Get aggregated stats from background
      const stats = await this.getAggregatedStats();

      // Update metric cards
      this.updateMetricCards(stats);

      // Update charts
      this.updateCharts(stats);

      // Update medallion layer status
      this.updateLayerStatus(stats);

      // Update Core Web Vitals
      await this.updateWebVitals();

      // Update Session Metrics
      await this.updateSessionMetrics();

      console.log("✓ Dashboard refreshed");
    } catch (error) {
      console.error("Failed to refresh dashboard:", error);
      this.showError("Failed to load dashboard data. Please try refreshing.");
    } finally {
      // Hide loading state
      this.showLoadingState(false);
    }
  }

  showLoadingState(isLoading) {
    const container = document.querySelector(".dashboard-container");
    const metricsSection = document.querySelector(".metrics-grid");
    const chartsSection = document.querySelector(".dashboard-charts");

    if (isLoading) {
      container?.classList.add("loading");
      if (metricsSection) metricsSection.style.opacity = "0.5";
      if (chartsSection) chartsSection.style.opacity = "0.5";
    } else {
      container?.classList.remove("loading");
      if (metricsSection) metricsSection.style.opacity = "1";
      if (chartsSection) chartsSection.style.opacity = "1";
    }
  }

  showError(message) {
    // Clear any existing timeout for previous error
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
      this.errorTimeout = null;
    }

    const errorContainer = document.createElement("div");
    errorContainer.className = "dashboard-error";
    errorContainer.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
      </div>
    `;

    const container = document.querySelector(".dashboard-container");
    if (container) {
      const existing = container.querySelector(".dashboard-error");
      if (existing) existing.remove();

      container.insertBefore(errorContainer, container.firstChild);

      // Auto-hide after 5 seconds
      this.errorTimeout = setTimeout(() => {
        errorContainer.remove();
        this.errorTimeout = null;
      }, 5000);
    }
  }

  async getAggregatedStats() {
    const filters = this.getActiveFilters();

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "getFilteredStats",
          filters: {
            ...filters,
            timeRange: this.timeRange,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error getting dashboard stats:",
              chrome.runtime.lastError
            );
            resolve(this.getDefaultStats());
            return;
          }

          if (response && response.success) {
            // Convert filtered stats to dashboard stats format
            const stats = {
              totalRequests: response.totalRequests || 0,
              avgResponse: 0,
              slowRequests: 0,
              errorCount: 0,
              volumeTimeline: { labels: response.timestamps || [], values: [] },
              statusDistribution: [0, 0, 0, 0],
              topDomains: { labels: [], values: [] },
              performanceTrend: {
                labels: response.timestamps || [],
                values: response.responseTimes || [],
              },
              layerCounts: { bronze: 0, silver: 0, gold: 0 },
            };

            // Calculate avgResponse
            if (response.responseTimes && response.responseTimes.length > 0) {
              stats.avgResponse =
                response.responseTimes.reduce((a, b) => a + b, 0) /
                response.responseTimes.length;
              stats.slowRequests = response.responseTimes.filter(
                (t) => t > 1000
              ).length;
            }

            // Map status codes to distribution
            if (response.statusCodes) {
              Object.entries(response.statusCodes).forEach(([code, count]) => {
                const statusCode = parseInt(code);
                if (statusCode >= 200 && statusCode < 300)
                  stats.statusDistribution[0] += count;
                else if (statusCode >= 300 && statusCode < 400)
                  stats.statusDistribution[1] += count;
                else if (statusCode >= 400 && statusCode < 500) {
                  stats.statusDistribution[2] += count;
                  stats.errorCount += count;
                } else if (statusCode >= 500) {
                  stats.statusDistribution[3] += count;
                  stats.errorCount += count;
                }
              });
            }

            resolve(stats);
          } else {
            resolve(this.getDefaultStats());
          }
        }
      );
    });
  }

  getDefaultStats() {
    return {
      totalRequests: 0,
      avgResponse: 0,
      slowRequests: 0,
      errorRate: 0,
      volumeTimeline: { labels: [], values: [] },
      statusDistribution: [0, 0, 0, 0],
      topDomains: { labels: [], values: [] },
      performanceTrend: { labels: [], values: [] },
      layerCounts: { bronze: 0, silver: 0, gold: 0 },
    };
  }

  updateMetricCards(stats) {
    // Total Requests
    const totalEl = document.getElementById("dashTotalRequests");
    if (totalEl) {
      totalEl.textContent = (stats.totalRequests || 0).toLocaleString();
    }

    // Avg Response Time
    const avgEl = document.getElementById("dashAvgResponse");
    if (avgEl) {
      avgEl.textContent = `${Math.round(stats.avgResponse || 0)}ms`;
    }

    // Slow Requests
    const slowEl = document.getElementById("dashSlowRequests");
    if (slowEl) {
      slowEl.textContent = (stats.slowRequests || 0).toLocaleString();
    }

    // Error Rate
    const errorEl = document.getElementById("dashErrorRate");
    if (errorEl) {
      const rate =
        stats.totalRequests > 0
          ? (((stats.errorCount || 0) / stats.totalRequests) * 100).toFixed(1)
          : 0;
      errorEl.textContent = `${rate}%`;
    }

    // Update change indicators (simplified - would need historical data for real changes)
    const updateChange = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value >= 0 ? `+${value}%` : `${value}%`;
        el.className = `metric-change ${value >= 0 ? "positive" : "negative"}`;
      }
    };

    updateChange("dashTotalChange", 0);
    updateChange("dashAvgChange", 0);
    updateChange("dashSlowChange", 0);
    updateChange("dashErrorChange", 0);
  }

  updateCharts(stats) {
    // Update volume chart
    if (this.charts.volume && stats.volumeTimeline) {
      this.charts.volume.data.labels = stats.volumeTimeline.labels || [];
      this.charts.volume.data.datasets[0].data =
        stats.volumeTimeline.values || [];
      this.charts.volume.update();
    }

    // Update status chart
    if (this.charts.status && stats.statusDistribution) {
      this.charts.status.data.datasets[0].data = stats.statusDistribution;
      this.charts.status.update();
    }

    // Update domains chart
    if (this.charts.domains && stats.topDomains) {
      this.charts.domains.data.labels = stats.topDomains.labels || [];
      this.charts.domains.data.datasets[0].data = stats.topDomains.values || [];
      this.charts.domains.update();
    }

    // Update performance chart
    if (this.charts.performance && stats.performanceTrend) {
      this.charts.performance.data.labels = stats.performanceTrend.labels || [];
      this.charts.performance.data.datasets[0].data =
        stats.performanceTrend.values || [];
      this.charts.performance.update();
    }
  }

  updateLayerStatus(stats) {
    const bronzeEl = document.getElementById("bronzeCount");
    const silverEl = document.getElementById("silverCount");
    const goldEl = document.getElementById("goldCount");

    if (bronzeEl && stats.layerCounts) {
      bronzeEl.textContent = (stats.layerCounts.bronze || 0).toLocaleString();
    }

    if (silverEl && stats.layerCounts) {
      silverEl.textContent = (stats.layerCounts.silver || 0).toLocaleString();
    }

    if (goldEl && stats.layerCounts) {
      goldEl.textContent = (stats.layerCounts.gold || 0).toLocaleString();
    }
  }

  startAutoRefresh() {
    // Stop any existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.refreshDashboard();
    }, 30000);

    console.log("✓ Dashboard auto-refresh started (30s interval)");
  }

  async loadEndpointPerformanceHistory() {
    try {
      const domainFilter = document.getElementById("dashboardDomainFilter");
      const typeFilter = document.getElementById("dashboardEndpointTypeFilter");
      const endpointPattern = document.getElementById(
        "dashboardEndpointPattern"
      );
      const timeBucket = document.getElementById("dashboardHistoryTimeBucket");

      const selectedDomain = domainFilter?.value || "all";
      const selectedType = typeFilter?.value || "";
      const pattern = endpointPattern?.value?.trim() || "";
      const bucket = timeBucket?.value || "hourly";

      const filters = {
        domain: selectedDomain === "all" ? null : selectedDomain,
        type: selectedType || null,
        endpoint: pattern || null,
        timeBucket: bucket,
        timeRange: this.timeRange,
      };

      const response = await chrome.runtime.sendMessage({
        action: selectedType
          ? "getRequestTypePerformanceHistory"
          : "getEndpointPerformanceHistory",
        filters,
      });

      if (response && response.success) {
        this.renderEndpointPerformanceChart(response);
      }
    } catch (error) {
      console.error("Failed to load endpoint performance history:", error);
    }
  }

  renderEndpointPerformanceChart(response) {
    const canvas = document.getElementById("dashboardHistoryChartCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Destroy existing chart
    if (this.charts.endpointHistory) {
      this.charts.endpointHistory.destroy();
    }

    const groupedData = response.groupedByType || response.groupedByEndpoint;
    if (!groupedData) {
      document.getElementById("dashboardPerformanceHistoryChart").innerHTML =
        '<p class="no-data">No performance data available</p>';
      return;
    }

    const groupKeys = Object.keys(groupedData);
    if (groupKeys.length === 0) {
      document.getElementById("dashboardPerformanceHistoryChart").innerHTML =
        '<p class="no-data">No data found for selected filters</p>';
      return;
    }

    const colors = [
      "#4CAF50",
      "#2196F3",
      "#FF9800",
      "#F44336",
      "#9C27B0",
      "#00BCD4",
    ];

    const datasets = groupKeys.slice(0, 6).map((key, index) => {
      const records = groupedData[key];
      records.sort((a, b) => a.timeBucket.localeCompare(b.timeBucket));

      return {
        label: key,
        data: records.map((r) => ({ x: r.timeBucket, y: r.avgDuration })),
        borderColor: colors[index % colors.length],
        backgroundColor: "transparent",
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });

    this.charts.endpointHistory = new Chart(ctx, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top" },
          title: {
            display: true,
            text: `Performance Over Time (${response.timeBucket})`,
          },
        },
        scales: {
          x: { type: "category", title: { display: true, text: "Time" } },
          y: {
            title: { display: true, text: "Avg Duration (ms)" },
            beginAtZero: true,
          },
        },
      },
    });
  }

  async loadRequestsTable(page = 1) {
    try {
      const domainFilter = document.getElementById("dashboardDomainFilter");
      const searchInput = document.getElementById("dashboardSearchRequests");
      const perPageSelect = document.getElementById("dashboardRequestsPerPage");

      const selectedDomain = domainFilter?.value || "all";
      const searchQuery = searchInput?.value?.trim() || "";
      const perPage = perPageSelect ? parseInt(perPageSelect.value) : 25;
      const offset = (page - 1) * perPage;

      const filters = {
        domain: selectedDomain === "all" ? null : selectedDomain,
        searchQuery: searchQuery || null,
        timeRange: this.timeRange,
      };

      const response = await chrome.runtime.sendMessage({
        action: "getDetailedRequests",
        filters,
        limit: perPage,
        offset: offset,
      });

      const tbody = document.getElementById("dashboardRequestsTableBody");

      if (
        !response.success ||
        !response.requests ||
        response.requests.length === 0
      ) {
        tbody.innerHTML =
          '<tr class="no-data-row"><td colspan="7" style="text-align: center; padding: 24px;">No requests available for selected filters</td></tr>';
        document.getElementById("dashboardTablePagination").innerHTML = "";
        return;
      }

      // Store requests for cURL export
      this.currentRequests = response.requests;

      // Build table rows
      let rows = "";
      response.requests.forEach((req) => {
        const statusClass =
          req.status >= 400
            ? "status-error"
            : req.status >= 300
            ? "status-warning"
            : "status-success";
        const size = req.size_bytes ? this.formatBytes(req.size_bytes) : "N/A";
        const duration = req.duration ? `${Math.round(req.duration)}ms` : "N/A";
        const cacheIcon = req.from_cache
          ? '<i class="fas fa-hdd" title="From cache"></i>'
          : "";

        rows += `
          <tr>
            <td><span class="method-badge">${req.method}</span></td>
            <td class="url-cell" title="${req.url}">${this.truncateUrl(
          req.url,
          50
        )}</td>
            <td><span class="status-badge ${statusClass}">${
          req.status || "N/A"
        }</span></td>
            <td>${req.type || "N/A"}</td>
            <td>${duration} ${cacheIcon}</td>
            <td>${size}</td>
            <td>
              <button class="btn-icon btn-view-details" data-request-id="${
                req.id
              }" title="View details">
                <i class="fas fa-info-circle"></i>
              </button>
              <button class="btn-icon btn-copy-curl" data-request-id="${
                req.id
              }" title="Copy as cURL">
                <i class="fas fa-terminal"></i>
              </button>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = rows;
      this.renderPagination(page, response.totalCount, perPage);
    } catch (error) {
      console.error("Failed to load requests table:", error);
      document.getElementById("dashboardRequestsTableBody").innerHTML =
        '<tr class="no-data-row"><td colspan="7" style="text-align: center;">Error loading requests</td></tr>';
    }
  }

  renderPagination(currentPage, totalCount, perPage) {
    const container = document.getElementById("dashboardTablePagination");
    if (!container || totalCount === 0) {
      if (container) container.innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(totalCount / perPage);
    if (totalPages <= 1) {
      container.innerHTML = `<span class="pagination-info">Showing ${totalCount} request${
        totalCount !== 1 ? "s" : ""
      }</span>`;
      return;
    }

    let html = `<span class="pagination-info">Page ${currentPage} of ${totalPages} (${totalCount} total)</span>`;
    html += '<div class="pagination-buttons">';

    // Previous button
    if (currentPage > 1) {
      html += `<button class="pagination-btn" data-page="${
        currentPage - 1
      }"><i class="fas fa-chevron-left"></i></button>`;
    }

    // Page numbers (show first, current-1, current, current+1, last)
    const pages = new Set();
    pages.add(1);
    if (currentPage > 1) pages.add(currentPage - 1);
    pages.add(currentPage);
    if (currentPage < totalPages) pages.add(currentPage + 1);
    pages.add(totalPages);

    const sortedPages = Array.from(pages).sort((a, b) => a - b);
    let lastPage = 0;
    sortedPages.forEach((p) => {
      if (lastPage && p - lastPage > 1) {
        html += '<span class="pagination-ellipsis">...</span>';
      }
      const activeClass = p === currentPage ? "active" : "";
      html += `<button class="pagination-btn ${activeClass}" data-page="${p}">${p}</button>`;
      lastPage = p;
    });

    // Next button
    if (currentPage < totalPages) {
      html += `<button class="pagination-btn" data-page="${
        currentPage + 1
      }"><i class="fas fa-chevron-right"></i></button>`;
    }

    html += "</div>";
    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll(".pagination-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = parseInt(btn.dataset.page);
        if (page) this.loadRequestsTable(page);
      });
    });
  }

  async viewRequestDetails(requestId) {
    try {
      // Search in both currentRequests and currentErrors arrays
      let request = this.currentRequests?.find((r) => r.id === requestId);
      if (!request) {
        request = this.currentErrors?.find((r) => r.id === requestId);
      }

      if (!request) {
        this.showToast("Request not found", "error");
        return;
      }

      const modal = document.createElement("div");
      modal.className = "details-modal";
      modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fas fa-info-circle"></i> Request Details</h3>
            <button class="modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="detail-section">
              <h4>General</h4>
              <table class="details-table">
                <tr><td>Method:</td><td><span class="method-badge">${
                  request.method
                }</span></td></tr>
                <tr><td>URL:</td><td class="selectable">${request.url}</td></tr>
                <tr><td>Status:</td><td>${request.status} ${
        request.status_text || ""
      }</td></tr>
                <tr><td>Type:</td><td>${request.type}</td></tr>
                <tr><td>Domain:</td><td>${request.domain || "N/A"}</td></tr>
                <tr><td>Page:</td><td>${request.page_url || "N/A"}</td></tr>
              </table>
            </div>
            <div class="detail-section">
              <h4>Performance</h4>
              <table class="details-table">
                <tr><td>Duration:</td><td>${
                  request.duration ? Math.round(request.duration) + "ms" : "N/A"
                }</td></tr>
                <tr><td>Size:</td><td>${this.formatBytes(
                  request.size_bytes || 0
                )}</td></tr>
                <tr><td>From Cache:</td><td>${
                  request.from_cache ? "Yes" : "No"
                }</td></tr>
                <tr><td>Timestamp:</td><td>${new Date(
                  request.timestamp
                ).toLocaleString()}</td></tr>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary modal-close-btn">Close</button>
          </div>
        </div>
      `;

      const closeModal = () => modal.remove();
      modal
        .querySelector(".modal-overlay")
        .addEventListener("click", closeModal);
      modal.querySelector(".modal-close").addEventListener("click", closeModal);
      modal
        .querySelector(".modal-close-btn")
        .addEventListener("click", closeModal);

      document.body.appendChild(modal);
    } catch (error) {
      console.error("Error showing request details:", error);
      this.showToast("Failed to load request details", "error");
    }
  }

  copyAsCurl(request) {
    try {
      let curl = `curl '${request.url}'`;

      if (request.method && request.method !== "GET") {
        curl += ` -X ${request.method}`;
      }

      curl += ` -H 'Accept: */*'`;
      curl += " --compressed";

      this.copyToClipboard(curl);
    } catch (error) {
      console.error("Error generating cURL:", error);
      this.showToast("Failed to generate cURL command", "error");
    }
  }

  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() =>
          this.showToast("cURL command copied to clipboard!", "success")
        )
        .catch(() => this.copyToClipboardFallback(text));
    } else {
      this.copyToClipboardFallback(text);
    }
  }

  copyToClipboardFallback(text) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (successful) {
        this.showToast("cURL command copied to clipboard!", "success");
      } else {
        this.showToast("Failed to copy cURL command", "error");
      }
    } catch (err) {
      console.error("Fallback copy failed:", err);
      this.showToast("Failed to copy cURL command", "error");
    }
  }

  async exportAsHAR() {
    try {
      const domainFilter = document.getElementById("dashboardDomainFilter");
      const selectedDomain = domainFilter?.value || "all";

      const response = await chrome.runtime.sendMessage({
        action: "exportHAR",
        filters: {
          domain: selectedDomain === "all" ? null : selectedDomain,
          timeRange: this.timeRange,
        },
      });

      if (response && response.success && response.har) {
        const blob = new Blob([JSON.stringify(response.har, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `requests-${selectedDomain}-${Date.now()}.har`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast("HAR file exported successfully", "success");
      } else {
        this.showToast("Failed to export HAR file", "error");
      }
    } catch (error) {
      console.error("Error exporting HAR:", error);
      this.showToast("Failed to export HAR file", "error");
    }
  }

  async loadResourcesBreakdown() {
    try {
      const domainFilter = document.getElementById("dashboardDomainFilter");
      const selectedDomain = domainFilter?.value || "all";

      const filters = {
        domain: selectedDomain === "all" ? null : selectedDomain,
        timeRange: this.timeRange,
      };

      const response = await chrome.runtime.sendMessage({
        action: "getResourceSizeBreakdown",
        filters,
      });

      const resourcesTable = document.getElementById("dashboardResourcesTable");

      if (
        !response.success ||
        !response.breakdown ||
        response.breakdown.length === 0
      ) {
        resourcesTable.innerHTML =
          '<p class="no-data">No resource data available for selected filters</p>';
        document.getElementById("dashboardCompressionStats").innerHTML =
          '<p class="no-data">No compression data available</p>';
        return;
      }

      // Render pie chart
      this.renderResourcePieChart(response.breakdown);

      // Render table
      let html = `
        <h5 style="margin-bottom: 12px;">Total Size: ${this.formatBytes(
          response.totalSize
        )} | Total Requests: ${response.totalCount}</h5>
        <table class="data-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th>Resource Type</th>
              <th>Count</th>
              <th>Total Size</th>
              <th>Avg Size</th>
              <th>Max Size</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
      `;

      response.breakdown.forEach((item) => {
        html += `
          <tr>
            <td><strong>${item.type}</strong></td>
            <td>${item.count}</td>
            <td>${this.formatBytes(item.totalBytes)}</td>
            <td>${this.formatBytes(item.avgBytes)}</td>
            <td>${this.formatBytes(item.maxBytes)}</td>
            <td>${item.percentage}%</td>
          </tr>
        `;
      });

      html += "</tbody></table>";
      resourcesTable.innerHTML = html;

      // Render compression analysis
      this.renderCompressionAnalysis(response.breakdown, response.totalSize);
    } catch (error) {
      console.error("Failed to load resources breakdown:", error);
      document.getElementById("dashboardResourcesTable").innerHTML =
        '<p class="no-data">Error loading resource data</p>';
    }
  }

  renderResourcePieChart(breakdown) {
    const canvas = document.getElementById("dashboardResourcePieChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (this.charts.resources) {
      this.charts.resources.destroy();
    }

    const labels = breakdown.map((b) => b.type);
    const data = breakdown.map((b) => b.totalBytes);

    this.charts.resources = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: [
              "#4CAF50",
              "#2196F3",
              "#FF9800",
              "#F44336",
              "#9C27B0",
              "#00BCD4",
              "#FFEB3B",
              "#795548",
            ],
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
          title: {
            display: true,
            text: "Resource Size Distribution",
          },
        },
      },
    });
  }

  renderCompressionAnalysis(breakdown, totalSize) {
    const compressibleTypes = [
      "script",
      "stylesheet",
      "xmlhttprequest",
      "fetch",
      "document",
    ];
    const compressibleSize = breakdown
      .filter((b) => compressibleTypes.includes(b.type))
      .reduce((sum, b) => sum + b.totalBytes, 0);

    const potentialSavings = compressibleSize * 0.7; // Assume 70% compression ratio
    const savingsPercentage =
      totalSize > 0 ? ((potentialSavings / totalSize) * 100).toFixed(1) : 0;

    const html = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
          <label>Compressible Resources:</label>
          <span style="font-weight: 600;">${this.formatBytes(
            compressibleSize
          )}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
          <label>Potential Savings:</label>
          <span style="font-weight: 600; color: var(--success-color);">${this.formatBytes(
            potentialSavings
          )}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
          <label>Compression Ratio:</label>
          <span style="font-weight: 600;">${savingsPercentage}% of total</span>
        </div>
        <div style="margin-top: 8px; padding: 12px; background: var(--background-color); border-radius: 6px; font-size: 12px;">
          <i class="fas fa-info-circle" style="color: var(--primary-color);"></i>
          <span style="margin-left: 8px;">Assumes 70% compression for text-based resources (JS, CSS, HTML, JSON)</span>
        </div>
      </div>
    `;

    document.getElementById("dashboardCompressionStats").innerHTML = html;
  }

  async loadErrorsAnalysis() {
    try {
      const domainFilter = document.getElementById("dashboardDomainFilter");
      const selectedDomain = domainFilter?.value || "all";

      const filters = {
        domain: selectedDomain === "all" ? null : selectedDomain,
        timeRange: this.timeRange,
      };

      // Get 4xx errors
      const filters4xx = { ...filters, statusPrefix: "4xx" };
      const response4xx = await chrome.runtime.sendMessage({
        action: "getDetailedRequests",
        filters: filters4xx,
        limit: 50,
        offset: 0,
      });

      // Get 5xx errors
      const filters5xx = { ...filters, statusPrefix: "5xx" };
      const response5xx = await chrome.runtime.sendMessage({
        action: "getDetailedRequests",
        filters: filters5xx,
        limit: 50,
        offset: 0,
      });

      const errorsList = document.getElementById("dashboardErrorsList");
      const errorCategories = document.getElementById(
        "dashboardErrorCategories"
      );

      const errors4xx = response4xx.success ? response4xx.requests : [];
      const errors5xx = response5xx.success ? response5xx.requests : [];
      const totalErrors = errors4xx.length + errors5xx.length;

      if (totalErrors === 0) {
        errorsList.innerHTML =
          '<p class="no-data">No errors found for selected filters</p>';
        errorCategories.innerHTML = "";

        // Clear error chart
        if (this.charts.errors) {
          this.charts.errors.destroy();
          delete this.charts.errors;
        }
        return;
      }

      // Store errors for action handlers
      this.currentErrors = [...errors4xx, ...errors5xx];

      // Render error categories
      const categoriesHtml = `
        <div class="error-category-stats" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="category-card" style="padding: 20px; background: var(--surface-color); border-radius: 8px; border-left: 4px solid #FF9800;">
            <h5 style="margin: 0 0 8px 0; color: #FF9800;"><i class="fas fa-exclamation-triangle"></i> 4xx Client Errors</h5>
            <div style="font-size: 32px; font-weight: 700; color: var(--text-primary); margin: 8px 0;">${errors4xx.length}</div>
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary-color);">Issues with the request</p>
          </div>
          <div class="category-card" style="padding: 20px; background: var(--surface-color); border-radius: 8px; border-left: 4px solid #F44336;">
            <h5 style="margin: 0 0 8px 0; color: #F44336;"><i class="fas fa-times-circle"></i> 5xx Server Errors</h5>
            <div style="font-size: 32px; font-weight: 700; color: var(--text-primary); margin: 8px 0;">${errors5xx.length}</div>
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary-color);">Server-side failures</p>
          </div>
        </div>
      `;
      errorCategories.innerHTML = categoriesHtml;

      // Render detailed error list
      let listHtml = '<div class="errors-list-content">';

      if (errors4xx.length > 0) {
        listHtml +=
          '<h5 style="margin: 16px 0 12px 0;"><i class="fas fa-exclamation-triangle" style="color: #FF9800;"></i> Client Errors (4xx)</h5>';
        errors4xx.forEach((err) => {
          listHtml += this.renderErrorItem(err, "client");
        });
      }

      if (errors5xx.length > 0) {
        listHtml +=
          '<h5 style="margin: 16px 0 12px 0;"><i class="fas fa-times-circle" style="color: #F44336;"></i> Server Errors (5xx)</h5>';
        errors5xx.forEach((err) => {
          listHtml += this.renderErrorItem(err, "server");
        });
      }

      listHtml += "</div>";
      errorsList.innerHTML = listHtml;

      // Render error distribution chart
      this.renderErrorChart(errors4xx, errors5xx);
    } catch (error) {
      console.error("Failed to load errors analysis:", error);
      document.getElementById("dashboardErrorsList").innerHTML =
        '<p class="no-data">Error loading error analysis data</p>';
    }
  }

  renderErrorItem(err, type) {
    const typeClass = type === "client" ? "error-client" : "error-server";
    const borderColor = type === "client" ? "#FF9800" : "#F44336";
    const domain = err.domain || "N/A";
    const pageUrl = err.page_url || "N/A";

    let pageDisplay = pageUrl;
    if (pageUrl !== "N/A") {
      try {
        const url = new URL(pageUrl);
        pageDisplay = url.pathname + url.search || "/";
      } catch (e) {
        pageDisplay = pageUrl;
      }
    }

    return `
      <div class="error-item ${typeClass}" style="padding: 12px; margin-bottom: 8px; background: var(--surface-color); border-radius: 6px; border-left: 3px solid ${borderColor};">
        <div class="error-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <span class="status-badge status-error">${err.status}</span>
          <span class="error-url" style="flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${
            err.url
          }">${this.truncateUrl(err.url, 60)}</span>
          <span class="error-time" style="font-size: 12px; color: var(--text-secondary-color);">${new Date(
            err.timestamp
          ).toLocaleTimeString()}</span>
        </div>
        <div class="error-details" style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-secondary-color); margin-bottom: 8px;">
          <span><i class="fas fa-code"></i> ${err.method || "GET"}</span>
          <span><i class="fas fa-tag"></i> ${err.type || "unknown"}</span>
          <span><i class="fas fa-globe"></i> ${domain}</span>
          <span title="${pageUrl}"><i class="fas fa-file"></i> ${this.truncateUrl(
      pageDisplay,
      30
    )}</span>
          ${
            err.error
              ? `<span class="error-message" style="color: var(--error-color);"><i class="fas fa-info-circle"></i> ${err.error}</span>`
              : ""
          }
        </div>
        <div class="error-actions" style="display: flex; gap: 8px;">
          <button class="btn-icon btn-error-details" data-request-id="${
            err.id
          }" title="View details">
            <i class="fas fa-info-circle"></i>
          </button>
          <button class="btn-icon btn-error-curl" data-request-id="${
            err.id
          }" title="Copy as cURL">
            <i class="fas fa-terminal"></i>
          </button>
        </div>
      </div>
    `;
  }

  renderErrorChart(errors4xx, errors5xx) {
    const canvas = document.getElementById("dashboardErrorsChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (this.charts.errors) {
      this.charts.errors.destroy();
    }

    // Group by status code
    const statusCounts = {};
    [...errors4xx, ...errors5xx].forEach((err) => {
      statusCounts[err.status] = (statusCounts[err.status] || 0) + 1;
    });

    const labels = Object.keys(statusCounts).sort();
    const data = labels.map((status) => statusCounts[status]);

    this.charts.errors = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Error Count",
            data,
            backgroundColor: labels.map((s) =>
              parseInt(s) >= 500 ? "#F44336" : "#FF9800"
            ),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: true,
            text: "Errors by Status Code",
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Count",
            },
          },
          x: {
            title: {
              display: true,
              text: "Status Code",
            },
          },
        },
      },
    });
  }

  truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    const parts = url.split("?");
    const base = parts[0];
    if (base.length > maxLength) {
      return base.substring(0, maxLength - 3) + "...";
    }
    return base + "?...";
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas fa-${
        type === "success"
          ? "check-circle"
          : type === "error"
          ? "exclamation-circle"
          : "info-circle"
      }"></i>
      <span>${message}</span>
    `;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--surface-color);
      color: var(--text-primary);
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log("✓ Dashboard auto-refresh stopped");
    }
  }

  destroy() {
    // Clean up when dashboard is closed
    this.stopAutoRefresh();

    // Destroy all charts
    Object.values(this.charts).forEach((chart) => {
      if (chart && typeof chart.destroy === "function") {
        chart.destroy();
      }
    });

    this.charts = {};
  }

  async loadDomainFilter() {
    try {
      const domainSelect = document.getElementById("dashboardDomainFilter");
      const modalDomainSelect = document.getElementById(
        "dashboardModalDomainFilter"
      );
      if (!domainSelect) return;

      // Reset dropdown
      domainSelect.innerHTML = '<option value="all">All Domains</option>';
      if (modalDomainSelect) {
        modalDomainSelect.innerHTML =
          '<option value="all">All Domains</option>';
      }

      // Get all domains
      const response = await chrome.runtime.sendMessage({
        action: "getDomains",
        timeRange: 604800, // Last 7 days
      });

      console.log("Dashboard domain filter response:", response);

      if (
        response &&
        response.success &&
        response.domains &&
        response.domains.length > 0
      ) {
        response.domains.forEach((domainObj) => {
          const domain = domainObj.domain;
          if (domain) {
            const option = document.createElement("option");
            option.value = domain;
            option.textContent = `${domain} (${domainObj.requestCount} requests)`;
            domainSelect.appendChild(option);

            // Also add to modal dropdown
            if (modalDomainSelect) {
              const modalOption = document.createElement("option");
              modalOption.value = domain;
              modalOption.textContent = `${domain} (${domainObj.requestCount} requests)`;
              modalDomainSelect.appendChild(modalOption);
            }
          }
        });
        console.log(`Loaded ${response.domains.length} domains for dashboard`);
      } else {
        console.warn("No domains found for dashboard");
      }
    } catch (error) {
      console.error("Failed to load domain filter:", error);
    }
  }

  switchDashboardTab(tabName) {
    // Update active button
    const buttons = document.querySelectorAll(".dashboard-tab-btn");
    buttons.forEach((btn) => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("active", isActive);
    });

    // Update active content
    const contents = document.querySelectorAll(".dashboard-tab-content");
    contents.forEach((content) => {
      const isActive = content.dataset.tabContent === tabName;
      content.classList.toggle("active", isActive);
    });

    // Load data for specific tabs when switched
    if (tabName === "requests") {
      this.loadRequestsTable(1);
    } else if (tabName === "performance") {
      this.loadEndpointPerformanceHistory();
    } else if (tabName === "resources") {
      this.loadResourcesBreakdown();
    } else if (tabName === "errors") {
      this.loadErrorsAnalysis();
    }
  }

  async onDomainFilterChange() {
    const domainSelect = document.getElementById("dashboardDomainFilter");
    const selectedDomain = domainSelect.value;

    // Load pages for selected domain
    if (selectedDomain && selectedDomain !== "all") {
      await this.loadPageFilter(selectedDomain);
    } else {
      // Clear page filter for "all domains"
      const pageSelect = document.getElementById("dashboardPageFilter");
      pageSelect.innerHTML = '<option value="">All Pages (Aggregated)</option>';
      pageSelect.disabled = true;
    }

    // Refresh dashboard with new filters
    await this.refreshDashboard();
  }

  async loadPageFilter(domain) {
    try {
      const pageSelect = document.getElementById("dashboardPageFilter");
      if (!pageSelect) return;

      // Reset page filter
      pageSelect.innerHTML = '<option value="">All Pages (Aggregated)</option>';
      pageSelect.disabled = false;

      if (!domain || domain === "all") {
        pageSelect.disabled = true;
        return;
      }

      // Get pages for this domain
      const response = await chrome.runtime.sendMessage({
        action: "getPagesByDomain",
        domain: domain,
        timeRange: 604800, // Last 7 days
      });

      console.log("Pages for domain response:", response);

      if (
        response &&
        response.success &&
        response.pages &&
        response.pages.length > 0
      ) {
        response.pages.forEach((pageObj) => {
          const pageUrl = pageObj.pageUrl;
          if (pageUrl) {
            const option = document.createElement("option");
            option.value = pageUrl;
            // Extract path from full URL for display
            try {
              const url = new URL(pageUrl);
              const displayPath = url.pathname + url.search || "/";
              option.textContent = `${displayPath} (${pageObj.requestCount} req)`;
            } catch (e) {
              option.textContent = `${pageUrl} (${pageObj.requestCount} req)`;
            }
            pageSelect.appendChild(option);
          }
        });
        console.log(
          `Loaded ${response.pages.length} pages for domain ${domain}`
        );
      } else {
        console.warn(`No pages found for domain ${domain}`);
      }
    } catch (error) {
      console.error("Failed to load page filter:", error);
    }
  }

  getActiveFilters() {
    const domainFilter = document.getElementById(
      "dashboardDomainFilter"
    )?.value;
    const pageFilter = document.getElementById("dashboardPageFilter")?.value;
    const requestTypeFilter = document.getElementById(
      "dashboardRequestTypeFilter"
    )?.value;

    const filters = {};

    // Add domain filter
    if (domainFilter && domainFilter !== "all") {
      filters.domain = domainFilter;
    }

    // Add page filter (if specific page selected)
    if (pageFilter && pageFilter !== "") {
      filters.pageUrl = pageFilter;
    }

    // Add request type filter
    if (requestTypeFilter && requestTypeFilter !== "") {
      filters.type = requestTypeFilter;
    }

    return filters;
  }

  async updateWebVitals() {
    try {
      const filters = this.getActiveFilters();

      console.log("[Dashboard] Requesting Web Vitals with filters:", filters);

      // Get Web Vitals from background
      const response = await chrome.runtime.sendMessage({
        action: "getWebVitals",
        filters: {
          ...filters,
          timeRange: this.timeRange,
        },
      });

      console.log("[Dashboard] Web Vitals response:", response);

      if (response && response.success && response.vitals) {
        const vitals = response.vitals;
        console.log("[Dashboard] Processing vitals:", vitals);

        // Update LCP
        this.updateVitalCard("lcp", vitals.LCP);

        // Update FID
        this.updateVitalCard("fid", vitals.FID);

        // Update CLS
        this.updateVitalCard("cls", vitals.CLS);

        // Update FCP
        this.updateVitalCard("fcp", vitals.FCP);

        // Update TTFB
        this.updateVitalCard("ttfb", vitals.TTFB);

        // Update TTI
        this.updateVitalCard("tti", vitals.TTI);

        // Update DCL
        this.updateVitalCard("dcl", vitals.DCL);

        // Update Load
        this.updateVitalCard("load", vitals.Load);
      } else {
        console.log("[Dashboard] No vitals data received or request failed");
      }
    } catch (error) {
      console.error("[Dashboard] Failed to update web vitals:", error);
    }
  }

  updateVitalCard(metric, data) {
    console.log(`[Dashboard] Updating ${metric} card with:`, data);
    if (!data) {
      console.log(`[Dashboard] No data for ${metric}, skipping update`);
      return;
    }

    const valueEl = document.getElementById(`${metric}Value`);
    const ratingEl = document.getElementById(`${metric}Rating`);
    const cardEl = document.getElementById(`${metric}Card`);

    if (!valueEl || !ratingEl || !cardEl) return;

    // Format value based on metric type
    let displayValue = "-";
    if (data.value !== null && data.value !== undefined) {
      if (metric === "cls") {
        displayValue = data.value.toFixed(3);
      } else {
        displayValue = `${Math.round(data.value)}ms`;
      }
    }

    valueEl.textContent = displayValue;

    // Update rating
    if (data.rating) {
      ratingEl.textContent = data.rating.replace("-", " ");
      ratingEl.className = `vital-rating ${data.rating}`;

      // Update card border
      cardEl.classList.remove("good", "needs-improvement", "poor");
      cardEl.classList.add(data.rating);
    }
  }

  async updateSessionMetrics() {
    try {
      const filters = this.getActiveFilters();

      // Get Session Metrics from background
      const response = await chrome.runtime.sendMessage({
        action: "getSessionMetrics",
        filters: {
          ...filters,
          timeRange: this.timeRange,
        },
      });

      if (response && response.success && response.metrics) {
        const metrics = response.metrics;

        // Update Avg Session Duration
        const avgDurationEl = document.getElementById("avgSessionDuration");
        if (avgDurationEl && metrics.avgDuration !== null) {
          avgDurationEl.textContent = this.formatDuration(metrics.avgDuration);
        }

        // Update Total Sessions
        const totalSessionsEl = document.getElementById("totalSessions");
        if (totalSessionsEl) {
          totalSessionsEl.textContent = metrics.totalSessions || 0;
        }

        // Update Avg Requests per Session
        const avgRequestsEl = document.getElementById("avgRequestsPerSession");
        if (avgRequestsEl && metrics.avgRequests !== null) {
          avgRequestsEl.textContent = Math.round(metrics.avgRequests);
        }

        // Update Avg Events per Session
        const avgEventsEl = document.getElementById("avgEventsPerSession");
        if (avgEventsEl && metrics.avgEvents !== null) {
          avgEventsEl.textContent = Math.round(metrics.avgEvents);
        }
      }
    } catch (error) {
      console.error("Failed to update session metrics:", error);
    }
  }

  formatDuration(ms) {
    if (!ms) return "-";

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}

// Export singleton instance
export const dashboard = new Dashboard();

// Initialize when dashboard tab is active
document.addEventListener("DOMContentLoaded", () => {
  const dashboardTab = document.querySelector('[data-tab="dashboard"]');
  if (dashboardTab) {
    dashboardTab.addEventListener("click", async () => {
      // Delay initialization to ensure DOM is ready
      setTimeout(async () => {
        if (!dashboard.charts.volume) {
          await dashboard.initialize();
        }
      }, 100);
    });

    // If dashboard tab is active by default, initialize immediately
    if (dashboardTab.classList.contains("active")) {
      setTimeout(async () => {
        await dashboard.initialize();
      }, 500);
    }
  }
});
