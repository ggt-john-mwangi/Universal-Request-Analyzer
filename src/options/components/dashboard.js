// Dashboard Component
// Manages the dashboard visualization and real-time metrics

import Chart from "../../lib/chart.min.js";

class Dashboard {
  constructor() {
    this.charts = {};
    this.comparisonChartInstance = null; // Store comparison chart instance
    this.refreshInterval = null;
    this.timeRange = 86400; // Default 24 hours
    this.currentRequests = []; // Store current requests for cURL export
    this.currentErrors = []; // Store current errors for actions
    this.searchTimeout = null; // Debounce search input
    this.loadingPageFilter = false; // Prevent concurrent page filter loads
  }

  async initialize() {
    console.log("Initializing Dashboard...");

    // Load domain filter first and check if domains exist
    const hasData = await this.loadDomainFilter();

    // Setup event listeners
    this.setupEventListeners();

    // Initialize charts
    this.initializeCharts();

    // Load initial data only if domains exist
    if (hasData) {
      await this.refreshDashboard();
    } else {
      this.showNoDomainState();
    }

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

    // Request Details Modal event listeners
    const requestDetailsModal = document.getElementById("requestDetailsModal");
    if (requestDetailsModal) {
      // Close button
      const closeBtn = requestDetailsModal.querySelector(".modal-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          requestDetailsModal.style.display = "none";
        });
      }

      // Footer close button
      const footerCloseBtn = document.getElementById("closeRequestDetailsBtn");
      if (footerCloseBtn) {
        footerCloseBtn.addEventListener("click", () => {
          requestDetailsModal.style.display = "none";
        });
      }

