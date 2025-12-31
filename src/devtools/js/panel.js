import Chart from "../../lib/chart.min.js";
import logger from "../../lib/utils/logger.js";

// Global initialization function that can be called from devtools.js
window.initializePanel = function () {
  logger.debug("Panel initialization requested");
};

export class DevToolsPanel {
  constructor() {
    this.charts = {};
    this.currentUrl = "";
    this.refreshInterval = null;
    this.capturePaused = false;
    this.streamPaused = false;
    this.streamData = [];
    this.selectedRequests = new Set();
    this.currentErrors = [];

    // Constants
    this.SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
    this.MAX_CHART_POINTS = 20;
    this.ERROR_STATUS_PREFIX = "4xx";
    this.DEFAULT_TIME_RANGE = 300; // 5 minutes in seconds

    this.initialize();
  }

  async initialize() {
    // Load settings first to know which charts to initialize
    await this.loadSettings();
    this.setupUI();
    this.setupEventListeners();
    await this.initializeCharts();
    this.startMetricsCollection();
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getSettings",
      });
      if (response && response.success && response.settings) {
        this.userSettings = response.settings;
        logger.debug("DevTools Panel: Loaded settings:", this.userSettings);
      } else {
        // Default settings if none found
        this.userSettings = {
          display: {
            showCharts: true,
            enabledCharts: ["performanceChart", "statusChart", "requestsChart"],
          },
        };
        logger.debug("DevTools Panel: Using default settings");
      }
    } catch (error) {
      logger.error("Failed to load settings:", error);
      this.userSettings = {
        display: {
          showCharts: true,
          enabledCharts: ["performanceChart", "statusChart", "requestsChart"],
        },
      };
    }
  }

  setupUI() {
    const container = document.getElementById("panel-container");
    container.innerHTML = `
      <div class="metrics-panel">
        <!-- Enhanced Filters Panel - At Top -->
        <div class="filters-header">
          <div class="filter-group">
            <label><i class="fas fa-globe"></i> Current Domain:</label>
            <span id="currentDomainDisplay" class="domain-display">Loading...</span>
          </div>
          
          <div class="filter-group">
            <label><i class="fas fa-file"></i> Page:</label>
            <select id="pageFilter" class="filter-select">
              <option value="">All Pages (Aggregated)</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label><i class="fas fa-filter"></i> Request Type:</label>
            <select id="requestTypeFilter" class="filter-select">
              <option value="">All Types</option>
              <option value="xmlhttprequest">XHR/AJAX</option>
              <option value="fetch">Fetch API</option>
              <option value="script">Scripts</option>
              <option value="stylesheet">Stylesheets</option>
              <option value="image">Images</option>
              <option value="font">Fonts</option>
              <option value="document">Documents</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label><i class="fas fa-check-circle"></i> Status:</label>
            <select id="statusFilter" class="filter-select">
              <option value="">All Status</option>
              <option value="200">2xx Success</option>
              <option value="3xx">3xx Redirect</option>
              <option value="4xx">4xx Client Error</option>
              <option value="5xx">5xx Server Error</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label><i class="fas fa-clock"></i> Time Range:</label>
            <select id="timeRange" class="filter-select">
              <option value="300" selected>Last 5 minutes</option>
              <option value="900">Last 15 minutes</option>
              <option value="1800">Last 30 minutes</option>
              <option value="3600">Last hour</option>
              <option value="21600">Last 6 hours</option>
              <option value="86400">Last 24 hours</option>
              <option value="604800">Last 7 days</option>
            </select>
          </div>
          
          <div class="filter-actions">
            <button id="refreshMetrics" class="btn-primary">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
            <button id="clearFilters" class="btn-secondary">
              <i class="fas fa-times"></i> Clear
            </button>
            <button id="exportMetrics" class="btn-secondary">
              <i class="fas fa-download"></i> Export
            </button>
            <button id="pauseCapture" class="btn-secondary" title="Pause request capture">
              <i class="fas fa-pause"></i> Pause
            </button>
          </div>
        </div>
        
        <!-- Active Filters Display -->
        <div id="activeFiltersDisplay" class="active-filters" style="display: none;">
          <span class="filter-label">Active Filters:</span>
          <div id="activeFiltersList"></div>
        </div>
        
        <!-- Stats Cards -->
        <div class="stats-grid">
          <div class="stat-card info">
            <div class="stat-card-label">
              <i class="fas fa-network-wired stat-card-icon"></i>
              Total Requests
            </div>
            <div class="stat-card-value" id="totalRequestsValue">0</div>
          </div>
          <div class="stat-card success">
            <div class="stat-card-label">
              <i class="fas fa-tachometer-alt stat-card-icon"></i>
              Avg Response
            </div>
            <div class="stat-card-value" id="avgResponseValue">0ms</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-card-label">
              <i class="fas fa-exclamation-triangle stat-card-icon"></i>
              Slow Requests
            </div>
            <div class="stat-card-value" id="slowRequestsValue">0</div>
          </div>
          <div class="stat-card error">
            <div class="stat-card-label">
              <i class="fas fa-times-circle stat-card-icon"></i>
              Errors
            </div>
            <div class="stat-card-value" id="errorsValue">0</div>
          </div>
          <div class="stat-card primary">
            <div class="stat-card-label">
              <i class="fas fa-exchange-alt stat-card-icon"></i>
              Success Rate
            </div>
            <div class="stat-card-value" id="successRateValue">0%</div>
          </div>
          <div class="stat-card secondary">
            <div class="stat-card-label">
              <i class="fas fa-clock stat-card-icon"></i>
              P95 Response
            </div>
            <div class="stat-card-value" id="p95ResponseValue">0ms</div>
          </div>
        </div>
        
        <!-- No Data State -->
        <div id="noDataState" class="no-data-state" style="display: none;">
          <i class="fas fa-inbox fa-3x"></i>
          <h3>No Data Available</h3>
          <p>No requests found for the selected filters.</p>
          <p class="hint">Try adjusting your filters or wait for requests to be captured.</p>
          <button id="resetFiltersBtn" class="btn-primary">Reset Filters</button>
        </div>

        <!-- Main Content Tabs -->
        <div class="content-tabs">
          <div class="tabs-nav">
            <button data-tab="overview" class="tab-btn active">
              <i class="fas fa-chart-line"></i> Overview
            </button>
            <button data-tab="requests" class="tab-btn">
              <i class="fas fa-list"></i> Requests Table
            </button>
            <button data-tab="endpoints" class="tab-btn">
              <i class="fas fa-network-wired"></i> Endpoints
            </button>
            <button data-tab="errors" class="tab-btn">
              <i class="fas fa-bug"></i> Errors
            </button>
            <button data-tab="performance" class="tab-btn">
              <i class="fas fa-stopwatch"></i> Performance
            </button>
            <button data-tab="waterfall" class="tab-btn">
              <i class="fas fa-stream"></i> Waterfall
            </button>
            <button data-tab="resources" class="tab-btn">
              <i class="fas fa-database"></i> Resources
            </button>
            <button data-tab="websocket" class="tab-btn" id="websocketTabBtn" style="display: none;">
              <i class="fas fa-plug"></i> WebSocket
            </button>
          </div>
          
          <!-- Overview Tab -->
          <div id="overviewTab" class="tab-content active">
            <div class="charts-grid" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));">
              <div class="chart-container">
                <h4><i class="fas fa-chart-line"></i> Response Time Timeline</h4>
                <canvas id="performanceChart"></canvas>
              </div>
              <div class="chart-container">
                <h4><i class="fas fa-chart-pie"></i> Status Distribution</h4>
                <canvas id="statusChart"></canvas>
              </div>
              <div class="chart-container">
                <h4><i class="fas fa-chart-bar"></i> Request Types</h4>
                <canvas id="requestsChart"></canvas>
              </div>
            </div>
          </div>
          
          <!-- Requests Table Tab -->
          <div id="requestsTab" class="tab-content">
            <div class="table-controls">
              <div class="search-container">
                <i class="fas fa-search"></i>
                <input type="text" id="searchRequests" placeholder="Search URLs, methods, status..." class="search-input">
              </div>
              <select id="requestsPerPage" class="filter-select-sm">
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
            <div class="requests-table-container">
              <table id="requestsTable" class="data-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>URL</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Time</th>
                    <th>Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="requestsTableBody">
                  <tr class="no-data-row">
                    <td colspan="7">No requests available</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div id="tablePagination" class="pagination"></div>
          </div>
          
          <!-- Waterfall Tab -->
          <div id="waterfallTab" class="tab-content">
            <div class="waterfall-controls">
              <button id="copyHAR" class="btn-secondary btn-sm">
                <i class="fas fa-copy"></i> Copy as HAR
              </button>
              <button id="exportHAR" class="btn-secondary btn-sm">
                <i class="fas fa-download"></i> Export HAR
              </button>
            </div>
            <div class="waterfall-container">
              <div id="waterfallChart" class="waterfall-chart"></div>
            </div>
          </div>
          
          <!-- Performance Tab -->
          <div id="performanceTab" class="tab-content">
            <div class="performance-breakdown">
              <h4><i class="fas fa-stopwatch"></i> Timing Breakdown</h4>
              <div id="timingBreakdown" class="timing-chart"></div>
            </div>
            <div class="performance-budgets">
              <h4><i class="fas fa-chart-line"></i> Performance Budgets</h4>
              <div id="budgetsConfig" class="budgets-config">
                <div class="budget-item">
                  <label>Max Response Time (ms):</label>
                  <input type="number" id="budgetResponseTime" value="1000" min="0">
                  <span id="budgetResponseStatus" class="budget-status"></span>
                </div>
                <div class="budget-item">
                  <label>Max Total Size (MB):</label>
                  <input type="number" id="budgetTotalSize" value="5" min="0" step="0.1">
                  <span id="budgetSizeStatus" class="budget-status"></span>
                </div>
                <div class="budget-item">
                  <label>Max Request Count:</label>
                  <input type="number" id="budgetRequestCount" value="100" min="0">
                  <span id="budgetCountStatus" class="budget-status"></span>
                </div>
              </div>
            </div>
            <div class="slow-requests">
              <h4><i class="fas fa-hourglass-half"></i> Slowest Requests (Top 10)</h4>
              <div id="slowRequestsList"></div>
            </div>
          </div>
          
          <!-- Endpoints Tab -->
          <div id="endpointsTab" class="tab-content">
            <div class="endpoints-analysis">
              <h4><i class="fas fa-network-wired"></i> API Endpoints Analysis</h4>
              <div id="endpointsTable"></div>
            </div>
            
            <div class="endpoint-performance-history" style="margin-top: 24px;">
              <h4 style="margin: 0;"><i class="fas fa-chart-line"></i> Endpoint Performance Over Time</h4>
              <p class="hint" id="performanceHint" style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
                Track request types (fetch, xhr, script, etc.) or specific API endpoints performance over time.
              </p>
              
              <div class="history-controls" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
                <!-- Row 1: Time Controls -->
                <div class="filter-group">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">
                    <i class="fas fa-clock"></i> Time Range
                  </label>
                  <select id="historyTimeRange" class="filter-select" style="width: 100%">
                    <option value="1800000">Last 30 minutes</option>
                    <option value="3600000">Last 1 hour</option>
                    <option value="21600000">Last 6 hours</option>
                    <option value="86400000" selected>Last 24 hours</option>
                    <option value="604800000">Last 7 days</option>
                    <option value="2592000000">Last 30 days</option>
                    <option value="7776000000">Last 3 months</option>
                  </select>
                </div>

                <div class="filter-group">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">
                    <i class="fas fa-filter"></i> Resource Type
                  </label>
                  <select id="endpointTypeFilter" class="filter-select" style="width: 100%">
                    <option value="">All Types</option>
                    <option value="fetch">Fetch</option>
                    <option value="xmlhttprequest">XHR/AJAX</option>
                    <option value="script">Script</option>
                    <option value="stylesheet">Stylesheet</option>
                    <option value="image">Image</option>
                    <option value="font">Font</option>
                    <option value="document">Document</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <!-- Row 2: Sorting & Filtering -->
                <div class="filter-group">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">
                    <i class="fas fa-sort"></i> Sort By
                  </label>
                  <select id="endpointSortBy" class="filter-select" style="width: 100%">
                    <option value="requests" selected>Most Requests</option>
                    <option value="slowest">Slowest Avg</option>
                    <option value="errors">Most Errors</option>
                    <option value="size">Largest Size</option>
                  </select>
                </div>

                <div class="filter-group">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">
                    <i class="fas fa-list-ol"></i> Show Top
                  </label>
                  <select id="endpointTopN" class="filter-select" style="width: 100%">
                    <option value="5">Top 5</option>
                    <option value="10" selected>Top 10</option>
                    <option value="15">Top 15</option>
                    <option value="20">Top 20</option>
                    <option value="all">All Endpoints</option>
                  </select>
                </div>

                <div class="filter-group">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">
                    <i class="fas fa-sync-alt"></i> Action
                  </label>
                  <button id="loadHistoryBtn" class="btn-primary" style="width: 100%; padding: 8px 16px; height: 36px">
                    <i class="fas fa-sync-alt"></i> Load Data
                  </button>
                </div>

                <!-- Row 3: Search (spans all columns) -->
                <div class="filter-group" style="grid-column: span 3">
                  <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px;">
                    <i class="fas fa-search"></i> Search Endpoint
                  </label>
                  <input type="text" id="endpointPattern" placeholder="Filter by URL pattern (e.g., /api/users, /login, /products/:id)" class="modern-input" style="width: 100%; padding: 8px 12px;">
                </div>
              </div>

              <!-- Endpoint Selection Panel (shows after loading) -->
              <div id="endpointSelector" style="display: none; margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 6px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <label style="font-weight: 500; color: var(--text-primary)">
                    <i class="fas fa-chart-line"></i> Select Endpoints to Plot (click to toggle):
                  </label>
                  <div style="display: flex; gap: 8px">
                    <button id="selectAllEndpoints" class="btn-secondary" style="padding: 4px 12px; font-size: 12px">
                      Select All
                    </button>
                    <button id="deselectAllEndpoints" class="btn-secondary" style="padding: 4px 12px; font-size: 12px">
                      Deselect All
                    </button>
                  </div>
                </div>
                <div id="endpointList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; max-height: 300px; overflow-y: auto;"></div>
              </div>
              
              <div id="performanceHistoryChart" style="min-height: 300px; position: relative;">
                <canvas id="historyChartCanvas"></canvas>
              </div>
            </div>
          </div>
          
          <!-- Resources Tab -->
          <div id="resourcesTab" class="tab-content">
            <div class="resources-analysis">
              <h4><i class="fas fa-database"></i> Resource Size Breakdown</h4>
              <div id="resourceSizeChart" class="chart-container">
                <canvas id="resourcePieChart"></canvas>
              </div>
              <div id="resourcesTable" class="resources-table"></div>
            </div>
            <div class="compression-analysis">
              <h4><i class="fas fa-compress"></i> Compression Analysis</h4>
              <div id="compressionStats"></div>
            </div>
          </div>
          
          <!-- Errors Tab -->
          <div id="errorsTab" class="tab-content">
            <div class="errors-analysis">
              <h4><i class="fas fa-bug"></i> Failed Requests</h4>
              <div id="errorsList"></div>
            </div>
            <div class="errors-chart">
              <h4><i class="fas fa-chart-bar"></i> Error Distribution</h4>
              <canvas id="errorsChart"></canvas>
            </div>
            <div class="error-categories">
              <h4><i class="fas fa-tags"></i> Error Categories</h4>
              <div id="errorCategories"></div>
            </div>
          </div>
          
          <!-- WebSocket Tab -->
          <div id="websocketTab" class="tab-content">
            <div class="websocket-header">
              <h4><i class="fas fa-plug"></i> WebSocket Inspector</h4>
              <div class="websocket-controls">
                <button id="clearWebSocketBtn" class="btn-secondary btn-sm">
                  <i class="fas fa-trash"></i> Clear
                </button>
                <button id="pauseWebSocketBtn" class="btn-secondary btn-sm">
                  <i class="fas fa-pause"></i> Pause
                </button>
              </div>
            </div>
            <div class="websocket-stats">
              <div class="stat-box">
                <span class="stat-label">Connections:</span>
                <span class="stat-value" id="wsConnectionCount">0</span>
              </div>
              <div class="stat-box">
                <span class="stat-label">Messages Sent:</span>
                <span class="stat-value" id="wsSentCount">0</span>
              </div>
              <div class="stat-box">
                <span class="stat-label">Messages Received:</span>
                <span class="stat-value" id="wsReceivedCount">0</span>
              </div>
            </div>
            <div class="websocket-messages" id="websocketMessages">
              <p class="placeholder">No WebSocket activity detected. WebSocket connections will appear here when they occur.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Filter controls
    const pageFilter = document.getElementById("pageFilter");
    const timeRange = document.getElementById("timeRange");
    const requestTypeFilter = document.getElementById("requestTypeFilter");
    const statusFilter = document.getElementById("statusFilter");

    if (pageFilter) {
      pageFilter.addEventListener("change", () => this.applyFilters());
    }
    if (timeRange) {
      timeRange.addEventListener("change", () => this.applyFilters());
    }
    if (requestTypeFilter) {
      requestTypeFilter.addEventListener("change", () => this.applyFilters());
    }
    if (statusFilter) {
      statusFilter.addEventListener("change", () => this.applyFilters());
    }

    // Action buttons
    const refreshMetrics = document.getElementById("refreshMetrics");
    if (refreshMetrics) {
      refreshMetrics.addEventListener("click", () => this.refreshMetrics());
    }

    const clearFilters = document.getElementById("clearFilters");
    if (clearFilters) {
      clearFilters.addEventListener("click", () => this.clearFilters());
    }

    const exportMetrics = document.getElementById("exportMetrics");
    if (exportMetrics) {
      exportMetrics.addEventListener("click", () => this.exportMetrics());
    }

    const resetFiltersBtn = document.getElementById("resetFiltersBtn");
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener("click", () => this.clearFilters());
    }

    // Time Travel feature
    const timeTravelBtn = document.getElementById("timeTravelBtn");
    if (timeTravelBtn) {
      timeTravelBtn.addEventListener("click", () => this.openTimeTravelModal());
    }

    const closeTimeTravelModal = document.getElementById(
      "closeTimeTravelModal"
    );
    if (closeTimeTravelModal) {
      closeTimeTravelModal.addEventListener("click", () =>
        this.closeTimeTravelModal()
      );
    }

    const loadHistoricalData = document.getElementById("loadHistoricalData");
    if (loadHistoricalData) {
      loadHistoricalData.addEventListener("click", () =>
        this.loadHistoricalData()
      );
    }

    // HAR export features
    const copyHAR = document.getElementById("copyHAR");
    if (copyHAR) {
      copyHAR.addEventListener("click", () => this.copyAsHAR());
    }

    const exportHAR = document.getElementById("exportHAR");
    if (exportHAR) {
      exportHAR.addEventListener("click", () => this.exportAsHAR());
    }

    // Performance budgets
    const budgetResponseTime = document.getElementById("budgetResponseTime");
    if (budgetResponseTime) {
      budgetResponseTime.addEventListener("change", () =>
        this.checkPerformanceBudgets()
      );
    }

    const budgetTotalSize = document.getElementById("budgetTotalSize");
    if (budgetTotalSize) {
      budgetTotalSize.addEventListener("change", () =>
        this.checkPerformanceBudgets()
      );
    }

    const budgetRequestCount = document.getElementById("budgetRequestCount");
    if (budgetRequestCount) {
      budgetRequestCount.addEventListener("change", () =>
        this.checkPerformanceBudgets()
      );
    }

    // Live streaming
    const pauseCapture = document.getElementById("pauseCapture");
    if (pauseCapture) {
      pauseCapture.addEventListener("click", () => this.toggleCapture());
    }

    // Tab navigation
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach((button) => {
      button.addEventListener("click", () =>
        this.switchTab(button.dataset.tab)
      );
    });

    // Search
    const searchRequests = document.getElementById("searchRequests");
    if (searchRequests) {
      searchRequests.addEventListener("input", (e) => {
        this.searchRequests(e.target.value);
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

  // Get current tab's domain
  async getCurrentDomain() {
    return new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(
        "window.location.hostname",
        (result, error) => {
          if (error) {
            logger.error("Error getting current domain:", error);
            resolve("");
          } else {
            resolve(result || "");
          }
        }
      );
    });
  }

  // Get current tab's full URL
  async getCurrentPageUrl() {
    return new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(
        "window.location.origin + window.location.pathname",
        (result, error) => {
          if (error) {
            logger.error("Error getting current page URL:", error);
            resolve("");
          } else {
            resolve(result || "");
          }
        }
      );
    });
  }

  async initializeCharts() {
    // Check if charts are enabled globally
    const showCharts = this.userSettings?.display?.showCharts !== false;
    const enabledCharts = this.userSettings?.display?.enabledCharts || [
      "performanceChart",
      "statusChart",
      "requestsChart",
    ];

    logger.debug("Initializing charts with settings:", {
      showCharts,
      enabledCharts,
    });

    if (!showCharts) {
      logger.debug("Charts disabled by user settings");
      return;
    }

    const colors = this.getChartColors();

    // Performance Chart - Line chart for response times over time
    if (enabledCharts.includes("performanceChart")) {
      const perfCtx = document
        .getElementById("performanceChart")
        ?.getContext("2d");
      if (perfCtx) {
        this.charts.performance = new Chart(perfCtx, {
          type: "line",
          data: {
            labels: [],
            datasets: [
              {
                label: "Response Time (ms)",
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
              tooltip: {
                mode: "index",
                intersect: false,
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
              x: {
                title: {
                  display: true,
                  text: "Time",
                },
              },
            },
          },
        });

        // Status Chart - Pie chart for status distribution
        if (enabledCharts.includes("statusChart")) {
          const statusCtx = document
            .getElementById("statusChart")
            ?.getContext("2d");
          if (statusCtx) {
            this.charts.status = new Chart(statusCtx, {
              type: "pie",
              data: {
                labels: [],
                datasets: [
                  {
                    data: [],
                    backgroundColor: [
                      colors.success, // 2xx
                      colors.info, // 3xx
                      colors.warning, // 4xx
                      colors.error, // 5xx
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
        }

        // Requests Chart - Bar chart for request types
        if (enabledCharts.includes("requestsChart")) {
          const reqCtx = document
            .getElementById("requestsChart")
            ?.getContext("2d");
          if (reqCtx) {
            this.charts.requests = new Chart(reqCtx, {
              type: "bar",
              data: {
                labels: [],
                datasets: [
                  {
                    label: "Requests by Type",
                    data: [],
                    backgroundColor: colors.primary,
                    borderWidth: 1,
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
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Count",
                    },
                  },
                },
              },
            });
          }
        }

        // Errors Chart for errors tab (always enabled)
        const errCtx = document.getElementById("errorsChart")?.getContext("2d");
        if (errCtx) {
          this.charts.errors = new Chart(errCtx, {
            type: "bar",
            data: {
              labels: [],
              datasets: [
                {
                  label: "Error Count",
                  data: [],
                  backgroundColor: colors.error,
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
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    precision: 0,
                  },
                },
              },
            },
          });
        }
      }

      logger.debug("Charts initialized:", Object.keys(this.charts));
    }
  }

  async startMetricsCollection() {
    // Get and display current domain
    const currentDomain = await this.getCurrentDomain();
    const domainDisplay = document.getElementById("currentDomainDisplay");
    if (domainDisplay && currentDomain) {
      domainDisplay.textContent = currentDomain;
      domainDisplay.title = `Showing data for ${currentDomain} only`;
    }

    // Store current domain for use in filters
    this.currentDomain = currentDomain;

    // Load pages for current domain
    if (currentDomain) {
      await this.loadPageFilter(currentDomain);
    }

    // Initialize capture button state from settings
    await this.initializeCaptureState();

    // Initial collection
    await this.collectMetrics();

    // Set up periodic refresh
    this.refreshInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Refresh every 5 seconds
  }

  async collectMetrics() {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        logger.warn(
          "Extension context invalidated, stopping metrics collection"
        );
        this.stopMetricsCollection();
        return;
      }

      const filters = this.getActiveFilters();
      logger.debug("DevTools Panel: Collecting metrics with filters:", filters);

      // Get metrics from background page
      chrome.runtime.sendMessage(
        {
          action: "getFilteredStats",
          filters,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            // Context invalidated or extension reloaded
            logger.warn(
              "Runtime error (context may be invalidated):",
              chrome.runtime.lastError.message
            );
            this.stopMetricsCollection();
            return;
          }

          logger.debug("DevTools Panel: Received response:", response);

          if (response && response.success) {
            // Check if there's data
            if (!response.totalRequests || response.totalRequests === 0) {
              logger.debug(
                "DevTools Panel: No data available (totalRequests = 0)"
              );
              this.showNoDataState(true);
            } else {
              logger.debug("DevTools Panel: Data available, updating metrics");
              this.showNoDataState(false);
              this.updateMetrics(response);
            }
          } else {
            logger.error(
              "DevTools Panel: Failed to get metrics:",
              response?.error
            );
            this.showNoDataState(true);
          }
        }
      );
    } catch (error) {
      logger.error("DevTools Panel: Error collecting metrics:", error);
      // Stop collection on error to prevent spam
      this.stopMetricsCollection();
    }
  }

  stopMetricsCollection() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      logger.debug("Metrics collection stopped");
    }
  }

  updateMetrics(metrics) {
    // Update stat cards
    document.getElementById("totalRequestsValue").textContent =
      metrics.totalRequests || 0;

    const avgResponse =
      metrics.responseTimes && metrics.responseTimes.length > 0
        ? Math.round(
            metrics.responseTimes.reduce((a, b) => a + b, 0) /
              metrics.responseTimes.length
          )
        : 0;
    document.getElementById(
      "avgResponseValue"
    ).textContent = `${avgResponse}ms`;

    const slowRequests =
      metrics.responseTimes && metrics.responseTimes.length > 0
        ? metrics.responseTimes.filter((t) => t > 1000).length
        : 0;
    document.getElementById("slowRequestsValue").textContent = slowRequests;

    const errors = Object.entries(metrics.statusCodes || {})
      .filter(([status]) => parseInt(status) >= 400)
      .reduce((sum, [, count]) => sum + count, 0);
    document.getElementById("errorsValue").textContent = errors;

    // Calculate success rate
    const total = metrics.totalRequests || 0;
    const successCount = total - errors;
    const successRate =
      total > 0 ? Math.round((successCount / total) * 100) : 0;
    document.getElementById("successRateValue").textContent = `${successRate}%`;

    // Calculate P95 response time
    if (metrics.responseTimes && metrics.responseTimes.length > 0) {
      const p95 = this.calculatePercentile(metrics.responseTimes, 95);
      document.getElementById("p95ResponseValue").textContent = `${p95}ms`;
    } else {
      document.getElementById("p95ResponseValue").textContent = "0ms";
    }

    // Update performance chart
    if (
      this.charts.performance &&
      metrics.timestamps &&
      metrics.responseTimes
    ) {
      this.charts.performance.data.labels = metrics.timestamps.slice(
        -this.MAX_CHART_POINTS
      );
      this.charts.performance.data.datasets[0].data =
        metrics.responseTimes.slice(-this.MAX_CHART_POINTS);
      this.charts.performance.update();
    }

    // Update status chart
    if (this.charts.status && metrics.statusCodes) {
      const statusGroups = {
        "2xx Success": 0,
        "3xx Redirect": 0,
        "4xx Client Error": 0,
        "5xx Server Error": 0,
      };

      for (const [status, count] of Object.entries(metrics.statusCodes)) {
        const statusCode = parseInt(status);
        if (statusCode >= 200 && statusCode < 300)
          statusGroups["2xx Success"] += count;
        else if (statusCode >= 300 && statusCode < 400)
          statusGroups["3xx Redirect"] += count;
        else if (statusCode >= 400 && statusCode < 500)
          statusGroups["4xx Client Error"] += count;
        else if (statusCode >= 500) statusGroups["5xx Server Error"] += count;
      }

      // Only show groups that have values
      const labels = [];
      const data = [];
      for (const [label, count] of Object.entries(statusGroups)) {
        if (count > 0) {
          labels.push(label);
          data.push(count);
        }
      }

      this.charts.status.data.labels = labels;
      this.charts.status.data.datasets[0].data = data;
      this.charts.status.update();
    }

    // Update requests chart
    if (this.charts.requests && metrics.requestTypes) {
      this.charts.requests.data.labels = Object.keys(metrics.requestTypes);
      this.charts.requests.data.datasets[0].data = Object.values(
        metrics.requestTypes
      );
      this.charts.requests.update();
    }

    // Update volume chart (aggregate by minute)
    if (this.charts.volume && metrics.timestamps) {
      const timelineData = this.aggregateByMinute(metrics.timestamps);
      this.charts.volume.data.labels = timelineData.labels;
      this.charts.volume.data.datasets[0].data = timelineData.values;
      this.charts.volume.update();
    }

    // Update errors chart (for errors tab)
    if (this.charts.errors && metrics.statusCodes) {
      const errorCodes = [];
      const errorCounts = [];

      for (const [status, count] of Object.entries(metrics.statusCodes)) {
        const statusCode = parseInt(status);
        if (statusCode >= 400) {
          errorCodes.push(`${status}`);
          errorCounts.push(count);
        }
      }

      this.charts.errors.data.labels = errorCodes;
      this.charts.errors.data.datasets[0].data = errorCounts;
      this.charts.errors.update();
    }
  }

  aggregateByMinute(timestamps) {
    const minuteCounts = new Map();

    timestamps.forEach((ts) => {
      // Extract minute from timestamp
      const minute = ts.substring(0, ts.lastIndexOf(":"));
      minuteCounts.set(minute, (minuteCounts.get(minute) || 0) + 1);
    });

    return {
      labels: Array.from(minuteCounts.keys()),
      values: Array.from(minuteCounts.values()),
    };
  }

  switchChart(chartId) {
    document.querySelectorAll(".charts-tabs button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.chart === chartId);
    });

    Object.keys(this.charts).forEach((key) => {
      const canvas = document.getElementById(`${key}Chart`);
      if (canvas) {
        canvas.style.display = key === chartId ? "block" : "none";
      }
    });
  }

  handleUrlChange(url) {
    this.currentUrl = url;
    const urlElement = document.getElementById("currentUrl");
    if (urlElement) {
      urlElement.textContent = url;
    }
    this.refreshMetrics();
  }

  async refreshMetrics() {
    const btn = document.getElementById("refreshMetrics");
    if (!btn) return;

    // Show loading state
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

    try {
      await this.collectMetrics();
      this.showToast("Metrics refreshed successfully", "success");
    } catch (error) {
      logger.error("Failed to refresh metrics:", error);
      this.showToast("Failed to refresh metrics", "error");
    } finally {
      // Restore button state
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  exportMetrics() {
    const btn = document.getElementById("exportMetrics");
    const filters = this.getActiveFilters();

    // Show loading state
    if (btn) {
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

      // Restore button after operation
      const restoreButton = () => {
        btn.disabled = false;
        btn.innerHTML = originalText;
      };

      this.showToast("Starting export...", "info");

      chrome.runtime.sendMessage(
        {
          action: "exportFilteredData",
          filters: filters,
          format: "json",
        },
        (response) => {
          restoreButton();

          if (chrome.runtime.lastError) {
            logger.error("Export error:", chrome.runtime.lastError);
            this.showToast(
              "Export failed: " + chrome.runtime.lastError.message,
              "error"
            );
            return;
          }

          if (response && response.success) {
            this.showToast("Metrics exported successfully", "success");
          } else {
            logger.error("Export failed:", response?.error);
            this.showToast(
              "Export failed: " + (response?.error || "Unknown error"),
              "error"
            );
          }
        }
      );
    } else {
      // Fallback if button not found
      this.showToast("Starting export...", "info");

      chrome.runtime.sendMessage(
        {
          action: "exportFilteredData",
          filters: filters,
          format: "json",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            logger.error("Export error:", chrome.runtime.lastError);
            this.showToast(
              "Export failed: " + chrome.runtime.lastError.message,
              "error"
            );
            return;
          }

          if (response && response.success) {
            this.showToast("Metrics exported successfully", "success");
          } else {
            logger.error("Export failed:", response?.error);
            this.showToast(
              "Export failed: " + (response?.error || "Unknown error"),
              "error"
            );
          }
        }
      );
    }
  }

  updateTimeRange(range) {
    this.refreshMetrics();
  }

  applyFilters() {
    this.refreshMetrics();
  }

  // Load domain filter with current domain and all tracked domains
  // Load pages for a specific domain (called from startMetricsCollection)
  async loadPageFilter(domain) {
    try {
      const pageSelect = document.getElementById("pageFilter");

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

      logger.debug("Pages for domain response:", response);
      logger.debug("Response structure:", {
        success: response?.success,
        pagesLength: response?.pages?.length,
        pages: response?.pages,
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
        logger.debug(
          `Loaded ${response.pages.length} pages for domain ${domain}`
        );
      } else {
        logger.warn(`No pages found for domain ${domain}`);
      }
    } catch (error) {
      logger.error("Failed to load page filter:", error);
    }
  }

  // Clear all filters
  clearFilters() {
    const pageFilter = document.getElementById("pageFilter");
    const timeRange = document.getElementById("timeRange");
    const requestTypeFilter = document.getElementById("requestTypeFilter");
    const statusFilter = document.getElementById("statusFilter");
    const searchRequests = document.getElementById("searchRequests");

    if (pageFilter) pageFilter.value = "";
    if (timeRange) timeRange.value = "300";
    if (requestTypeFilter) requestTypeFilter.value = "";
    if (statusFilter) statusFilter.value = "";
    if (searchRequests) searchRequests.value = "";

    // Show feedback
    this.showToast("Filters cleared", "info");

    // Reload data with cleared filters
    this.applyFilters();
  }

  // Switch between tabs
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabBtn) {
      tabBtn.classList.add("active");
    }

    // Update tab content
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });
    const tabContent = document.getElementById(`${tabName}Tab`);
    if (tabContent) {
      tabContent.classList.add("active");
    }

    // Load tab-specific data
    this.loadTabData(tabName);
  }

  // Load data for specific tab
  async loadTabData(tabName) {
    switch (tabName) {
      case "requests":
        await this.loadRequestsTable();
        break;
      case "waterfall":
        await this.loadWaterfallData();
        break;
      case "performance":
        await this.loadPerformanceData();
        break;
      case "endpoints":
        await this.loadEndpointsData();
        break;
      case "resources":
        await this.loadResourcesData();
        break;
      case "errors":
        await this.loadErrorsData();
        break;
      case "websocket":
        await this.loadWebSocketData();
        break;
    }
  }

  // Load requests table
  async loadRequestsTable(page = 1) {
    try {
      const filters = this.getActiveFilters();
      const perPageSelect = document.getElementById("requestsPerPage");
      const perPage = perPageSelect ? parseInt(perPageSelect.value) : 25;
      const offset = (page - 1) * perPage;

      logger.debug("loadRequestsTable called:", {
        page,
        perPage,
        offset,
        filters,
      });

      const response = await chrome.runtime.sendMessage({
        action: "getDetailedRequests",
        filters,
        limit: perPage,
        offset: offset,
      });

      logger.debug("getDetailedRequests response:", {
        success: response?.success,
        requestsLength: response?.requests?.length,
        totalCount: response?.totalCount,
      });

      const tbody = document.getElementById("requestsTableBody");

      if (
        !response.success ||
        !response.requests ||
        response.requests.length === 0
      ) {
        tbody.innerHTML =
          '<tr class="no-data-row"><td colspan="7">No requests available for selected filters</td></tr>';
        document.getElementById("tablePagination").innerHTML = "";
        return;
      }

      // Build table rows with actual request data
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
        const errorIcon = req.error
          ? '<i class="fas fa-exclamation-circle" title="Error"></i>'
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
              <button class="btn-icon btn-copy-fetch" data-request-id="${
                req.id
              }" title="Copy as Fetch">
                <i class="fas fa-code"></i>
              </button>
              ${errorIcon}
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = rows;

      // Store requests for copy as cURL functionality
      this.currentRequests = response.requests;

      // Render pagination
      this.renderPagination(page, response.totalCount, perPage);

      // Add listener for per-page selector (only once)
      if (perPageSelect && !perPageSelect.dataset.listenerAdded) {
        perPageSelect.dataset.listenerAdded = "true";
        perPageSelect.addEventListener("change", () => {
          this.loadRequestsTable(1); // Reset to page 1 when changing per-page
        });
      }

      // Use event delegation instead of inline onclick (only add listener once)
      if (!tbody.dataset.listenerAdded) {
        tbody.dataset.listenerAdded = "true";
        tbody.addEventListener("click", (e) => {
          const viewBtn = e.target.closest(".btn-view-details");
          if (viewBtn) {
            const requestId = viewBtn.dataset.requestId;
            this.viewRequestDetails(requestId);
            return;
          }

          const curlBtn = e.target.closest(".btn-copy-curl");
          if (curlBtn) {
            const requestId = curlBtn.dataset.requestId;
            logger.debug("Copy cURL clicked for request:", requestId);
            logger.debug(
              "Current requests available:",
              this.currentRequests?.length
            );
            const requestData = this.currentRequests?.find(
              (r) => r.id === requestId
            );
            if (requestData) {
              logger.debug("Found request data:", {
                url: requestData.url,
                method: requestData.method,
              });
              this.copyAsCurl(requestData);
            } else {
              logger.error("Request data not found for id:", requestId);
              this.showToast("Request data not available", "error");
            }
            return;
          }

          const fetchBtn = e.target.closest(".btn-copy-fetch");
          if (fetchBtn) {
            const requestId = fetchBtn.dataset.requestId;
            const requestData = this.currentRequests?.find(
              (r) => r.id === requestId
            );
            if (requestData) {
              this.copyAsFetch(requestData);
            } else {
              logger.error("Request data not found for id:", requestId);
              this.showToast("Request data not available", "error");
            }
            return;
          }
        });
      }
    } catch (error) {
      logger.error("Failed to load requests table:", error);
      document.getElementById("requestsTableBody").innerHTML =
        '<tr class="no-data-row"><td colspan="7">Error loading requests</td></tr>';
    }
  }

  // Render pagination controls
  renderPagination(currentPage, totalCount, perPage) {
    const container = document.getElementById("tablePagination");
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

    // Previous button
    if (currentPage > 1) {
      html += `<button class="pagination-btn" data-page="${
        currentPage - 1
      }"><i class="fas fa-chevron-left"></i> Previous</button>`;
    }

    // Page numbers
    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    const endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    if (endPage - startPage < maxPageButtons - 1) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    if (startPage > 1) {
      html += `<button class="pagination-btn" data-page="1">1</button>`;
      if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === currentPage ? "active" : "";
      html += `<button class="pagination-btn ${activeClass}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1)
        html += `<span class="pagination-ellipsis">...</span>`;
      html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next button
    if (currentPage < totalPages) {
      html += `<button class="pagination-btn" data-page="${
        currentPage + 1
      }">Next <i class="fas fa-chevron-right"></i></button>`;
    }

    container.innerHTML = html;

    // Add event listeners to pagination buttons
    container.querySelectorAll(".pagination-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = parseInt(btn.dataset.page);
        this.loadRequestsTable(page);
      });
    });
  }

  // View request details
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

      // Create modal
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
            ${
              request.error
                ? `
            <div class="detail-section">
              <h4>Error</h4>
              <div class="error-box">${request.error}</div>
            </div>
            `
                : ""
            }
          </div>
          <div class="modal-footer">
            <button class="btn-secondary modal-close-btn">Close</button>
          </div>
        </div>
      `;

      // Add event listeners for closing
      const overlay = modal.querySelector(".modal-overlay");
      const closeBtn = modal.querySelector(".modal-close");
      const closeBtnFooter = modal.querySelector(".modal-close-btn");

      const closeModal = () => modal.remove();

      overlay.addEventListener("click", closeModal);
      closeBtn.addEventListener("click", closeModal);
      closeBtnFooter.addEventListener("click", closeModal);

      document.body.appendChild(modal);
    } catch (error) {
      logger.error("Error showing request details:", error);
      this.showToast("Failed to load request details", "error");
    }
  }

  // Copy request as cURL command
  // Note: Headers are stored in a separate table and not included in basic cURL export
  async copyAsCurl(request) {
    try {
      // Fetch headers from database
      const headers = await this.getRequestHeaders(request.id);

      let curl = `curl '${request.url}'`;

      // Add method if not GET
      if (request.method && request.method !== "GET") {
        curl += ` -X ${request.method}`;
      }

      // Add headers
      if (headers && headers.length > 0) {
        headers.forEach((header) => {
          // Skip some headers that curl sets automatically
          const name = header.name.toLowerCase();
          if (!["host", "connection", "content-length"].includes(name)) {
            curl += ` -H '${header.name}: ${header.value.replace(
              /'/g,
              "'\\''"
            )}'`;
          }
        });
      }

      // Add compressed flag
      curl += " --compressed";

      // Copy to clipboard with fallback method
      this.copyToClipboard(curl);
    } catch (error) {
      logger.error("Error generating cURL:", error);
      this.showToast("Failed to generate cURL command", "error");
    }
  }

  // Fetch headers for a request from database
  async getRequestHeaders(requestId) {
    try {
      // Escape requestId to prevent SQL injection
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const response = await chrome.runtime.sendMessage({
        action: "executeDirectQuery",
        query: `
          SELECT name, value
          FROM bronze_request_headers
          WHERE request_id = ${escapeStr(requestId)} AND header_type = 'request'
          ORDER BY name
        `,
      });

      if (response && response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      logger.error("Error fetching headers:", error);
      return [];
    }
  }

  // Fetch request body from database
  async getRequestBody(requestId) {
    try {
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const response = await chrome.runtime.sendMessage({
        action: "executeDirectQuery",
        query: `
          SELECT request_body
          FROM bronze_requests
          WHERE id = ${escapeStr(requestId)}
        `,
      });

      if (
        response &&
        response.success &&
        response.data &&
        response.data.length > 0
      ) {
        return response.data[0].request_body;
      }
      return null;
    } catch (error) {
      logger.error("Error fetching request body:", error);
      return null;
    }
  }

  // Copy request as Fetch API call
  async copyAsFetch(request) {
    try {
      // Fetch headers and body from database
      const headers = await this.getRequestHeaders(request.id);
      const requestBody = await this.getRequestBody(request.id);

      const fetchCode = this.generateFetchCode(request, headers, requestBody);

      // Use textarea fallback method (Clipboard API is blocked in extension contexts)
      this.copyToClipboardFallback(
        fetchCode,
        "Fetch code copied to clipboard!"
      );
    } catch (error) {
      logger.error("Failed to copy as Fetch:", error);
      this.showToast("Failed to copy to clipboard", "error");
    }
  }

  // Generate Fetch API code
  generateFetchCode(request, headers = [], requestBody = null) {
    const options = {
      method: request.method || "GET",
    };

    let hasCookies = false;

    // Add headers
    if (headers && headers.length > 0) {
      options.headers = {};
      headers.forEach((header) => {
        const name = header.name.toLowerCase();

        // Track cookies for credentials option
        if (name === "cookie") {
          hasCookies = true;
        }

        // Skip some headers that fetch sets automatically or handles differently
        if (
          ![
            "host",
            "connection",
            "content-length",
            "user-agent",
            "cookie",
          ].includes(name)
        ) {
          options.headers[header.name] = header.value;
        }
      });
    }

    // Add credentials if cookies present
    if (hasCookies) {
      options.credentials = "include";
    }

    // Add request body for POST/PUT/PATCH/DELETE
    if (
      requestBody &&
      request.method &&
      !["GET", "HEAD"].includes(request.method)
    ) {
      try {
        const bodyObj = JSON.parse(requestBody);

        if (bodyObj.formData) {
          // FormData - will be formatted separately
          options.body = "formData";
          options._formDataParts = [];
          for (const [key, values] of Object.entries(bodyObj.formData)) {
            values.forEach((value) => {
              options._formDataParts.push(
                `  formData.append('${key}', '${value}');`
              );
            });
          }
        } else if (bodyObj.raw) {
          options.body = "'<binary data>'";
        } else {
          options.body = JSON.stringify(bodyObj);
        }
      } catch (e) {
        options.body = requestBody;
      }
    }

    // Format the code
    let code = "";

    // Handle FormData separately
    if (options._formDataParts) {
      code += "const formData = new FormData();\n";
      code += options._formDataParts.join("\n") + "\n\n";
      delete options._formDataParts;
      delete options.body;
      code += `fetch('${request.url}', ${JSON.stringify(
        { ...options, body: "formData" },
        null,
        2
      ).replace(/"formData"/, "formData")})`;
    } else {
      code += `fetch('${request.url}'`;

      if (
        Object.keys(options.headers || {}).length > 0 ||
        options.method !== "GET" ||
        options.body ||
        options.credentials
      ) {
        code += `, ${JSON.stringify(options, null, 2)}`;
      }

      code += ")";
    }

    // Add flexible response handling
    code += `\n  .then(response => {\n`;
    code += `    if (!response.ok) throw new Error(\`HTTP error! status: \${response.status}\`)  ;\n`;
    code += `    const contentType = response.headers.get('content-type');\n`;
    code += `    if (contentType && contentType.includes('application/json')) return response.json();\n`;
    code += `    if (contentType && (contentType.includes('image/') || contentType.includes('video/'))) return response.blob();\n`;
    code += `    return response.text();\n`;
    code += `  })\n`;
    code += `  .then(data => console.log(data))\n`;
    code += `  .catch(error => console.error('Error:', error));`;

    return code;
  }

  // Copy text to clipboard with fallback for different browsers
  copyToClipboard(text) {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.showToast("cURL command copied to clipboard!", "success");
        })
        .catch((err) => {
          logger.error("Clipboard API failed:", err);
          this.copyToClipboardFallback(text);
        });
    } else {
      // Fallback for older browsers or restricted contexts
      this.copyToClipboardFallback(text);
    }
  }

  // Fallback clipboard copy method using textarea
  copyToClipboardFallback(text) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (successful) {
        this.showToast("cURL command copied to clipboard!", "success");
      } else {
        this.showToast(
          "Failed to copy cURL command - please try again",
          "error"
        );
      }
    } catch (err) {
      logger.error("Fallback copy failed:", err);
      this.showToast("Failed to copy cURL command", "error");
    }
  }

  // Helper to truncate URLs
  truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    const parts = url.split("?");
    const base = parts[0];
    if (base.length > maxLength) {
      return base.substring(0, maxLength - 3) + "...";
    }
    if (parts.length > 1 && parts[1]) {
      const remaining = maxLength - base.length - 4;
      return base + "?" + parts[1].substring(0, remaining) + "...";
    }
    return url;
  }

  // Helper to format bytes
  formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  // Load performance data
  async loadPerformanceData() {
    try {
      const filters = this.getActiveFilters();

      // Get detailed requests for slow requests list
      // Note: getDetailedRequests and getFilteredStats return different data structures
      // and serve different purposes, so they cannot easily be combined
      const detailedResponse = await chrome.runtime.sendMessage({
        action: "getDetailedRequests",
        filters,
        limit: 100, // Get more to sort and filter
        offset: 0,
      });

      const response = await chrome.runtime.sendMessage({
        action: "getFilteredStats",
        filters,
      });

      if (
        !response.success ||
        !response.responseTimes ||
        response.responseTimes.length === 0
      ) {
        document.getElementById("timingBreakdown").innerHTML =
          '<p class="no-data">No performance data available</p>';
        document.getElementById("slowRequestsList").innerHTML =
          '<p class="no-data">No requests available</p>';
        this.updatePerformanceBudgets({});
        return;
      }

      // Show timing breakdown
      const avgTime =
        response.responseTimes.reduce((a, b) => a + b, 0) /
        response.responseTimes.length;
      const maxTime = Math.max(...response.responseTimes);
      const minTime = Math.min(...response.responseTimes);
      const totalSize = response.totalBytes || 0;
      const totalRequests = response.totalRequests || 0;

      document.getElementById("timingBreakdown").innerHTML = `
        <div class="timing-stats">
          <div class="timing-stat">
            <span class="label">Average:</span>
            <span class="value">${Math.round(avgTime)}ms</span>
          </div>
          <div class="timing-stat">
            <span class="label">Min:</span>
            <span class="value">${Math.round(minTime)}ms</span>
          </div>
          <div class="timing-stat">
            <span class="label">Max:</span>
            <span class="value">${Math.round(maxTime)}ms</span>
          </div>
          <div class="timing-stat">
            <span class="label">P95:</span>
            <span class="value">${this.calculatePercentile(
              response.responseTimes,
              95
            )}ms</span>
          </div>
        </div>
      `;

      // Update performance budgets with actual data
      this.updatePerformanceBudgets({
        avgResponseTime: avgTime,
        maxResponseTime: maxTime,
        totalSize,
        totalRequests,
      });

      // Show slowest requests
      if (
        detailedResponse.success &&
        detailedResponse.requests &&
        detailedResponse.requests.length > 0
      ) {
        // Sort by duration descending and take top 10
        const slowestRequests = detailedResponse.requests
          .filter((req) => req.duration > 0)
          .sort((a, b) => (b.duration || 0) - (a.duration || 0))
          .slice(0, 10);

        if (slowestRequests.length > 0) {
          let html = '<div class="slow-requests-list">';
          slowestRequests.forEach((req, index) => {
            const statusClass =
              req.status >= 400
                ? "status-error"
                : req.status >= 300
                ? "status-warning"
                : "status-success";
            html += `
              <div class="slow-request-item">
                <div class="slow-request-rank">#${index + 1}</div>
                <div class="slow-request-details">
                  <div class="slow-request-url" title="${req.url}">
                    <span class="method-badge method-${
                      req.method?.toLowerCase() || "get"
                    }">${req.method || "GET"}</span>
                    ${this.truncateUrl(req.url, 50)}
                  </div>
                  <div class="slow-request-meta">
                    <span class="status-badge ${statusClass}">${
              req.status || "N/A"
            }</span>
                    <span class="request-type">${req.type || "N/A"}</span>
                    ${
                      req.size_bytes
                        ? `<span class="request-size">${this.formatBytes(
                            req.size_bytes
                          )}</span>`
                        : ""
                    }
                  </div>
                </div>
                <div class="slow-request-time">${Math.round(
                  req.duration
                )}ms</div>
              </div>
            `;
          });
          html += "</div>";
          document.getElementById("slowRequestsList").innerHTML = html;
        } else {
          document.getElementById("slowRequestsList").innerHTML =
            '<p class="no-data">No slow requests found</p>';
        }
      } else {
        document.getElementById("slowRequestsList").innerHTML =
          '<p class="no-data">No detailed request data available</p>';
      }
    } catch (error) {
      logger.error("Failed to load performance data:", error);
      document.getElementById("timingBreakdown").innerHTML =
        '<p class="error-message">Error loading performance data</p>';
      document.getElementById("slowRequestsList").innerHTML =
        '<p class="error-message">Error loading slowest requests</p>';
    }
  }

  // Update performance budgets and show status
  updatePerformanceBudgets(data) {
    // Store current data for budget recalculation
    this.currentPerformanceData = data;

    const budgetResponseTime = parseInt(
      document.getElementById("budgetResponseTime")?.value || 1000
    );
    const budgetTotalSize = parseFloat(
      document.getElementById("budgetTotalSize")?.value || 5
    );
    const budgetRequestCount = parseInt(
      document.getElementById("budgetRequestCount")?.value || 100
    );

    const avgResponseTime = data.avgResponseTime || 0;
    const maxResponseTime = data.maxResponseTime || 0;
    const totalSize = data.totalSize || 0;
    const totalRequests = data.totalRequests || 0;

    const totalSizeMB = totalSize / (1024 * 1024);

    // Response time status
    const responseStatus = document.getElementById("budgetResponseStatus");
    if (responseStatus) {
      if (maxResponseTime > budgetResponseTime) {
        responseStatus.innerHTML = `<span class="budget-fail"><i class="fas fa-times-circle"></i> Failed (Max: ${Math.round(
          maxResponseTime
        )}ms)</span>`;
        responseStatus.className = "budget-status fail";
      } else if (avgResponseTime > budgetResponseTime * 0.8) {
        responseStatus.innerHTML = `<span class="budget-warning"><i class="fas fa-exclamation-triangle"></i> Warning (Avg: ${Math.round(
          avgResponseTime
        )}ms)</span>`;
        responseStatus.className = "budget-status warning";
      } else {
        responseStatus.innerHTML = `<span class="budget-pass"><i class="fas fa-check-circle"></i> Pass (Max: ${Math.round(
          maxResponseTime
        )}ms)</span>`;
        responseStatus.className = "budget-status pass";
      }
    }

    // Total size status
    const sizeStatus = document.getElementById("budgetSizeStatus");
    if (sizeStatus) {
      if (totalSizeMB > budgetTotalSize) {
        sizeStatus.innerHTML = `<span class="budget-fail"><i class="fas fa-times-circle"></i> Failed (${totalSizeMB.toFixed(
          2
        )}MB)</span>`;
        sizeStatus.className = "budget-status fail";
      } else if (totalSizeMB > budgetTotalSize * 0.8) {
        sizeStatus.innerHTML = `<span class="budget-warning"><i class="fas fa-exclamation-triangle"></i> Warning (${totalSizeMB.toFixed(
          2
        )}MB)</span>`;
        sizeStatus.className = "budget-status warning";
      } else {
        sizeStatus.innerHTML = `<span class="budget-pass"><i class="fas fa-check-circle"></i> Pass (${totalSizeMB.toFixed(
          2
        )}MB)</span>`;
        sizeStatus.className = "budget-status pass";
      }
    }

    // Request count status
    const countStatus = document.getElementById("budgetCountStatus");
    if (countStatus) {
      if (totalRequests > budgetRequestCount) {
        countStatus.innerHTML = `<span class="budget-fail"><i class="fas fa-times-circle"></i> Failed (${totalRequests} requests)</span>`;
        countStatus.className = "budget-status fail";
      } else if (totalRequests > budgetRequestCount * 0.8) {
        countStatus.innerHTML = `<span class="budget-warning"><i class="fas fa-exclamation-triangle"></i> Warning (${totalRequests} requests)</span>`;
        countStatus.className = "budget-status warning";
      } else {
        countStatus.innerHTML = `<span class="budget-pass"><i class="fas fa-check-circle"></i> Pass (${totalRequests} requests)</span>`;
        countStatus.className = "budget-status pass";
      }
    }

    // Add event listeners to budget inputs to recalculate on change
    if (!this.budgetListenersAdded) {
      ["budgetResponseTime", "budgetTotalSize", "budgetRequestCount"].forEach(
        (id) => {
          const element = document.getElementById(id);
          if (element) {
            element.addEventListener("change", () => {
              // Use stored current data for recalculation
              if (this.currentPerformanceData) {
                this.updatePerformanceBudgets(this.currentPerformanceData);
              }
            });
          }
        }
      );
      this.budgetListenersAdded = true;
    }
  }

  // Load endpoints data
  async loadEndpointsData() {
    try {
      const filters = this.getActiveFilters();
      const response = await chrome.runtime.sendMessage({
        action: "getEndpointAnalysis",
        filters,
      });

      const table = document.getElementById("endpointsTable");

      if (
        !response.success ||
        !response.endpoints ||
        response.endpoints.length === 0
      ) {
        table.innerHTML =
          '<p class="no-data">No API endpoints found for selected filters</p>';
        return;
      }

      // Build table with endpoint analysis
      let html = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Endpoint Pattern</th>
              <th>Calls</th>
              <th>Avg Time</th>
              <th>Min/Max</th>
              <th>Errors</th>
              <th>Error Rate</th>
              <th>Avg Size</th>
            </tr>
          </thead>
          <tbody>
      `;

      response.endpoints.forEach((ep) => {
        const errorClass =
          ep.errorRate > 10
            ? "status-error"
            : ep.errorRate > 5
            ? "status-warning"
            : "";
        const perfClass =
          ep.avgDuration > 1000
            ? "status-error"
            : ep.avgDuration > 500
            ? "status-warning"
            : "status-success";

        html += `
          <tr>
            <td title="${ep.url}"><code>${ep.endpoint}</code></td>
            <td>${ep.callCount}</td>
            <td class="${perfClass}">${ep.avgDuration}ms</td>
            <td><small>${ep.minDuration}ms / ${ep.maxDuration}ms</small></td>
            <td>${ep.errorCount}</td>
            <td class="${errorClass}">${ep.errorRate}%</td>
            <td>${this.formatBytes(ep.avgSize)}</td>
          </tr>
        `;
      });

      html += "</tbody></table>";
      table.innerHTML = html;

      // Setup history load button listener (only once)
      const loadHistoryBtn = document.getElementById("loadHistoryBtn");
      if (loadHistoryBtn && !loadHistoryBtn.dataset.listenerAdded) {
        loadHistoryBtn.dataset.listenerAdded = "true";
        loadHistoryBtn.addEventListener("click", () =>
          this.loadEndpointPerformanceHistory()
        );
      }
    } catch (error) {
      logger.error("Failed to load endpoints data:", error);
      document.getElementById("endpointsTable").innerHTML =
        '<p class="error-message">Error loading endpoint analysis</p>';
    }
  }

  // Load endpoint performance history for regression analysis
  async loadEndpointPerformanceHistory() {
    try {
      const filters = this.getActiveFilters();
      const timeRangeSelect = document.getElementById("historyTimeRange");
      const typeFilter = document.getElementById("endpointTypeFilter");
      const endpointPattern = document.getElementById("endpointPattern");
      const sortBy = document.getElementById("endpointSortBy");
      const topN = document.getElementById("endpointTopN");

      const timeRangeMs = parseInt(timeRangeSelect?.value || "86400000");
      const selectedType = typeFilter?.value || "";
      const pattern = endpointPattern?.value?.trim() || "";
      const sort = sortBy?.value || "requests";
      const limit = topN?.value || "10";

      // Calculate startTime based on selected range
      const startTime = Date.now() - timeRangeMs;
      const endTime = Date.now();

      logger.debug("Loading endpoint performance history:", {
        pattern,
        selectedType,
        timeRangeMs,
        startTime,
        endTime,
        sort,
        limit,
        domain: filters.domain,
      });

      const requestFilters = {
        domain: filters.domain || null,
        pageUrl: filters.pageUrl || null,
        type: filters.type || selectedType || null,
        endpoint: pattern || null,
        timeBucket: "none", // No bucketing - plot actual request times
        startTime,
        endTime,
        sortBy: sort,
        limit: limit === "all" ? 100 : parseInt(limit),
        maxPointsPerEndpoint: 100, // Default to 100 points per endpoint
      };

      const response = await chrome.runtime.sendMessage({
        action: "getEndpointPerformanceHistory",
        filters: requestFilters,
      });

      logger.debug("Performance history response:", {
        success: response?.success,
        groupedByEndpointKeys: response?.groupedByEndpoint
          ? Object.keys(response.groupedByEndpoint)
          : null,
        fullResponse: response,
      });

      if (response && response.success) {
        // Store all endpoints for selection
        this.availableEndpoints = response.groupedByEndpoint || {};

        // Reset selections to show all new endpoints by default
        this.selectedEndpoints = new Set(Object.keys(this.availableEndpoints));

        logger.debug(
          `Loaded ${this.selectedEndpoints.size} endpoints, all selected by default`
        );

        // Show endpoint selector
        this.renderEndpointSelector();

        // Render chart with selected endpoints
        this.renderEndpointPerformanceChart(response);
      } else {
        // Show error message
        document.getElementById("performanceHistoryChart").innerHTML =
          '<p class="no-data"><i class="fas fa-info-circle"></i> No performance data found. Try adjusting the filters or time range.</p>';
        document.getElementById("endpointSelector").style.display = "none";
      }
    } catch (error) {
      logger.error("Failed to load endpoint performance history:", error);

      // Check if extension context was invalidated
      const isContextError =
        error.message?.includes("Extension context invalidated") ||
        error.message?.includes("message port closed");

      const errorMessage = isContextError
        ? '<p class="error-message"><i class="fas fa-exclamation-triangle"></i> Extension was reloaded. Please <strong>close and reopen DevTools</strong> to continue.</p>'
        : `<p class="error-message">Error loading performance history: ${error.message}</p>`;

      document.getElementById("performanceHistoryChart").innerHTML =
        errorMessage;
    }
  }

  renderEndpointSelector() {
    const selectorPanel = document.getElementById("endpointSelector");
    const endpointList = document.getElementById("endpointList");

    if (!selectorPanel || !endpointList || !this.availableEndpoints) return;

    const endpoints = Object.keys(this.availableEndpoints);

    if (endpoints.length === 0) {
      selectorPanel.style.display = "none";
      return;
    }

    // Initialize selected endpoints (all by default)
    if (!this.selectedEndpoints) {
      this.selectedEndpoints = new Set(endpoints);
    }

    // Render endpoint checkboxes
    endpointList.innerHTML = endpoints
      .map((endpoint, index) => {
        const data = this.availableEndpoints[endpoint];
        const totalRequests = data.reduce(
          (sum, d) => sum + (d.requestCount || 1),
          0
        );
        const avgDuration = Math.round(
          data.reduce((sum, d) => sum + (d.avgDuration || d.duration || 0), 0) /
            data.length
        );
        const isSelected = this.selectedEndpoints.has(endpoint);

        return `
        <label 
          class="endpoint-checkbox-item" 
          style="
            display: flex; 
            align-items: center; 
            padding: 8px; 
            background: ${
              isSelected
                ? "var(--primary-color-alpha)"
                : "var(--background-color)"
            }; 
            border: 1px solid ${
              isSelected ? "var(--primary-color)" : "var(--border-color)"
            };
            border-radius: 4px; 
            cursor: pointer;
            transition: all 0.2s;
          "
          data-endpoint="${endpoint}"
        >
          <input 
            type="checkbox" 
            ${isSelected ? "checked" : ""}
            style="margin-right: 8px;"
          />
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${endpoint}">
              ${endpoint}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              ${totalRequests} req · ${avgDuration}ms avg
            </div>
          </div>
        </label>
      `;
      })
      .join("");

    selectorPanel.style.display = "block";

    // Add click handlers with proper context binding
    endpointList.querySelectorAll(".endpoint-checkbox-item").forEach((item) => {
      const clickHandler = (e) => {
        const endpoint = item.dataset.endpoint;
        const checkbox = item.querySelector('input[type="checkbox"]');

        // Toggle selection
        if (this.selectedEndpoints.has(endpoint)) {
          this.selectedEndpoints.delete(endpoint);
          checkbox.checked = false;
          item.style.background = "var(--background-color)";
          item.style.borderColor = "var(--border-color)";
        } else {
          this.selectedEndpoints.add(endpoint);
          checkbox.checked = true;
          item.style.background = "var(--primary-color-alpha)";
          item.style.borderColor = "var(--primary-color)";
        }

        // Re-render chart with new selection
        try {
          if (typeof this.updateChartVisibility === "function") {
            this.updateChartVisibility();
          } else {
            logger.error(
              "updateChartVisibility is not a function:",
              typeof this.updateChartVisibility
            );
          }
        } catch (err) {
          logger.error("Error calling updateChartVisibility:", err);
        }
      };

      item.addEventListener("click", clickHandler);
    });

    // Setup select all / deselect all buttons
    const selectAllBtn = document.getElementById("selectAllEndpoints");
    const deselectAllBtn = document.getElementById("deselectAllEndpoints");

    if (selectAllBtn && !selectAllBtn.dataset.listenerAdded) {
      selectAllBtn.dataset.listenerAdded = "true";
      selectAllBtn.addEventListener("click", () => {
        this.selectedEndpoints = new Set(endpoints);
        this.renderEndpointSelector();
        try {
          if (typeof this.updateChartVisibility === "function") {
            this.updateChartVisibility();
          }
        } catch (err) {
          logger.error("Error in selectAll:", err);
        }
      });
    }

    if (deselectAllBtn && !deselectAllBtn.dataset.listenerAdded) {
      deselectAllBtn.dataset.listenerAdded = "true";
      deselectAllBtn.addEventListener("click", () => {
        this.selectedEndpoints = new Set();
        this.renderEndpointSelector();
        try {
          if (typeof this.updateChartVisibility === "function") {
            this.updateChartVisibility();
          }
        } catch (err) {
          logger.error("Error in deselectAll:", err);
        }
      });
    }
  }

  // Render endpoint performance history chart
  renderEndpointPerformanceChart(response) {
    logger.debug("renderEndpointPerformanceChart called with:", {
      hasGroupedByType: !!response.groupedByType,
      hasGroupedByEndpoint: !!response.groupedByEndpoint,
      groupedByTypeKeys: response.groupedByType
        ? Object.keys(response.groupedByType)
        : null,
      groupedByEndpointKeys: response.groupedByEndpoint
        ? Object.keys(response.groupedByEndpoint)
        : null,
    });

    // Get or recreate canvas
    const chartContainer = document.getElementById("performanceHistoryChart");
    let canvas = document.getElementById("historyChartCanvas");

    if (!canvas) {
      logger.warn("Canvas not found, recreating...");
      if (chartContainer) {
        chartContainer.innerHTML = '<canvas id="historyChartCanvas"></canvas>';
        canvas = document.getElementById("historyChartCanvas");
      }
    }

    if (!canvas) {
      logger.error("Failed to create canvas element");
      if (chartContainer) {
        chartContainer.innerHTML =
          '<p class="error-message">Chart canvas initialization failed</p>';
      }
      return;
    }

    const ctx = canvas.getContext("2d");

    // Destroy existing chart if any
    if (this.performanceHistoryChart) {
      try {
        this.performanceHistoryChart.destroy();
      } catch (e) {
        logger.warn("Error destroying old chart:", e);
      }
      this.performanceHistoryChart = null;
    }

    // Group data by endpoint pattern or request type
    const groupedData = response.groupedByType || response.groupedByEndpoint;
    if (!groupedData || Object.keys(groupedData).length === 0) {
      logger.error("No grouped data found in response:", {
        hasGroupedByType: !!response.groupedByType,
        hasGroupedByEndpoint: !!response.groupedByEndpoint,
        responseKeys: Object.keys(response),
      });
      document.getElementById(
        "performanceHistoryChart"
      ).innerHTML = `<p class="no-data">No endpoint performance data available.<br><small>Try: 1) Load data with 'Load Data' button, 2) Adjust time range, 3) Check if requests are being captured</small></p>`;
      return;
    }

    // Filter by selected endpoints
    const selectedKeys = this.selectedEndpoints
      ? Array.from(this.selectedEndpoints).filter((key) => groupedData[key])
      : Object.keys(groupedData);

    if (selectedKeys.length === 0) {
      document.getElementById("performanceHistoryChart").innerHTML = `
        <p class="no-data" style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-mouse-pointer" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
          No endpoints selected.<br>
          <small style="font-size: 12px; margin-top: 8px; display: block;">Please select at least one endpoint from the list above to display the chart.</small>
        </p>
      `;
      return;
    }

    // Detect if using individual requests (timestamp field) or bucketed data (timeBucket field)
    const isIndividualRequests =
      selectedKeys.length > 0 &&
      groupedData[selectedKeys[0]].length > 0 &&
      groupedData[selectedKeys[0]][0].timestamp !== undefined;

    // Generate distinct colors for each endpoint
    const generateColor = (index, total) => {
      const hue = (index * 360) / total;
      return `hsl(${hue}, 70%, 50%)`;
    };

    const datasets = selectedKeys.map((key, index) => {
      const records = groupedData[key];

      // Truncate long endpoint names for legend
      const shortLabel = key.length > 40 ? key.substring(0, 37) + "..." : key;

      if (isIndividualRequests) {
        // Individual request mode - scatter/line plot at actual timestamps
        records.sort((a, b) => a.timestamp - b.timestamp);

        return {
          label: shortLabel,
          data: records.map((r) => ({
            x: r.timestamp,
            y: r.duration,
          })),
          borderColor: generateColor(index, selectedKeys.length),
          backgroundColor: generateColor(index, selectedKeys.length),
          tension: 0.1,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 7,
          borderWidth: 2,
          showLine: true,
        };
      } else {
        // Bucketed mode (legacy) - aggregate averages
        records.sort((a, b) => a.timeBucket.localeCompare(b.timeBucket));

        return {
          label: shortLabel,
          data: records.map((r) => ({ x: r.timeBucket, y: r.avgDuration })),
          borderColor: generateColor(index, selectedKeys.length),
          backgroundColor: "transparent",
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6,
        };
      }
    });

    const chartType = isIndividualRequests ? "scatter" : "line";
    const scaleType = isIndividualRequests ? "linear" : "category";

    try {
      this.performanceHistoryChart = new Chart(ctx, {
        type: chartType,
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: isIndividualRequests
                ? "Endpoint Performance (Individual Requests)"
                : "Endpoint Performance Over Time",
              font: { size: 16, weight: "bold" },
            },
            legend: {
              display: true,
              position: "top",
              labels: {
                boxWidth: 12,
                padding: 10,
                font: { size: 11 },
              },
            },
            tooltip: {
              mode: "nearest",
              intersect: false,
              callbacks: {
                label: function (context) {
                  const dataPoint = context.raw;
                  if (isIndividualRequests) {
                    const time = new Date(dataPoint.x).toLocaleString();
                    return `${context.dataset.label}: ${dataPoint.y}ms at ${time}`;
                  } else {
                    return `${context.dataset.label}: ${dataPoint.y}ms`;
                  }
                },
              },
            },
          },
          scales: {
            x: {
              type: scaleType,
              title: {
                display: true,
                text: isIndividualRequests ? "Request Time" : "Time Bucket",
              },
              ticks: isIndividualRequests
                ? {
                    callback: function (value) {
                      return new Date(value).toLocaleTimeString();
                    },
                    maxRotation: 45,
                    minRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 10,
                  }
                : {
                    maxRotation: 45,
                    minRotation: 45,
                  },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Duration (ms)",
              },
            },
          },
        },
      });

      logger.debug("Chart created successfully:", this.performanceHistoryChart);

      // Show the chart container
      const chartContainer = document.getElementById("performanceHistoryChart");
      if (chartContainer) {
        chartContainer.style.display = "block";
        logger.debug("Chart container made visible");
      }
    } catch (error) {
      logger.error("Error creating chart:", error);
      document.getElementById(
        "performanceHistoryChart"
      ).innerHTML = `<p class="error-message">Error rendering chart: ${error.message}<br><small>Check console for details</small></p>`;
    }
  }

  // Update chart visibility based on selected endpoints
  updateChartVisibility() {
    try {
      logger.debug("updateChartVisibility called", {
        hasAvailableEndpoints: !!this.availableEndpoints,
        hasSelectedEndpoints: !!this.selectedEndpoints,
        selectedCount: this.selectedEndpoints?.size,
      });

      // Re-render the chart with the currently selected endpoints
      if (this.availableEndpoints && this.selectedEndpoints) {
        const response = {
          success: true,
          groupedByEndpoint: this.availableEndpoints,
        };
        this.renderEndpointPerformanceChart(response);
      } else {
        logger.warn("Cannot update chart: missing data", {
          hasAvailableEndpoints: !!this.availableEndpoints,
          hasSelectedEndpoints: !!this.selectedEndpoints,
        });
      }
    } catch (error) {
      logger.error("Error in updateChartVisibility:", error);
    }
  }

  // Load waterfall chart data
  async loadWaterfallData() {
    try {
      const filters = this.getActiveFilters();

      logger.debug("🌊 Loading waterfall data with filters:", filters);

      const response = await chrome.runtime.sendMessage({
        action: "getWaterfallData",
        filters,
        limit: 50,
      });

      logger.debug("🌊 Waterfall response:", {
        success: response?.success,
        requestsLength: response?.requests?.length,
        error: response?.error,
      });

      const container = document.getElementById("waterfallChart");

      if (!response || !response.success) {
        const errorMsg = response?.error || "Unknown error";
        logger.error("Waterfall data fetch failed:", errorMsg);
        container.innerHTML = `<p class="error-message">Error loading waterfall data: ${errorMsg}</p>`;
        return;
      }

      if (!response.requests || response.requests.length === 0) {
        container.innerHTML =
          '<p class="no-data"><i class="fas fa-info-circle"></i> No requests available for waterfall visualization. Try adjusting filters or wait for requests to be captured.</p>';
        return;
      }

      logger.debug(
        "🌊 Rendering waterfall chart with",
        response.requests.length,
        "requests"
      );

      // Render waterfall chart
      this.renderWaterfallChart(response.requests);
    } catch (error) {
      logger.error("Failed to load waterfall data:", error);
      const container = document.getElementById("waterfallChart");
      if (container) {
        container.innerHTML = `<p class="error-message"><i class="fas fa-exclamation-triangle"></i> Error loading waterfall chart: ${error.message}</p>`;
      }
    }
  }

  // Render waterfall chart visualization
  renderWaterfallChart(requests) {
    const container = document.getElementById("waterfallChart");

    if (requests.length === 0) {
      container.innerHTML = '<p class="no-data">No requests to display</p>';
      return;
    }

    // Find timeline bounds
    const minTime = Math.min(...requests.map((r) => r.timestamp));
    const maxTime = Math.max(
      ...requests.map((r) => r.timestamp + (r.duration || 0))
    );
    const timeRange = maxTime - minTime || 1000; // Default to 1 second if all same time

    // Create timeline header with time markers
    let html = `
      <div class="waterfall-header">
        <div class="waterfall-legend">
          <div class="legend-item"><span class="legend-color queued"></span> Queued</div>
          <div class="legend-item"><span class="legend-color dns"></span> DNS</div>
          <div class="legend-item"><span class="legend-color tcp"></span> TCP</div>
          <div class="legend-item"><span class="legend-color ssl"></span> SSL</div>
          <div class="legend-item"><span class="legend-color waiting"></span> Waiting (TTFB)</div>
          <div class="legend-item"><span class="legend-color download"></span> Download</div>
        </div>
        <div class="waterfall-timeline-header">
          <span>0ms</span>
          <span>${Math.round(timeRange / 4)}ms</span>
          <span>${Math.round(timeRange / 2)}ms</span>
          <span>${Math.round((3 * timeRange) / 4)}ms</span>
          <span>${Math.round(timeRange)}ms</span>
        </div>
      </div>
      <div class="waterfall-rows">
    `;

    requests.forEach((req, index) => {
      const startOffset = ((req.timestamp - minTime) / timeRange) * 100;
      const duration = req.duration || 0;
      const width = Math.max((duration / timeRange) * 100, 0.5);

      const statusClass =
        req.status >= 400 ? "error" : req.status >= 300 ? "warning" : "success";

      // Estimate timing phases if not provided
      const phases = req.phases || this.estimateTimingPhases(req);
      const totalPhases =
        Object.values(phases).reduce((a, b) => a + b, 0) || duration;

      html += `
        <div class="waterfall-row" data-index="${index}">
          <div class="waterfall-info">
            <div class="waterfall-label" title="${req.url}">
              <span class="method-badge ${statusClass}">${
        req.method || "GET"
      }</span>
              <span class="status-code status-${statusClass}">${
        req.status || ""
      }</span>
              <span class="url-text">${this.truncateUrl(req.url, 35)}</span>
            </div>
          </div>
          <div class="waterfall-timeline">
            <div class="waterfall-bar" style="left: ${startOffset}%; width: ${width}%;" title="${
        req.url
      }">
              ${this.renderWaterfallPhases(phases, totalPhases)}
            </div>
            <div class="waterfall-duration">${Math.round(duration)}ms</div>
          </div>
        </div>
      `;
    });

    html += "</div>";
    container.innerHTML = html;
  }

  // Estimate timing phases from available data
  estimateTimingPhases(request) {
    const duration = request.duration || 0;

    // If we don't have detailed timing, estimate based on request type
    const phases = {};

    // Rough estimates for different phases
    if (duration > 0) {
      // DNS typically 20-50ms
      phases.dns = Math.min(duration * 0.1, 50);
      // TCP connection 20-100ms
      phases.tcp = Math.min(duration * 0.15, 100);
      // SSL for HTTPS
      if (request.url && request.url.startsWith("https")) {
        phases.ssl = Math.min(duration * 0.1, 80);
      }
      // Waiting for response (TTFB)
      phases.waiting = duration * 0.3;
      // Download
      phases.download = duration * 0.35;
    }

    return phases;
  }

  // Render waterfall timing phases
  renderWaterfallPhases(phases, total) {
    const colors = {
      queued: "#cbd5e0",
      dns: "#48bb78",
      tcp: "#4299e1",
      ssl: "#9f7aea",
      waiting: "#ed8936",
      ttfb: "#ed8936",
      download: "#f56565",
    };

    const phaseNames = {
      queued: "Queued",
      dns: "DNS Lookup",
      tcp: "TCP Connection",
      ssl: "SSL/TLS",
      waiting: "Waiting (TTFB)",
      ttfb: "Waiting (TTFB)",
      download: "Content Download",
    };

    let html = "";
    let cumulative = 0;

    // Order phases logically
    const orderedPhases = [
      "queued",
      "dns",
      "tcp",
      "ssl",
      "waiting",
      "ttfb",
      "download",
    ];

    orderedPhases.forEach((phase) => {
      if (phases[phase] && phases[phase] > 0) {
        const time = phases[phase];
        const percent = (time / total) * 100;
        html += `
          <div class="phase-segment ${phase}" 
               style="left: ${cumulative}%; width: ${Math.max(
          percent,
          0.5
        )}%; background: ${colors[phase] || "#888"};"
               title="${phaseNames[phase] || phase}: ${Math.round(time)}ms">
          </div>
        `;
        cumulative += percent;
      }
    });

    // If no segments were rendered, show a simple bar
    if (html === "") {
      html = `<div class="phase-segment default" style="width: 100%; background: ${
        colors.download
      };" title="Total: ${Math.round(total)}ms"></div>`;
    }

    return html;
  }

  // Load resources data
  async loadResourcesData() {
    try {
      const filters = this.getActiveFilters();
      logger.debug("Loading resources data with filters:", filters);

      const response = await chrome.runtime.sendMessage({
        action: "getResourceSizeBreakdown",
        filters,
      });

      logger.debug("getResourceSizeBreakdown response:", response);

      if (
        !response ||
        !response.success ||
        !response.breakdown ||
        response.breakdown.length === 0
      ) {
        const errorMsg = response?.error || "No data available";
        logger.warn("No resource data:", errorMsg);

        document.getElementById(
          "resourcesTable"
        ).innerHTML = `<p class="no-data">No resource data available for selected filters.</p>
           <p class="hint" style="font-size: 13px; color: var(--text-secondary); margin-top: 12px; line-height: 1.6;">
             <strong>Possible reasons:</strong><br>
             • No requests captured yet - browse the site to generate traffic<br>
             • Time range too restrictive - try "Last 24 hours" or "Last 7 days"<br>
             • Request capture paused - check the Pause button at top<br>
             • Filters too specific - try clicking "Clear" button<br>
             <small style="color: var(--text-tertiary); display: block; margin-top: 8px;">Backend: ${errorMsg}</small>
           </p>`;
        document.getElementById("resourceSizeChart").innerHTML =
          '<p class="no-data">No resource data to chart</p>';
        const compressionStats = document.getElementById("compressionStats");
        if (compressionStats) {
          compressionStats.innerHTML =
            '<p class="no-data">No compression data available</p>';
        }
        return;
      }

      // Render pie chart
      this.renderResourcePieChart(response.breakdown);

      // Render table
      let html = `
        <h5>Total Size: ${this.formatBytes(response.totalSize)}</h5>
        <table class="data-table">
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
      document.getElementById("resourcesTable").innerHTML = html;

      // Add compression analysis
      this.renderCompressionAnalysis(response.breakdown, response.totalSize);
    } catch (error) {
      logger.error("Failed to load resources data:", error);
      const resourcesTable = document.getElementById("resourcesTable");
      if (resourcesTable) {
        resourcesTable.innerHTML =
          '<p class="error-message">Error loading resource data. Please try refreshing.</p>';
      }
    }
  }

  // Render resource pie chart
  renderResourcePieChart(breakdown) {
    const canvas = document.getElementById("resourcePieChart");
    if (!canvas) {
      logger.warn("Resource pie chart canvas not found");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      logger.warn("Cannot get canvas context for resource chart");
      return;
    }

    if (this.resourceChart) {
      this.resourceChart.destroy();
    }

    const labels = breakdown.map((b) => b.type);
    const data = breakdown.map((b) => b.totalBytes);

    this.resourceChart = new Chart(ctx, {
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

  // Render compression analysis
  async renderCompressionAnalysis(breakdown, totalSize) {
    try {
      const filters = this.getActiveFilters();

      // Try to get real compression stats from backend
      const statsResponse = await chrome.runtime.sendMessage({
        action: "getResourceCompressionStats",
        filters: {
          domain: filters.domain || null,
          pageUrl: filters.pageUrl || null,
        },
      });

      const compressionStats = document.getElementById("compressionStats");
      if (!compressionStats) return;

      if (statsResponse.success && statsResponse.data.resourceCount > 0) {
        const stats = statsResponse.data;
        const compressionRate = parseFloat(stats.compressionRate) || 0;

        const html = `
          <div class="compression-stats-content">
            <div class="stat-item">
              <label>Total Bytes:</label>
              <span>${this.formatBytes(stats.totalBytes)}</span>
            </div>
            <div class="stat-item">
              <label>Compressed Bytes:</label>
              <span style="color: ${
                compressionRate > 50
                  ? "var(--success-color)"
                  : "var(--warning-color)"
              }">${this.formatBytes(stats.compressedBytes)}</span>
            </div>
            <div class="stat-item">
              <label>Potential Savings:</label>
              <span style="color: ${
                stats.potentialSavings > 1000000
                  ? "var(--error-color)"
                  : "var(--success-color)"
              }">${this.formatBytes(stats.potentialSavings)}</span>
            </div>
            <div class="stat-item">
              <label>Compression Rate:</label>
              <span>${compressionRate}%</span>
            </div>
            <div class="stat-item" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
              <i class="fas fa-${
                compressionRate > 50 ? "check-circle" : "exclamation-triangle"
              }" style="color: ${
          compressionRate > 50 ? "var(--success-color)" : "var(--warning-color)"
        }"></i>
              <small style="color: var(--text-secondary);">${
                compressionRate > 50
                  ? "Good compression rate!"
                  : "Enable compression to improve performance."
              }</small>
            </div>
          </div>
        `;
        compressionStats.innerHTML = html;
      } else {
        // Fallback to estimated compression analysis
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

        const html = `
          <div class="compression-stats-content">
            <div class="stat-item">
              <label>Compressible Resources:</label>
              <span>${this.formatBytes(compressibleSize)}</span>
            </div>
            <div class="stat-item">
              <label>Estimated Savings (70% compression):</label>
              <span class="highlight">${this.formatBytes(
                potentialSavings
              )}</span>
            </div>
            <div class="stat-item">
              <label>Compression Ratio:</label>
              <span>${((potentialSavings / totalSize) * 100).toFixed(
                1
              )}% of total</span>
            </div>
            <p class="hint"><i class="fas fa-info-circle"></i> Enable gzip/brotli compression on your server to reduce transfer size</p>
          </div>
        `;
        compressionStats.innerHTML = html;
      }
    } catch (error) {
      logger.error("Failed to load compression analysis:", error);
      const compressionStats = document.getElementById("compressionStats");
      if (compressionStats) {
        compressionStats.innerHTML =
          '<p class="no-data">Error loading compression data</p>';
      }
    }
  }

  // Load errors data with enhanced categorization
  async loadErrorsData() {
    try {
      const filters = { ...this.getActiveFilters() };

      // Get 4xx errors
      const filters4xx = { ...filters, statusPrefix: "4xx" };
      const response4xx = await chrome.runtime.sendMessage({
        action: "getDetailedRequests",
        filters: filters4xx,
        limit: 50,
      });

      // Get 5xx errors
      const filters5xx = { ...filters, statusPrefix: "5xx" };
      const response5xx = await chrome.runtime.sendMessage({
        action: "getDetailedRequests",
        filters: filters5xx,
        limit: 50,
      });

      const errorsList = document.getElementById("errorsList");
      const errorCategories = document.getElementById("errorCategories");

      const errors4xx = response4xx.success ? response4xx.requests : [];
      const errors5xx = response5xx.success ? response5xx.requests : [];
      const totalErrors = errors4xx.length + errors5xx.length;

      if (totalErrors === 0) {
        errorsList.innerHTML =
          '<p class="no-data">No errors found for selected filters</p>';
        errorCategories.innerHTML = "";
        return;
      }

      // Render error categories
      const categoriesHtml = `
        <div class="error-category-stats">
          <div class="category-card client-error">
            <h5>4xx Client Errors</h5>
            <div class="category-count">${errors4xx.length}</div>
            <p>Issues with the request</p>
          </div>
          <div class="category-card server-error">
            <h5>5xx Server Errors</h5>
            <div class="category-count">${errors5xx.length}</div>
            <p>Server-side failures</p>
          </div>
        </div>
      `;
      errorCategories.innerHTML = categoriesHtml;

      // Render detailed error list
      let listHtml = `<div class="errors-list-content">`;

      if (errors4xx.length > 0) {
        listHtml +=
          '<h5><i class="fas fa-exclamation-triangle"></i> Client Errors (4xx)</h5>';
        errors4xx.forEach((err) => {
          listHtml += this.renderErrorItem(err, "client");
        });
      }

      if (errors5xx.length > 0) {
        listHtml +=
          '<h5><i class="fas fa-times-circle"></i> Server Errors (5xx)</h5>';
        errors5xx.forEach((err) => {
          listHtml += this.renderErrorItem(err, "server");
        });
      }

      listHtml += "</div>";
      errorsList.innerHTML = listHtml;

      // Store error requests for action handlers
      this.currentErrors = [...errors4xx, ...errors5xx];

      // Add event delegation for error actions
      if (!errorsList.dataset.listenerAdded) {
        errorsList.dataset.listenerAdded = "true";
        errorsList.addEventListener("click", (e) => {
          const detailsBtn = e.target.closest(".btn-error-details");
          if (detailsBtn) {
            const requestId = detailsBtn.dataset.requestId;
            const request = this.currentErrors.find((r) => r.id === requestId);
            if (request) {
              this.viewRequestDetails(requestId);
            }
            return;
          }

          const curlBtn = e.target.closest(".btn-error-curl");
          if (curlBtn) {
            const requestId = curlBtn.dataset.requestId;
            const request = this.currentErrors.find((r) => r.id === requestId);
            if (request) {
              this.copyAsCurl(request);
            }
            return;
          }

          const fetchBtn = e.target.closest(".btn-error-fetch");
          if (fetchBtn) {
            const requestId = fetchBtn.dataset.requestId;
            const request = this.currentErrors.find((r) => r.id === requestId);
            if (request) {
              this.copyAsFetch(request);
            }
            return;
          }
        });
      }

      // Render error distribution chart
      this.renderErrorChart(errors4xx, errors5xx);
    } catch (error) {
      logger.error("Failed to load errors data:", error);
    }
  }

  renderErrorItem(err, type) {
    const typeClass = type === "client" ? "error-client" : "error-server";
    const domain = err.domain || "N/A";
    const pageUrl = err.page_url || "N/A";

    // Extract path from page URL for display
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
      <div class="error-item ${typeClass}">
        <div class="error-header">
          <span class="status-badge status-error">${err.status}</span>
          <span class="error-url" title="${err.url}">${this.truncateUrl(
      err.url,
      60
    )}</span>
          <span class="error-time">${new Date(
            err.timestamp
          ).toLocaleTimeString()}</span>
        </div>
        <div class="error-details">
          <span><i class="fas fa-code"></i> ${err.method || "GET"}</span>
          <span><i class="fas fa-tag"></i> ${err.type || "unknown"}</span>
          <span><i class="fas fa-globe"></i> ${domain}</span>
          <span title="${pageUrl}"><i class="fas fa-file"></i> ${this.truncateUrl(
      pageDisplay,
      30
    )}</span>
          ${
            err.error
              ? `<span class="error-message"><i class="fas fa-info-circle"></i> ${err.error}</span>`
              : ""
          }
        </div>
        <div class="error-actions">
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
          <button class="btn-icon btn-error-fetch" data-request-id="${
            err.id
          }" title="Copy as Fetch">
            <i class="fas fa-code"></i>
          </button>
        </div>
      </div>
    `;
  }

  renderErrorChart(errors4xx, errors5xx) {
    const ctx = document.getElementById("errorsChart").getContext("2d");

    if (this.errorChart) {
      this.errorChart.destroy();
    }

    // Group by status code
    const statusCounts = {};
    [...errors4xx, ...errors5xx].forEach((err) => {
      statusCounts[err.status] = (statusCounts[err.status] || 0) + 1;
    });

    const labels = Object.keys(statusCounts).sort();
    const data = labels.map((status) => statusCounts[status]);

    this.errorChart = new Chart(ctx, {
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
        },
      },
    });
  }

  // Search requests
  searchRequests(query) {
    const tbody = document.getElementById("requestsTableBody");
    if (!tbody) {
      logger.warn("requestsTableBody not found");
      return;
    }

    const rows = tbody.querySelectorAll("tr");
    const searchLower = query.toLowerCase().trim();

    logger.debug(`Searching for: "${query}" in ${rows.length} rows`);

    let matchCount = 0;
    let totalDataRows = 0;

    // Filter rows based on search query
    rows.forEach((row) => {
      // Skip no-data-row
      if (row.classList.contains("no-data-row")) {
        return;
      }

      totalDataRows++;

      if (!searchLower) {
        // Show all rows if search is empty
        row.style.display = "";
        matchCount++;
        return;
      }

      const cells = row.querySelectorAll("td");
      let found = false;

      cells.forEach((cell) => {
        const text = cell.textContent.toLowerCase();
        if (text.includes(searchLower)) {
          found = true;
        }
      });

      row.style.display = found ? "" : "none";
      if (found) matchCount++;
    });

    logger.debug(
      `Search: "${query}" - ${matchCount} matches out of ${totalDataRows} total rows`
    );
  }

  // Get active filters
  getActiveFilters() {
    const pageFilter = document.getElementById("pageFilter");
    const timeRange = document.getElementById("timeRange");
    const requestTypeFilter = document.getElementById("requestTypeFilter");
    const statusFilter = document.getElementById("statusFilter");

    const filters = {
      timeRange: timeRange
        ? parseInt(timeRange.value)
        : this.DEFAULT_TIME_RANGE,
    };

    // Use the current domain (already determined from inspected window)
    if (this.currentDomain) {
      filters.domain = this.currentDomain;
    }

    // Add page filter (if specific page selected)
    const pageValue = pageFilter ? pageFilter.value : "";
    if (pageValue && pageValue !== "") {
      filters.pageUrl = pageValue;
    }

    // Add request type filter
    const requestType = requestTypeFilter ? requestTypeFilter.value : "";
    if (requestType) {
      filters.type = requestType;
    }

    // Add status filter
    const status = statusFilter ? statusFilter.value : "";
    if (status) {
      filters.statusPrefix = status;
    }

    // Update active filters display
    this.updateActiveFiltersDisplay(filters);

    return filters;
  }

  // Update active filters display
  updateActiveFiltersDisplay(filters) {
    const container = document.getElementById("activeFiltersDisplay");
    const list = document.getElementById("activeFiltersList");

    const activeFilters = [];
    if (filters.domain) {
      activeFilters.push(`Domain: ${filters.domain}`);
    }
    if (filters.pageUrl) {
      try {
        const url = new URL(filters.pageUrl);
        const path = url.pathname + url.search || "/";
        activeFilters.push(`Page: ${path}`);
      } catch (e) {
        activeFilters.push(`Page: ${filters.pageUrl}`);
      }
    } else if (filters.domain) {
      activeFilters.push(`Page: All (Aggregated)`);
    }
    if (filters.type) activeFilters.push(`Type: ${filters.type}`);
    if (filters.statusPrefix)
      activeFilters.push(`Status: ${filters.statusPrefix}`);

    if (activeFilters.length > 0) {
      list.innerHTML = activeFilters
        .map((f) => `<span class="filter-tag">${f}</span>`)
        .join("");
      container.style.display = "flex";
    } else {
      container.style.display = "none";
    }
  }

  // Calculate percentile
  calculatePercentile(arr, percentile) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[index] || 0);
  }

  // Show/hide no data state
  showNoDataState(show) {
    const noDataEl = document.getElementById("noDataState");
    const contentEl = document.querySelector(".content-tabs");

    if (show) {
      noDataEl.style.display = "flex";
      contentEl.style.display = "none";
    } else {
      noDataEl.style.display = "none";
      contentEl.style.display = "block";
    }
  }

  // Time Travel Modal methods
  openTimeTravelModal() {
    const modal = document.getElementById("timeTravelModal");
    if (modal) {
      modal.style.display = "flex";
    }
  }

  closeTimeTravelModal() {
    const modal = document.getElementById("timeTravelModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  async loadHistoricalData() {
    try {
      const filters = this.getActiveFilters();
      const groupBy = document.getElementById("timeTravelGroupBy").value;

      const response = await chrome.runtime.sendMessage({
        action: "getHistoricalData",
        filters,
        groupBy,
      });

      if (!response.success || !response.data || response.data.length === 0) {
        // Show inline message instead of alert
        const container = document.getElementById("historicalChartContainer");
        container.innerHTML =
          '<p class="info-message"><i class="fas fa-info-circle"></i> No historical data available for the selected filters and time range</p>';
        return;
      }

      // Create historical chart
      this.renderHistoricalChart(response.data);
    } catch (error) {
      logger.error("Failed to load historical data:", error);
      const container = document.getElementById("historicalChartContainer");
      container.innerHTML =
        '<p class="error-message"><i class="fas fa-exclamation-circle"></i> Error loading historical data. Please try again.</p>';
    }
  }

  renderHistoricalChart(data) {
    const ctx = document.getElementById("historicalChart").getContext("2d");

    // Destroy existing chart if any
    if (this.historicalChart) {
      this.historicalChart.destroy();
    }

    const labels = data.map((d) => d.timeBucket);
    const requestCounts = data.map((d) => d.requestCount);
    const avgDurations = data.map((d) => d.avgDuration);
    const errorCounts = data.map((d) => d.errorCount);

    this.historicalChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Request Count",
            data: requestCounts,
            borderColor: "rgb(75, 192, 192)",
            backgroundColor: "rgba(75, 192, 192, 0.1)",
            yAxisID: "y",
            tension: 0.4,
          },
          {
            label: "Avg Duration (ms)",
            data: avgDurations,
            borderColor: "rgb(54, 162, 235)",
            backgroundColor: "rgba(54, 162, 235, 0.1)",
            yAxisID: "y1",
            tension: 0.4,
          },
          {
            label: "Errors",
            data: errorCounts,
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.1)",
            yAxisID: "y",
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: "Historical Performance Data",
          },
          legend: {
            display: true,
            position: "top",
          },
        },
        scales: {
          y: {
            type: "linear",
            display: true,
            position: "left",
            title: {
              display: true,
              text: "Request Count / Errors",
            },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            title: {
              display: true,
              text: "Avg Duration (ms)",
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    });
  }

  // HAR Export functions
  async copyAsHAR() {
    try {
      const har = await this.generateHAR();
      await navigator.clipboard.writeText(JSON.stringify(har, null, 2));

      this.showToast("HAR data copied to clipboard", "success");
    } catch (error) {
      logger.error("Failed to copy HAR:", error);
      this.showToast("Failed to copy HAR data", "error");
    }
  }

  async exportAsHAR() {
    try {
      const har = await this.generateHAR();
      const blob = new Blob([JSON.stringify(har, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `network-export-${Date.now()}.har`;
      a.click();
      URL.revokeObjectURL(url);

      this.showToast("HAR file exported", "success");
    } catch (error) {
      logger.error("Failed to export HAR:", error);
      this.showToast("Failed to export HAR file", "error");
    }
  }

  async generateHAR() {
    const filters = this.getActiveFilters();
    const response = await chrome.runtime.sendMessage({
      action: "getDetailedRequests",
      filters,
      limit: 1000,
    });

    if (!response.success || !response.requests) {
      throw new Error("No requests available");
    }

    // Generate HAR format
    const har = {
      log: {
        version: "1.2",
        creator: {
          name: "Universal Request Analyzer",
          version: "1.0.0",
        },
        entries: response.requests.map((req) => ({
          startedDateTime: new Date(req.timestamp).toISOString(),
          time: req.duration || 0,
          request: {
            method: req.method || "GET",
            url: req.url,
            httpVersion: "HTTP/1.1",
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1,
          },
          response: {
            status: req.status || 0,
            statusText: req.status_text || "",
            httpVersion: "HTTP/1.1",
            headers: [],
            cookies: [],
            content: {
              size: req.size_bytes || 0,
              mimeType: req.type || "application/octet-stream",
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: req.size_bytes || 0,
          },
          cache: {
            beforeRequest: req.from_cache
              ? { lastAccess: "", eTag: "", hitCount: 1 }
              : null,
          },
          timings: {
            blocked: -1,
            dns: -1,
            connect: -1,
            send: 0,
            wait: req.duration || 0,
            receive: 0,
            ssl: -1,
          },
        })),
      },
    };

    return har;
  }

  // Performance budgets checking
  async checkPerformanceBudgets() {
    const budgetResponseTime = parseInt(
      document.getElementById("budgetResponseTime")?.value || 1000
    );
    const budgetTotalSize =
      parseFloat(document.getElementById("budgetTotalSize")?.value || 5) *
      1024 *
      1024; // Convert to bytes
    const budgetRequestCount = parseInt(
      document.getElementById("budgetRequestCount")?.value || 100
    );

    const filters = this.getActiveFilters();
    const response = await chrome.runtime.sendMessage({
      action: "getFilteredStats",
      filters,
    });

    if (!response.success) return;

    // Check response time budget
    const avgResponse =
      response.responseTimes && response.responseTimes.length > 0
        ? response.responseTimes.reduce((a, b) => a + b, 0) /
          response.responseTimes.length
        : 0;
    const responseStatus = document.getElementById("budgetResponseStatus");
    if (responseStatus) {
      if (avgResponse <= budgetResponseTime) {
        responseStatus.innerHTML =
          '<i class="fas fa-check-circle"></i> Within budget';
        responseStatus.className = "budget-status success";
      } else {
        responseStatus.innerHTML =
          '<i class="fas fa-times-circle"></i> Over budget';
        responseStatus.className = "budget-status error";
      }
    }

    // Check request count budget
    const countStatus = document.getElementById("budgetCountStatus");
    if (countStatus) {
      if (response.totalRequests <= budgetRequestCount) {
        countStatus.innerHTML =
          '<i class="fas fa-check-circle"></i> Within budget';
        countStatus.className = "budget-status success";
      } else {
        countStatus.innerHTML =
          '<i class="fas fa-times-circle"></i> Over budget';
        countStatus.className = "budget-status error";
      }
    }

    // Check size budget (fetch actual resource size data)
    const sizeResponse = await chrome.runtime.sendMessage({
      action: "getResourceSizeBreakdown",
      filters,
    });

    const sizeStatus = document.getElementById("budgetSizeStatus");
    if (sizeStatus && sizeResponse.success) {
      const totalSizeMB = (sizeResponse.totalSize || 0) / (1024 * 1024);
      const budgetSizeMB = parseFloat(
        document.getElementById("budgetTotalSize")?.value || 5
      );

      if (totalSizeMB <= budgetSizeMB) {
        sizeStatus.innerHTML =
          '<i class="fas fa-check-circle"></i> Within budget';
        sizeStatus.className = "budget-status success";
      } else {
        sizeStatus.innerHTML =
          '<i class="fas fa-times-circle"></i> Over budget';
        sizeStatus.className = "budget-status error";
      }
    }
  }

  // Show toast notification
  showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast-notification toast-${type}`;
    const icon =
      type === "success"
        ? "check-circle"
        : type === "error"
        ? "exclamation-circle"
        : "info-circle";
    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    toast.style.cssText =
      "position: fixed; bottom: 20px; right: 20px; background: " +
      (type === "success"
        ? "#4CAF50"
        : type === "error"
        ? "#F44336"
        : "#2196F3") +
      "; color: white; padding: 12px 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Request Comparison features
  openComparisonModal() {
    const modal = document.getElementById("comparisonModal");
    if (modal) {
      modal.style.display = "flex";
      this.loadComparisonData();
    }
  }

  closeComparisonModal() {
    const modal = document.getElementById("comparisonModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  async loadComparisonData() {
    const filters = this.getActiveFilters();
    const response = await chrome.runtime.sendMessage({
      action: "getDetailedRequests",
      filters,
      limit: 10,
    });

    if (
      !response.success ||
      !response.requests ||
      response.requests.length < 2
    ) {
      document.getElementById("comparisonContent").innerHTML =
        '<p class="info-message">Select at least 2 requests to compare. Showing first 10 requests for demonstration.</p>';
      return;
    }

    // Take first 2 requests for comparison
    const req1 = response.requests[0];
    const req2 = response.requests[1];

    const html = `
      <div class="comparison-columns">
        <div class="comparison-column">
          <h4>Request 1</h4>
          ${this.renderComparisonDetails(req1)}
        </div>
        <div class="comparison-divider"></div>
        <div class="comparison-column">
          <h4>Request 2</h4>
          ${this.renderComparisonDetails(req2)}
        </div>
      </div>
      <div class="comparison-diff">
        <h4>Differences</h4>
        <ul>
          <li><strong>Duration:</strong> ${this.formatDiff(
            req1.duration,
            req2.duration,
            "ms"
          )}</li>
          <li><strong>Size:</strong> ${this.formatDiff(
            req1.size_bytes,
            req2.size_bytes,
            "bytes"
          )}</li>
          <li><strong>Status:</strong> ${req1.status} vs ${req2.status}</li>
        </ul>
      </div>
    `;

    document.getElementById("comparisonContent").innerHTML = html;
  }

  renderComparisonDetails(req) {
    return `
      <div class="comparison-details">
        <div class="detail-row">
          <label>URL:</label>
          <span title="${req.url}">${this.truncateUrl(req.url, 50)}</span>
        </div>
        <div class="detail-row">
          <label>Method:</label>
          <span class="method-badge">${req.method || "GET"}</span>
        </div>
        <div class="detail-row">
          <label>Status:</label>
          <span class="status-badge ${
            req.status >= 400 ? "status-error" : "status-success"
          }">${req.status}</span>
        </div>
        <div class="detail-row">
          <label>Type:</label>
          <span>${req.type || "N/A"}</span>
        </div>
        <div class="detail-row">
          <label>Duration:</label>
          <span>${req.duration || 0}ms</span>
        </div>
        <div class="detail-row">
          <label>Size:</label>
          <span>${this.formatBytes(req.size_bytes || 0)}</span>
        </div>
        <div class="detail-row">
          <label>Time:</label>
          <span>${new Date(req.timestamp).toLocaleString()}</span>
        </div>
        <div class="detail-row">
          <label>Cache:</label>
          <span>${req.from_cache ? "Yes" : "No"}</span>
        </div>
      </div>
    `;
  }

  formatDiff(val1, val2, unit) {
    const diff = (val1 || 0) - (val2 || 0);
    const sign = diff > 0 ? "+" : "";
    const color = diff > 0 ? "red" : diff < 0 ? "green" : "gray";
    return `<span style="color: ${color}">${sign}${diff} ${unit}</span>`;
  }

  // Initialize capture button state from settings
  async initializeCaptureState() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getSettings",
      });

      if (response && response.success && response.settings) {
        const captureEnabled = response.settings.capture?.enabled !== false;
        this.capturePaused = !captureEnabled;

        const btn = document.getElementById("pauseCapture");
        if (btn) {
          if (this.capturePaused) {
            btn.innerHTML = '<i class="fas fa-play"></i> Resume';
          } else {
            btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
          }
        }

        logger.debug("Capture state initialized:", {
          captureEnabled,
          capturePaused: this.capturePaused,
        });
      }
    } catch (error) {
      logger.error("Failed to initialize capture state:", error);
      // Default to not paused on error
      this.capturePaused = false;
    }
  }

  // Live Stream features
  async toggleCapture() {
    this.capturePaused = !this.capturePaused;
    const btn = document.getElementById("pauseCapture");

    try {
      // Send message to background to toggle capture
      const response = await chrome.runtime.sendMessage({
        action: "capture:toggle",
        enabled: !this.capturePaused,
      });

      if (response && response.success) {
        if (btn) {
          if (this.capturePaused) {
            btn.innerHTML = '<i class="fas fa-play"></i> Resume';
            this.showToast("Request capture paused", "info");
          } else {
            btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            this.showToast("Request capture resumed", "success");
          }
        }
      } else {
        // Revert state on failure
        this.capturePaused = !this.capturePaused;
        this.showToast(
          "Failed to toggle capture: " + (response?.error || "Unknown error"),
          "error"
        );
      }
    } catch (error) {
      // Revert state on error
      this.capturePaused = !this.capturePaused;
      logger.error("Error toggling capture:", error);
      this.showToast("Failed to toggle capture", "error");
    }
  }

  closeLiveStreamModal() {
    const modal = document.getElementById("liveStreamModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  toggleStreamPause() {
    this.streamPaused = !this.streamPaused;
    const btn = document.getElementById("pauseStream");
    if (btn) {
      btn.innerHTML = this.streamPaused
        ? '<i class="fas fa-play"></i> Resume'
        : '<i class="fas fa-pause"></i> Pause';
    }
  }

  clearStream() {
    this.streamData = [];
    const content = document.getElementById("liveStreamContent");
    if (content) {
      content.innerHTML =
        '<p class="info-message">Stream cleared. New requests will appear here.</p>';
    }
  }

  addToStream(request) {
    if (this.streamPaused) return;

    this.streamData.push(request);
    if (this.streamData.length > 100) {
      this.streamData.shift(); // Keep last 100
    }

    const content = document.getElementById("liveStreamContent");
    if (!content) return;

    const highlightCriteria =
      document.getElementById("highlightCriteria")?.value;
    let shouldHighlight = false;

    if (highlightCriteria === "errors" && request.status >= 400) {
      shouldHighlight = true;
    } else if (highlightCriteria === "slow" && request.duration > 1000) {
      shouldHighlight = true;
    } else if (
      highlightCriteria === "large" &&
      request.size_bytes > 1024 * 1024
    ) {
      shouldHighlight = true;
    }

    const item = document.createElement("div");
    item.className = `stream-item ${shouldHighlight ? "highlight" : ""}`;
    item.innerHTML = `
      <span class="stream-time">${new Date(
        request.timestamp
      ).toLocaleTimeString()}</span>
      <span class="method-badge">${request.method || "GET"}</span>
      <span class="status-badge ${
        request.status >= 400 ? "status-error" : "status-success"
      }">${request.status}</span>
      <span class="stream-url" title="${request.url}">${this.truncateUrl(
      request.url,
      60
    )}</span>
      <span class="stream-duration">${request.duration || 0}ms</span>
    `;

    content.appendChild(item);

    const autoScroll = document.getElementById("autoScroll")?.checked;
    if (autoScroll) {
      content.scrollTop = content.scrollHeight;
    }
  }

  // Cleanup when panel is closed
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Destroy all charts
    Object.values(this.charts).forEach((chart) => {
      if (chart) {
        chart.destroy();
      }
    });
  }

  // WebSocket Inspector Methods
  async loadWebSocketData() {
    // Initialize WebSocket tracking
    this.websocketMessages = this.websocketMessages || [];
    this.websocketPaused = false;

    // Setup event listeners for WebSocket controls
    const clearBtn = document.getElementById("clearWebSocketBtn");
    const pauseBtn = document.getElementById("pauseWebSocketBtn");

    if (clearBtn) {
      // Remove existing listener if any
      clearBtn.replaceWith(clearBtn.cloneNode(true));
      document
        .getElementById("clearWebSocketBtn")
        .addEventListener("click", () => this.clearWebSocket());
    }
    if (pauseBtn) {
      // Remove existing listener if any
      pauseBtn.replaceWith(pauseBtn.cloneNode(true));
      document
        .getElementById("pauseWebSocketBtn")
        .addEventListener("click", () => this.toggleWebSocketPause());
    }

    // Display message that WebSocket tracking is active
    this.updateWebSocketDisplay();
  }

  toggleWebSocketPause() {
    this.websocketPaused = !this.websocketPaused;
    const btn = document.getElementById("pauseWebSocketBtn");
    if (btn) {
      btn.innerHTML = this.websocketPaused
        ? '<i class="fas fa-play"></i> Resume'
        : '<i class="fas fa-pause"></i> Pause';
    }
  }

  clearWebSocket() {
    this.websocketMessages = [];
    this.updateWebSocketDisplay();
  }

  updateWebSocketDisplay() {
    const container = document.getElementById("websocketMessages");
    if (!container) return;

    if (this.websocketMessages.length === 0) {
      container.innerHTML =
        '<p class="placeholder">No WebSocket activity detected. WebSocket connections will appear here when they occur.</p>';
      return;
    }

    let html = '<div class="websocket-list">';

    this.websocketMessages
      .slice(-100)
      .reverse()
      .forEach((msg, idx) => {
        const direction = msg.direction === "sent" ? "outgoing" : "incoming";
        html += `
        <div class="websocket-message ${direction}">
          <div class="ws-header">
            <span class="ws-time">${new Date(
              msg.timestamp
            ).toLocaleTimeString()}</span>
            <span class="ws-direction">${
              msg.direction === "sent" ? "→" : "←"
            } ${msg.direction.toUpperCase()}</span>
            <span class="ws-size">${this.formatBytes(msg.size || 0)}</span>
          </div>
          <div class="ws-connection">${msg.url || "Unknown connection"}</div>
          <div class="ws-data">${this.truncateText(msg.data || "", 200)}</div>
        </div>
      `;
      });

    html += "</div>";
    container.innerHTML = html;

    // Update stats
    const sentCount = this.websocketMessages.filter(
      (m) => m.direction === "sent"
    ).length;
    const receivedCount = this.websocketMessages.filter(
      (m) => m.direction === "received"
    ).length;
    const connections = new Set(this.websocketMessages.map((m) => m.url)).size;

    document.getElementById("wsConnectionCount").textContent = connections;
    document.getElementById("wsSentCount").textContent = sentCount;
    document.getElementById("wsReceivedCount").textContent = receivedCount;
  }

  // Real-time Feed Methods
  startRealtimeFeed() {
    this.realtimeMessages = this.realtimeMessages || [];
    this.realtimePaused = false;

    // Setup event listeners
    const clearBtn = document.getElementById("clearRealtimeBtn");
    const pauseBtn = document.getElementById("pauseRealtimeBtn");

    if (clearBtn) {
      // Remove existing listener if any
      clearBtn.replaceWith(clearBtn.cloneNode(true));
      document
        .getElementById("clearRealtimeBtn")
        .addEventListener("click", () => this.clearRealtimeFeed());
    }
    if (pauseBtn) {
      // Remove existing listener if any
      pauseBtn.replaceWith(pauseBtn.cloneNode(true));
      document
        .getElementById("pauseRealtimeBtn")
        .addEventListener("click", () => this.toggleRealtimePause());
    }

    // Start polling for new requests
    if (!this.realtimeInterval) {
      this.realtimeInterval = setInterval(
        () => this.pollRealtimeRequests(),
        1000
      );
    }

    this.updateRealtimeDisplay();
  }

  async pollRealtimeRequests() {
    if (this.realtimePaused) return;

    try {
      const filters = {
        ...this.getActiveFilters(),
        timeRange: 5, // Last 5 seconds
      };

      const response = await chrome.runtime.sendMessage({
        action: "getDetailedRequests",
        filters,
        limit: 10,
      });

      if (response && response.success && response.requests) {
        response.requests.forEach((req) => {
          // Only add if not already in feed
          if (!this.realtimeMessages.find((m) => m.id === req.id)) {
            this.addRealtimeRequest(req);
          }
        });
      }
    } catch (error) {
      logger.error("Failed to poll realtime requests:", error);
    }
  }

  toggleRealtimePause() {
    this.realtimePaused = !this.realtimePaused;
    const btn = document.getElementById("pauseRealtimeBtn");
    if (btn) {
      btn.innerHTML = this.realtimePaused
        ? '<i class="fas fa-play"></i> Resume'
        : '<i class="fas fa-pause"></i> Pause';
    }
  }

  clearRealtimeFeed() {
    this.realtimeMessages = [];
    this.updateRealtimeDisplay();
  }

  addRealtimeRequest(request) {
    if (this.realtimePaused) return;

    this.realtimeMessages.push(request);
    if (this.realtimeMessages.length > 200) {
      this.realtimeMessages.shift();
    }

    this.updateRealtimeDisplay();
  }

  // WebSocket tab visibility management
  updateWebSocketTabVisibility(hasWebSockets) {
    const wsTabBtn = document.getElementById("websocketTabBtn");
    if (wsTabBtn) {
      wsTabBtn.style.display = hasWebSockets ? "block" : "none";
    }
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }
}

// Initialize panel when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  logger.debug("Initializing DevTools Panel...");

  const panel = new DevToolsPanel();

  // Listen for tab URL changes
  chrome.devtools.network.onNavigated.addListener((url) => {
    panel.handleUrlChange(url);
  });

  // Get current URL
  chrome.devtools.inspectedWindow.eval(
    "window.location.href",
    (result, isException) => {
      if (!isException && result) {
        panel.handleUrlChange(result);
      }
    }
  );

  // Cleanup on unload
  window.addEventListener("beforeunload", () => {
    panel.destroy();
  });

  logger.debug("✓ DevTools Panel initialized");
});
