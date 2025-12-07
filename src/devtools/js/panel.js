import Chart from "../../lib/chart.min.js";

export class DevToolsPanel {
  constructor() {
    this.charts = {};
    this.currentUrl = "";
    this.refreshInterval = null;
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
        <div class="url-info">
          <i class="fas fa-globe"></i>
          <span>Current URL: </span>
          <span id="currentUrl">Loading...</span>
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
        </div>
        
        <div class="controls">
          <button id="refreshMetrics">
            <i class="fas fa-sync-alt"></i>
            Refresh
          </button>
          <select id="timeRange">
            <option value="300">Last 5 minutes</option>
            <option value="900">Last 15 minutes</option>
            <option value="1800">Last 30 minutes</option>
            <option value="3600">Last hour</option>
            <option value="86400">Last 24 hours</option>
          </select>
          <button id="exportMetrics">
            <i class="fas fa-download"></i>
            Export
          </button>
        </div>

        <div class="charts-container">
          <div class="charts-tabs">
            <button data-chart="performance" class="active">
              <i class="fas fa-chart-line"></i> Performance
            </button>
            <button data-chart="requests">
              <i class="fas fa-chart-bar"></i> Requests
            </button>
            <button data-chart="errors">
              <i class="fas fa-chart-pie"></i> Status
            </button>
            <button data-chart="timeline">
              <i class="fas fa-clock"></i> Timeline
            </button>
          </div>
          
          <div class="chart-display">
            <canvas id="performanceChart"></canvas>
            <canvas id="requestsChart" style="display: none;"></canvas>
            <canvas id="errorsChart" style="display: none;"></canvas>
            <canvas id="timelineChart" style="display: none;"></canvas>
          </div>
        </div>

        <div class="filters-panel">
          <select id="requestTypeFilter">
            <option value="">All Types</option>
            <option value="xmlhttprequest">XHR</option>
            <option value="fetch">Fetch</option>
            <option value="script">Script</option>
            <option value="stylesheet">Stylesheet</option>
            <option value="image">Image</option>
            <option value="font">Font</option>
            <option value="document">Document</option>
            <option value="other">Other</option>
          </select>
          
          <select id="statusFilter">
            <option value="">All Status</option>
            <option value="200">200 OK</option>
            <option value="3xx">3xx Redirect</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
          </select>
          
          <select id="performanceFilter">
            <option value="">All Performance</option>
            <option value="fast">Fast (<100ms)</option>
            <option value="normal">Normal (100-500ms)</option>
            <option value="slow">Slow (500-1000ms)</option>
            <option value="veryslow">Very Slow (>1000ms)</option>
          </select>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    document
      .getElementById("refreshMetrics")
      .addEventListener("click", () => this.refreshMetrics());
    document
      .getElementById("exportMetrics")
      .addEventListener("click", () => this.exportMetrics());
    document
      .getElementById("timeRange")
      .addEventListener("change", (e) => this.updateTimeRange(e.target.value));

    document.querySelectorAll(".charts-tabs button").forEach((button) => {
      button.addEventListener("click", () =>
        this.switchChart(button.dataset.chart)
      );
    });

    document
      .getElementById("requestTypeFilter")
      .addEventListener("change", () => this.applyFilters());
    document
      .getElementById("statusFilter")
      .addEventListener("change", () => this.applyFilters());
    document
      .getElementById("performanceFilter")
      .addEventListener("change", () => this.applyFilters());
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

    // Errors Chart - Doughnut chart for status codes
    const errCtx = document.getElementById("errorsChart").getContext("2d");
    this.charts.errors = new Chart(errCtx, {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: [
              "rgba(76, 175, 80, 0.6)",   // 2xx
              "rgba(33, 150, 243, 0.6)",   // 3xx
              "rgba(255, 152, 0, 0.6)",    // 4xx
              "rgba(244, 67, 54, 0.6)",    // 5xx
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

    // Timeline Chart - Area chart for request volume over time
    const timeCtx = document.getElementById("timelineChart").getContext("2d");
    this.charts.timeline = new Chart(timeCtx, {
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
      const timeRange = document.getElementById("timeRange").value;
      const typeFilter = document.getElementById("requestTypeFilter").value;
      const statusFilter = document.getElementById("statusFilter").value;

      // Get metrics from background page
      chrome.runtime.sendMessage(
        {
          action: "getFilteredStats",
          filters: {
            pageUrl: this.currentUrl,
            timeRange: parseInt(timeRange),
            type: typeFilter,
            statusPrefix: statusFilter,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError);
            return;
          }

          if (response && response.success) {
            this.updateMetrics(response);
          } else {
            console.error("Failed to get metrics:", response?.error);
          }
        }
      );
    } catch (error) {
      console.error("Error collecting metrics:", error);
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

    // Update performance chart
    if (this.charts.performance && metrics.timestamps && metrics.responseTimes) {
      this.charts.performance.data.labels = metrics.timestamps;
      this.charts.performance.data.datasets[0].data = metrics.responseTimes;
      this.charts.performance.update();
    }

    // Update requests chart
    if (this.charts.requests && metrics.requestTypes) {
      this.charts.requests.data.labels = Object.keys(metrics.requestTypes);
      this.charts.requests.data.datasets[0].data = Object.values(
        metrics.requestTypes
      );
      this.charts.requests.update();
    }

    // Update errors chart
    if (this.charts.errors && metrics.statusCodes) {
      const statusLabels = [];
      const statusData = [];
      
      for (const [status, count] of Object.entries(metrics.statusCodes)) {
        const statusCode = parseInt(status);
        let label = '';
        if (statusCode >= 200 && statusCode < 300) label = '2xx Success';
        else if (statusCode >= 300 && statusCode < 400) label = '3xx Redirect';
        else if (statusCode >= 400 && statusCode < 500) label = '4xx Client Error';
        else if (statusCode >= 500) label = '5xx Server Error';
        
        statusLabels.push(label);
        statusData.push(count);
      }
      
      this.charts.errors.data.labels = statusLabels;
      this.charts.errors.data.datasets[0].data = statusData;
      this.charts.errors.update();
    }

    // Update timeline chart (aggregate by minute)
    if (this.charts.timeline && metrics.timestamps) {
      const timelineData = this.aggregateByMinute(metrics.timestamps);
      this.charts.timeline.data.labels = timelineData.labels;
      this.charts.timeline.data.datasets[0].data = timelineData.values;
      this.charts.timeline.update();
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
