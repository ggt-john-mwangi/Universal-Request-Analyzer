import "../../styles.css"; // Import the global styles.css
import "../css/devtools.css"; // Ensure the CSS file is imported
import "../../lib/chart.min.js";

export class DevToolsPanel {
  constructor() {
    this.charts = {};
    this.currentUrl = "";
    this.currentDomain = ""; // Domain from inspected window
    this.selectedDomain = null; // Domain selected in the dropdown (null for all)
    this.allDomains = []; // List of all domains from DB
    this.initialize();
  }

  async initialize() {
    this.setupUI();
    await this.fetchAndPopulateDomains(); // Fetch domains first
    this.setupEventListeners();
    this.setupMessageListener();
    // Initial load: Use currentDomain if available, otherwise fetch all (selectedDomain = null)
    this.selectedDomain = this.currentDomain || null;
    this.updateDomainSelectionUI();
    this.refreshMetrics(true);
  }

  async fetchAndPopulateDomains() {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "GET_DISTINCT_DOMAINS" }, (res) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (res && res.error) {
            reject(new Error(res.error));
          } else {
            resolve(res);
          }
        });
      });
      this.allDomains = response?.domains || [];
      this.populateDomainDropdown();
    } catch (error) {
      console.error("Error fetching distinct domains:", error);
      this.allDomains = [];
      // Optionally display an error in the UI
    }
  }

  populateDomainDropdown() {
    const domainSelect = document.getElementById("domainFilterSelect");
    if (!domainSelect) return;

    domainSelect.innerHTML = '<option value="">-- All Domains --</option>'; // Default option

    this.allDomains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      domainSelect.appendChild(option);
    });

    // Set the initial value based on selectedDomain
    domainSelect.value = this.selectedDomain || "";
  }

  updateDomainSelectionUI() {
    const domainSelect = document.getElementById("domainFilterSelect");
    if (domainSelect) {
        domainSelect.value = this.selectedDomain || "";
    }
    const currentDomainSpan = document.getElementById("currentDomain");
     if (currentDomainSpan) {
        currentDomainSpan.textContent = this.currentDomain || 'N/A';
     }
  }

  setupUI() {
    const container = document.getElementById("panel-container");
    container.innerHTML = `
      <div class="panel-header">
        <div class="url-info">
          <span>Inspected Domain: </span>
          <span id="currentDomain">${this.currentDomain || 'N/A (Waiting...)'}</span>
        </div>
        <div class="filter-controls">
            <label for="domainFilterSelect">Filter by Domain:</label>
            <select id="domainFilterSelect">
                <option value="">-- All Domains --</option>
                <!-- Domains will be populated here -->
            </select>
        </div>
      </div>
      <div id="analytics-summary" class="summary-grid">
          <!-- Summary Stats will be populated here -->
          Loading summary...
      </div>
      <div id="charts-container" class="charts-grid">
          <div class="chart-item"><canvas id="responseTimesChart"></canvas></div>
          <div class="chart-item"><canvas id="statusCodesChart"></canvas></div>
          <div class="chart-item"><canvas id="requestTypesChart"></canvas></div>
          <div class="chart-item"><canvas id="avgTimingsChart"></canvas></div>
      </div>
    `;
    // Initialize empty charts or placeholders
    this.initializeCharts();
  }

  initializeCharts() {
      const chartIds = ['responseTimesChart', 'statusCodesChart', 'requestTypesChart', 'avgTimingsChart'];
      chartIds.forEach(id => {
          const canvas = document.getElementById(id);
          if (canvas) {
              const ctx = canvas.getContext('2d');
              // Destroy existing chart if it exists
              if (this.charts[id]) {
                  this.charts[id].destroy();
              }
              // Optionally create a placeholder or leave blank until data arrives
              this.charts[id] = null; // Reset chart reference
          } else {
              console.warn(`Canvas element with id ${id} not found.`);
          }
      });
  }

  setupEventListeners() {
    const domainSelect = document.getElementById("domainFilterSelect");
    if (domainSelect) {
        domainSelect.addEventListener("change", (event) => {
            this.selectedDomain = event.target.value || null; // Use null for "All Domains"
            console.log(`Domain filter changed to: ${this.selectedDomain}`);
            this.refreshMetrics();
        });
    }
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'URL_UPDATE') {
        this.handleUrlChange(event.data.url);
      }
    });
  }

  async collectMetrics(isInitialLoad = false) {
    // Use the domain selected in the dropdown for filtering
    const domainFilter = this.selectedDomain;
    console.log(`Collecting metrics for domain filter: ${domainFilter || 'All'}`);

    try {
      const metrics = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: "GET_METRICS", // Ensure this matches the background handler
            payload: {
              domain: domainFilter, // Send the selected domain (null for all)
            },
          },
          (response) => {
            // ... existing error handling ...
             if (chrome.runtime.lastError) {
              console.error(
                "Error fetching metrics:",
                chrome.runtime.lastError.message
              );
              if (chrome.runtime.lastError.message.includes("closed")) {
                 console.warn("Connection to background script lost.");
              }
              reject(chrome.runtime.lastError);
            } else if (response && response.error) {
               console.error("Error from background script:", response.error);
               reject(new Error(response.error));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (metrics) {
        this.updateMetricsUI(metrics);
      } else {
        console.log("No metrics received or error occurred.");
        this.clearMetricsUI(); // Clear UI if no data
      }
    } catch (error) {
      console.error("Error in collectMetrics promise:", error);
      this.clearMetricsUI(); // Clear UI on error
    }
  }

  handleUrlChange(url) {
    console.log(`Panel received URL: ${url}`);
    this.currentUrl = url;
    let newDomain = "";
    try {
      if (url && url !== 'about:blank') {
         const urlObject = new URL(url);
         newDomain = urlObject.hostname;
      } else {
         newDomain = null;
      }
    } catch (e) {
      console.error("Invalid URL received:", url, e);
      newDomain = null;
    }

    // Only update if the inspected domain changed
    if (newDomain !== this.currentDomain) {
        this.currentDomain = newDomain;
        console.log(`Inspected domain updated to: ${this.currentDomain}`);

        // Update the displayed inspected domain
        const currentDomainSpan = document.getElementById("currentDomain");
        if (currentDomainSpan) {
          currentDomainSpan.textContent = this.currentDomain || 'N/A';
        }

        // Check if the new domain exists in the dropdown
        const domainExists = this.allDomains.includes(this.currentDomain);
        if (domainExists) {
            // If it exists, automatically select it in the dropdown and refresh
            this.selectedDomain = this.currentDomain;
            this.updateDomainSelectionUI();
            this.refreshMetrics();
        } else if (this.currentDomain === null) {
             // If navigated to blank/invalid, reset filter to All
             this.selectedDomain = null;
             this.updateDomainSelectionUI();
             this.refreshMetrics();
        }
        // If the new domain doesn't exist, keep the current dropdown selection
    }
  }

  async refreshMetrics(isInitialLoad = false) {
    console.log("Refreshing metrics...");
    await this.collectMetrics(isInitialLoad);
  }

  updateMetricsUI(metrics) {
    console.log("Received metrics:", metrics);
    if (!metrics || metrics.error) {
        console.error("Error in received metrics:", metrics?.error);
        this.clearMetricsUI("Error loading metrics.");
        return;
    }

    // Update Summary Stats
    const summaryContainer = document.getElementById("analytics-summary");
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="summary-item"><strong>Total Requests:</strong> ${metrics.requestCount ?? 'N/A'}</div>
            <div class="summary-item"><strong>Avg Response Time:</strong> ${metrics.avgResponseTime ? metrics.avgResponseTime.toFixed(2) + ' ms' : 'N/A'}</div>
            <div class="summary-item"><strong>Success Rate:</strong> ${metrics.successRate ? metrics.successRate.toFixed(2) + ' %' : 'N/A'}</div>
            <div class="summary-item"><strong>Successful:</strong> ${metrics.successCount ?? 'N/A'}</div>
            <div class="summary-item"><strong>Failed:</strong> ${metrics.errorCount ?? 'N/A'}</div>
            <div class="summary-item"><strong>DB Size:</strong> ${metrics.size ? (metrics.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</div>
        `;
    }

    // Update Charts
    this.updateResponseTimesChart(metrics.responseTimesData);
    this.updateStatusCodesChart(metrics.statusCodes);
    this.updateRequestTypesChart(metrics.requestTypes);
    // Assuming getFilteredStats returns avgTimings similar to README
    // this.updateAvgTimingsChart(metrics.avgTimings);
    // Placeholder for avgTimings - needs adjustment based on actual db-manager output
    console.warn("Average Timings chart data might be missing or in the wrong format in getFilteredStats response.");
    this.updateAvgTimingsChart(null); // Pass null or handle appropriately

  }

  clearMetricsUI(message = "No data available for the selected domain.") {
      const summaryContainer = document.getElementById("analytics-summary");
      if (summaryContainer) {
          summaryContainer.innerHTML = `<div class="summary-item">${message}</div>`;
      }
      this.initializeCharts(); // Clear/reset all charts
  }

  // --- Chart Update Functions ---

  updateResponseTimesChart(data) {
    const canvas = document.getElementById('responseTimesChart');
    if (!canvas || !data || !data.timestamps || !data.durations) return;
    const ctx = canvas.getContext('2d');
    if (this.charts.responseTimesChart) this.charts.responseTimesChart.destroy();

    this.charts.responseTimesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.timestamps,
        datasets: [{
          label: 'Response Time (ms)',
          data: data.durations,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: { title: { display: true, text: 'Response Times (Last 100)' } }
    });
  }

  updateStatusCodesChart(statusCodes) {
    const canvas = document.getElementById('statusCodesChart');
    if (!canvas || !statusCodes || statusCodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (this.charts.statusCodesChart) this.charts.statusCodesChart.destroy();

    const labels = statusCodes.map(item => item.status);
    const data = statusCodes.map(item => item.count);

    this.charts.statusCodesChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: 'Status Codes',
          data: data,
          backgroundColor: [
            'rgb(54, 162, 235)', 'rgb(255, 99, 132)', 'rgb(255, 205, 86)', 'rgb(75, 192, 192)', 'rgb(153, 102, 255)', 'rgb(255, 159, 64)'
          ],
        }]
      },
      options: { title: { display: true, text: 'Status Code Distribution' } }
    });
  }

  updateRequestTypesChart(requestTypes) {
    const canvas = document.getElementById('requestTypesChart');
    if (!canvas || !requestTypes || requestTypes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (this.charts.requestTypesChart) this.charts.requestTypesChart.destroy();

    const labels = requestTypes.map(item => item.type);
    const data = requestTypes.map(item => item.count);

    this.charts.requestTypesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          label: 'Request Types',
          data: data,
           backgroundColor: [
            'rgb(255, 99, 132)', 'rgb(54, 162, 235)', 'rgb(255, 205, 86)', 'rgb(75, 192, 192)', 'rgb(153, 102, 255)', 'rgb(255, 159, 64)'
          ],
        }]
      },
       options: { title: { display: true, text: 'Request Type Distribution' } }
    });
  }

  updateAvgTimingsChart(avgTimings) {
    const canvas = document.getElementById('avgTimingsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (this.charts.avgTimingsChart) this.charts.avgTimingsChart.destroy();

    // Check if avgTimings data is available and valid
    if (!avgTimings || typeof avgTimings !== 'object') {
        // Display placeholder or message
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillText('Average Timings data not available', canvas.width / 2, canvas.height / 2);
        this.charts.avgTimingsChart = null;
        return;
    }

    const labels = ['DNS', 'TCP', 'SSL', 'TTFB', 'Download'];
    const data = [
        avgTimings.avgDns || 0,
        avgTimings.avgTcp || 0,
        avgTimings.avgSsl || 0,
        avgTimings.avgTtfb || 0,
        avgTimings.avgDownload || 0
    ];

    this.charts.avgTimingsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Average Time (ms)',
          data: data,
          backgroundColor: 'rgba(153, 102, 255, 0.6)'
        }]
      },
      options: {
          title: { display: true, text: 'Average Request Phase Timings' },
          scales: {
              y: {
                  beginAtZero: true
              }
          }
      }
    });
  }

  // ... rest of the class ...
}

document.addEventListener("DOMContentLoaded", () => {
  const devToolsPanel = new DevToolsPanel();
});
