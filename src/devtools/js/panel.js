import Chart from "../../lib/chart.min.js";

export class DevToolsPanel {
  constructor() {
    this.charts = {};
    this.currentUrl = "";
    this.refreshInterval = null;
    
    // Constants
    this.SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
    this.MAX_CHART_POINTS = 20;
    this.ERROR_STATUS_PREFIX = '4xx';
    
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
        <!-- Enhanced Filters Panel -->
        <div class="filters-header">
          <div class="filter-group">
            <label><i class="fas fa-globe"></i> Domain:</label>
            <select id="domainFilter" class="filter-select">
              <option value="current">Current Page Domain</option>
              <option value="all">All Domains</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label><i class="fas fa-file"></i> Page:</label>
            <select id="pageFilter" class="filter-select">
              <option value="">All Pages (Aggregated)</option>
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
              <option value="2592000">Last 30 days</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label><i class="fas fa-history"></i> Time Travel:</label>
            <button id="timeTravelBtn" class="btn-secondary btn-sm" title="View historical data">
              <i class="fas fa-calendar-alt"></i> History
            </button>
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
          </div>
        </div>
        
        <!-- Time Travel Modal -->
        <div id="timeTravelModal" class="modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3><i class="fas fa-history"></i> Time Travel - Historical Data</h3>
              <button id="closeTimeTravelModal" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <div class="time-travel-controls">
                <div class="control-group">
                  <label>Group By:</label>
                  <select id="timeTravelGroupBy" class="filter-select">
                    <option value="hour">Hourly</option>
                    <option value="day">Daily</option>
                    <option value="minute">By Minute</option>
                  </select>
                </div>
                <button id="loadHistoricalData" class="btn-primary">
                  <i class="fas fa-chart-line"></i> Load Historical Data
                </button>
              </div>
              <div id="historicalChartContainer" style="margin-top: 20px;">
                <canvas id="historicalChart"></canvas>
              </div>
            </div>
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
            <button data-tab="performance" class="tab-btn">
              <i class="fas fa-stopwatch"></i> Performance
            </button>
            <button data-tab="endpoints" class="tab-btn">
              <i class="fas fa-network-wired"></i> Endpoints
            </button>
            <button data-tab="errors" class="tab-btn">
              <i class="fas fa-bug"></i> Errors
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
              <input type="text" id="searchRequests" placeholder="Search URLs, methods, status..." class="search-input">
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
          
          <!-- Performance Tab -->
          <div id="performanceTab" class="tab-content">
            <div class="performance-breakdown">
              <h4><i class="fas fa-stopwatch"></i> Timing Breakdown</h4>
              <div id="timingBreakdown" class="timing-chart"></div>
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
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Filter controls
    document.getElementById("domainFilter").addEventListener("change", () => {
      this.onDomainFilterChange();
    });
    document.getElementById("pageFilter").addEventListener("change", () => this.applyFilters());
    document.getElementById("timeRange").addEventListener("change", () => this.applyFilters());
    document.getElementById("requestTypeFilter").addEventListener("change", () => this.applyFilters());
    document.getElementById("statusFilter").addEventListener("change", () => this.applyFilters());
    
    // Action buttons
    document.getElementById("refreshMetrics").addEventListener("click", () => this.refreshMetrics());
    document.getElementById("clearFilters").addEventListener("click", () => this.clearFilters());
    document.getElementById("exportMetrics").addEventListener("click", () => this.exportMetrics());
    document.getElementById("resetFiltersBtn")?.addEventListener("click", () => this.clearFilters());
    
    // Time Travel feature
    document.getElementById("timeTravelBtn")?.addEventListener("click", () => this.openTimeTravelModal());
    document.getElementById("closeTimeTravelModal")?.addEventListener("click", () => this.closeTimeTravelModal());
    document.getElementById("loadHistoricalData")?.addEventListener("click", () => this.loadHistoricalData());
    
    // Tab navigation
    document.querySelectorAll(".tab-btn").forEach((button) => {
      button.addEventListener("click", () => this.switchTab(button.dataset.tab));
    });
    
    // Search
    document.getElementById("searchRequests")?.addEventListener("input", (e) => {
      this.searchRequests(e.target.value);
    });
    
    // Load domains and current page
    this.loadDomainFilter();
  }

