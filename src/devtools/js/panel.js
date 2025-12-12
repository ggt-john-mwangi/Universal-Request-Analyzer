import Chart from "../../lib/chart.min.js";

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
    this.ERROR_STATUS_PREFIX = '4xx';
    this.DEFAULT_TIME_RANGE = 300; // 5 minutes in seconds
    
    this.initialize();
  }

  initialize() {
    this.setupUI();
    this.setupEventListeners();
    this.initializeCharts();
    this.startMetricsCollection();
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
              <option value="xmlhttprequest">XHR/API</option>
              <option value="fetch">Fetch</option>
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
            <button data-tab="waterfall" class="tab-btn">
              <i class="fas fa-stream"></i> Waterfall
            </button>
            <button data-tab="performance" class="tab-btn">
              <i class="fas fa-stopwatch"></i> Performance
            </button>
            <button data-tab="endpoints" class="tab-btn">
              <i class="fas fa-network-wired"></i> Endpoints
            </button>
            <button data-tab="resources" class="tab-btn">
              <i class="fas fa-database"></i> Resources
            </button>
            <button data-tab="errors" class="tab-btn">
              <i class="fas fa-bug"></i> Errors
            </button>
            <button data-tab="websocket" class="tab-btn">
              <i class="fas fa-plug"></i> WebSocket
            </button>
            <button data-tab="realtime" class="tab-btn">
              <i class="fas fa-bolt"></i> Real-time Feed
            </button>
          </div>
          
          <!-- Overview Tab -->
          <div id="overviewTab" class="tab-content active">
            <div class="charts-grid">
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
              <div class="chart-container">
                <h4><i class="fas fa-clock"></i> Request Volume</h4>
                <canvas id="volumeChart"></canvas>
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
              <h4><i class="fas fa-chart-line"></i> Endpoint Performance Over Time</h4>
              <p class="hint">Track how specific endpoints perform over time. Useful for detecting performance degradation and regression analysis.</p>
              
              <div class="history-controls" style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                <div class="filter-group">
                  <label><i class="fas fa-link"></i> Endpoint Pattern:</label>
                  <input type="text" id="endpointPattern" placeholder="e.g., /api/login, /users/:id" class="filter-input" style="min-width: 250px;">
                </div>
                
                <div class="filter-group">
                  <label><i class="fas fa-calendar"></i> Time Bucket:</label>
                  <select id="historyTimeBucket" class="filter-select">
                    <option value="hourly" selected>Hourly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
                
                <div class="filter-group">
                  <label><i class="fas fa-clock"></i> Time Range:</label>
                  <select id="historyTimeRange" class="filter-select">
                    <option value="3600000">Last Hour</option>
                    <option value="21600000">Last 6 Hours</option>
                    <option value="86400000">Last 24 Hours</option>
                    <option value="259200000">Last 3 Days</option>
                    <option value="604800000" selected>Last 7 Days</option>
                    <option value="2592000000">Last 30 Days</option>
                  </select>
                </div>
                
                <button id="loadHistoryBtn" class="btn-primary" style="align-self: flex-end;">
                  <i class="fas fa-sync-alt"></i> Load History
                </button>
              </div>
              
              <div id="performanceHistoryChart" style="min-height: 300px; position: relative;">
                <canvas id="historyChartCanvas"></canvas>
              </div>
              
              <div id="performanceInsights" class="performance-insights" style="margin-top: 16px; display: none;">
                <h5><i class="fas fa-lightbulb"></i> Performance Insights</h5>
                <div id="insightsContent"></div>
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
          
          <!-- Real-time Feed Tab -->
          <div id="realtimeTab" class="tab-content">
            <div class="realtime-header">
              <h4><i class="fas fa-bolt"></i> Real-time Request Feed</h4>
              <div class="realtime-controls">
                <button id="clearRealtimeBtn" class="btn-secondary btn-sm">
                  <i class="fas fa-trash"></i> Clear
                </button>
                <button id="pauseRealtimeBtn" class="btn-secondary btn-sm">
                  <i class="fas fa-pause"></i> Pause
                </button>
                <label class="autoscroll-label">
                  <input type="checkbox" id="autoScrollCheckbox" checked>
                  <span>Auto-scroll</span>
                </label>
              </div>
            </div>
            <div class="realtime-feed" id="realtimeFeed">
              <p class="placeholder">Waiting for requests...</p>
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
    
    const closeTimeTravelModal = document.getElementById("closeTimeTravelModal");
    if (closeTimeTravelModal) {
      closeTimeTravelModal.addEventListener("click", () => this.closeTimeTravelModal());
    }
    
    const loadHistoricalData = document.getElementById("loadHistoricalData");
    if (loadHistoricalData) {
      loadHistoricalData.addEventListener("click", () => this.loadHistoricalData());
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
      budgetResponseTime.addEventListener("change", () => this.checkPerformanceBudgets());
    }
    
    const budgetTotalSize = document.getElementById("budgetTotalSize");
    if (budgetTotalSize) {
      budgetTotalSize.addEventListener("change", () => this.checkPerformanceBudgets());
    }
    
    const budgetRequestCount = document.getElementById("budgetRequestCount");
    if (budgetRequestCount) {
      budgetRequestCount.addEventListener("change", () => this.checkPerformanceBudgets());
    }
    
    // Live streaming
    const pauseCapture = document.getElementById("pauseCapture");
    if (pauseCapture) {
      pauseCapture.addEventListener("click", () => this.toggleCapture());
    }
    
    // Tab navigation
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => this.switchTab(button.dataset.tab));
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
      success: this.getThemeColor('--success-color'),
      info: this.getThemeColor('--info-color'),
      warning: this.getThemeColor('--warning-color'),
      error: this.getThemeColor('--error-color'),
      primary: this.getThemeColor('--primary-color'),
    };
  }

  // Get current tab's domain
  async getCurrentDomain() {
    return new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(
        'window.location.hostname',
        (result, error) => {
          if (error) {
            console.error('Error getting current domain:', error);
            resolve('');
          } else {
            resolve(result || '');
          }
        }
      );
    });
  }

  // Get current tab's full URL
  async getCurrentPageUrl() {
    return new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(
        'window.location.origin + window.location.pathname',
        (result, error) => {
          if (error) {
            console.error('Error getting current page URL:', error);
            resolve('');
          } else {
            resolve(result || '');
          }
        }
      );
    });
  }

  initializeCharts() {
    const colors = this.getChartColors();
    
    // Performance Chart - Line chart for response times over time
    const perfCtx = document
      .getElementById("performanceChart")
      .getContext("2d");
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
            position: 'top',
          },
          tooltip: {
            mode: 'index',
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
    const statusCtx = document.getElementById("statusChart").getContext("2d");
    this.charts.status = new Chart(statusCtx, {
      type: "pie",
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: [
              colors.success,    // 2xx
              colors.info,       // 3xx
              colors.warning,    // 4xx
              colors.error,      // 5xx
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
        },
      },
    });

    // Requests Chart - Bar chart for request types
    const reqCtx = document.getElementById("requestsChart").getContext("2d");
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

    // Volume Chart - Area chart for request volume over time
    const volCtx = document.getElementById("volumeChart").getContext("2d");
    this.charts.volume = new Chart(volCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Request Volume",
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
            position: 'top',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            },
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
    });

    // Errors Chart for errors tab
    const errCtx = document.getElementById("errorsChart").getContext("2d");
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
              precision: 0
            },
          },
        },
      },
    });
  }

  async startMetricsCollection() {
    // Get and display current domain
    const currentDomain = await this.getCurrentDomain();
    const domainDisplay = document.getElementById('currentDomainDisplay');
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
        console.warn("Extension context invalidated, stopping metrics collection");
        this.stopMetricsCollection();
        return;
      }

      const filters = this.getActiveFilters();
      console.log('DevTools Panel: Collecting metrics with filters:', filters);

      // Get metrics from background page
      chrome.runtime.sendMessage(
        {
          action: "getFilteredStats",
          filters
        },
        (response) => {
          if (chrome.runtime.lastError) {
            // Context invalidated or extension reloaded
            console.warn("Runtime error (context may be invalidated):", chrome.runtime.lastError.message);
            this.stopMetricsCollection();
            return;
          }

          console.log('DevTools Panel: Received response:', response);

          if (response && response.success) {
            // Check if there's data
            if (!response.totalRequests || response.totalRequests === 0) {
              console.log('DevTools Panel: No data available (totalRequests = 0)');
              this.showNoDataState(true);
            } else {
              console.log('DevTools Panel: Data available, updating metrics');
              this.showNoDataState(false);
              this.updateMetrics(response);
            }
          } else {
            console.error("DevTools Panel: Failed to get metrics:", response?.error);
            this.showNoDataState(true);
          }
        }
      );
    } catch (error) {
      console.error("DevTools Panel: Error collecting metrics:", error);
      // Stop collection on error to prevent spam
      this.stopMetricsCollection();
    }
  }

  stopMetricsCollection() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log("Metrics collection stopped");
    }
  }

  updateMetrics(metrics) {
    // Update stat cards
    document.getElementById("totalRequestsValue").textContent = 
      metrics.totalRequests || 0;
    
    const avgResponse = (metrics.responseTimes && metrics.responseTimes.length > 0)
      ? Math.round(metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length)
      : 0;
    document.getElementById("avgResponseValue").textContent = `${avgResponse}ms`;
    
    const slowRequests = (metrics.responseTimes && metrics.responseTimes.length > 0)
      ? metrics.responseTimes.filter(t => t > 1000).length 
      : 0;
    document.getElementById("slowRequestsValue").textContent = slowRequests;
    
    const errors = Object.entries(metrics.statusCodes || {})
      .filter(([status]) => parseInt(status) >= 400)
      .reduce((sum, [, count]) => sum + count, 0);
    document.getElementById("errorsValue").textContent = errors;
    
    // Calculate success rate
    const total = metrics.totalRequests || 0;
    const successCount = total - errors;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
    document.getElementById("successRateValue").textContent = `${successRate}%`;
    
    // Calculate P95 response time
    if (metrics.responseTimes && metrics.responseTimes.length > 0) {
      const p95 = this.calculatePercentile(metrics.responseTimes, 95);
      document.getElementById("p95ResponseValue").textContent = `${p95}ms`;
    } else {
      document.getElementById("p95ResponseValue").textContent = '0ms';
    }

    // Update performance chart
    if (this.charts.performance && metrics.timestamps && metrics.responseTimes) {
      this.charts.performance.data.labels = metrics.timestamps.slice(-this.MAX_CHART_POINTS);
      this.charts.performance.data.datasets[0].data = metrics.responseTimes.slice(-this.MAX_CHART_POINTS);
      this.charts.performance.update();
    }

    // Update status chart
    if (this.charts.status && metrics.statusCodes) {
      const statusGroups = {
        '2xx Success': 0,
        '3xx Redirect': 0,
        '4xx Client Error': 0,
        '5xx Server Error': 0
      };
      
      for (const [status, count] of Object.entries(metrics.statusCodes)) {
        const statusCode = parseInt(status);
        if (statusCode >= 200 && statusCode < 300) statusGroups['2xx Success'] += count;
        else if (statusCode >= 300 && statusCode < 400) statusGroups['3xx Redirect'] += count;
        else if (statusCode >= 400 && statusCode < 500) statusGroups['4xx Client Error'] += count;
        else if (statusCode >= 500) statusGroups['5xx Server Error'] += count;
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
    
    timestamps.forEach(ts => {
      // Extract minute from timestamp
      const minute = ts.substring(0, ts.lastIndexOf(':'));
      minuteCounts.set(minute, (minuteCounts.get(minute) || 0) + 1);
    });
    
    return {
      labels: Array.from(minuteCounts.keys()),
      values: Array.from(minuteCounts.values())
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
    await this.collectMetrics();
  }

  exportMetrics() {
    const filters = this.getActiveFilters();
    chrome.runtime.sendMessage(
      {
        action: "exportFilteredData",
        filters: filters,
        format: "json",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Export error:", chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          this.showToast('Metrics exported successfully', 'success');
        } else {
          console.error("Export failed:", response?.error);
          this.showToast('Export failed: ' + (response?.error || 'Unknown error'), 'error');
        }
      }
    );
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
      
      if (!domain || domain === 'all') {
        pageSelect.disabled = true;
        return;
      }
      
      // Get pages for this domain
      const response = await chrome.runtime.sendMessage({
        action: 'getPagesByDomain',
        domain: domain,
        timeRange: 604800  // Last 7 days
      });
      
      console.log('Pages for domain response:', response);
      console.log('Response structure:', {
        success: response?.success,
        pagesLength: response?.pages?.length,
        pages: response?.pages
      });
      
      if (response && response.success && response.pages && response.pages.length > 0) {
        response.pages.forEach(pageObj => {
          const pageUrl = pageObj.pageUrl;
          if (pageUrl) {
            const option = document.createElement('option');
            option.value = pageUrl;
            // Extract path from full URL for display
            try {
              const url = new URL(pageUrl);
              const displayPath = url.pathname + url.search || '/';
              option.textContent = `${displayPath} (${pageObj.requestCount} req)`;
            } catch (e) {
              option.textContent = `${pageUrl} (${pageObj.requestCount} req)`;
            }
            pageSelect.appendChild(option);
          }
        });
        console.log(`Loaded ${response.pages.length} pages for domain ${domain}`);
      } else {
        console.warn(`No pages found for domain ${domain}`);
      }
    } catch (error) {
      console.error('Failed to load page filter:', error);
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
    
    // Reload data with cleared filters
    this.applyFilters();
  }

  // Switch between tabs
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.remove("active");
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
    
    // Update tab content
    document.querySelectorAll(".tab-content").forEach(content => {
      content.classList.remove("active");
    });
    document.getElementById(`${tabName}Tab`).classList.add("active");
    
    // Load tab-specific data
    this.loadTabData(tabName);
  }

  // Load data for specific tab
  async loadTabData(tabName) {
    switch(tabName) {
      case 'requests':
        await this.loadRequestsTable();
        break;
      case 'waterfall':
        await this.loadWaterfallData();
        break;
      case 'performance':
        await this.loadPerformanceData();
        break;
      case 'endpoints':
        await this.loadEndpointsData();
        break;
      case 'resources':
        await this.loadResourcesData();
        break;
      case 'errors':
        await this.loadErrorsData();
        break;
      case 'websocket':
        await this.loadWebSocketData();
        break;
      case 'realtime':
        this.startRealtimeFeed();
        break;
    }
  }

  // Load requests table
  async loadRequestsTable(page = 1) {
    try {
      const filters = this.getActiveFilters();
      const perPageSelect = document.getElementById('requestsPerPage');
      const perPage = perPageSelect ? parseInt(perPageSelect.value) : 25;
      const offset = (page - 1) * perPage;
      
      console.log('loadRequestsTable called:', { page, perPage, offset, filters });
      
      const response = await chrome.runtime.sendMessage({
        action: 'getDetailedRequests',
        filters,
        limit: perPage,
        offset: offset
      });
      
      console.log('getDetailedRequests response:', {
        success: response?.success,
        requestsLength: response?.requests?.length,
        totalCount: response?.totalCount
      });
      
      const tbody = document.getElementById('requestsTableBody');
      
      if (!response.success || !response.requests || response.requests.length === 0) {
        tbody.innerHTML = '<tr class="no-data-row"><td colspan="7">No requests available for selected filters</td></tr>';
        document.getElementById('tablePagination').innerHTML = '';
        return;
      }
      
      // Build table rows with actual request data
      let rows = '';
      response.requests.forEach(req => {
        const statusClass = req.status >= 400 ? 'status-error' : req.status >= 300 ? 'status-warning' : 'status-success';
        const size = req.size_bytes ? this.formatBytes(req.size_bytes) : 'N/A';
        const duration = req.duration ? `${Math.round(req.duration)}ms` : 'N/A';
        const cacheIcon = req.from_cache ? '<i class="fas fa-hdd" title="From cache"></i>' : '';
        const errorIcon = req.error ? '<i class="fas fa-exclamation-circle" title="Error"></i>' : '';
        
        rows += `
          <tr>
            <td><span class="method-badge">${req.method}</span></td>
            <td class="url-cell" title="${req.url}">${this.truncateUrl(req.url, 50)}</td>
            <td><span class="status-badge ${statusClass}">${req.status || 'N/A'}</span></td>
            <td>${req.type || 'N/A'}</td>
            <td>${duration} ${cacheIcon}</td>
            <td>${size}</td>
            <td>
              <button class="btn-icon btn-view-details" data-request-id="${req.id}" title="View details">
                <i class="fas fa-info-circle"></i>
              </button>
              <button class="btn-icon btn-copy-curl" data-request-id="${req.id}" title="Copy as cURL">
                <i class="fas fa-terminal"></i>
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
        perPageSelect.dataset.listenerAdded = 'true';
        perPageSelect.addEventListener('change', () => {
          this.loadRequestsTable(1); // Reset to page 1 when changing per-page
        });
      }
      
      // Use event delegation instead of inline onclick (only add listener once)
      if (!tbody.dataset.listenerAdded) {
        tbody.dataset.listenerAdded = 'true';
        tbody.addEventListener('click', (e) => {
          const viewBtn = e.target.closest('.btn-view-details');
          if (viewBtn) {
            const requestId = viewBtn.dataset.requestId;
            this.viewRequestDetails(requestId);
            return;
          }
          
          const curlBtn = e.target.closest('.btn-copy-curl');
          if (curlBtn) {
            const requestId = curlBtn.dataset.requestId;
            const requestData = this.currentRequests.find(r => r.id === requestId);
            if (requestData) {
              this.copyAsCurl(requestData);
            }
            return;
          }
        });
      }
      
    } catch (error) {
      console.error('Failed to load requests table:', error);
      document.getElementById('requestsTableBody').innerHTML = 
        '<tr class="no-data-row"><td colspan="7">Error loading requests</td></tr>';
    }
  }
  
  // Render pagination controls
  renderPagination(currentPage, totalCount, perPage) {
    const container = document.getElementById('tablePagination');
    if (!container || totalCount === 0) {
      if (container) container.innerHTML = '';
      return;
    }
    
    const totalPages = Math.ceil(totalCount / perPage);
    if (totalPages <= 1) {
      container.innerHTML = `<span class="pagination-info">Showing ${totalCount} request${totalCount !== 1 ? 's' : ''}</span>`;
      return;
    }
    
    let html = `<span class="pagination-info">Page ${currentPage} of ${totalPages} (${totalCount} total)</span>`;
    
    // Previous button
    if (currentPage > 1) {
      html += `<button class="pagination-btn" data-page="${currentPage - 1}"><i class="fas fa-chevron-left"></i> Previous</button>`;
    }
    
    // Page numbers
    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    
    if (endPage - startPage < maxPageButtons - 1) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }
    
    if (startPage > 1) {
      html += `<button class="pagination-btn" data-page="1">1</button>`;
      if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === currentPage ? 'active' : '';
      html += `<button class="pagination-btn ${activeClass}" data-page="${i}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
      html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    if (currentPage < totalPages) {
      html += `<button class="pagination-btn" data-page="${currentPage + 1}">Next <i class="fas fa-chevron-right"></i></button>`;
    }
    
    container.innerHTML = html;
    
    // Add event listeners to pagination buttons
    container.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        this.loadRequestsTable(page);
      });
    });
  }
  
  // View request details
  async viewRequestDetails(requestId) {
    try {
      // Search in both currentRequests and currentErrors arrays
      let request = this.currentRequests?.find(r => r.id === requestId);
      if (!request) {
        request = this.currentErrors?.find(r => r.id === requestId);
      }
      
      if (!request) {
        this.showToast('Request not found', 'error');
        return;
      }
      
      // Create modal
      const modal = document.createElement('div');
      modal.className = 'details-modal';
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
                <tr><td>Method:</td><td><span class="method-badge">${request.method}</span></td></tr>
                <tr><td>URL:</td><td class="selectable">${request.url}</td></tr>
                <tr><td>Status:</td><td>${request.status} ${request.status_text || ''}</td></tr>
                <tr><td>Type:</td><td>${request.type}</td></tr>
                <tr><td>Domain:</td><td>${request.domain || 'N/A'}</td></tr>
                <tr><td>Page:</td><td>${request.page_url || 'N/A'}</td></tr>
              </table>
            </div>
            <div class="detail-section">
              <h4>Performance</h4>
              <table class="details-table">
                <tr><td>Duration:</td><td>${request.duration ? Math.round(request.duration) + 'ms' : 'N/A'}</td></tr>
                <tr><td>Size:</td><td>${this.formatBytes(request.size_bytes || 0)}</td></tr>
                <tr><td>From Cache:</td><td>${request.from_cache ? 'Yes' : 'No'}</td></tr>
                <tr><td>Timestamp:</td><td>${new Date(request.timestamp).toLocaleString()}</td></tr>
              </table>
            </div>
            ${request.error ? `
            <div class="detail-section">
              <h4>Error</h4>
              <div class="error-box">${request.error}</div>
            </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn-secondary modal-close-btn">Close</button>
          </div>
        </div>
      `;
      
      // Add event listeners for closing
      const overlay = modal.querySelector('.modal-overlay');
      const closeBtn = modal.querySelector('.modal-close');
      const closeBtnFooter = modal.querySelector('.modal-close-btn');
      
      const closeModal = () => modal.remove();
      
      overlay.addEventListener('click', closeModal);
      closeBtn.addEventListener('click', closeModal);
      closeBtnFooter.addEventListener('click', closeModal);
      
      document.body.appendChild(modal);
    } catch (error) {
      console.error('Error showing request details:', error);
      this.showToast('Failed to load request details', 'error');
    }
  }
  
  // Copy request as cURL command
  // Note: Headers are stored in a separate table and not included in basic cURL export
  copyAsCurl(request) {
    try {
      let curl = `curl '${request.url}'`;
      
      // Add method if not GET
      if (request.method && request.method !== 'GET') {
        curl += ` -X ${request.method}`;
      }
      
      // Note: Headers are stored in bronze_request_headers table
      // and not fetched for performance reasons
      // Add common headers manually
      curl += ` -H 'Accept: */*'`;
      
      // Add compressed flag
      curl += ' --compressed';
      
      // Copy to clipboard
      navigator.clipboard.writeText(curl).then(() => {
        this.showToast('cURL command copied to clipboard!', 'success');
      }).catch(err => {
        console.error('Failed to copy:', err);
        this.showToast('Failed to copy cURL command', 'error');
      });
    } catch (error) {
      console.error('Error generating cURL:', error);
      this.showToast('Failed to generate cURL command', 'error');
    }
  }
  
  // Helper to truncate URLs
  truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    const parts = url.split('?');
    const base = parts[0];
    if (base.length > maxLength) {
      return base.substring(0, maxLength - 3) + '...';
    }
    if (parts.length > 1 && parts[1]) {
      const remaining = maxLength - base.length - 4;
      return base + '?' + parts[1].substring(0, remaining) + '...';
    }
    return url;
  }
  
  // Helper to format bytes
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Load performance data
  async loadPerformanceData() {
    try {
      const filters = this.getActiveFilters();
      const response = await chrome.runtime.sendMessage({
        action: 'getFilteredStats',
        filters
      });
      
      if (!response.success || !response.responseTimes || response.responseTimes.length === 0) {
        document.getElementById('timingBreakdown').innerHTML = '<p class="no-data">No performance data available</p>';
        document.getElementById('slowRequestsList').innerHTML = '<p class="no-data">No requests available</p>';
        return;
      }
      
      // Show timing breakdown
      const avgTime = response.responseTimes.reduce((a, b) => a + b, 0) / response.responseTimes.length;
      const maxTime = Math.max(...response.responseTimes);
      const minTime = Math.min(...response.responseTimes);
      
      document.getElementById('timingBreakdown').innerHTML = `
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
            <span class="value">${this.calculatePercentile(response.responseTimes, 95)}ms</span>
          </div>
        </div>
      `;
      
      // Show slow requests placeholder
      document.getElementById('slowRequestsList').innerHTML = `
        <p class="info-message">
          <i class="fas fa-info-circle"></i> 
          Top ${Math.min(10, response.responseTimes.length)} slowest requests will be displayed here.
        </p>
      `;
    } catch (error) {
      console.error('Failed to load performance data:', error);
    }
  }

  // Load endpoints data
  async loadEndpointsData() {
    try {
      const filters = this.getActiveFilters();
      const response = await chrome.runtime.sendMessage({
        action: 'getEndpointAnalysis',
        filters
      });
      
      const table = document.getElementById('endpointsTable');
      
      if (!response.success || !response.endpoints || response.endpoints.length === 0) {
        table.innerHTML = '<p class="no-data">No API endpoints found for selected filters</p>';
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
      
      response.endpoints.forEach(ep => {
        const errorClass = ep.errorRate > 10 ? 'status-error' : ep.errorRate > 5 ? 'status-warning' : '';
        const perfClass = ep.avgDuration > 1000 ? 'status-error' : ep.avgDuration > 500 ? 'status-warning' : 'status-success';
        
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
      
      html += '</tbody></table>';
      table.innerHTML = html;
      
      // Setup history load button listener (only once)
      const loadHistoryBtn = document.getElementById('loadHistoryBtn');
      if (loadHistoryBtn && !loadHistoryBtn.dataset.listenerAdded) {
        loadHistoryBtn.dataset.listenerAdded = 'true';
        loadHistoryBtn.addEventListener('click', () => this.loadEndpointPerformanceHistory());
      }
      
    } catch (error) {
      console.error('Failed to load endpoints data:', error);
      document.getElementById('endpointsTable').innerHTML = 
        '<p class="error-message">Error loading endpoint analysis</p>';
    }
  }
  
  // Load endpoint performance history for regression analysis
  async loadEndpointPerformanceHistory() {
    try {
      const filters = this.getActiveFilters();
      const endpointPattern = document.getElementById('endpointPattern')?.value || '';
      const timeBucket = document.getElementById('historyTimeBucket')?.value || 'hourly';
      const timeRangeMs = parseInt(document.getElementById('historyTimeRange')?.value || '604800000');
      
      const startTime = Date.now() - timeRangeMs;
      const endTime = Date.now();
      
      console.log('Loading endpoint performance history:', { 
        endpoint: endpointPattern, 
        timeBucket, 
        startTime, 
        endTime, 
        domain: filters.domain 
      });
      
      const response = await chrome.runtime.sendMessage({
        action: 'getEndpointPerformanceHistory',
        filters: {
          domain: filters.domain,
          pageUrl: filters.pageUrl,
          endpoint: endpointPattern,
          timeBucket,
          startTime,
          endTime
        }
      });
      
      console.log('Performance history response:', response);
      
      if (!response.success || !response.history || response.history.length === 0) {
        document.getElementById('performanceHistoryChart').innerHTML = 
          '<p class="no-data"><i class="fas fa-info-circle"></i> No performance data found. Try adjusting the endpoint pattern or time range.</p>';
        document.getElementById('performanceInsights').style.display = 'none';
        return;
      }
      
      // Render the performance chart
      this.renderEndpointPerformanceChart(response);
      
      // Generate performance insights
      this.generatePerformanceInsights(response);
      
    } catch (error) {
      console.error('Failed to load endpoint performance history:', error);
      document.getElementById('performanceHistoryChart').innerHTML = 
        '<p class="error-message">Error loading performance history</p>';
    }
  }
  
  // Render endpoint performance history chart
  renderEndpointPerformanceChart(response) {
    const canvas = document.getElementById('historyChartCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if any
    if (this.performanceHistoryChart) {
      this.performanceHistoryChart.destroy();
    }
    
    // Group data by endpoint pattern for multi-line chart
    const groupedData = response.groupedByEndpoint;
    const endpoints = Object.keys(groupedData);
    
    if (endpoints.length === 0) {
      document.getElementById('performanceHistoryChart').innerHTML = 
        '<p class="no-data">No endpoints found in the data</p>';
      return;
    }
    
    // Generate colors for each endpoint
    const colors = [
      '#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0',
      '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63'
    ];
    
    // Prepare datasets - one per endpoint
    const datasets = endpoints.slice(0, 10).map((endpoint, index) => {
      const records = groupedData[endpoint];
      // Sort by time bucket
      records.sort((a, b) => a.timeBucket.localeCompare(b.timeBucket));
      
      return {
        label: endpoint,
        data: records.map(r => ({ x: r.timeBucket, y: r.avgDuration })),
        borderColor: colors[index % colors.length],
        backgroundColor: 'transparent',
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6
      };
    });
    
    this.performanceHistoryChart = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Endpoint Performance Over Time (${response.timeBucket})`
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              afterLabel: function(context) {
                const dataPoint = response.history[context.dataIndex];
                if (dataPoint) {
                  return [
                    `Requests: ${dataPoint.requestCount}`,
                    `Min: ${dataPoint.minDuration}ms`,
                    `Max: ${dataPoint.maxDuration}ms`,
                    `Errors: ${dataPoint.errorCount} (${dataPoint.errorRate}%)`
                  ];
                }
                return [];
              }
            }
          }
        },
        scales: {
          x: {
            type: 'category',
            title: {
              display: true,
              text: 'Time'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Average Duration (ms)'
            }
          }
        }
      }
    });
    
    // Show the chart container
    document.getElementById('performanceHistoryChart').innerHTML = '';
    document.getElementById('performanceHistoryChart').appendChild(canvas);
  }
  
  // Generate performance insights for regression analysis
  generatePerformanceInsights(response) {
    const insights = [];
    const { groupedByEndpoint } = response;
    
    Object.keys(groupedByEndpoint).forEach(endpoint => {
      const records = groupedByEndpoint[endpoint];
      if (records.length < 2) return; // Need at least 2 data points
      
      // Sort chronologically
      records.sort((a, b) => a.timeBucket.localeCompare(b.timeBucket));
      
      // Calculate performance trends
      const first = records[0];
      const last = records[records.length - 1];
      const avgFirst = first.avgDuration;
      const avgLast = last.avgDuration;
      
      const change = avgLast - avgFirst;
      const changePercent = avgFirst > 0 ? ((change / avgFirst) * 100).toFixed(1) : 0;
      
      // Detect spikes (more than 50% increase between consecutive points)
      const spikes = [];
      for (let i = 1; i < records.length; i++) {
        const prev = records[i - 1];
        const curr = records[i];
        const increase = ((curr.avgDuration - prev.avgDuration) / prev.avgDuration) * 100;
        
        if (increase > 50) {
          spikes.push({
            time: curr.timeBucket,
            increase: increase.toFixed(1),
            from: prev.avgDuration,
            to: curr.avgDuration
          });
        }
      }
      
      // Calculate error rate trend
      const avgErrorRate = (records.reduce((sum, r) => sum + parseFloat(r.errorRate), 0) / records.length).toFixed(2);
      
      insights.push({
        endpoint,
        trend: change > 0 ? 'degradation' : 'improvement',
        change,
        changePercent,
        spikes,
        avgErrorRate,
        totalRequests: records.reduce((sum, r) => sum + r.requestCount, 0)
      });
    });
    
    // Render insights
    let html = '<div class="insights-grid">';
    
    insights.forEach(insight => {
      const trendIcon = insight.trend === 'degradation' ? 'fa-arrow-up' : 'fa-arrow-down';
      const trendClass = insight.trend === 'degradation' ? 'trend-bad' : 'trend-good';
      const trendColor = insight.trend === 'degradation' ? '#F44336' : '#4CAF50';
      
      html += `
        <div class="insight-card">
          <h6><code>${insight.endpoint}</code></h6>
          <div class="insight-stats">
            <div class="insight-stat">
              <i class="fas ${trendIcon}" style="color: ${trendColor}"></i>
              <span class="${trendClass}">${Math.abs(insight.changePercent)}% ${insight.trend}</span>
              <small>${Math.abs(insight.change).toFixed(0)}ms ${insight.change > 0 ? 'slower' : 'faster'}</small>
            </div>
            <div class="insight-stat">
              <i class="fas fa-bug"></i>
              <span>Error Rate: ${insight.avgErrorRate}%</span>
            </div>
            <div class="insight-stat">
              <i class="fas fa-network-wired"></i>
              <span>${insight.totalRequests} requests</span>
            </div>
          </div>
          ${insight.spikes.length > 0 ? `
            <div class="insight-spikes">
              <strong><i class="fas fa-exclamation-triangle"></i> Performance Spikes Detected:</strong>
              <ul>
                ${insight.spikes.slice(0, 3).map(spike => `
                  <li>${spike.time}: +${spike.increase}% (${spike.from}ms → ${spike.to}ms)</li>
                `).join('')}
              </ul>
              <p class="hint">Check deployments or PR merges around these times</p>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    html += '</div>';
    
    document.getElementById('insightsContent').innerHTML = html;
    document.getElementById('performanceInsights').style.display = 'block';
  }
  
  // Load waterfall chart data
  async loadWaterfallData() {
    try {
      const filters = this.getActiveFilters();
      
      console.log('🌊 Loading waterfall data with filters:', filters);
      
      const response = await chrome.runtime.sendMessage({
        action: 'getWaterfallData',
        filters,
        limit: 50
      });
      
      console.log('🌊 Waterfall response:', {
        success: response?.success,
        requestsLength: response?.requests?.length,
        error: response?.error
      });
      
      const container = document.getElementById('waterfallChart');
      
      if (!response || !response.success) {
        const errorMsg = response?.error || 'Unknown error';
        console.error('Waterfall data fetch failed:', errorMsg);
        container.innerHTML = `<p class="error-message">Error loading waterfall data: ${errorMsg}</p>`;
        return;
      }
      
      if (!response.requests || response.requests.length === 0) {
        container.innerHTML = '<p class="no-data"><i class="fas fa-info-circle"></i> No requests available for waterfall visualization. Try adjusting filters or wait for requests to be captured.</p>';
        return;
      }
      
      console.log('🌊 Rendering waterfall chart with', response.requests.length, 'requests');
      
      // Render waterfall chart
      this.renderWaterfallChart(response.requests);
      
    } catch (error) {
      console.error('Failed to load waterfall data:', error);
      const container = document.getElementById('waterfallChart');
      if (container) {
        container.innerHTML = `<p class="error-message"><i class="fas fa-exclamation-triangle"></i> Error loading waterfall chart: ${error.message}</p>`;
      }
    }
  }
  
  // Render waterfall chart visualization
  renderWaterfallChart(requests) {
    const container = document.getElementById('waterfallChart');
    
    if (requests.length === 0) {
      container.innerHTML = '<p class="no-data">No requests to display</p>';
      return;
    }
    
    // Find timeline bounds
    const minTime = Math.min(...requests.map(r => r.timestamp));
    const maxTime = Math.max(...requests.map(r => r.timestamp + (r.duration || 0)));
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
          <span>${Math.round(3 * timeRange / 4)}ms</span>
          <span>${Math.round(timeRange)}ms</span>
        </div>
      </div>
      <div class="waterfall-rows">
    `;
    
    requests.forEach((req, index) => {
      const startOffset = ((req.timestamp - minTime) / timeRange) * 100;
      const duration = req.duration || 0;
      const width = Math.max((duration / timeRange) * 100, 0.5);
      
      const statusClass = req.status >= 400 ? 'error' : req.status >= 300 ? 'warning' : 'success';
      
      // Estimate timing phases if not provided
      const phases = req.phases || this.estimateTimingPhases(req);
      const totalPhases = Object.values(phases).reduce((a, b) => a + b, 0) || duration;
      
      html += `
        <div class="waterfall-row" data-index="${index}">
          <div class="waterfall-info">
            <div class="waterfall-label" title="${req.url}">
              <span class="method-badge ${statusClass}">${req.method || 'GET'}</span>
              <span class="status-code status-${statusClass}">${req.status || ''}</span>
              <span class="url-text">${this.truncateUrl(req.url, 35)}</span>
            </div>
          </div>
          <div class="waterfall-timeline">
            <div class="waterfall-bar" style="left: ${startOffset}%; width: ${width}%;" title="${req.url}">
              ${this.renderWaterfallPhases(phases, totalPhases)}
            </div>
            <div class="waterfall-duration">${Math.round(duration)}ms</div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
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
      if (request.url && request.url.startsWith('https')) {
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
      queued: '#cbd5e0',
      dns: '#48bb78',
      tcp: '#4299e1',
      ssl: '#9f7aea',
      waiting: '#ed8936',
      ttfb: '#ed8936',
      download: '#f56565'
    };
    
    const phaseNames = {
      queued: 'Queued',
      dns: 'DNS Lookup',
      tcp: 'TCP Connection',
      ssl: 'SSL/TLS',
      waiting: 'Waiting (TTFB)',
      ttfb: 'Waiting (TTFB)',
      download: 'Content Download'
    };
    
    let html = '';
    let cumulative = 0;
    
    // Order phases logically
    const orderedPhases = ['queued', 'dns', 'tcp', 'ssl', 'waiting', 'ttfb', 'download'];
    
    orderedPhases.forEach(phase => {
      if (phases[phase] && phases[phase] > 0) {
        const time = phases[phase];
        const percent = (time / total) * 100;
        html += `
          <div class="phase-segment ${phase}" 
               style="left: ${cumulative}%; width: ${Math.max(percent, 0.5)}%; background: ${colors[phase] || '#888'};"
               title="${phaseNames[phase] || phase}: ${Math.round(time)}ms">
          </div>
        `;
        cumulative += percent;
      }
    });
    
    // If no segments were rendered, show a simple bar
    if (html === '') {
      html = `<div class="phase-segment default" style="width: 100%; background: ${colors.download};" title="Total: ${Math.round(total)}ms"></div>`;
    }
    
    return html;
  }
  
  // Load resources data
  async loadResourcesData() {
    try {
      const filters = this.getActiveFilters();
      const response = await chrome.runtime.sendMessage({
        action: 'getResourceSizeBreakdown',
        filters
      });
      
      if (!response.success || !response.breakdown || response.breakdown.length === 0) {
        document.getElementById('resourcesTable').innerHTML = '<p class="no-data">No resource data available</p>';
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
      
      response.breakdown.forEach(item => {
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
      
      html += '</tbody></table>';
      document.getElementById('resourcesTable').innerHTML = html;
      
      // Add compression analysis
      this.renderCompressionAnalysis(response.breakdown, response.totalSize);
      
    } catch (error) {
      console.error('Failed to load resources data:', error);
    }
  }
  
  // Render resource pie chart
  renderResourcePieChart(breakdown) {
    const ctx = document.getElementById('resourcePieChart').getContext('2d');
    
    if (this.resourceChart) {
      this.resourceChart.destroy();
    }
    
    const labels = breakdown.map(b => b.type);
    const data = breakdown.map(b => b.totalBytes);
    
    this.resourceChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: [
            '#4CAF50', '#2196F3', '#FF9800', '#F44336',
            '#9C27B0', '#00BCD4', '#FFEB3B', '#795548'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right'
          },
          title: {
            display: true,
            text: 'Resource Size Distribution'
          }
        }
      }
    });
  }
  
  // Render compression analysis
  renderCompressionAnalysis(breakdown, totalSize) {
    const compressibleTypes = ['script', 'stylesheet', 'xmlhttprequest', 'fetch', 'document'];
    const compressibleSize = breakdown
      .filter(b => compressibleTypes.includes(b.type))
      .reduce((sum, b) => sum + b.totalBytes, 0);
    
    const potentialSavings = compressibleSize * 0.7; // Assume 70% compression ratio
    
    const html = `
      <div class="compression-stats-content">
        <div class="stat-item">
          <label>Compressible Resources:</label>
          <span>${this.formatBytes(compressibleSize)}</span>
        </div>
        <div class="stat-item">
          <label>Potential Savings (70% compression):</label>
          <span class="highlight">${this.formatBytes(potentialSavings)}</span>
        </div>
        <div class="stat-item">
          <label>Compression Ratio:</label>
          <span>${((potentialSavings / totalSize) * 100).toFixed(1)}% of total</span>
        </div>
        <p class="hint"><i class="fas fa-info-circle"></i> Enable gzip/brotli compression on your server to reduce transfer size</p>
      </div>
    `;
    
    document.getElementById('compressionStats').innerHTML = html;
  }

  // Load errors data with enhanced categorization
  async loadErrorsData() {
    try {
      const filters = {...this.getActiveFilters()};
      
      // Get 4xx errors
      const filters4xx = {...filters, statusPrefix: '4xx'};
      const response4xx = await chrome.runtime.sendMessage({
        action: 'getDetailedRequests',
        filters: filters4xx,
        limit: 50
      });
      
      // Get 5xx errors
      const filters5xx = {...filters, statusPrefix: '5xx'};
      const response5xx = await chrome.runtime.sendMessage({
        action: 'getDetailedRequests',
        filters: filters5xx,
        limit: 50
      });
      
      const errorsList = document.getElementById('errorsList');
      const errorCategories = document.getElementById('errorCategories');
      
      const errors4xx = response4xx.success ? response4xx.requests : [];
      const errors5xx = response5xx.success ? response5xx.requests : [];
      const totalErrors = errors4xx.length + errors5xx.length;
      
      if (totalErrors === 0) {
        errorsList.innerHTML = '<p class="no-data">No errors found for selected filters</p>';
        errorCategories.innerHTML = '';
        return;
      }
      
      // Render error categories
      let categoriesHtml = `
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
        listHtml += '<h5><i class="fas fa-exclamation-triangle"></i> Client Errors (4xx)</h5>';
        errors4xx.forEach(err => {
          listHtml += this.renderErrorItem(err, 'client');
        });
      }
      
      if (errors5xx.length > 0) {
        listHtml += '<h5><i class="fas fa-times-circle"></i> Server Errors (5xx)</h5>';
        errors5xx.forEach(err => {
          listHtml += this.renderErrorItem(err, 'server');
        });
      }
      
      listHtml += '</div>';
      errorsList.innerHTML = listHtml;
      
      // Store error requests for action handlers
      this.currentErrors = [...errors4xx, ...errors5xx];
      
      // Add event delegation for error actions
      if (!errorsList.dataset.listenerAdded) {
        errorsList.dataset.listenerAdded = 'true';
        errorsList.addEventListener('click', (e) => {
          const detailsBtn = e.target.closest('.btn-error-details');
          if (detailsBtn) {
            const requestId = detailsBtn.dataset.requestId;
            const request = this.currentErrors.find(r => r.id === requestId);
            if (request) {
              this.viewRequestDetails(requestId);
            }
            return;
          }
          
          const curlBtn = e.target.closest('.btn-error-curl');
          if (curlBtn) {
            const requestId = curlBtn.dataset.requestId;
            const request = this.currentErrors.find(r => r.id === requestId);
            if (request) {
              this.copyAsCurl(request);
            }
            return;
          }
        });
      }
      
      // Render error distribution chart
      this.renderErrorChart(errors4xx, errors5xx);
      
    } catch (error) {
      console.error('Failed to load errors data:', error);
    }
  }
  
  renderErrorItem(err, type) {
    const typeClass = type === 'client' ? 'error-client' : 'error-server';
    const domain = err.domain || 'N/A';
    const pageUrl = err.page_url || 'N/A';
    
    // Extract path from page URL for display
    let pageDisplay = pageUrl;
    if (pageUrl !== 'N/A') {
      try {
        const url = new URL(pageUrl);
        pageDisplay = url.pathname + url.search || '/';
      } catch (e) {
        pageDisplay = pageUrl;
      }
    }
    
    return `
      <div class="error-item ${typeClass}">
        <div class="error-header">
          <span class="status-badge status-error">${err.status}</span>
          <span class="error-url" title="${err.url}">${this.truncateUrl(err.url, 60)}</span>
          <span class="error-time">${new Date(err.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="error-details">
          <span><i class="fas fa-code"></i> ${err.method || 'GET'}</span>
          <span><i class="fas fa-tag"></i> ${err.type || 'unknown'}</span>
          <span><i class="fas fa-globe"></i> ${domain}</span>
          <span title="${pageUrl}"><i class="fas fa-file"></i> ${this.truncateUrl(pageDisplay, 30)}</span>
          ${err.error ? `<span class="error-message"><i class="fas fa-info-circle"></i> ${err.error}</span>` : ''}
        </div>
        <div class="error-actions">
          <button class="btn-icon btn-error-details" data-request-id="${err.id}" title="View details">
            <i class="fas fa-info-circle"></i>
          </button>
          <button class="btn-icon btn-error-curl" data-request-id="${err.id}" title="Copy as cURL">
            <i class="fas fa-terminal"></i>
          </button>
        </div>
      </div>
    `;
  }
  
  renderErrorChart(errors4xx, errors5xx) {
    const ctx = document.getElementById('errorsChart').getContext('2d');
    
    if (this.errorChart) {
      this.errorChart.destroy();
    }
    
    // Group by status code
    const statusCounts = {};
    [...errors4xx, ...errors5xx].forEach(err => {
      statusCounts[err.status] = (statusCounts[err.status] || 0) + 1;
    });
    
    const labels = Object.keys(statusCounts).sort();
    const data = labels.map(status => statusCounts[status]);
    
    this.errorChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Error Count',
          data,
          backgroundColor: labels.map(s => parseInt(s) >= 500 ? '#F44336' : '#FF9800')
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Errors by Status Code'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count'
            }
          }
        }
      }
    });
  }

  // Search requests
  searchRequests(query) {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) {
      console.warn('requestsTableBody not found');
      return;
    }
    
    const rows = tbody.querySelectorAll('tr');
    const searchLower = query.toLowerCase().trim();
    
    console.log(`Searching for: "${query}" in ${rows.length} rows`);
    
    let matchCount = 0;
    let totalDataRows = 0;
    
    // Filter rows based on search query
    rows.forEach(row => {
      // Skip no-data-row
      if (row.classList.contains('no-data-row')) {
        return;
      }
      
      totalDataRows++;
      
      if (!searchLower) {
        // Show all rows if search is empty
        row.style.display = '';
        matchCount++;
        return;
      }
      
      const cells = row.querySelectorAll('td');
      let found = false;
      
      cells.forEach(cell => {
        const text = cell.textContent.toLowerCase();
        if (text.includes(searchLower)) {
          found = true;
        }
      });
      
      row.style.display = found ? '' : 'none';
      if (found) matchCount++;
    });
    
    console.log(`Search: "${query}" - ${matchCount} matches out of ${totalDataRows} total rows`);
  }

  // Get active filters
  getActiveFilters() {
    const pageFilter = document.getElementById("pageFilter");
    const timeRange = document.getElementById("timeRange");
    const requestTypeFilter = document.getElementById("requestTypeFilter");
    const statusFilter = document.getElementById("statusFilter");
    
    const filters = { 
      timeRange: timeRange ? parseInt(timeRange.value) : this.DEFAULT_TIME_RANGE 
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
        const path = url.pathname + url.search || '/';
        activeFilters.push(`Page: ${path}`);
      } catch (e) {
        activeFilters.push(`Page: ${filters.pageUrl}`);
      }
    } else if (filters.domain) {
      activeFilters.push(`Page: All (Aggregated)`);
    }
    if (filters.type) activeFilters.push(`Type: ${filters.type}`);
    if (filters.statusPrefix) activeFilters.push(`Status: ${filters.statusPrefix}`);
    
    if (activeFilters.length > 0) {
      list.innerHTML = activeFilters.map(f => `<span class="filter-tag">${f}</span>`).join('');
      container.style.display = 'flex';
    } else {
      container.style.display = 'none';
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
    const noDataEl = document.getElementById('noDataState');
    const contentEl = document.querySelector('.content-tabs');
    
    if (show) {
      noDataEl.style.display = 'flex';
      contentEl.style.display = 'none';
    } else {
      noDataEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }
  
  // Time Travel Modal methods
  openTimeTravelModal() {
    const modal = document.getElementById('timeTravelModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }
  
  closeTimeTravelModal() {
    const modal = document.getElementById('timeTravelModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  async loadHistoricalData() {
    try {
      const filters = this.getActiveFilters();
      const groupBy = document.getElementById('timeTravelGroupBy').value;
      
      const response = await chrome.runtime.sendMessage({
        action: 'getHistoricalData',
        filters,
        groupBy
      });
      
      if (!response.success || !response.data || response.data.length === 0) {
        // Show inline message instead of alert
        const container = document.getElementById('historicalChartContainer');
        container.innerHTML = '<p class="info-message"><i class="fas fa-info-circle"></i> No historical data available for the selected filters and time range</p>';
        return;
      }
      
      // Create historical chart
      this.renderHistoricalChart(response.data);
      
    } catch (error) {
      console.error('Failed to load historical data:', error);
      const container = document.getElementById('historicalChartContainer');
      container.innerHTML = '<p class="error-message"><i class="fas fa-exclamation-circle"></i> Error loading historical data. Please try again.</p>';
    }
  }
  
  renderHistoricalChart(data) {
    const ctx = document.getElementById('historicalChart').getContext('2d');
    
    // Destroy existing chart if any
    if (this.historicalChart) {
      this.historicalChart.destroy();
    }
    
    const labels = data.map(d => d.timeBucket);
    const requestCounts = data.map(d => d.requestCount);
    const avgDurations = data.map(d => d.avgDuration);
    const errorCounts = data.map(d => d.errorCount);
    
    this.historicalChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Request Count',
            data: requestCounts,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            yAxisID: 'y',
            tension: 0.4
          },
          {
            label: 'Avg Duration (ms)',
            data: avgDurations,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            yAxisID: 'y1',
            tension: 0.4
          },
          {
            label: 'Errors',
            data: errorCounts,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: 'Historical Performance Data'
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Request Count / Errors'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Avg Duration (ms)'
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        }
      }
    });
  }
  
  // HAR Export functions
  async copyAsHAR() {
    try {
      const har = await this.generateHAR();
      await navigator.clipboard.writeText(JSON.stringify(har, null, 2));
      
      this.showToast('HAR data copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy HAR:', error);
      this.showToast('Failed to copy HAR data', 'error');
    }
  }
  
  async exportAsHAR() {
    try {
      const har = await this.generateHAR();
      const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `network-export-${Date.now()}.har`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showToast('HAR file exported', 'success');
    } catch (error) {
      console.error('Failed to export HAR:', error);
      this.showToast('Failed to export HAR file', 'error');
    }
  }
  
  async generateHAR() {
    const filters = this.getActiveFilters();
    const response = await chrome.runtime.sendMessage({
      action: 'getDetailedRequests',
      filters,
      limit: 1000
    });
    
    if (!response.success || !response.requests) {
      throw new Error('No requests available');
    }
    
    // Generate HAR format
    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'Universal Request Analyzer',
          version: '1.0.0'
        },
        entries: response.requests.map(req => ({
          startedDateTime: new Date(req.timestamp).toISOString(),
          time: req.duration || 0,
          request: {
            method: req.method || 'GET',
            url: req.url,
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1
          },
          response: {
            status: req.status || 0,
            statusText: req.status_text || '',
            httpVersion: 'HTTP/1.1',
            headers: [],
            cookies: [],
            content: {
              size: req.size_bytes || 0,
              mimeType: req.type || 'application/octet-stream'
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: req.size_bytes || 0
          },
          cache: {
            beforeRequest: req.from_cache ? { lastAccess: '', eTag: '', hitCount: 1 } : null
          },
          timings: {
            blocked: -1,
            dns: -1,
            connect: -1,
            send: 0,
            wait: req.duration || 0,
            receive: 0,
            ssl: -1
          }
        }))
      }
    };
    
    return har;
  }
  
  // Performance budgets checking
  async checkPerformanceBudgets() {
    const budgetResponseTime = parseInt(document.getElementById('budgetResponseTime')?.value || 1000);
    const budgetTotalSize = parseFloat(document.getElementById('budgetTotalSize')?.value || 5) * 1024 * 1024; // Convert to bytes
    const budgetRequestCount = parseInt(document.getElementById('budgetRequestCount')?.value || 100);
    
    const filters = this.getActiveFilters();
    const response = await chrome.runtime.sendMessage({
      action: 'getFilteredStats',
      filters
    });
    
    if (!response.success) return;
    
    // Check response time budget
    const avgResponse = response.responseTimes && response.responseTimes.length > 0
      ? response.responseTimes.reduce((a, b) => a + b, 0) / response.responseTimes.length
      : 0;
    const responseStatus = document.getElementById('budgetResponseStatus');
    if (responseStatus) {
      if (avgResponse <= budgetResponseTime) {
        responseStatus.innerHTML = '<i class="fas fa-check-circle"></i> Within budget';
        responseStatus.className = 'budget-status success';
      } else {
        responseStatus.innerHTML = '<i class="fas fa-times-circle"></i> Over budget';
        responseStatus.className = 'budget-status error';
      }
    }
    
    // Check request count budget
    const countStatus = document.getElementById('budgetCountStatus');
    if (countStatus) {
      if (response.totalRequests <= budgetRequestCount) {
        countStatus.innerHTML = '<i class="fas fa-check-circle"></i> Within budget';
        countStatus.className = 'budget-status success';
      } else {
        countStatus.innerHTML = '<i class="fas fa-times-circle"></i> Over budget';
        countStatus.className = 'budget-status error';
      }
    }
    
    // Check size budget (fetch actual resource size data)
    const sizeResponse = await chrome.runtime.sendMessage({
      action: 'getResourceSizeBreakdown',
      filters
    });
    
    const sizeStatus = document.getElementById('budgetSizeStatus');
    if (sizeStatus && sizeResponse.success) {
      const totalSizeMB = (sizeResponse.totalSize || 0) / (1024 * 1024);
      const budgetSizeMB = parseFloat(document.getElementById('budgetTotalSize')?.value || 5);
      
      if (totalSizeMB <= budgetSizeMB) {
        sizeStatus.innerHTML = '<i class="fas fa-check-circle"></i> Within budget';
        sizeStatus.className = 'budget-status success';
      } else {
        sizeStatus.innerHTML = '<i class="fas fa-times-circle"></i> Over budget';
        sizeStatus.className = 'budget-status error';
      }
    }
  }
  
  // Show toast notification
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: ' + 
      (type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3') + 
      '; color: white; padding: 12px 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
  
  // Request Comparison features
  openComparisonModal() {
    const modal = document.getElementById('comparisonModal');
    if (modal) {
      modal.style.display = 'flex';
      this.loadComparisonData();
    }
  }
  
  closeComparisonModal() {
    const modal = document.getElementById('comparisonModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  async loadComparisonData() {
    const filters = this.getActiveFilters();
    const response = await chrome.runtime.sendMessage({
      action: 'getDetailedRequests',
      filters,
      limit: 10
    });
    
    if (!response.success || !response.requests || response.requests.length < 2) {
      document.getElementById('comparisonContent').innerHTML = 
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
          <li><strong>Duration:</strong> ${this.formatDiff(req1.duration, req2.duration, 'ms')}</li>
          <li><strong>Size:</strong> ${this.formatDiff(req1.size_bytes, req2.size_bytes, 'bytes')}</li>
          <li><strong>Status:</strong> ${req1.status} vs ${req2.status}</li>
        </ul>
      </div>
    `;
    
    document.getElementById('comparisonContent').innerHTML = html;
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
          <span class="method-badge">${req.method || 'GET'}</span>
        </div>
        <div class="detail-row">
          <label>Status:</label>
          <span class="status-badge ${req.status >= 400 ? 'status-error' : 'status-success'}">${req.status}</span>
        </div>
        <div class="detail-row">
          <label>Type:</label>
          <span>${req.type || 'N/A'}</span>
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
          <span>${req.from_cache ? 'Yes' : 'No'}</span>
        </div>
      </div>
    `;
  }
  
  formatDiff(val1, val2, unit) {
    const diff = (val1 || 0) - (val2 || 0);
    const sign = diff > 0 ? '+' : '';
    const color = diff > 0 ? 'red' : diff < 0 ? 'green' : 'gray';
    return `<span style="color: ${color}">${sign}${diff} ${unit}</span>`;
  }
  
  // Live Stream features
  toggleCapture() {
    this.capturePaused = !this.capturePaused;
    const btn = document.getElementById('pauseCapture');
    if (btn) {
      if (this.capturePaused) {
        btn.innerHTML = '<i class="fas fa-play"></i> Resume';
        this.showToast('Request capture paused', 'info');
      } else {
        btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        this.showToast('Request capture resumed', 'success');
      }
    }
  }
  
  closeLiveStreamModal() {
    const modal = document.getElementById('liveStreamModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  toggleStreamPause() {
    this.streamPaused = !this.streamPaused;
    const btn = document.getElementById('pauseStream');
    if (btn) {
      btn.innerHTML = this.streamPaused ? 
        '<i class="fas fa-play"></i> Resume' : 
        '<i class="fas fa-pause"></i> Pause';
    }
  }
  
  clearStream() {
    this.streamData = [];
    const content = document.getElementById('liveStreamContent');
    if (content) {
      content.innerHTML = '<p class="info-message">Stream cleared. New requests will appear here.</p>';
    }
  }
  
  addToStream(request) {
    if (this.streamPaused) return;
    
    this.streamData.push(request);
    if (this.streamData.length > 100) {
      this.streamData.shift(); // Keep last 100
    }
    
    const content = document.getElementById('liveStreamContent');
    if (!content) return;
    
    const highlightCriteria = document.getElementById('highlightCriteria')?.value;
    let shouldHighlight = false;
    
    if (highlightCriteria === 'errors' && request.status >= 400) {
      shouldHighlight = true;
    } else if (highlightCriteria === 'slow' && request.duration > 1000) {
      shouldHighlight = true;
    } else if (highlightCriteria === 'large' && request.size_bytes > 1024 * 1024) {
      shouldHighlight = true;
    }
    
    const item = document.createElement('div');
    item.className = `stream-item ${shouldHighlight ? 'highlight' : ''}`;
    item.innerHTML = `
      <span class="stream-time">${new Date(request.timestamp).toLocaleTimeString()}</span>
      <span class="method-badge">${request.method || 'GET'}</span>
      <span class="status-badge ${request.status >= 400 ? 'status-error' : 'status-success'}">${request.status}</span>
      <span class="stream-url" title="${request.url}">${this.truncateUrl(request.url, 60)}</span>
      <span class="stream-duration">${request.duration || 0}ms</span>
    `;
    
    content.appendChild(item);
    
    const autoScroll = document.getElementById('autoScroll')?.checked;
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
    Object.values(this.charts).forEach(chart => {
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
    const clearBtn = document.getElementById('clearWebSocketBtn');
    const pauseBtn = document.getElementById('pauseWebSocketBtn');
    
    if (clearBtn) {
      // Remove existing listener if any
      clearBtn.replaceWith(clearBtn.cloneNode(true));
      document.getElementById('clearWebSocketBtn').addEventListener('click', () => this.clearWebSocket());
    }
    if (pauseBtn) {
      // Remove existing listener if any
      pauseBtn.replaceWith(pauseBtn.cloneNode(true));
      document.getElementById('pauseWebSocketBtn').addEventListener('click', () => this.toggleWebSocketPause());
    }
    
    // Display message that WebSocket tracking is active
    this.updateWebSocketDisplay();
  }
  
  toggleWebSocketPause() {
    this.websocketPaused = !this.websocketPaused;
    const btn = document.getElementById('pauseWebSocketBtn');
    if (btn) {
      btn.innerHTML = this.websocketPaused ? 
        '<i class="fas fa-play"></i> Resume' : 
        '<i class="fas fa-pause"></i> Pause';
    }
  }
  
  clearWebSocket() {
    this.websocketMessages = [];
    this.updateWebSocketDisplay();
  }
  
  updateWebSocketDisplay() {
    const container = document.getElementById('websocketMessages');
    if (!container) return;
    
    if (this.websocketMessages.length === 0) {
      container.innerHTML = '<p class="placeholder">No WebSocket activity detected. WebSocket connections will appear here when they occur.</p>';
      return;
    }
    
    let html = '<div class="websocket-list">';
    
    this.websocketMessages.slice(-100).reverse().forEach((msg, idx) => {
      const direction = msg.direction === 'sent' ? 'outgoing' : 'incoming';
      html += `
        <div class="websocket-message ${direction}">
          <div class="ws-header">
            <span class="ws-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
            <span class="ws-direction">${msg.direction === 'sent' ? '→' : '←'} ${msg.direction.toUpperCase()}</span>
            <span class="ws-size">${this.formatBytes(msg.size || 0)}</span>
          </div>
          <div class="ws-connection">${msg.url || 'Unknown connection'}</div>
          <div class="ws-data">${this.truncateText(msg.data || '', 200)}</div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Update stats
    const sentCount = this.websocketMessages.filter(m => m.direction === 'sent').length;
    const receivedCount = this.websocketMessages.filter(m => m.direction === 'received').length;
    const connections = new Set(this.websocketMessages.map(m => m.url)).size;
    
    document.getElementById('wsConnectionCount').textContent = connections;
    document.getElementById('wsSentCount').textContent = sentCount;
    document.getElementById('wsReceivedCount').textContent = receivedCount;
  }
  
  // Real-time Feed Methods
  startRealtimeFeed() {
    this.realtimeMessages = this.realtimeMessages || [];
    this.realtimePaused = false;
    
    // Setup event listeners
    const clearBtn = document.getElementById('clearRealtimeBtn');
    const pauseBtn = document.getElementById('pauseRealtimeBtn');
    
    if (clearBtn) {
      // Remove existing listener if any
      clearBtn.replaceWith(clearBtn.cloneNode(true));
      document.getElementById('clearRealtimeBtn').addEventListener('click', () => this.clearRealtimeFeed());
    }
    if (pauseBtn) {
      // Remove existing listener if any
      pauseBtn.replaceWith(pauseBtn.cloneNode(true));
      document.getElementById('pauseRealtimeBtn').addEventListener('click', () => this.toggleRealtimePause());
    }
    
    // Start polling for new requests
    if (!this.realtimeInterval) {
      this.realtimeInterval = setInterval(() => this.pollRealtimeRequests(), 1000);
    }
    
    this.updateRealtimeDisplay();
  }
  
  async pollRealtimeRequests() {
    if (this.realtimePaused) return;
    
    try {
      const filters = {
        ...this.getActiveFilters(),
        timeRange: 5 // Last 5 seconds
      };
      
      const response = await chrome.runtime.sendMessage({
        action: 'getDetailedRequests',
        filters,
        limit: 10
      });
      
      if (response && response.success && response.requests) {
        response.requests.forEach(req => {
          // Only add if not already in feed
          if (!this.realtimeMessages.find(m => m.id === req.id)) {
            this.addRealtimeRequest(req);
          }
        });
      }
    } catch (error) {
      console.error('Failed to poll realtime requests:', error);
    }
  }
  
  toggleRealtimePause() {
    this.realtimePaused = !this.realtimePaused;
    const btn = document.getElementById('pauseRealtimeBtn');
    if (btn) {
      btn.innerHTML = this.realtimePaused ? 
        '<i class="fas fa-play"></i> Resume' : 
        '<i class="fas fa-pause"></i> Pause';
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
  
  updateRealtimeDisplay() {
    const container = document.getElementById('realtimeFeed');
    if (!container) return;
    
    if (this.realtimeMessages.length === 0) {
      container.innerHTML = '<p class="placeholder">Waiting for requests...</p>';
      return;
    }
    
    let html = '<div class="realtime-list">';
    
    this.realtimeMessages.slice(-50).reverse().forEach(req => {
      const statusClass = req.status >= 400 ? 'error' : req.status >= 300 ? 'warning' : 'success';
      const errorClass = req.status >= 400 ? 'realtime-error' : '';
      
      html += `
        <div class="realtime-item ${errorClass}">
          <div class="realtime-time">${new Date(req.timestamp).toLocaleTimeString()}.${new Date(req.timestamp).getMilliseconds()}</div>
          <span class="method-badge">${req.method || 'GET'}</span>
          <span class="status-badge status-${statusClass}">${req.status || 'N/A'}</span>
          <span class="realtime-url" title="${req.url}">${this.truncateUrl(req.url, 70)}</span>
          <span class="realtime-duration">${req.duration || 0}ms</span>
          <div class="realtime-timing-bar" style="width: ${Math.min((req.duration || 0) / 10, 100)}%"></div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Auto-scroll if enabled
    const autoScrollCheckbox = document.getElementById('autoScrollCheckbox');
    if (autoScrollCheckbox && autoScrollCheckbox.checked) {
      container.scrollTop = 0; // Scroll to top since we reverse the list
    }
  }
  
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}

// Initialize panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing DevTools Panel...');
  
  const panel = new DevToolsPanel();
  
  // Listen for tab URL changes
  chrome.devtools.network.onNavigated.addListener((url) => {
    panel.handleUrlChange(url);
  });
  
  // Get current URL
  chrome.devtools.inspectedWindow.eval(
    'window.location.href',
    (result, isException) => {
      if (!isException && result) {
        panel.handleUrlChange(result);
      }
    }
  );
  
  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    panel.destroy();
  });
  
  console.log('✓ DevTools Panel initialized');
});
