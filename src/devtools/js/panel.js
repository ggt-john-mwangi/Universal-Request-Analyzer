import "../../styles.css";
import "../css/devtools.css";
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
          <span>Current URL: </span>
          <span id="currentUrl"></span>
        </div>
        
        <div class="controls">
          <button id="refreshMetrics">Refresh</button>
          <select id="timeRange">
            <option value="300">Last 5 minutes</option>
            <option value="900">Last 15 minutes</option>
            <option value="3600">Last hour</option>
            <option value="86400">Last 24 hours</option>
          </select>
          <button id="exportMetrics">Export</button>
        </div>

        <div class="charts-container">
          <div class="charts-tabs">
            <button data-chart="performance" class="active">Performance</button>
            <button data-chart="requests">Requests</button>
            <button data-chart="errors">Errors</button>
          </div>
          
          <div class="chart-display">
            <canvas id="performanceChart"></canvas>
            <canvas id="requestsChart" style="display: none;"></canvas>
            <canvas id="errorsChart" style="display: none;"></canvas>
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
          </select>
          
          <select id="statusFilter">
            <option value="">All Status</option>
            <option value="200">200 OK</option>
            <option value="3xx">3xx Redirect</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
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
  }

  initializeCharts() {
    // Performance Chart
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
            borderColor: "rgb(75, 192, 192)",
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
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

    // Requests Chart
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
              "rgba(75, 192, 192, 0.5)",
              "rgba(255, 159, 64, 0.5)",
              "rgba(255, 205, 86, 0.5)",
              "rgba(54, 162, 235, 0.5)",
            ],
          },
        ],
      },
      options: {
        responsive: true,
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

    // Errors Chart
    const errCtx = document.getElementById("errorsChart").getContext("2d");
    this.charts.errors = new Chart(errCtx, {
      type: "pie",
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: [
              "rgba(255, 99, 132, 0.5)",
              "rgba(255, 159, 64, 0.5)",
              "rgba(255, 205, 86, 0.5)",
            ],
          },
        ],
      },
      options: {
        responsive: true,
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
          if (response.error) {
            console.error("Failed to get metrics:", response.error);
            return;
          }

          this.updateMetrics(response);
        }
      );
    } catch (error) {
      console.error("Error collecting metrics:", error);
    }
  }

  updateMetrics(metrics) {
    // Update performance chart
    this.charts.performance.data.labels = metrics.timestamps;
    this.charts.performance.data.datasets[0].data = metrics.responseTimes;
    this.charts.performance.update();

    // Update requests chart
    this.charts.requests.data.labels = Object.keys(metrics.requestTypes);
    this.charts.requests.data.datasets[0].data = Object.values(
      metrics.requestTypes
    );
    this.charts.requests.update();

    // Update errors chart
    const errorLabels = [];
    const errorData = [];
    for (const [status, count] of Object.entries(metrics.statusCodes)) {
      if (status >= 400) {
        errorLabels.push(`${status} (${count})`);
        errorData.push(count);
      }
    }
    this.charts.errors.data.labels = errorLabels;
    this.charts.errors.data.datasets[0].data = errorData;
    this.charts.errors.update();
  }

  switchChart(chartId) {
    document.querySelectorAll(".charts-tabs button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.chart === chartId);
    });

    Object.keys(this.charts).forEach((key) => {
      const canvas = document.getElementById(`${key}Chart`);
      canvas.style.display = key === chartId ? "block" : "none";
    });
  }

  handleUrlChange(url) {
    this.currentUrl = url;
    document.getElementById("currentUrl").textContent = url;
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
        },
        format: "json",
      },
      (response) => {
        if (response.error) {
          console.error("Export failed:", response.error);
          return;
        }
        console.log("Metrics exported successfully");
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
  }
}