      // Click outside to close
      requestDetailsModal.addEventListener("click", (e) => {
        if (e.target === requestDetailsModal) {
          requestDetailsModal.style.display = "none";
        }
      });
    }

    // cURL Command Modal event listeners
    const curlCommandModal = document.getElementById("curlCommandModal");
    if (curlCommandModal) {
      // Close button
      const closeBtn = curlCommandModal.querySelector(".modal-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          curlCommandModal.style.display = "none";
        });
      }

      // Footer close button
      const footerCloseBtn = document.getElementById("closeCurlModalBtn");
      if (footerCloseBtn) {
        footerCloseBtn.addEventListener("click", () => {
          curlCommandModal.style.display = "none";
        });
      }

      // Copy button
      const copyBtn = document.getElementById("copyCurlBtn");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          const curlText = document.getElementById("curlCommandText");
          if (curlText) {
            this.copyToClipboard(curlText.textContent);
          }
        });
      }

      // Click outside to close
      curlCommandModal.addEventListener("click", (e) => {
        if (e.target === curlCommandModal) {
          curlCommandModal.style.display = "none";
        }
      });
    }

    // Analytics Tab event listeners removed - features provide no actionable value for developers

    // Populate domain comparison dropdowns
    const compareDomain1 = document.getElementById("compareDomain1");
    const compareDomain2 = document.getElementById("compareDomain2");
    const compareDomain3 = document.getElementById("compareDomain3");

    if (compareDomain1 || compareDomain2 || compareDomain3) {
      // Load domains for comparison dropdowns
      chrome.runtime
        .sendMessage({ action: "getAvailableDomains" })
        .then((response) => {
          if (response.success && response.domains) {
            const options = response.domains
              .map(
                (d) =>
                  `<option value="${d.domain}">${d.domain} (${d.count} requests)</option>`
              )
              .join("");

            if (compareDomain1)
              compareDomain1.innerHTML =
                '<option value="">Select Domain 1</option>' + options;
            if (compareDomain2)
              compareDomain2.innerHTML =
                '<option value="">Select Domain 2</option>' + options;
            if (compareDomain3)
              compareDomain3.innerHTML =
                '<option value="">Select Domain 3</option>' + options;
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

    // Check if "All Domains" is selected
    const domainFilter = document.getElementById("dashboardDomainFilter");
    if (domainFilter && domainFilter.value === "all") {
      this.showSelectDomainPrompt();
      this.showLoadingState(false);
      return;
    }

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

      // Reload data for currently active tab
      const activeTab = document.querySelector(".dashboard-tab-btn.active");
      if (activeTab) {
        const tabName = activeTab.dataset.tab;
        await this.reloadActiveTabData(tabName);
      }

      console.log("✓ Dashboard refreshed");
    } catch (error) {
      console.error("Failed to refresh dashboard:", error);
      this.showError("Failed to load dashboard data. Please try refreshing.");
    } finally {
      // Hide loading state
      this.showLoadingState(false);
    }
  }

  async reloadActiveTabData(tabName) {
    // Reload data for the active tab when filters change
    switch (tabName) {
      case "overview":
        await this.loadWebVitals();
        break;
      case "requests":
        await this.loadRequestsTable(1);
        break;
      case "performance":
        await this.loadEndpointPerformanceHistory();
        break;
      case "resources":
        await this.loadResourcesBreakdown();
        break;
      case "errors":
        await this.loadErrorsAnalysis();
        break;
      case "analytics":
        await this.loadAnalyticsPercentiles();
        // Other analytics features removed - don't provide actionable insights for developers
        break;
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

  showNoDomainState() {
    const dashboardContainer = document.querySelector(".dashboard-content");
    if (!dashboardContainer) return;

    const emptyStateHtml = `
      <div class="dashboard-empty-state" style="
        text-align: center;
        padding: 80px 20px;
        max-width: 600px;
        margin: 0 auto;
      ">
        <div style="
          font-size: 64px;
          color: var(--text-tertiary, #ccc);
          margin-bottom: 24px;
        ">
          <i class="fas fa-inbox"></i>
        </div>
        <h2 style="
          color: var(--text-primary);
          margin: 0 0 16px 0;
          font-size: 24px;
        ">No Data Captured Yet</h2>
        <p style="
          color: var(--text-secondary);
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 32px 0;
        ">
          Start browsing websites with the extension enabled to see request analytics, 
          performance metrics, and insights here.
        </p>
        <div style="
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 24px;
          text-align: left;
          max-width: 400px;
          margin: 0 auto;
        ">
          <h3 style="
            margin: 0 0 16px 0;
            font-size: 16px;
            color: var(--text-primary);
          ">
            <i class="fas fa-lightbulb" style="color: var(--warning-color);"></i>
            Getting Started
          </h3>
          <ol style="
            margin: 0;
            padding-left: 24px;
            color: var(--text-secondary);
            line-height: 1.8;
          ">
            <li>Visit any website</li>
            <li>Make sure request capture is enabled</li>
            <li>Return here to see analytics</li>
          </ol>
        </div>
      </div>
    `;

    // Hide all tab content and show empty state
    const tabContents = document.querySelectorAll(".dashboard-tab-content");
    tabContents.forEach((content) => {
      content.style.display = "none";
    });

    // Insert empty state
    const firstTabContent = document.querySelector(".dashboard-tab-content");
    if (firstTabContent) {
      const emptyStateDiv = document.createElement("div");
      emptyStateDiv.className = "dashboard-empty-state-container";
      emptyStateDiv.innerHTML = emptyStateHtml;
      firstTabContent.parentNode.insertBefore(emptyStateDiv, firstTabContent);
    }
  }

  showSelectDomainPrompt() {
    const dashboardContainer = document.querySelector(".dashboard-content");
    if (!dashboardContainer) return;

    // Remove any existing prompt
    const existing = document.querySelector(".dashboard-select-domain-prompt");
    if (existing) existing.remove();

    const promptHtml = `
      <div class="dashboard-select-domain-prompt" style="
        text-align: center;
        padding: 60px 20px;
        max-width: 500px;
        margin: 0 auto;
      ">
        <div style="
          font-size: 48px;
          color: var(--primary-color);
          margin-bottom: 24px;
        ">
          <i class="fas fa-filter"></i>
        </div>
        <h2 style="
          color: var(--text-primary);
          margin: 0 0 16px 0;
          font-size: 22px;
        ">Select a Domain to View Dashboard</h2>
        <p style="
          color: var(--text-secondary);
          font-size: 15px;
          line-height: 1.6;
          margin: 0 0 24px 0;
        ">
          Please select a specific domain from the filter above to view detailed analytics, 
          metrics, and performance data.
        </p>
        <div style="
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 16px;
          display: inline-block;
        ">
          <i class="fas fa-arrow-up" style="color: var(--primary-color); margin-right: 8px;"></i>
          <span style="color: var(--text-primary); font-weight: 500;">Use the Domain filter above</span>
        </div>
      </div>
    `;

    // Hide all tab content and show prompt
    const tabContents = document.querySelectorAll(".dashboard-tab-content");
    tabContents.forEach((content) => {
      content.style.display = "none";
    });

    // Insert prompt
    const firstTabContent = document.querySelector(".dashboard-tab-content");
    if (firstTabContent) {
      const promptDiv = document.createElement("div");
      promptDiv.className = "dashboard-select-domain-prompt-container";
      promptDiv.innerHTML = promptHtml;
      firstTabContent.parentNode.insertBefore(promptDiv, firstTabContent);
    }

    // Also hide active filters banner since no specific domain is selected
    const activeFiltersInfo = document.getElementById("dashboardActiveFilters");
    if (activeFiltersInfo) {
      activeFiltersInfo.style.display = "none";
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
              volumeTimeline: {
                labels: response.timestamps || [],
                values: this.calculateVolumeValues(response.timestamps || []),
              },
              statusDistribution: [0, 0, 0, 0],
              topDomains: this.extractTopDomains(response.requestTypes || {}),
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

  calculateVolumeValues(timestamps) {
    // Group timestamps into buckets and count requests per bucket
    const bucketCounts = {};
    timestamps.forEach((timestamp) => {
      bucketCounts[timestamp] = (bucketCounts[timestamp] || 0) + 1;
    });
    // Return counts in same order as labels
    return timestamps.map((label) => bucketCounts[label] || 0);
  }

  extractTopDomains(requestTypes) {
    // Convert requestTypes object to sorted array
    const entries = Object.entries(requestTypes);
    entries.sort((a, b) => b[1] - a[1]); // Sort by count descending
    const top5 = entries.slice(0, 5);

    return {
      labels: top5.map(([type]) => type),
      values: top5.map(([, count]) => count),
    };
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

  async loadWebVitals() {
    try {
      const filters = this.getActiveFilters();

      // Query for latest web vitals by metric name
      let query = `
        SELECT 
          metric_name,
          metric_value,
          rating,
          timestamp
        FROM bronze_web_vitals
        WHERE 1=1
      `;

      if (filters.domain) {
        query += ` AND page_url LIKE '%${filters.domain}%'`;
      }

      if (filters.pageUrl) {
        query += ` AND page_url = '${filters.pageUrl.replace(/'/g, "''")}'`;
      }

      query += `
        ORDER BY timestamp DESC
        LIMIT 100
      `;

      const response = await chrome.runtime.sendMessage({
        action: "executeDirectQuery",
        query: query,
      });

      if (response.success && response.data) {
        // Group by metric name and get latest value
        const vitals = {};
        response.data.forEach((row) => {
          if (!vitals[row.metric_name]) {
            vitals[row.metric_name] = {
              value: row.metric_value,
              rating: row.rating || "needs-improvement",
            };
          }
        });

        // Update DOM elements
        this.updateWebVitalCard("lcp", vitals.LCP);
        this.updateWebVitalCard("fid", vitals.FID);
        this.updateWebVitalCard("cls", vitals.CLS);
        this.updateWebVitalCard("fcp", vitals.FCP);
        this.updateWebVitalCard("ttfb", vitals.TTFB);
        this.updateWebVitalCard("tti", vitals.TTI);
        this.updateWebVitalCard("dcl", vitals.DCL);
        this.updateWebVitalCard("load", vitals.Load);
      }
    } catch (error) {
      console.error("Failed to load web vitals:", error);
    }
  }

  updateWebVitalCard(metricKey, vitalData) {
    const valueEl = document.getElementById(`${metricKey}Value`);
    if (!valueEl) return;

    if (vitalData) {
      // Format value based on metric type
      let displayValue;
      if (metricKey === "cls") {
        displayValue = vitalData.value.toFixed(3);
      } else if (metricKey === "dcl" || metricKey === "load") {
        displayValue = `${(vitalData.value / 1000).toFixed(2)}s`;
      } else {
        displayValue = `${Math.round(vitalData.value)}ms`;
      }

      valueEl.textContent = displayValue;

      // Apply rating class (preserve existing vital-value class)
      valueEl.className = "vital-value";
      if (vitalData.rating === "good") {
        valueEl.classList.add("vital-good");
      } else if (vitalData.rating === "needs-improvement") {
        valueEl.classList.add("vital-warning");
      } else {
        valueEl.classList.add("vital-poor");
      }
    } else {
      valueEl.textContent = "-";
      valueEl.className = "vital-value";
    }
  }

  // Session metrics removed - they only tracked developer's own testing behavior,
  // not representative of real user engagement. bronze_sessions table is kept
  // for linking Web Vitals data.

  async loadEndpointPerformanceHistory() {
    try {
      const activeFilters = this.getActiveFilters();
      const typeFilter = document.getElementById("dashboardEndpointTypeFilter");
      const endpointPattern = document.getElementById(
        "dashboardEndpointPattern"
      );
      const timeBucket = document.getElementById("dashboardHistoryTimeBucket");

      const selectedType = typeFilter?.value || "";
      const pattern = endpointPattern?.value?.trim() || "";
      const bucket = timeBucket?.value || "hourly";

      const filters = {
        domain: activeFilters.domain || null,
        pageUrl: activeFilters.pageUrl || null,
        type: activeFilters.type || selectedType || null,
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
      const activeFilters = this.getActiveFilters();
      const searchInput = document.getElementById("dashboardSearchRequests");
      const perPageSelect = document.getElementById("dashboardRequestsPerPage");

      const searchQuery = searchInput?.value?.trim() || "";
      const perPage = perPageSelect ? parseInt(perPageSelect.value) : 25;
      const offset = (page - 1) * perPage;

      const filters = {
        ...activeFilters,
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

      // Populate modal content
      const modalBody = document.getElementById("requestDetailsBody");
      if (!modalBody) return;

      modalBody.innerHTML = `
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
      `;

      // Show modal
      const modal = document.getElementById("requestDetailsModal");
      if (modal) {
        modal.style.display = "block";
      }
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

      // Populate modal with cURL command
      const curlCommandText = document.getElementById("curlCommandText");
      if (curlCommandText) {
        curlCommandText.textContent = curl;
      }

      // Show modal
      const modal = document.getElementById("curlCommandModal");
      if (modal) {
        modal.style.display = "block";
      }
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
      const activeFilters = this.getActiveFilters();

      const filters = {
        ...activeFilters,
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

  async renderCompressionAnalysis(breakdown, totalSize) {
    try {
      const domainFilter = document.getElementById("dashboardDomainFilter");
      const selectedDomain = domainFilter?.value || "all";

      const statsResponse = await chrome.runtime.sendMessage({
        action: "getResourceCompressionStats",
        filters: {
          domain: selectedDomain === "all" ? null : selectedDomain,
          timeRange: this.timeRange,
        },
      });

      if (statsResponse.success && statsResponse.data.resourceCount > 0) {
        const stats = statsResponse.data;
        const compressionRate = parseFloat(stats.compressionRate) || 0;

        // Pre-compute values to avoid nested template literals
        const compressedColor =
          compressionRate > 50
            ? "var(--success-color)"
            : "var(--warning-color)";
        const savingsColor =
          stats.potentialSavings > 1000000
            ? "var(--error-color)"
            : "var(--success-color)";
        const iconClass =
          compressionRate > 50 ? "check-circle" : "exclamation-triangle";
        const iconColor =
          compressionRate > 50
            ? "var(--success-color)"
            : "var(--warning-color)";

        let message;
        if (compressionRate > 50) {
          message = "Good compression rate! Resources are well optimized.";
        } else if (stats.potentialSavings > 100000) {
          message =
            "Enable compression to save " +
            this.formatBytes(stats.potentialSavings) +
            ".";
        } else {
          message = "Resource sizes are optimized.";
        }

        const html = `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <label>Total Bytes:</label>
              <span style="font-weight: 600;">${this.formatBytes(
                stats.totalBytes
              )}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <label>Compressed Bytes:</label>
              <span style="font-weight: 600; color: ${compressedColor};">${this.formatBytes(
          stats.compressedBytes
        )}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <label>Potential Savings:</label>
              <span style="font-weight: 600; color: ${savingsColor};">${this.formatBytes(
          stats.potentialSavings
        )}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <label>Compression Rate:</label>
              <span style="font-weight: 600;">${compressionRate}%</span>
            </div>
            <div style="margin-top: 8px; padding: 12px; background: var(--background-color); border-radius: 6px; font-size: 12px;">
              <i class="fas fa-${iconClass}" style="color: ${iconColor};"></i>
              <span style="margin-left: 8px;">${message}</span>
            </div>
          </div>
        `;
        document.getElementById("dashboardCompressionStats").innerHTML = html;
      } else {
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
        const potentialSavings = compressibleSize * 0.7;
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
              <label>Potential Savings (Est.):</label>
              <span style="font-weight: 600; color: var(--warning-color);">${this.formatBytes(
                potentialSavings
              )}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <label>Compression Ratio (Est.):</label>
              <span style="font-weight: 600;">${savingsPercentage}% of total</span>
            </div>
            <div style="margin-top: 8px; padding: 12px; background: var(--background-color); border-radius: 6px; font-size: 12px;">
              <i class="fas fa-info-circle" style="color: var(--primary-color);"></i>
              <span style="margin-left: 8px;">Estimated: Assumes 70% compression. Visit pages to collect real Resource Timing data.</span>
            </div>
          </div>
        `;
        document.getElementById("dashboardCompressionStats").innerHTML = html;
      }
    } catch (error) {
      console.error("Failed to render compression analysis:", error);
      document.getElementById("dashboardCompressionStats").innerHTML =
        '<p class="no-data">Error loading compression data</p>';
    }
  }

  async loadErrorsAnalysis() {
    try {
      const activeFilters = this.getActiveFilters();

      const filters = {
        ...activeFilters,
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

        // Auto-select the first domain by default (instead of "All Domains")
        const firstDomain = response.domains[0].domain;
        domainSelect.value = firstDomain;
        if (modalDomainSelect) {
          modalDomainSelect.value = firstDomain;
        }
        console.log(`Auto-selected domain: ${firstDomain}`);

        // Load pages for the auto-selected domain
        await this.loadPageFilter(firstDomain);

        return true; // Indicate that domains exist
      } else {
        console.warn("No domains found for dashboard");
        return false; // Indicate no domains available
      }
    } catch (error) {
      console.error("Failed to load domain filter:", error);
      return false;
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
    if (tabName === "overview") {
      this.loadWebVitals();
    } else if (tabName === "requests") {
      this.loadRequestsTable(1);
    } else if (tabName === "performance") {
      this.loadEndpointPerformanceHistory();
    } else if (tabName === "resources") {
      this.loadResourcesBreakdown();
    } else if (tabName === "errors") {
      this.loadErrorsAnalysis();
    } else if (tabName === "analytics") {
      this.loadAnalyticsPercentiles();
      // Other analytics features removed - don't provide actionable insights for developers
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
      if (pageSelect) {
        pageSelect.innerHTML =
          '<option value="">All Pages (Aggregated)</option>';
        pageSelect.disabled = true;
      }
    }

    // Refresh dashboard with new filters
    await this.refreshDashboard();
  }

  async loadPageFilter(domain) {
    // Prevent concurrent calls
    if (this.loadingPageFilter) {
      return;
    }

    this.loadingPageFilter = true;

    try {
      const pageSelect = document.getElementById("dashboardPageFilter");

      if (!pageSelect) {
        return;
      }

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
      }
    } catch (error) {
      console.error("Failed to load page filter:", error);
    } finally {
      this.loadingPageFilter = false;
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

    // Add domain filter (if "all" is selected, no domain filter is added, showing all domains)
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

    // Update active filters display
    this.updateActiveFiltersDisplay(
      domainFilter,
      pageFilter,
      requestTypeFilter
    );

    return filters;
  }

  updateActiveFiltersDisplay(domain, page, type) {
    const infoBox = document.getElementById("dashboardActiveFilters");
    const infoText = document.getElementById("activeFiltersText");

    if (!infoBox || !infoText) return;

    const parts = [];

    if (domain && domain !== "all") {
      parts.push(`<strong>Domain:</strong> ${domain}`);
    } else {
      parts.push(`<strong>Showing data from ALL domains</strong>`);
    }

    if (page && page !== "") {
      try {
        const url = new URL(page);
        const displayPath = url.pathname + url.search || "/";
        parts.push(`<strong>Page:</strong> ${displayPath}`);
      } catch (e) {
        parts.push(`<strong>Page:</strong> ${page}`);
      }
    }

    if (type && type !== "") {
      parts.push(`<strong>Type:</strong> ${type}`);
    }

    infoText.innerHTML = parts.join(" | ");
    infoBox.style.display = "block";
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

  // updateSessionMetrics() and formatDuration() removed - session engagement metrics
  // not meaningful for single-user browser extension

  async loadAnalyticsPercentiles() {
    try {
      const filters = this.getActiveFilters();

      // Build WHERE clause
      const whereConditions = ["duration IS NOT NULL"];
      if (filters.domain) {
        whereConditions.push(
          `domain = '${filters.domain.replace(/'/g, "''")}'`
        );
      }
      if (filters.pageUrl) {
        whereConditions.push(
          `page_url = '${filters.pageUrl.replace(/'/g, "''")}'`
        );
      }
      if (filters.type) {
        whereConditions.push(`type = '${filters.type.replace(/'/g, "''")}'`);
      }
      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Query for percentiles from gold_domain_stats or calculate from silver_requests
      const query = `
        SELECT 
          MIN(duration) as min_duration,
          MAX(duration) as max_duration,
          AVG(duration) as avg_duration,
          COUNT(*) as total_count
        FROM silver_requests
        ${whereClause}
      `;

      const response = await chrome.runtime.sendMessage({
        action: "executeDirectQuery",
        query: query,
      });

      if (response.success && response.data && response.data.length > 0) {
        const stats = response.data[0];

        // Get percentiles with separate queries
        const percentileQueries = [50, 75, 90, 95, 99].map((p) => {
          const offset = Math.floor((stats.total_count * p) / 100);
          return `
            SELECT duration 
            FROM silver_requests 
            ${whereClause}
            ORDER BY duration ASC
            LIMIT 1 OFFSET ${offset}
          `;
        });

        // Execute all percentile queries
        const percentileResults = await Promise.all(
          percentileQueries.map((q) =>
            chrome.runtime.sendMessage({
              action: "executeDirectQuery",
              query: q,
            })
          )
        );

        // Update UI with percentiles
        const percentiles = {
          p50: percentileResults[0]?.data?.[0]?.duration || 0,
          p75: percentileResults[1]?.data?.[0]?.duration || 0,
          p90: percentileResults[2]?.data?.[0]?.duration || 0,
          p95: percentileResults[3]?.data?.[0]?.duration || 0,
          p99: percentileResults[4]?.data?.[0]?.duration || 0,
          max: stats.max_duration || 0,
        };

        document.getElementById("p50Value").textContent = `${Math.round(
          percentiles.p50
        )}ms`;
        document.getElementById("p75Value").textContent = `${Math.round(
          percentiles.p75
        )}ms`;
        document.getElementById("p90Value").textContent = `${Math.round(
          percentiles.p90
        )}ms`;
        document.getElementById("p95Value").textContent = `${Math.round(
          percentiles.p95
        )}ms`;
        document.getElementById("p99Value").textContent = `${Math.round(
          percentiles.p99
        )}ms`;
        document.getElementById("maxValue").textContent = `${Math.round(
          percentiles.max
        )}ms`;

        // Apply color coding based on thresholds
        this.applyPercentileColors(percentiles);
      }
    } catch (error) {
      console.error("Failed to load analytics percentiles:", error);
    }
  }

  applyPercentileColors(percentiles) {
    const thresholds = {
      good: 200,
      warning: 500,
    };

    const applyColor = (elementId, value) => {
      const el = document.getElementById(elementId);
      if (!el) return;

      el.className = "percentile-value";
      if (value < thresholds.good) {
        el.classList.add("good");
      } else if (value < thresholds.warning) {
        el.classList.add("warning");
      } else {
        el.classList.add("danger");
      }
    };

    applyColor("p50Value", percentiles.p50);
    applyColor("p75Value", percentiles.p75);
    applyColor("p90Value", percentiles.p90);
    applyColor("p95Value", percentiles.p95);
    applyColor("p99Value", percentiles.p99);
    applyColor("maxValue", percentiles.max);
  }

  async loadAnomalyDetection() {
    try {
      const filters = this.getActiveFilters();

      // Build WHERE clause
      const whereConditions = ["duration IS NOT NULL"];
      if (filters.domain) {
        whereConditions.push(
          `domain = '${filters.domain.replace(/'/g, "''")}'`
        );
      }
      if (filters.pageUrl) {
        whereConditions.push(
          `page_url = '${filters.pageUrl.replace(/'/g, "''")}'`
        );
      }
      if (filters.type) {
        whereConditions.push(`type = '${filters.type.replace(/'/g, "''")}'`);
      }
      const whereClause = whereConditions.join(" AND ");

      // Get requests exceeding P99 threshold
      const query = `
        WITH percentiles AS (
          SELECT duration 
          FROM silver_requests 
          WHERE ${whereClause}
          ORDER BY duration DESC
          LIMIT 1 OFFSET (
            SELECT CAST(COUNT(*) * 0.01 AS INTEGER)
            FROM silver_requests
            WHERE ${whereClause}
          )
        )
        SELECT 
          r.url,
          r.method,
          r.duration,
          r.status,
          r.domain,
          r.timestamp
        FROM silver_requests r
        CROSS JOIN percentiles p
        WHERE r.duration > p.duration
          AND (${whereClause})
        ORDER BY r.duration DESC
        LIMIT 20
      `;

      const response = await chrome.runtime.sendMessage({
        action: "executeDirectQuery",
        query: query,
      });

      const anomaliesList = document.getElementById("anomaliesList");

      if (response.success && response.data && response.data.length > 0) {
        let html = '<div style="max-height: 400px; overflow-y: auto;">';

        response.data.forEach((anomaly) => {
          const date = new Date(anomaly.timestamp);
          html += `
            <div class="anomaly-item" style="padding: 12px; margin-bottom: 8px; background: var(--surface-color); border-left: 3px solid var(--error-color); border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; margin-bottom: 4px;">
                    <span class="method-badge ${anomaly.method}">${
            anomaly.method
          }</span>
                    <span style="margin-left: 8px;">${anomaly.url}</span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-secondary-color);">
                    <span><i class="fas fa-server"></i> ${anomaly.domain}</span>
                    <span style="margin-left: 12px;"><i class="fas fa-clock"></i> ${date.toLocaleString()}</span>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 18px; font-weight: 700; color: var(--error-color);">
                    ${Math.round(anomaly.duration)}ms
                  </div>
                  <div style="font-size: 11px; color: var(--text-secondary-color);">
                    Status: ${anomaly.status || "N/A"}
                  </div>
                </div>
              </div>
            </div>
          `;
        });

        html += "</div>";
        html += `<p style="margin-top: 12px; font-size: 12px; color: var(--text-secondary-color);"><i class="fas fa-info-circle"></i> Showing top 20 slowest requests (P99 outliers)</p>`;
        anomaliesList.innerHTML = html;
      } else {
        anomaliesList.innerHTML =
          '<p class="placeholder" style="padding: 20px; text-align: center; color: var(--text-secondary-color);"><i class="fas fa-check-circle" style="color: var(--success-color);"></i> No anomalies detected - all requests performing within normal range</p>';
      }
    } catch (error) {
      console.error("Failed to load anomaly detection:", error);
      document.getElementById("anomaliesList").innerHTML =
        '<p class="no-data">Error loading anomaly data</p>';
    }
  }

  async loadTrendAnalysis() {
    try {
      const compareType =
        document.getElementById("trendCompareType")?.value || "week";
      const filters = this.getActiveFilters();

      // Calculate time ranges
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      const currentPeriodDays = compareType === "week" ? 7 : 30;
      const currentStart = now - currentPeriodDays * msPerDay;
      const previousStart = currentStart - currentPeriodDays * msPerDay;

      // Build WHERE clause for filters
      const buildWhereClause = (startTime, endTime) => {
        const conditions = [
          `timestamp >= ${startTime}`,
          `timestamp < ${endTime}`,
        ];
        if (filters.domain) {
          conditions.push(`domain = '${filters.domain.replace(/'/g, "''")}'`);
        }
        if (filters.pageUrl) {
          conditions.push(
            `page_url = '${filters.pageUrl.replace(/'/g, "''")}'`
          );
        }
        if (filters.type) {
          conditions.push(`type = '${filters.type.replace(/'/g, "''")}'`);
        }
        return conditions.join(" AND ");
      };

      // Query current period
      const currentQuery = `
        SELECT 
          COUNT(*) as request_count,
          AVG(duration) as avg_duration,
          SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
          SUM(size_bytes) as total_bytes
        FROM silver_requests
        WHERE ${buildWhereClause(currentStart, now)}
      `;

      // Query previous period
      const previousQuery = `
        SELECT 
          COUNT(*) as request_count,
          AVG(duration) as avg_duration,
          SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
          SUM(size_bytes) as total_bytes
        FROM silver_requests
        WHERE ${buildWhereClause(previousStart, currentStart)}
      `;

      const [currentResponse, previousResponse] = await Promise.all([
        chrome.runtime.sendMessage({
          action: "executeDirectQuery",
          query: currentQuery,
        }),
        chrome.runtime.sendMessage({
          action: "executeDirectQuery",
          query: previousQuery,
        }),
      ]);

      if (currentResponse.success && previousResponse.success) {
        const current = currentResponse.data[0] || {
          request_count: 0,
          avg_duration: 0,
          error_count: 0,
          total_bytes: 0,
        };
        const previous = previousResponse.data[0] || {
          request_count: 0,
          avg_duration: 0,
          error_count: 0,
          total_bytes: 0,
        };

        // Calculate changes
        const calcChange = (curr, prev) => {
          if (!prev || prev === 0) return curr > 0 ? 100 : 0;
          return ((curr - prev) / prev) * 100;
        };

        const requestChange = calcChange(
          current.request_count,
          previous.request_count
        );
        const durationChange = calcChange(
          current.avg_duration,
          previous.avg_duration
        );
        const errorChange = calcChange(
          current.error_count,
          previous.error_count
        );
        const bytesChange = calcChange(
          current.total_bytes,
          previous.total_bytes
        );

        // Update UI
        document.getElementById("trendRequests").textContent =
          current.request_count.toLocaleString();
        document.getElementById("trendDuration").textContent = `${Math.round(
          current.avg_duration || 0
        )}ms`;
        document.getElementById("trendErrors").textContent =
          current.error_count.toLocaleString();
        document.getElementById("trendBytes").textContent = this.formatBytes(
          current.total_bytes || 0
        );

        // Update change indicators
        const formatChange = (change, reverse = false) => {
          const isPositive = reverse ? change < 0 : change > 0;
          const icon = isPositive ? "fa-arrow-up" : "fa-arrow-down";
          const color = isPositive
            ? "var(--success-color)"
            : "var(--error-color)";
          return `<i class="fas ${icon}" style="color: ${color};"></i> ${Math.abs(
            change
          ).toFixed(1)}%`;
        };

        document.getElementById("trendRequestsChange").innerHTML =
          formatChange(requestChange);
        document.getElementById("trendDurationChange").innerHTML = formatChange(
          durationChange,
          true
        ); // Reverse: lower is better
        document.getElementById("trendErrorsChange").innerHTML = formatChange(
          errorChange,
          true
        ); // Reverse: lower is better
        document.getElementById("trendBytesChange").innerHTML = formatChange(
          bytesChange,
          true
        ); // Reverse: lower is better
      }
    } catch (error) {
      console.error("Failed to load trend analysis:", error);
    }
  }

  async loadActivityHeatmap() {
    try {
      const filters = this.getActiveFilters();

      // Build WHERE clause
      const whereConditions = ["timestamp IS NOT NULL"];
      if (filters.domain) {
        whereConditions.push(
          `domain = '${filters.domain.replace(/'/g, "''")}'`
        );
      }
      if (filters.pageUrl) {
        whereConditions.push(
          `page_url = '${filters.pageUrl.replace(/'/g, "''")}'`
        );
      }
      if (filters.type) {
        whereConditions.push(`type = '${filters.type.replace(/'/g, "''")}'`);
      }
      const whereClause = whereConditions.join(" AND ");

      // Query for request counts by hour and day of week
      const query = `
        SELECT 
          CAST(strftime('%w', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) as day_of_week,
          CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) as hour_of_day,
          COUNT(*) as request_count
        FROM silver_requests
        WHERE ${whereClause}
        GROUP BY day_of_week, hour_of_day
        ORDER BY day_of_week, hour_of_day
      `;

      const response = await chrome.runtime.sendMessage({
        action: "executeDirectQuery",
        query: query,
      });

      if (response.success && response.data && response.data.length > 0) {
        const canvas = document.getElementById("heatmapCanvas");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const cellSize = 30;
        const padding = 40;
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const hours = Array.from({ length: 24 }, (_, i) => i);

        canvas.width = padding + hours.length * cellSize;
        canvas.height = padding + days.length * cellSize;

        // Create heatmap data structure
        const heatmapData = Array(7)
          .fill(0)
          .map(() => Array(24).fill(0));
        let maxCount = 0;

        response.data.forEach((row) => {
          heatmapData[row.day_of_week][row.hour_of_day] = row.request_count;
          maxCount = Math.max(maxCount, row.request_count);
        });

        // Clear canvas
        ctx.fillStyle =
          getComputedStyle(document.body).getPropertyValue(
            "--background-color"
          ) || "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw labels
        ctx.font = "12px Arial";
        ctx.fillStyle =
          getComputedStyle(document.body).getPropertyValue(
            "--text-primary-color"
          ) || "#333";

        // Day labels
        days.forEach((day, i) => {
          ctx.fillText(day, 5, padding + i * cellSize + 18);
        });

        // Hour labels (every 3 hours)
        for (let h = 0; h < 24; h += 3) {
          ctx.fillText(h.toString(), padding + h * cellSize + 5, 20);
        }

        // Draw heatmap cells
        days.forEach((day, dayIndex) => {
          hours.forEach((hour, hourIndex) => {
            const count = heatmapData[dayIndex][hourIndex];
            const intensity = maxCount > 0 ? count / maxCount : 0;

            // Color gradient from light to dark based on activity
            const r = Math.floor(255 - intensity * 150);
            const g = Math.floor(255 - intensity * 100);
            const b = Math.floor(255 - intensity * 50);

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(
              padding + hourIndex * cellSize,
              padding + dayIndex * cellSize,
              cellSize - 1,
              cellSize - 1
            );

            // Add count text if significant
            if (count > 0) {
              ctx.fillStyle = intensity > 0.5 ? "#fff" : "#333";
              ctx.font = "10px Arial";
              ctx.textAlign = "center";
              ctx.fillText(
                count.toString(),
                padding + hourIndex * cellSize + cellSize / 2,
                padding + dayIndex * cellSize + cellSize / 2 + 3
              );
            }
          });
        });
      } else {
        // Show placeholder if no data
        const canvas = document.getElementById("heatmapCanvas");
        if (canvas) {
          const ctx = canvas.getContext("2d");
          canvas.width = 600;
          canvas.height = 300;
          ctx.fillStyle =
            getComputedStyle(document.body).getPropertyValue(
              "--text-secondary-color"
            ) || "#999";
          ctx.font = "14px Arial";
          ctx.textAlign = "center";
          ctx.fillText(
            "No activity data available",
            canvas.width / 2,
            canvas.height / 2
          );
        }
      }
    } catch (error) {
      console.error("Failed to load activity heatmap:", error);
    }
  }

  async loadDomainComparison() {
    try {
      const domain1 = document.getElementById("compareDomain1")?.value;
      const domain2 = document.getElementById("compareDomain2")?.value;
      const domain3 = document.getElementById("compareDomain3")?.value;

      const domains = [domain1, domain2, domain3].filter((d) => d && d !== "");

      if (domains.length < 2) {
        document.getElementById("comparisonResults").innerHTML =
          '<p class="placeholder" style="padding: 40px; text-align: center; color: var(--text-secondary-color);">Select at least 2 domains to compare</p>';
        return;
      }

      // Query metrics for each domain
      const queries = domains.map(
        (domain) => `
        SELECT 
          '${domain.replace(/'/g, "''")}' as domain,
          COUNT(*) as request_count,
          AVG(duration) as avg_duration,
          SUM(size_bytes) as total_bytes,
          SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count,
          (SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as cache_hit_rate
        FROM silver_requests
        WHERE domain = '${domain.replace(/'/g, "''")}'
      `
      );

      const responses = await Promise.all(
        queries.map((q) =>
          chrome.runtime.sendMessage({ action: "executeDirectQuery", query: q })
        )
      );

      const comparisonData = responses
        .filter((r) => r.success && r.data && r.data.length > 0)
        .map((r) => r.data[0]);

      if (comparisonData.length < 2) {
        document.getElementById("comparisonResults").innerHTML =
          '<p class="placeholder">Not enough data for comparison</p>';
        return;
      }

      // Create comparison chart
      const canvas = document.getElementById("comparisonChart");
      const ctx = canvas.getContext("2d");

      // Destroy existing chart if it exists
      if (this.comparisonChartInstance) {
        this.comparisonChartInstance.destroy();
      }

      this.comparisonChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: [
            "Requests",
            "Avg Duration (ms)",
            "Errors",
            "Cache Hit Rate (%)",
          ],
          datasets: comparisonData.map((data, index) => ({
            label: data.domain,
            data: [
              data.request_count,
              Math.round(data.avg_duration || 0),
              data.error_count,
              Math.round(data.cache_hit_rate || 0),
            ],
            backgroundColor: [
              "rgba(54, 162, 235, 0.6)",
              "rgba(255, 99, 132, 0.6)",
              "rgba(75, 192, 192, 0.6)",
            ][index],
            borderColor: [
              "rgba(54, 162, 235, 1)",
              "rgba(255, 99, 132, 1)",
              "rgba(75, 192, 192, 1)",
            ][index],
            borderWidth: 1,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: "top",
              labels: {
                color:
                  getComputedStyle(document.body).getPropertyValue(
                    "--text-primary-color"
                  ) || "#333",
              },
            },
            title: {
              display: true,
              text: "Domain Performance Comparison",
              color:
                getComputedStyle(document.body).getPropertyValue(
                  "--text-primary-color"
                ) || "#333",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color:
                  getComputedStyle(document.body).getPropertyValue(
                    "--text-secondary-color"
                  ) || "#666",
              },
              grid: {
                color:
                  getComputedStyle(document.body).getPropertyValue(
                    "--border-color"
                  ) || "#ddd",
              },
            },
            x: {
              ticks: {
                color:
                  getComputedStyle(document.body).getPropertyValue(
                    "--text-secondary-color"
                  ) || "#666",
              },
              grid: {
                color:
                  getComputedStyle(document.body).getPropertyValue(
                    "--border-color"
                  ) || "#ddd",
              },
            },
          },
        },
      });
    } catch (error) {
      console.error("Failed to load domain comparison:", error);
      document.getElementById("comparisonResults").innerHTML =
        '<p class="no-data">Error loading comparison data</p>';
    }
  }

  async loadPerformanceInsights() {
    try {
      const filters = this.getActiveFilters();

      // Build WHERE clause
      const whereConditions = ["duration IS NOT NULL"];
      if (filters.domain) {
        whereConditions.push(
          `domain = '${filters.domain.replace(/'/g, "''")}'`
        );
      }
      if (filters.pageUrl) {
        whereConditions.push(
          `page_url = '${filters.pageUrl.replace(/'/g, "''")}'`
        );
      }
      if (filters.type) {
        whereConditions.push(`type = '${filters.type.replace(/'/g, "''")}'`);
      }
      const whereClause = whereConditions.join(" AND ");

      // Query for insights data
      const queries = {
        slowRequests: `
          SELECT COUNT(*) as count
          FROM silver_requests
          WHERE ${whereClause} AND duration > 1000
        `,
        largeRequests: `
          SELECT COUNT(*) as count, SUM(size_bytes) as total_size
          FROM silver_requests
          WHERE ${whereClause} AND size_bytes > 1000000
        `,
        errors: `
          SELECT COUNT(*) as count
          FROM silver_requests
          WHERE ${whereClause} AND status >= 400
        `,
        cacheHits: `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END) as cached
          FROM silver_requests
          WHERE ${whereClause}
        `,
      };

      const responses = await Promise.all(
        Object.values(queries).map((q) =>
          chrome.runtime.sendMessage({ action: "executeDirectQuery", query: q })
        )
      );

      const insights = [];
      const [slowResp, largeResp, errorResp, cacheResp] = responses;

      // Analyze slow requests
      if (slowResp.success && slowResp.data[0]?.count > 0) {
        const count = slowResp.data[0].count;
        insights.push({
          type: "warning",
          title: "Slow Requests Detected",
          description: `${count} request${
            count > 1 ? "s" : ""
          } took longer than 1 second to complete.`,
          recommendation:
            "Consider optimizing these endpoints or adding caching.",
          priority: "high",
        });
      }

      // Analyze large requests
      if (largeResp.success && largeResp.data[0]?.count > 0) {
        const count = largeResp.data[0].count;
        const totalMB = (largeResp.data[0].total_size / 1048576).toFixed(2);
        insights.push({
          type: "info",
          title: "Large Requests Found",
          description: `${count} request${
            count > 1 ? "s" : ""
          } exceeded 1MB (total: ${totalMB}MB).`,
          recommendation:
            "Consider implementing compression or lazy loading for large resources.",
          priority: "medium",
        });
      }

      // Analyze errors
      if (errorResp.success && errorResp.data[0]?.count > 0) {
        const count = errorResp.data[0].count;
        insights.push({
          type: "error",
          title: "Request Errors Detected",
          description: `${count} request${
            count > 1 ? "s" : ""
          } failed with 4xx/5xx status codes.`,
          recommendation:
            "Review error logs and fix broken endpoints or network issues.",
          priority: "high",
        });
      }

      // Analyze cache performance
      if (cacheResp.success && cacheResp.data[0]) {
        const total = cacheResp.data[0].total;
        const cached = cacheResp.data[0].cached;
        const cacheRate = total > 0 ? ((cached / total) * 100).toFixed(1) : 0;

        if (cacheRate < 30 && total > 10) {
          insights.push({
            type: "warning",
            title: "Low Cache Hit Rate",
            description: `Only ${cacheRate}% of requests are being served from cache.`,
            recommendation:
              "Improve caching strategy with appropriate Cache-Control headers.",
            priority: "medium",
          });
        } else if (cacheRate >= 70) {
          insights.push({
            type: "success",
            title: "Excellent Cache Performance",
            description: `${cacheRate}% of requests are being served from cache.`,
            recommendation: "Great job! Your caching strategy is working well.",
            priority: "low",
          });
        }
      }

      // Display insights
      const insightsList = document.getElementById("insightsList");
      if (insights.length === 0) {
        insightsList.innerHTML =
          '<p class="placeholder" style="padding: 20px; text-align: center; color: var(--success-color);"><i class="fas fa-check-circle"></i> No issues detected - performance looks good!</p>';
      } else {
        let html = '<div style="display: grid; gap: 12px;">';

        insights.forEach((insight) => {
          const iconMap = {
            error: "fa-exclamation-circle",
            warning: "fa-exclamation-triangle",
            info: "fa-info-circle",
            success: "fa-check-circle",
          };

          const colorMap = {
            error: "var(--error-color)",
            warning: "var(--warning-color)",
            info: "var(--info-color)",
            success: "var(--success-color)",
          };

          const priorityBadge =
            insight.priority === "high"
              ? '<span style="background: var(--error-color); color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">HIGH</span>'
              : insight.priority === "medium"
              ? '<span style="background: var(--warning-color); color: #333; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">MEDIUM</span>'
              : '<span style="background: var(--surface-color); color: var(--text-secondary-color); padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">LOW</span>';

          html += `
            <div class="insight-card" style="
              background: var(--surface-color);
              border-left: 4px solid ${colorMap[insight.type]};
              border-radius: 4px;
              padding: 16px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <i class="fas ${iconMap[insight.type]}" style="color: ${
            colorMap[insight.type]
          };"></i>
                  <h4 style="margin: 0; font-size: 16px; color: var(--text-primary-color);">${
                    insight.title
                  }</h4>
                </div>
                ${priorityBadge}
              </div>
              <p style="margin: 0 0 8px 0; color: var(--text-primary-color); font-size: 14px;">
                ${insight.description}
              </p>
              <p style="margin: 0; color: var(--text-secondary-color); font-size: 13px;">
                <i class="fas fa-lightbulb" style="color: var(--warning-color);"></i>
                <strong>Recommendation:</strong> ${insight.recommendation}
              </p>
            </div>
          `;
        });

        html += "</div>";
        insightsList.innerHTML = html;
      }
    } catch (error) {
      console.error("Failed to load performance insights:", error);
      document.getElementById("insightsList").innerHTML =
        '<p class="no-data">Error loading insights</p>';
    }
  }
}

// Export singleton instance
export const dashboard = new Dashboard();

// Initialize when dashboard tab is active
document.addEventListener("DOMContentLoaded", () => {
  const dashboardTab = document.querySelector('[data-tab="dashboard"]');
  const dashboardContent = document.getElementById("dashboard");

  if (dashboardTab) {
    // Attach to the tab click
    dashboardTab.addEventListener("click", async () => {
      // Delay initialization to ensure DOM is ready
      setTimeout(async () => {
        if (!dashboard.charts.volume) {
          await dashboard.initialize();
        } else {
          await dashboard.refreshDashboard();
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

  // Also observe the dashboard content becoming active (backup approach)
  if (dashboardContent) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          if (dashboardContent.classList.contains("active")) {
            setTimeout(async () => {
              if (!dashboard.charts.volume) {
                await dashboard.initialize();
              }
            }, 100);
          }
        }
      });
    });

    observer.observe(dashboardContent, { attributes: true });
  }
});
