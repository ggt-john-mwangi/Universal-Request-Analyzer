import "../../styles.css"; // Import the global styles.css
import "../css/devtools.css"; // Ensure the CSS file is imported
import "../../lib/chart.min.js";

export class DevToolsPanel {
  constructor() {
    this.charts = {};
    this.currentUrl = "";
    this.currentDomain = ""; // Add property to store the domain
    this.refreshInterval = null;
    this.initialize();
  }

  async initialize() { // Make initialize async
    await this.getCurrentUrlAndDomain(); // Get URL first
    this.setupUI();
    this.setupEventListeners();
  }

  // New method to get URL and extract domain
  async getCurrentUrlAndDomain() {
    return new Promise((resolve) => {
      chrome.tabs.get(chrome.devtools.inspectedWindow.tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.error("Error getting tab info:", chrome.runtime.lastError);
          this.currentUrl = "Error fetching URL";
          this.currentDomain = "";
        } else if (tab && tab.url) {
          this.currentUrl = tab.url;
          try {
            const urlObject = new URL(tab.url);
            this.currentDomain = urlObject.hostname; // Extract hostname as domain
          } catch (e) {
            console.error("Invalid URL:", tab.url, e);
            this.currentDomain = ""; // Handle invalid URLs
          }
        } else {
          this.currentUrl = "N/A";
          this.currentDomain = "";
        }
        console.log(`Inspected Domain: ${this.currentDomain}`); // Log the domain
        resolve();
      });
    });
  }

  setupUI() {
    const container = document.getElementById("panel-container");
    container.innerHTML = `
      <div class="metrics-panel">
        <div class="url-info">
          <span>Current Domain: </span>
          <span id="currentDomain">${this.currentDomain || 'N/A'}</span> <!-- Display domain -->
        </div>
      </div>
    `;
    // Ensure the domain is updated in the UI after innerHTML overwrite
    const currentDomainSpan = document.getElementById("currentDomain");
    if (currentDomainSpan) {
      currentDomainSpan.textContent = this.currentDomain || 'N/A';
    }
  }

  setupEventListeners() {
    const toggleButton = document.getElementById("toggleNetworkStats");
    const networkStatsPanel = document.getElementById("networkStatsPanel");

    toggleButton.addEventListener("click", () => {
      const isVisible = networkStatsPanel.style.display === "block";
      networkStatsPanel.style.display = isVisible ? "none" : "block";
    });
  }

  async collectMetrics() {
    // Ensure currentDomain is available before collecting
    if (!this.currentDomain) {
      console.warn("Domain not yet determined, delaying metric collection.");
      await this.getCurrentUrlAndDomain(); // Try getting it again if missing
      if (!this.currentDomain) {
        console.error("Failed to determine domain. Cannot collect metrics.");
        return; // Exit if domain still unknown
      }
      // Update UI again in case it wasn't ready before
      const currentDomainSpan = document.getElementById("currentDomain");
      if (currentDomainSpan) {
        currentDomainSpan.textContent = this.currentDomain;
      }
    }

    console.log(`Collecting metrics for domain: ${this.currentDomain}`);
    // TODO: Modify this part to request data filtered by this.currentDomain
    // This likely involves sending a message to the background script
    // with the domain as a filter parameter.

    // Placeholder: Simulate fetching domain-specific data
    // Replace with actual message passing to background.js
    try {
      const metrics = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "GET_METRICS",
            payload: {
              domain: this.currentDomain, // Send the domain filter
              // Add other filters like time range, request type, status code later
            },
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error fetching metrics:",
                chrome.runtime.lastError.message
              );
              resolve(null); // Resolve with null on error
            } else {
              resolve(response);
            }
          }
        );
      });

      if (metrics) {
        this.updateMetrics(metrics);
      } else {
        console.log("No metrics received or error occurred.");
        // Optionally clear charts or show an error state
      }
    } catch (error) {
      console.error("Error in collectMetrics:", error);
    }
  }

  handleUrlChange(url) {
    // This might be triggered by background script if URL changes significantly
    console.log(`URL changed to: ${url}`);
    this.currentUrl = url;
    try {
      const urlObject = new URL(url);
      this.currentDomain = urlObject.hostname;
    } catch (e) {
      console.error("Invalid URL:", url, e);
      this.currentDomain = "";
    }
    // Update UI and refresh metrics for the new domain
    const currentDomainSpan = document.getElementById("currentDomain");
    if (currentDomainSpan) {
      currentDomainSpan.textContent = this.currentDomain || 'N/A';
    }
    this.refreshMetrics(); // Refresh data for the new domain
  }

  async refreshMetrics() {
    console.log("Refreshing metrics...");
    await this.collectMetrics(); // Re-collect metrics using the current domain/filters
  }

  updateMetrics(response) {
    const ctx = document.getElementById("networkStatsChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: response.stats.timestamps,
        datasets: [
          {
            label: "API Response Times",
            data: response.stats.responseTimes,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: "Time",
            },
          },
          y: {
            title: {
              display: true,
              text: "Response Time (ms)",
            },
          },
        },
      },
    });
  }

  applyFilters() {
    // Filters should trigger a refresh, which will use the current domain
    this.refreshMetrics();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const devToolsPanel = new DevToolsPanel();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "urlChange") {
      devToolsPanel.handleUrlChange(message.url);
    }
  });
});
