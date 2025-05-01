// Performance monitoring component
import { Chart } from "../../lib/chart.min.js";
import { notificationSystem } from "./notifications.js";

export default class PerformanceMonitor {
  constructor(options = {}) {
    this.isEnabled = false;
    this.container = null;
    this.resourceChart = null;
    this.refreshInterval = null;
    this.metricsPanel = null;
    this.performanceToggle = null;
    this.options = {
      refreshInterval: 5000,
      ...options,
    };
  }

  initialize(container) {
    this.container = container;
    this.createUI();
    this.setupEventListeners();
    this.loadInitialState();
  }

  createUI() {
    this.container.innerHTML = `
      <div class="performance-controls">
        <label class="performance-toggle">
          <input type="checkbox" id="performanceToggle">
          Enable Performance Monitoring
        </label>
      </div>
      <div id="metricsPanel" class="metrics-panel disabled">
        <h3>Performance Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-title">DNS Lookup</div>
            <div id="dnsTime" class="metric-value">0 ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">TCP Connection</div>
            <div id="tcpTime" class="metric-value">0 ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">SSL/TLS</div>
            <div id="sslTime" class="metric-value">0 ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Time to First Byte</div>
            <div id="ttfbTime" class="metric-value">0 ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Download</div>
            <div id="downloadTime" class="metric-value">0 ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Total Time</div>
            <div id="totalTime" class="metric-value">0 ms</div>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="resourceChart"></canvas>
        </div>
      </div>
    `;

    this.metricsPanel = this.container.querySelector("#metricsPanel");
    this.performanceToggle = this.container.querySelector("#performanceToggle");

    // Initialize resource timing chart
    const ctx = document.getElementById("resourceChart").getContext("2d");
    this.resourceChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["DNS", "TCP", "SSL", "TTFB", "Download"],
        datasets: [
          {
            label: "Time (ms)",
            data: [0, 0, 0, 0, 0],
            backgroundColor: [
              "rgba(54, 162, 235, 0.5)",
              "rgba(75, 192, 192, 0.5)",
              "rgba(153, 102, 255, 0.5)",
              "rgba(255, 159, 64, 0.5)",
              "rgba(255, 99, 132, 0.5)",
            ],
            borderColor: [
              "rgba(54, 162, 235, 1)",
              "rgba(75, 192, 192, 1)",
              "rgba(153, 102, 255, 1)",
              "rgba(255, 159, 64, 1)",
              "rgba(255, 99, 132, 1)",
            ],
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
          },
        },
      },
    });
  }

  setupEventListeners() {
    this.performanceToggle.addEventListener("change", async (e) => {
      await this.updatePerformanceMonitoring(e.target.checked);
    });
  }

  async loadInitialState() {
    try {
      const { isEnabled } = await chrome.runtime.sendMessage({
        action: "getPerformanceState",
      });
      this.isEnabled = isEnabled;
      this.performanceToggle.checked = isEnabled;
      this.toggleMetricsPanel(isEnabled);

      if (isEnabled) {
        this.startDataRefresh();
        await this.refreshPerformanceData();
      }
    } catch (error) {
      console.error("Failed to load performance state:", error);
      notificationSystem.showError(
        "Failed to load performance monitoring state"
      );
    }
  }

  async updatePerformanceMonitoring(enabled) {
    try {
      await chrome.runtime.sendMessage({
        action: "updatePerformanceState",
        enabled,
      });

      this.isEnabled = enabled;
      this.toggleMetricsPanel(enabled);

      if (enabled) {
        this.startDataRefresh();
        await this.refreshPerformanceData();
      } else {
        this.stopDataRefresh();
      }
    } catch (error) {
      console.error("Failed to update performance monitoring:", error);
      notificationSystem.showError("Failed to update performance monitoring");
      // Revert UI state
      this.performanceToggle.checked = !enabled;
    }
  }

  toggleMetricsPanel(show) {
    this.metricsPanel.classList.toggle("disabled", !show);
  }

  updatePerformanceMetrics(metrics) {
    if (!this.isEnabled) return;

    // Update timing values
    document.getElementById("dnsTime").textContent = `${metrics.dns.toFixed(
      2
    )} ms`;
    document.getElementById("tcpTime").textContent = `${metrics.tcp.toFixed(
      2
    )} ms`;
    document.getElementById("sslTime").textContent = `${metrics.ssl.toFixed(
      2
    )} ms`;
    document.getElementById("ttfbTime").textContent = `${metrics.ttfb.toFixed(
      2
    )} ms`;
    document.getElementById(
      "downloadTime"
    ).textContent = `${metrics.download.toFixed(2)} ms`;
    document.getElementById("totalTime").textContent = `${metrics.total.toFixed(
      2
    )} ms`;

    // Update resource chart
    this.resourceChart.data.datasets[0].data = [
      metrics.dns,
      metrics.tcp,
      metrics.ssl,
      metrics.ttfb,
      metrics.download,
    ];
    this.resourceChart.update();
  }

  async refreshPerformanceData() {
    if (!this.isEnabled) return;

    try {
      const metrics = await chrome.runtime.sendMessage({
        action: "getPerformanceMetrics",
      });
      this.updatePerformanceMetrics(metrics);
    } catch (error) {
      console.error("Failed to refresh performance data:", error);
    }
  }

  startDataRefresh() {
    this.stopDataRefresh(); // Clear any existing interval
    this.refreshInterval = setInterval(() => {
      this.refreshPerformanceData();
    }, this.options.refreshInterval);
  }

  stopDataRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  cleanup() {
    this.stopDataRefresh();
    if (this.resourceChart) {
      this.resourceChart.destroy();
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