  initializeCharts() {
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
            borderColor: "rgb(33, 150, 243)",
            backgroundColor: "rgba(33, 150, 243, 0.1)",
            tension: 0.4,
            fill: true,
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
              "rgba(76, 175, 80, 0.7)",   // 2xx - green
              "rgba(33, 150, 243, 0.7)",   // 3xx - blue
              "rgba(255, 152, 0, 0.7)",    // 4xx - orange
              "rgba(244, 67, 54, 0.7)",    // 5xx - red
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
            backgroundColor: [
              "rgba(76, 175, 80, 0.6)",
              "rgba(33, 150, 243, 0.6)",
              "rgba(255, 152, 0, 0.6)",
              "rgba(156, 39, 176, 0.6)",
              "rgba(244, 67, 54, 0.6)",
              "rgba(0, 188, 212, 0.6)",
              "rgba(255, 235, 59, 0.6)",
              "rgba(96, 125, 139, 0.6)",
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
            borderColor: "rgb(76, 175, 80)",
            backgroundColor: "rgba(76, 175, 80, 0.2)",
            tension: 0.4,
            fill: true,
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
            backgroundColor: "rgba(244, 67, 54, 0.6)",
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

          if (response && response.success) {
            // Check if there's data
            if (!response.totalRequests || response.totalRequests === 0) {
              this.showNoDataState(true);
            } else {
              this.showNoDataState(false);
              this.updateMetrics(response);
            }
          } else {
            console.error("Failed to get metrics:", response?.error);
            this.showNoDataState(true);
          }
        }
      );
    } catch (error) {
      console.error("Error collecting metrics:", error);
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
    chrome.runtime.sendMessage(
      {
        action: "exportFilteredData",
        filters: {
          pageUrl: this.currentUrl,
          timeRange: parseInt(document.getElementById("timeRange").value),
        },
        format: "json",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Export error:", chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          console.log("Metrics exported successfully");
        } else {
          console.error("Export failed:", response?.error);
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
  async loadDomainFilter() {
    try {
      const domainSelect = document.getElementById("domainFilter");
      
      // Get current URL
      chrome.devtools.inspectedWindow.eval(
        'window.location.href',
        async (url, isException) => {
          if (!isException && url) {
            const currentDomain = new URL(url).hostname;
            this.currentUrl = url;
            this.currentDomain = currentDomain;
            
            // Update current domain option
            domainSelect.innerHTML = `
              <option value="current">Current Domain (${currentDomain})</option>
              <option value="all">All Domains</option>
            `;
            
            // Load all domains from database
            const response = await chrome.runtime.sendMessage({
              action: 'getDomains',
              timeRange: 604800  // Last 7 days
            });
            
            console.log('Panel domain filter response:', response);
            
            if (response && response.success && response.domains && response.domains.length > 0) {
              response.domains.forEach(domainObj => {
                const domain = domainObj.domain;
                if (domain && domain !== currentDomain) {
                  const option = document.createElement('option');
                  option.value = domain;
                  option.textContent = `${domain} (${domainObj.requestCount} requests)`;
                  domainSelect.appendChild(option);
                }
              });
              console.log(`Loaded ${response.domains.length} domains for panel filter`);
            } else {
              console.warn('No domains found in database for panel');
            }
            
            // Load pages for current domain initially
            await this.loadPageFilter(currentDomain);
          }
        }
      );
    } catch (error) {
      console.error('Failed to load domain filter:', error);
    }
  }

  // Handle domain filter change - reload pages
  async onDomainFilterChange() {
    const domainSelect = document.getElementById("domainFilter");
    const selectedValue = domainSelect.value;
    
    let domain = null;
    if (selectedValue === "current") {
      domain = this.currentDomain;
    } else if (selectedValue !== "all") {
      domain = selectedValue;
    }
    
    // Load pages for selected domain
    if (domain && domain !== "all") {
      await this.loadPageFilter(domain);
    } else {
      // Clear page filter for "all domains"
      const pageSelect = document.getElementById("pageFilter");
      pageSelect.innerHTML = '<option value="">All Pages (Aggregated)</option>';
      pageSelect.disabled = true;
    }
    
    // Apply filters after domain change
    this.applyFilters();
  }

  // Load pages for a specific domain
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
    document.getElementById("domainFilter").value = "current";
    document.getElementById("pageFilter").value = "";
    document.getElementById("timeRange").value = "300";
    document.getElementById("requestTypeFilter").value = "";
    document.getElementById("statusFilter").value = "";
    document.getElementById("searchRequests").value = "";
    this.onDomainFilterChange(); // Reload pages for current domain
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
      case 'performance':
        await this.loadPerformanceData();
        break;
      case 'endpoints':
        await this.loadEndpointsData();
        break;
      case 'errors':
        await this.loadErrorsData();
        break;
    }
  }

  // Load requests table
  async loadRequestsTable() {
    try {
      const filters = this.getActiveFilters();
      const response = await chrome.runtime.sendMessage({
        action: 'getDetailedRequests',
        filters,
        limit: 100,
        offset: 0
      });
      
      const tbody = document.getElementById('requestsTableBody');
      
      if (!response.success || !response.requests || response.requests.length === 0) {
        tbody.innerHTML = '<tr class="no-data-row"><td colspan="7">No requests available for selected filters</td></tr>';
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
              <button class="btn-icon" onclick="window.panelInstance.viewRequestDetails('${req.id}')" title="View details">
                <i class="fas fa-info-circle"></i>
              </button>
              ${errorIcon}
            </td>
          </tr>
        `;
      });
      
      tbody.innerHTML = rows;
      
      // Store panel instance for onclick handlers
      window.panelInstance = this;
      
    } catch (error) {
      console.error('Failed to load requests table:', error);
      document.getElementById('requestsTableBody').innerHTML = 
        '<tr class="no-data-row"><td colspan="7">Error loading requests</td></tr>';
    }
  }
  
  // View request details
  viewRequestDetails(requestId) {
    console.log('View details for request:', requestId);
    // TODO: Show modal with full request details including headers, body, timing breakdown
    alert(`Request details for ${requestId} - Full implementation coming soon`);
  }
  
  // Helper to truncate URLs
  truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    const parts = url.split('?');
    const base = parts[0];
    if (base.length > maxLength) {
      return base.substring(0, maxLength - 3) + '...';
    }
    return base + '?' + parts[1].substring(0, maxLength - base.length - 4) + '...';
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
    // TODO: Implement API endpoint analysis feature
    // This will group requests by endpoint pattern (e.g., /api/users/:id)
    // and show call frequency, average response time, and error rates per endpoint
    // GitHub Issue: TBD
    document.getElementById('endpointsTable').innerHTML = `
      <p class="info-message">
        <i class="fas fa-info-circle"></i> 
        API endpoints analysis will group and analyze requests by endpoint pattern.
      </p>
    `;
  }

  // Load errors data
  async loadErrorsData() {
    try {
      const filters = {...this.getActiveFilters(), statusPrefix: this.ERROR_STATUS_PREFIX};
      const response = await chrome.runtime.sendMessage({
        action: 'getFilteredStats',
        filters
      });
      
      const errorsList = document.getElementById('errorsList');
      
      if (!response.success || response.totalRequests === 0) {
        errorsList.innerHTML = '<p class="no-data">No errors found for selected filters</p>';
        return;
      }
      
      errorsList.innerHTML = `
        <div class="errors-summary">
          <p><i class="fas fa-exclamation-triangle"></i> Found ${response.totalRequests} failed requests</p>
          <p class="hint">Detailed error information will be displayed here</p>
        </div>
      `;
    } catch (error) {
      console.error('Failed to load errors data:', error);
    }
  }

  // Search requests
  searchRequests(query) {
    // Implement search filtering
    console.log('Searching for:', query);
  }

  // Get active filters
  getActiveFilters() {
    const domainFilter = document.getElementById("domainFilter").value;
    const pageFilter = document.getElementById("pageFilter").value;
    const timeRange = parseInt(document.getElementById("timeRange").value);
    const requestType = document.getElementById("requestTypeFilter").value;
    const status = document.getElementById("statusFilter").value;
    
    const filters = { timeRange };
    
    // Determine domain to filter by
    let domain = null;
    if (domainFilter === "current") {
      domain = this.currentDomain;
    } else if (domainFilter !== "all") {
      domain = domainFilter;
    }
    
    // Add domain filter
    if (domain && domain !== "all") {
      filters.domain = domain;
    }
    
    // Add page filter (if specific page selected)
    if (pageFilter && pageFilter !== "") {
      filters.pageUrl = pageFilter;
    }
    
    if (requestType) filters.type = requestType;
    if (status) filters.statusPrefix = status;
    
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
        alert('No historical data available for the selected filters and time range');
        return;
      }
      
      // Create historical chart
      this.renderHistoricalChart(response.data);
      
    } catch (error) {
      console.error('Failed to load historical data:', error);
      alert('Error loading historical data');
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
