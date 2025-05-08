import "../css/popup.css";
import "../css/themes.css";
import "../css/data-visualization.css";
import "../../lib/chart.min.js";
import themeManager from "../../config/theme-manager.js";

// Import popup components
import "../components/chart-components.js";
import "../components/chart-renderer.js";
import "../components/data-filter-panel.js";
import "../components/data-loader.js";
import "../components/data-visualization.js";
import "../components/filters.js";
import "./settings-manager.js";
import { initSettingsUI } from "./settings-ui.js";
import DataVisualization from "../components/data-visualization.js";

// --- Harmonized Config/Filters Sync System ---
import { getHarmonizedConfig, updateHarmonizedConfig, listenForConfigUpdates } from "../../popup/js/settings-manager.js";

// On load, fetch config/filters from background
getHarmonizedConfig().then((config) => {
  // Use config for all settings/filters in popup UI
  // ...apply config to UI elements...
});

// When user changes config/filters, update via background
function onUserChangeConfig(newConfig) {
  updateHarmonizedConfig(newConfig, (response) => {
    // Optionally handle response
  });
}

// Listen for config updates from background
listenForConfigUpdates((newConfig) => {
  // Update UI/state with newConfig
});

// --- Global Variables ---
console.log("popup.js: Script start"); // Log script start

// Pagination
let currentPage = 1; // Current page number for pagination
let totalPages = 1;
let itemsPerPage = 50; // Default, will be updated from config
let totalItems = 0;

// Active filters
let activeFilters = {
  status: "all",
  type: "all",
  domain: "",
  url: "",
  startDate: "",
  endDate: "",
  quick: "all", // Added quick filter
};

// Sorting and Search State
let sortState = { column: null, direction: 'asc' };
let searchQuery = '';
let lastLoadedRequests = [];

// Config - Load relevant parts needed for popup operation (like itemsPerPage)
let config = {
  ui: {
    requestsPerPage: 50, // Default value
  },
};

// DOM elements - Declare globally, assign in DOMContentLoaded
let requestsTableBody = null;
let totalRequestsEl = null;
let avgResponseTimeEl = null;
let successRateEl = null;
let filterBtn = null;
let filterPanel = null;
let clearBtn = null;
let exportBtn = null;
let exportPanel = null;
let exportDbSizeSpan = null;
let exportFormatSelect = null;
let exportFilenameInput = null;
let requestDetails = null;
let closeDetails = null;
let applyFilterBtn = null;
let resetFilterBtn = null;
let doExportBtn = null;
let cancelExportBtn = null;
let prevPageBtn = null;
let nextPageBtn = null;
let pageInfoEl = null;
let tabContents = null;
let vizApplyFilterBtn = null;
let vizResetFilterBtn = null;
let OptionsPage = null;
let notificationElement = null;
let importBtn = null;
let importPanel = null;
let doImportBtn = null;
let cancelImportBtn = null;
let importFile = null;
let importStatus = null;
let refreshBtn = null;
let statusFilter = null;
let typeFilter = null;
let domainFilter = null;
let urlFilter = null;
let startDateFilter = null;
let endDateFilter = null;

// Settings Tab Elements
let themeSelector = null;
let requestsPerPagePopupInput = null;
let showTimingBarsPopupCheckbox = null;
let savePopupSettingsBtn = null;
let openOptionsPageLink = null;

let activePanel = null; // Keep track of the currently open panel
let tabsContainer = null; // Added for tab switching

let pendingGetRequests = {};
let pendingGetStats = {};

// --- Event-based request/response helpers ---
const pendingPopupRequests = {};
function eventRequest(action, payload, callback) {
  const requestId = generateRequestId();
  pendingPopupRequests[requestId] = callback;
  chrome.runtime.sendMessage({ ...payload, action, requestId });
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.requestId && pendingPopupRequests[message.requestId]) {
    pendingPopupRequests[message.requestId](message);
    delete pendingPopupRequests[message.requestId];
  }
});

function generateRequestId() {
  return 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Event-based fetch for request headers and timings
function fetchRequestHeaders(requestId, callback) {
  const eventRequestId = `popup_headers_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  function handler(message) {
    if (message && message.requestId === eventRequestId) {
      callback(message);
      chrome.runtime.onMessage.removeListener(handler);
    }
  }
  chrome.runtime.onMessage.addListener(handler);
  chrome.runtime.sendMessage({ action: "getRequestHeaders", requestId, requestIdFor: eventRequestId });
}

function fetchRequestTimings(requestId, callback) {
  const eventRequestId = `popup_timings_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  function handler(message) {
    if (message && message.requestId === eventRequestId) {
      callback(message);
      chrome.runtime.onMessage.removeListener(handler);
    }
  }
  chrome.runtime.onMessage.addListener(handler);
  chrome.runtime.sendMessage({ action: "getRequestTimings", requestId, requestIdFor: eventRequestId });
}

// Example usage for getConfig:
function loadConfigEventBased(callback) {
  eventRequest("getConfig", {}, (response) => {
    if (response.success) {
      callback(response.config);
    } else {
      // handle error
      callback(null);
    }
  });
}

// Example usage for getFilteredStats:
function loadStatsEventBased(filters, callback) {
  eventRequest("getFilteredStats", { filters }, (response) => {
    if (response.success) {
      callback(response);
    } else {
      // handle error
      callback(null);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try { // Add try block
    console.log("popup.js: DOMContentLoaded event fired"); // Log DOM ready

    // Initialize theme manager first
    try {
      await themeManager.initialize({
        initialTheme: "light", // Or load from storage
      });
      console.log("popup.js: Theme manager initialized");
    } catch (error) {
      console.error("popup.js: Error initializing theme manager:", error);
    }

    // Assign DOM elements *before* initializing UI components that need them
    console.log("popup.js: Assigning DOM elements...");
    requestsTableBody = document.getElementById("requestsTableBody");
    totalRequestsEl = document.getElementById("totalRequests");
    avgResponseTimeEl = document.getElementById("avgResponseTime");
    successRateEl = document.getElementById("successRate");
    filterBtn = document.getElementById("filterBtn");
    filterPanel = document.getElementById("filterPanel");
    clearBtn = document.getElementById("clearBtn");
    exportBtn = document.getElementById("exportBtn");
    exportPanel = document.getElementById("exportPanel");
    exportDbSizeSpan = document.getElementById("exportDbSize");
    exportFormatSelect = document.getElementById("exportFormat");
    exportFilenameInput = document.getElementById("exportFilename");
    requestDetails = document.getElementById("requestDetails");
    closeDetails = document.getElementById("closeDetails");
    applyFilterBtn = document.getElementById("applyFilterBtn");
    resetFilterBtn = document.getElementById("resetFilterBtn");
    doExportBtn = document.getElementById("doExportBtn");
    cancelExportBtn = document.getElementById("cancelExportBtn");
    prevPageBtn = document.getElementById("prevPageBtn");
    nextPageBtn = document.getElementById("nextPageBtn");
    pageInfoEl = document.getElementById("pageInfo");
    tabContents = document.querySelectorAll(".tab-content"); // Select all potential tab content panels
    vizApplyFilterBtn = document.getElementById("vizApplyFilterBtn");
    vizResetFilterBtn = document.getElementById("vizResetFilterBtn");
    OptionsPage = document.getElementById("openOptions");
    notificationElement = document.getElementById("notification");
    importBtn = document.getElementById("importBtn");
    importPanel = document.getElementById("importPanel");
    doImportBtn = document.getElementById("doImportBtn");
    cancelImportBtn = document.getElementById("cancelImportBtn");
    importFile = document.getElementById("importFile");
    importStatus = document.getElementById("importStatus");
    refreshBtn = document.getElementById("refreshBtn");
    statusFilter = document.getElementById("statusFilter");
    typeFilter = document.getElementById("typeFilter");
    domainFilter = document.getElementById("domainFilter");
    urlFilter = document.getElementById("urlFilter");
    startDateFilter = document.getElementById("startDateFilter");
    endDateFilter = document.getElementById("endDateFilter");
    tabsContainer = document.querySelector(".tabs"); // Get tabs container

    // Settings Tab Elements
    themeSelector = document.getElementById("themeSelector");
    requestsPerPagePopupInput = document.getElementById("requestsPerPagePopup");
    showTimingBarsPopupCheckbox = document.getElementById("showTimingBarsPopup");
    savePopupSettingsBtn = document.getElementById("savePopupSettingsBtn");
    openOptionsPageLink = document.getElementById("openOptionsPageLink");

    console.log("popup.js: DOM elements assigned.");
    console.log("popup.js: clearBtn element:", clearBtn); // Check if button elements are found
    console.log("popup.js: exportBtn element:", exportBtn);
    console.log("popup.js: importBtn element:", importBtn);
    console.log("popup.js: filterBtn element:", filterBtn);
    console.log("popup.js: refreshBtn element:", refreshBtn);

    // Initialize Settings UI *after* DOM elements are assigned
    try {
      console.log("popup.js: Initializing Settings UI...");
      initSettingsUI();
      console.log("popup.js: Settings UI initialized.");
    } catch (error) {
      console.error("popup.js: Error initializing Settings UI:", error);
    }

    // --- Utility Functions ---

    // Function to format bytes
    function formatBytes(bytes, decimals = 2) {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    // Function to show notifications
    function showNotification(message, isError = false) {
      if (notificationElement) {
        notificationElement.textContent = message;
        notificationElement.classList.remove("success", "error");
        notificationElement.classList.add(isError ? "error" : "success");
        notificationElement.classList.add("visible");

        setTimeout(() => {
          notificationElement.classList.remove("visible");
        }, isError ? 6000 : 4000);
      } else {
        console.warn("Notification element not found in popup.html");
        if (isError) {
          console.error("Notification:", message);
        } else {
          console.log("Notification:", message);
        }
      }
    }

    // --- Panel Management ---

    function togglePanel(panelElement) {
      if (!panelElement) return;

      const isOpening =
        panelElement.style.display === "none" || panelElement.style.display === "";

      if (activePanel && activePanel !== panelElement) {
        activePanel.style.display = "none";
      }

      if (isOpening) {
        panelElement.style.display = "block";
        activePanel = panelElement;
        if (panelElement === exportPanel) {
          loadExportPanelData();
        } else if (panelElement === importPanel) {
          resetImportPanel();
        }
      } else {
        panelElement.style.display = "none";
        activePanel = null;
      }
    }

    // --- Tab Switching Logic ---
    if (tabsContainer) {
      tabsContainer.addEventListener("click", (event) => {
        const clickedButton = event.target.closest(".tab-btn");
        if (clickedButton && !clickedButton.classList.contains("active")) {
          const targetTab = clickedButton.getAttribute("data-tab");

          tabsContainer.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.classList.remove("active");
          });
          clickedButton.classList.add("active");

          document.querySelectorAll(".tab-content").forEach((content) => {
            content.classList.remove("active");
          });
          const targetContent = document.getElementById(`${targetTab}-tab`);
          if (targetContent) {
            targetContent.classList.add("active");

            if (targetTab === "stats") {
              loadStats();
            } else if (targetTab === "requests") {
              loadRequests();
            } else if (targetTab === "settings") {
              loadPopupSettings(); // Load settings when tab is activated
            } else if (targetTab === "plots") {
              // Mount or reload the Plots tab visualization
              if (!targetContent._vizMounted) {
                const viz = DataVisualization(activeFilters);
                targetContent.innerHTML = "";
                targetContent.appendChild(viz);
                targetContent._vizMounted = viz;
              } else if (targetContent._vizMounted && typeof targetContent._vizMounted.reload === "function") {
                targetContent._vizMounted.reload(activeFilters);
              }
            }
          } else {
            console.warn(`Tab content not found for tab: ${targetTab}`);
          }

          if (activePanel) {
            activePanel.style.display = "none";
            activePanel = null;
          }
        }
      });
    } else {
      console.error("Tabs container (.tabs) not found.");
    }

    // --- Refresh Logic ---
    function handleRefresh() {
      console.log("Refreshing data...");
      const activeTabButton = document.querySelector(".tab-btn.active");
      if (activeTabButton) {
        const activeTabId = activeTabButton.getAttribute("data-tab");
        if (activeTabId === "requests") {
          loadRequests();
        } else if (activeTabId === "stats") {
          loadStats();
        } else if (activeTabId === "plots") {
          // If plots tab, reload visualization if possible
          const plotsTab = document.getElementById("plots-tab");
          if (plotsTab && plotsTab._vizMounted && typeof plotsTab._vizMounted.reload === "function") {
            plotsTab._vizMounted.reload(activeFilters);
          }
        }
      } else {
        loadRequests();
      }
      showNotification("Data refreshed.");
    }

    // --- Event Listeners ---
    console.log("popup.js: Attaching event listeners...");

    // Helper to attach and log event listeners for header controls
    function attachHeaderButtonListener(btn, handler, name) {
      if (btn) {
        btn.addEventListener("click", handler);
        console.log(`popup.js: ${name} button listener attached.`);
      } else {
        console.warn(`popup.js: ${name} button not found for listener.`);
      }
    }

    attachHeaderButtonListener(filterBtn, () => {
      console.log("popup.js: Filter button clicked");
      togglePanel(filterPanel);
    }, 'Filter');

    attachHeaderButtonListener(exportBtn, () => {
      console.log("popup.js: Export button clicked");
      togglePanel(exportPanel);
    }, 'Export');

    attachHeaderButtonListener(importBtn, () => {
      console.log("popup.js: Import button clicked");
      togglePanel(importPanel);
    }, 'Import');

    attachHeaderButtonListener(clearBtn, () => {
      console.log("popup.js: Clear button clicked");
      clearRequests();
    }, 'Clear');

    attachHeaderButtonListener(refreshBtn, () => {
      console.log("popup.js: Refresh button clicked");
      // Always refresh the current active tab
      const activeTabButton = document.querySelector(".tab-btn.active");
      if (activeTabButton) {
        const activeTabId = activeTabButton.getAttribute("data-tab");
        if (activeTabId === "requests") {
          loadRequests();
        } else if (activeTabId === "stats") {
          loadStats();
        } else if (activeTabId === "plots") {
          // If plots tab, reload visualization if possible
          const plotsTab = document.getElementById("plots-tab");
          if (plotsTab && plotsTab._vizMounted && typeof plotsTab._vizMounted.reload === "function") {
            plotsTab._vizMounted.reload(activeFilters);
          }
        }
      } else {
        loadRequests();
      }
      showNotification("Data refreshed.");
    }, 'Refresh');

    attachHeaderButtonListener(OptionsPage, openOptionsPage, 'Options');

    const closeFilterBtn = filterPanel?.querySelector(".close-btn");
    const closeExportBtn = exportPanel?.querySelector(".close-btn"); // Assuming export panel has one
    const closeImportBtn = importPanel?.querySelector(".close-btn"); // Assuming import panel has one

    if (closeFilterBtn) closeFilterBtn.addEventListener("click", () => togglePanel(filterPanel));
    if (cancelExportBtn && exportPanel) cancelExportBtn.addEventListener("click", () => togglePanel(exportPanel)); // Keep original cancel
    if (closeExportBtn && exportPanel && closeExportBtn !== cancelExportBtn) closeExportBtn.addEventListener("click", () => togglePanel(exportPanel)); // Add close if different
    if (cancelImportBtn && importPanel) cancelImportBtn.addEventListener("click", () => togglePanel(importPanel)); // Keep original cancel
    if (closeImportBtn && importPanel && closeImportBtn !== cancelImportBtn) closeImportBtn.addEventListener("click", () => togglePanel(importPanel)); // Add close if different

    if (applyFilterBtn) applyFilterBtn.addEventListener("click", applyFilters);
    if (resetFilterBtn) resetFilterBtn.addEventListener("click", resetFilters);
    if (doExportBtn) doExportBtn.addEventListener("click", handleExportData);
    if (doImportBtn) doImportBtn.addEventListener("click", handleImportData);

    const requestsTable = document.getElementById("requestsTable");
    const requestsTableSearch = document.getElementById("requestsTableSearch");
    if (requestsTable) {
      requestsTable.addEventListener("click", (e) => {
        const th = e.target.closest("th.sortable");
        if (!th) return;
        const column = th.getAttribute("data-sort");
        if (sortState.column === column) {
          sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.column = column;
          sortState.direction = 'asc';
        }
        renderRequestsTable(lastLoadedRequests);
        updateSortIndicators();
      });
    }
    if (requestsTableSearch) {
      requestsTableSearch.addEventListener("input", (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderRequestsTable(lastLoadedRequests);
      });
    }

    // Add quick filter container above the table
    if (requestsTable) {
      const quickFiltersDiv = document.createElement("div");
      quickFiltersDiv.id = "requestsQuickFilters";
      quickFiltersDiv.style.marginBottom = "8px";
      requestsTable.parentNode.insertBefore(quickFiltersDiv, requestsTable);
      renderQuickFilters();
    }

    // Add summary/sparkline container above the table
    if (requestsTable) {
      const summaryDiv = document.createElement("div");
      summaryDiv.id = "requestsSummarySparklines";
      summaryDiv.style.marginBottom = "8px";
      requestsTable.parentNode.insertBefore(summaryDiv, requestsTable);
    }

    console.log("popup.js: Event listeners attached.");

    loadPopupConfig(); // Load config after listeners are set

    // Initial tab load logic (slightly adjusted)
    setTimeout(() => {
      console.log("popup.js: Setting initial tab...");
      const defaultTabId = config?.display?.defaultTab || "requests";
      const initialActiveTabButton = tabsContainer?.querySelector(`.tab-btn[data-tab="${defaultTabId}"]`);
      let activeTabSet = false;

      if (initialActiveTabButton && !initialActiveTabButton.classList.contains("active")) {
        console.log(`popup.js: Clicking default tab: ${defaultTabId}`);
        initialActiveTabButton.click();
        activeTabSet = true;
      } else if (document.querySelector(".tab-btn.active")) {
        console.log("popup.js: A tab is already active.");
        // Ensure data loads for the already active tab if needed
        const activeTabButton = document.querySelector(".tab-btn.active");
        const activeTabId = activeTabButton?.getAttribute("data-tab");
        if (activeTabId === "requests" && requestsTableBody && requestsTableBody.rows.length === 0) {
          console.log("popup.js: Loading requests for already active requests tab.");
          loadRequests();
        } else if (activeTabId === "stats") {
          console.log("popup.js: Loading stats for already active stats tab.");
          loadStats();
        }
        activeTabSet = true;
      } else {
        const firstTabButton = tabsContainer?.querySelector(".tab-btn");
        if (firstTabButton) {
          const firstTabId = firstTabButton.getAttribute("data-tab");
          console.log(`popup.js: Clicking first available tab: ${firstTabId}`);
          firstTabButton.click();
          activeTabSet = true;
        } else {
          console.warn("popup.js: No tabs found, loading requests by default.");
          loadRequests(); // Fallback if no tabs exist
          activeTabSet = true;
        }
      }
      console.log("popup.js: Initial tab setup complete.");
    }, 150); // Slightly increased timeout just in case

    chrome.runtime.onMessage.addListener((message) => {
      console.log("popup.js: Received message:", message.action); // Log incoming messages
      if (
        message.action === "requestUpdated" ||
        message.action === "requestsCleared" ||
        message.action === "database:imported"
      ) {
        const activeTabButton = document.querySelector(".tab-btn.active");
        if (activeTabButton) {
          const activeTabId = activeTabButton.getAttribute("data-tab");
          if (activeTabId === "requests") {
            loadRequests();
          } else if (activeTabId === "stats") {
            loadStats();
          }
        }
      }
      if (message.action === "configUpdated") {
        loadPopupConfig();
      }
    });

    console.log("popup.js: DOMContentLoaded handler finished.");
  } catch (error) { // Add catch block
    console.error("Error during popup initialization:", error);
    // Optionally display an error message to the user in the popup UI
    const body = document.querySelector('body');
    if (body) {
        body.innerHTML = '<div style="padding: 20px; color: red;">Error initializing popup. Please check the console.</div>';
    }
  }
});

// --- Quick Filter Buttons for Requests Tab ---
function renderQuickFilters() {
  const container = document.getElementById("requestsQuickFilters");
  if (!container) return;
  container.innerHTML = `
    <button class="quick-filter-btn" data-filter="all">All</button>
    <button class="quick-filter-btn" data-filter="success">Success</button>
    <button class="quick-filter-btn" data-filter="error">Errors</button>
    <button class="quick-filter-btn" data-filter="slow">Slow</button>
  `;
  container.querySelectorAll(".quick-filter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const filter = btn.getAttribute("data-filter");
      activeFilters.quick = filter;
      loadRequests();
      container.querySelectorAll(".quick-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

// Patch loadRequests to apply quick filter
const originalRenderRequestsTable = renderRequestsTable;
renderRequestsTable = function(requests) {
  if (!requestsTableBody) return;
  lastLoadedRequests = requests;
  let filtered = requests;
  if (activeFilters.quick && activeFilters.quick !== "all") {
    if (activeFilters.quick === "success") {
      filtered = filtered.filter(r => r.statusCode >= 200 && r.statusCode < 300);
    } else if (activeFilters.quick === "error") {
      filtered = filtered.filter(r => r.statusCode >= 400 || r.status === "error");
    } else if (activeFilters.quick === "slow") {
      filtered = filtered.filter(r => r.duration && r.duration > 1000);
    }
  }
  if (searchQuery) {
    filtered = filtered.filter(r =>
      (r.method && r.method.toLowerCase().includes(searchQuery)) ||
      (r.domain && r.domain.toLowerCase().includes(searchQuery)) ||
      (r.path && r.path.toLowerCase().includes(searchQuery)) ||
      (r.statusCode && String(r.statusCode).includes(searchQuery)) ||
      (r.status && String(r.status).toLowerCase().includes(searchQuery)) ||
      (r.type && r.type.toLowerCase().includes(searchQuery)) ||
      (r.url && r.url.toLowerCase().includes(searchQuery))
    );
  }
  if (sortState.column) {
    filtered = filtered.slice().sort((a, b) => {
      let valA = a[sortState.column];
      let valB = b[sortState.column];
      if (sortState.column === 'size' || sortState.column === 'duration') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (sortState.column === 'time') {
        valA = a.startTime;
        valB = b.startTime;
      } else {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      }
      if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  requestsTableBody.innerHTML = "";
  if (filtered.length === 0) {
    requestsTableBody.innerHTML =
      '<tr><td colspan="8">No requests captured yet.</td></tr>';
    hideLiveIndicator();
    return;
  }
  filtered.forEach((request) => {
    const row = document.createElement("tr");
    row.dataset.requestId = request.id;
    let statusClass = "";
    if (request.statusCode >= 200 && request.statusCode < 300) {
      statusClass = "status-success";
    } else if (request.statusCode >= 400) {
      statusClass = "status-error";
    } else if (request.statusCode >= 300 && request.statusCode < 400) {
      statusClass = "status-redirect";
    } else if (request.status === "pending") {
      statusClass = "status-pending";
    }
    row.innerHTML = `
      <td>${request.method}</td>
      <td>${request.domain || "-"}</td>
      <td class="path-cell" title="${request.path || "-"}">${
      request.path || "-"
    }</td>
      <td class="${statusClass}">${
      request.statusCode || request.status || "-"
    }</td>
      <td>${request.type || "-"}</td>
      <td>${request.size ? formatBytes(request.size) : "-"}</td>
      <td>${request.duration ? `${Math.round(request.duration)}ms` : "-"}</td>
      <td>${new Date(request.startTime).toLocaleTimeString()}</td>
    `;
    row.addEventListener("click", () => {
      // Remove any existing expanded row
      const existing = document.querySelector(".request-details-row");
      if (existing) existing.remove();
      renderExpandableRow(request, row);
    });
    requestsTableBody.appendChild(row);
  });
  // Show live indicator if new requests are being captured
  if (filtered.length > lastRequestCount) {
    showLiveIndicator();
  } else {
    hideLiveIndicator();
  }
  lastRequestCount = filtered.length;
  renderDomainSummaryAndSparklines(filtered);
};

// --- Enhanced Mini Sparkline and Summary for Requests Tab ---
function renderDomainSummaryAndSparklines(requests) {
  const container = document.getElementById("requestsSummarySparklines");
  if (!container) return;
  // Get all unique domains
  const allDomains = Array.from(new Set(requests.map(r => r.domain).filter(Boolean)));
  // Domain selector if multiple domains
  let domain = activeFilters.domain || null;
  if (!domain && requests.length > 0) {
    domain = requests[0].domain;
  }
  container.innerHTML = "";
  if (allDomains.length > 1) {
    const select = document.createElement("select");
    select.id = "domainSummarySelect";
    allDomains.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (d === domain) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", e => {
      activeFilters.domain = select.value;
      loadRequests();
    });
    container.appendChild(select);
  }
  // Filter requests for current domain
  const domainRequests = domain ? requests.filter(r => r.domain === domain) : requests;
  if (!domainRequests.length) {
    container.innerHTML += '<div class="no-data">No requests for this domain.</div>';
    return;
  }
  // Stats
  const durations = domainRequests.map(r => r.duration || 0).filter(x => x > 0);
  const avg = durations.reduce((sum, v) => sum + v, 0) / (durations.length || 1);
  const max = Math.max(...durations);
  const min = Math.min(...durations);
  const sorted = durations.slice().sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const successCount = domainRequests.filter(r => r.statusCode >= 200 && r.statusCode < 300).length;
  const errorCount = domainRequests.filter(r => r.statusCode >= 400).length;
  const slowCount = domainRequests.filter(r => r.duration > 1000).length;
  const mostStatus = mode(domainRequests.map(r => r.statusCode));
  const mostMethod = mode(domainRequests.map(r => r.method));
  // Summary
  container.innerHTML += `
    <div class="domain-summary">
      <b>Domain:</b> ${domain} &nbsp; <b>Requests:</b> ${domainRequests.length} &nbsp; <b>Success:</b> ${successCount} &nbsp; <b>Errors:</b> ${errorCount} &nbsp; <b>Slow:</b> ${slowCount}<br>
      <b>Avg:</b> ${Math.round(avg)}ms &nbsp; <b>Median:</b> ${Math.round(median)}ms &nbsp; <b>P95:</b> ${Math.round(p95)}ms &nbsp; <b>Min:</b> ${Math.round(min)}ms &nbsp; <b>Max:</b> ${Math.round(max)}ms<br>
      <b>Most Status:</b> ${mostStatus || '-'} &nbsp; <b>Most Method:</b> ${mostMethod || '-'}
    </div>
    <canvas id="domainSparkline" width="160" height="32" style="vertical-align:middle;"></canvas>
  `;
  // Recent response times (last 10)
  const recent = domainRequests.slice(0, 10).map(r => Math.round(r.duration || 0));
  // Draw sparkline with outlier coloring, tooltip, and moving average
  const canvas = document.getElementById("domainSparkline");
  if (canvas && recent.length > 1) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw sparkline
    ctx.strokeStyle = "#007bff";
    ctx.beginPath();
    for (let i = 0; i < recent.length; i++) {
      const x = (i / (recent.length - 1)) * (canvas.width - 2) + 1;
      const y = canvas.height - 2 - ((recent[i] - min) / (max - min || 1)) * (canvas.height - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Draw outlier points (slow)
    for (let i = 0; i < recent.length; i++) {
      if (recent[i] > 1000) {
        const x = (i / (recent.length - 1)) * (canvas.width - 2) + 1;
        const y = canvas.height - 2 - ((recent[i] - min) / (max - min || 1)) * (canvas.height - 4);
        ctx.fillStyle = "#e74c3c";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    // Draw moving average
    ctx.strokeStyle = "#888";
    ctx.beginPath();
    let sum = 0;
    for (let i = 0; i < recent.length; i++) {
      sum += recent[i];
      const avg = sum / (i + 1);
      const x = (i / (recent.length - 1)) * (canvas.width - 2) + 1;
      const y = canvas.height - 2 - ((avg - min) / (max - min || 1)) * (canvas.height - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Tooltip on hover
    canvas.onmousemove = function(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const idx = Math.round((mx - 1) / (canvas.width - 2) * (recent.length - 1));
      if (recent[idx] !== undefined) {
        canvas.title = `#${idx + 1}: ${recent[idx]}ms`;
      } else {
        canvas.title = '';
      }
    };
    canvas.setAttribute('aria-label', 'Recent response times sparkline for domain ' + domain);
  }
}
function mode(arr) {
  if (!arr.length) return null;
  const counts = {};
  let max = 0, maxVal = null;
  arr.forEach(v => {
    if (v == null) return;
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > max) {
      max = counts[v];
      maxVal = v;
    }
  });
  return maxVal;
}

// --- Mini Sparkline and Summary for Requests Tab ---
function applyFilters() {
  activeFilters.status = statusFilter?.value || "all";
  activeFilters.type = typeFilter?.value || "all";
  activeFilters.domain = domainFilter?.value.trim() || "";
  activeFilters.url = urlFilter?.value.trim() || "";
  activeFilters.startDate = startDateFilter?.value || "";
  activeFilters.endDate = endDateFilter?.value || "";

  currentPage = 1;
  loadRequests();
  // Also reload Plots tab if mounted
  const plotsTab = document.getElementById("plots-tab");
  if (plotsTab && plotsTab._vizMounted && typeof plotsTab._vizMounted.reload === "function") {
    plotsTab._vizMounted.reload(activeFilters);
  }
  togglePanel(filterPanel);
  showNotification("Filters applied.");
}

function resetFilters() {
  if (statusFilter) statusFilter.value = "all";
  if (typeFilter) typeFilter.value = "all";
  if (domainFilter) domainFilter.value = "";
  if (urlFilter) urlFilter.value = "";
  if (startDateFilter) startDateFilter.value = "";
  if (endDateFilter) endDateFilter.value = "";

  activeFilters = { status: "all", type: "all", domain: "", url: "", startDate: "", endDate: "", quick: "all" };
  currentPage = 1;
  loadRequests();
  // Also reload Plots tab if mounted
  const plotsTab = document.getElementById("plots-tab");
  if (plotsTab && plotsTab._vizMounted && typeof plotsTab._vizMounted.reload === "function") {
    plotsTab._vizMounted.reload(activeFilters);
  }
  showNotification("Filters reset.");
}

function loadExportPanelData() {
  // Fetch DB Stats for size
  chrome.runtime.sendMessage({ action: "getDatabaseStats" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error fetching DB stats for export panel:", chrome.runtime.lastError.message);
      if (exportDbSizeSpan) exportDbSizeSpan.textContent = "Error";
      return;
    }
    if (response && response.success && response.stats && exportDbSizeSpan) {
      exportDbSizeSpan.textContent = formatBytes(response.stats.dbSize || 0);
    } else if (exportDbSizeSpan) {
      exportDbSizeSpan.textContent = "N/A";
      if (response && !response.success) {
        console.error("Failed to load DB stats for export panel:", response.error);
      }
    }
  });

  // Set default filename
  if (exportFilenameInput) {
    const date = new Date().toISOString().slice(0, 10);
    exportFilenameInput.value = `ura-export-${date}`;
  }

  // Populate export format options (assuming exportManager provides these)
  // For now, let's hardcode common options. Ideally, this comes from background.
  if (exportFormatSelect) {
    exportFormatSelect.innerHTML = ''; // Clear existing options
    const formats = ['json', 'csv', 'sqlite']; // Example formats
    formats.forEach(format => {
        const option = document.createElement('option');
        option.value = format;
        option.textContent = format.toUpperCase();
        exportFormatSelect.appendChild(option);
    });
    // Set default format from config if available
    exportFormatSelect.value = config?.export?.defaultFormat || config?.display?.defaultExportFormat || "json";
  }
}

function handleExportData() {
  const format = exportFormatSelect?.value || "json";
  const filename = exportFilenameInput?.value.trim() || `ura-export-${Date.now()}`;
  showNotification(`Exporting data as ${format.toUpperCase()}...`);
  eventRequest("exportData", { format, filename }, (response) => {
    if (response && response.success) {
      showNotification("Data exported successfully.");
    } else {
      showNotification(`Error exporting data: ${response?.error || "Unknown error"}`, true);
    }
    togglePanel(exportPanel);
  });
}

function resetImportPanel() {
  if (importFile) importFile.value = null;
  if (importStatus) importStatus.textContent = "";
}

function handleImportData() {
  const fileInput = importFile;
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showNotification("Please select a file to import.", true);
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = (event) => {
    const fileContent = event.target.result;
    let format = file.name.split(".").pop().toLowerCase();
    if (format === "db") format = "sqlite";

    if (!["json", "csv", "sqlite"].includes(format)) {
      showNotification(`Unsupported import format: ${format}. Use JSON, CSV, or SQLite.`, true);
      return;
    }

    if (importStatus) importStatus.textContent = "Importing... please wait.";
    showNotification("Importing data...");

    eventRequest("importData", { format, data: fileContent }, (response) => {
      if (response && response.success) {
        showNotification(`Import successful! ${response.count || 0} records added.`);
        if (importStatus) importStatus.textContent = `Import successful! ${response.count || 0} records added.`;
        loadRequests();
        loadStats();
      } else {
        const errorMsg = `Import failed: ${response?.error || "Unknown error"}`;
        showNotification(errorMsg, true);
        if (importStatus) importStatus.textContent = errorMsg;
      }
    });
  };

  reader.onerror = () => {
    const errorMsg = "Error reading file.";
    showNotification(errorMsg, true);
    if (importStatus) importStatus.textContent = errorMsg;
  };

  if (format === "sqlite") {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
}

function loadPopupConfig() {
  eventRequest("getConfig", {}, (response) => {
    if (response && response.config) {
      config = response.config;
      itemsPerPage = config.display?.requestsPerPage || 50;
    } else {
      console.warn("Failed to load config, using defaults.");
      itemsPerPage = 50;
    }
    const activeTabButton = document.querySelector(".tab-btn.active");
    const activeTabId = activeTabButton?.getAttribute("data-tab");
    if (activeTabId === "requests") {
      loadRequests();
    } else if (activeTabId === "stats") {
      loadStats();
    }
    updatePagination();
  });
}

// --- Settings Tab Functions ---

function loadPopupSettings() {
  eventRequest("getConfig", {}, (response) => {
    if (response && response.config) {
      const currentConfig = response.config;
      if (themeSelector) {
        themeSelector.value = currentConfig.display?.theme || "system";
      }
      if (requestsPerPagePopupInput) {
        requestsPerPagePopupInput.value = currentConfig.display?.requestsPerPagePopup || 50;
      }
      if (showTimingBarsPopupCheckbox) {
        showTimingBarsPopupCheckbox.checked = currentConfig.display?.showTimingBarsPopup ?? true;
      }
      console.log("Popup settings loaded into UI.");
    } else {
      console.warn("Failed to load config for popup settings tab.", response?.error);
      // Optionally disable controls or show an error
    }
  });
}

function savePopupSettings() {
  console.log("Saving popup settings...");
  const newSettings = {
    display: {
      ...(config.display || {}), // Preserve other display settings
      theme: themeSelector?.value || "system",
      requestsPerPagePopup: parseInt(requestsPerPagePopupInput?.value, 10) || 50,
      showTimingBarsPopup: showTimingBarsPopupCheckbox?.checked ?? true,
    }
  };

  // Send only the updated part of the config
  eventRequest("updateConfig", { config: newSettings }, (response) => {
    if (response && response.success) {
      showNotification("Popup settings saved.");
      // Update local config variable if needed, or rely on configUpdated message
      config = { ...config, ...newSettings }; // Simple merge
      // Re-apply theme immediately
      if (themeManager && newSettings.display.theme) {
        themeManager.applyTheme(newSettings.display.theme);
      }
      // Update itemsPerPage if it changed
      itemsPerPage = newSettings.display.requestsPerPagePopup;
      updatePagination(); // Update pagination based on new itemsPerPage
      loadRequests(); // Reload requests with new page size

    } else {
      showNotification(`Error saving settings: ${response?.error || "Unknown error"}`, true);
    }
  });
}

// --- End Settings Tab Functions ---

// Open options page function
function openOptionsPage() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("src/options/options.html"));
  }
}

// Load requests from background script
function loadRequests() {
  const requestId = generateRequestId();
  pendingGetRequests[requestId] = (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error loading requests (connection):", chrome.runtime.lastError.message);
      if (requestsTableBody) {
        requestsTableBody.innerHTML =
          '<tr><td colspan="8">Error connecting to background service. Please try again.</td></tr>';
      }
      return;
    }

    if (response && response.requests) {
      totalItems = response.total || 0;
      totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      renderRequestsTable(response.requests);
      updatePagination();
      if (typeof updateStatsSummary === "function" && response.stats) {
        updateStatsSummary(response.stats);
      }
    } else {
      const errorMessage = response?.error || "Unknown error loading requests.";
      console.error("Error loading requests (response):", errorMessage);
      if (requestsTableBody) {
        requestsTableBody.innerHTML = `<tr><td colspan="8">Error loading requests: ${errorMessage}</td></tr>`;
      }
    }
  };

  chrome.runtime.sendMessage(
    {
      action: "getRequests",
      page: currentPage,
      limit: itemsPerPage,
      filters: activeFilters,
      requestId
    }
  );
}

// Update pagination UI
function updatePagination() {
  if (!pageInfoEl || !prevPageBtn || !nextPageBtn) return;
  pageInfoEl.textContent = `Page ${currentPage} of ${totalPages} (${totalItems} items)`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

// Change page
function changePage(page) {
  if (page < 1 || page > totalPages) return;

  currentPage = page;
  loadRequests();
}

// Update stats summary panel (Requests tab)
function updateStatsSummary(stats) {
  if (!totalRequestsEl || !avgResponseTimeEl || !successRateEl) return;
  if (stats?.error) {
    totalRequestsEl.textContent = "Error";
    avgResponseTimeEl.textContent = "Error";
    successRateEl.textContent = "Error";
    return;
  }
  totalRequestsEl.textContent = (stats?.requestCount ?? stats?.totalRequests ?? totalItems)?.toLocaleString() || "0";
  avgResponseTimeEl.textContent = stats?.avgResponseTime ? `${Math.round(stats.avgResponseTime)} ms` : "0 ms";
  successRateEl.textContent = stats?.successRate ? `${stats.successRate.toFixed(1)}%` : "0%";
}

// Update statistics tab UI
function updateStatisticsTab(stats) {
  document.getElementById("statsTotalRequests").textContent = stats?.requestCount?.toLocaleString() || "0";
  document.getElementById("statsAvgResponseTime").textContent = stats?.avgResponseTime ? `${Math.round(stats.avgResponseTime)} ms` : "0 ms";
  document.getElementById("statsSuccessfulRequests").textContent = stats?.successCount?.toLocaleString() || "0";
  document.getElementById("statsFailedRequests").textContent = stats?.errorCount?.toLocaleString() || "0";
  // Advanced metrics
  document.getElementById("statsDbSize").textContent = stats?.size ? `${(stats.size/1024/1024).toFixed(2)} MB` : "-";
  document.getElementById("statsAvgDns").textContent = stats?.avgTimings?.avgDns ? `${Math.round(stats.avgTimings.avgDns)} ms` : "-";
  document.getElementById("statsAvgTcp").textContent = stats?.avgTimings?.avgTcp ? `${Math.round(stats.avgTimings.avgTcp)} ms` : "-";
  document.getElementById("statsAvgSsl").textContent = stats?.avgTimings?.avgSsl ? `${Math.round(stats.avgTimings.avgSsl)} ms` : "-";
  document.getElementById("statsAvgTtfb").textContent = stats?.avgTimings?.avgTtfb ? `${Math.round(stats.avgTimings.avgTtfb)} ms` : "-";
  document.getElementById("statsAvgDownload").textContent = stats?.avgTimings?.avgDownload ? `${Math.round(stats.avgTimings.avgDownload)} ms` : "-";
  // Status codes
  const statusCodesEl = document.getElementById("statsStatusCodes");
  statusCodesEl.innerHTML = stats?.statusCodes?.length ? stats.statusCodes.map(s => `<div>${s.status}: ${s.count}</div>`).join("") : "-";
  // Request types
  const typesEl = document.getElementById("statsRequestTypes");
  typesEl.innerHTML = stats?.requestTypes?.length ? stats.requestTypes.map(t => `<div>${t.type}: ${t.count}</div>`).join("") : "-";
  // Top domains (if available)
  const domainsEl = document.getElementById("statsTopDomains");
  domainsEl.innerHTML = stats?.topDomains?.length ? stats.topDomains.map(d => `<div>${d.domain}: ${d.count}</div>`).join("") : "-";
}

// --- Enhanced Statistics Tab ---
function renderStatisticsTrends(stats, prevStats) {
  // Helper to get trend arrow
  function trendArrow(current, prev) {
    if (prev == null) return '';
    if (current > prev) return '↑';
    if (current < prev) return '↓';
    return '→';
  }
  // Error rate
  const errorRate = stats.requestCount ? (stats.errorCount / stats.requestCount) * 100 : 0;
  const prevErrorRate = prevStats && prevStats.requestCount ? (prevStats.errorCount / prevStats.requestCount) * 100 : null;
  // Slowest request
  const slowest = stats.maxDuration || 0;
  const prevSlowest = prevStats ? prevStats.maxDuration : null;
  // Most common domain/type/method
  const mostDomain = stats.topDomains && stats.topDomains[0] ? stats.topDomains[0].domain : '-';
  const prevMostDomain = prevStats && prevStats.topDomains && prevStats.topDomains[0] ? prevStats.topDomains[0].domain : null;
  const mostType = stats.requestTypes && stats.requestTypes[0] ? stats.requestTypes[0].type : '-';
  const prevMostType = prevStats && prevStats.requestTypes && prevStats.requestTypes[0] ? prevStats.requestTypes[0].type : null;
  const mostMethod = stats.mostMethod || '-';
  const prevMostMethod = prevStats ? prevStats.mostMethod : null;
  // Render
  document.getElementById("statsErrorRate").textContent = `${errorRate.toFixed(1)}% ${trendArrow(errorRate, prevErrorRate)}`;
  document.getElementById("statsSlowest").textContent = `${Math.round(slowest)} ms ${trendArrow(slowest, prevSlowest)}`;
  document.getElementById("statsMostDomain").textContent = `${mostDomain} ${trendArrow(mostDomain, prevMostDomain)}`;
  document.getElementById("statsMostType").textContent = `${mostType} ${trendArrow(mostType, prevMostType)}`;
  document.getElementById("statsMostMethod").textContent = `${mostMethod} ${trendArrow(mostMethod, prevMostMethod)}`;
}

// --- Time Window Selection ---
let statsTimeWindow = 'hour'; // default
function renderStatsTimeWindowSelector() {
  const container = document.getElementById('statsTimeWindowSelector');
  if (!container) return;
  container.innerHTML = `
    <label for="statsTimeWindow">Time Window:</label>
    <select id="statsTimeWindow">
      <option value="5min">Last 5 min</option>
      <option value="hour" selected>Last hour</option>
      <option value="day">Today</option>
      <option value="all">All</option>
    </select>
  `;
  const select = document.getElementById('statsTimeWindow');
  select.value = statsTimeWindow;
  select.addEventListener('change', e => {
    statsTimeWindow = select.value;
    loadStats();
  });
}

// Patch loadStats to use time window and fetch previous stats for trends
const originalLoadStats = loadStats;
loadStats = function() {
  renderStatsTimeWindowSelector();
  // Calculate time window
  let filters = {};
  const now = Date.now();
  if (statsTimeWindow === '5min') filters.startDate = new Date(now - 5 * 60 * 1000).toISOString();
  else if (statsTimeWindow === 'hour') filters.startDate = new Date(now - 60 * 60 * 1000).toISOString();
  else if (statsTimeWindow === 'day') {
    const d = new Date(); d.setHours(0,0,0,0); filters.startDate = d.toISOString();
  }
  // Fetch current stats
  eventRequest('getFilteredStats', { filters }, (response) => {
    if (response && response.stats) {
      updateStatisticsTab(response.stats);
      // Fetch previous period for trend
      let prevFilters = { ...filters };
      if (statsTimeWindow === '5min') prevFilters.startDate = new Date(now - 10 * 60 * 1000).toISOString(), prevFilters.endDate = new Date(now - 5 * 60 * 1000).toISOString();
      else if (statsTimeWindow === 'hour') prevFilters.startDate = new Date(now - 2 * 60 * 60 * 1000).toISOString(), prevFilters.endDate = new Date(now - 60 * 60 * 1000).toISOString();
      else if (statsTimeWindow === 'day') { const d = new Date(); d.setHours(0,0,0,0); prevFilters.startDate = new Date(d.getTime() - 24*60*60*1000).toISOString(); prevFilters.endDate = d.toISOString(); }
      else prevFilters = null;
      if (prevFilters) {
        eventRequest('getFilteredStats', { filters: prevFilters }, (prevResp) => {
          renderStatisticsTrends(response.stats, prevResp && prevResp.stats ? prevResp.stats : null);
        });
      } else {
        renderStatisticsTrends(response.stats, null);
      }
    } else {
      updateStatisticsTab({ error: response?.error || "Unknown error loading stats." });
    }
  });
};

// Patch updateStatisticsTab to add new stats fields
const originalUpdateStatisticsTab = updateStatisticsTab;
updateStatisticsTab = function(stats) {
  originalUpdateStatisticsTab(stats);
  // Add error rate, slowest, most common domain/type/method
  document.getElementById("statsErrorRate").textContent = stats.requestCount ? ((stats.errorCount / stats.requestCount) * 100).toFixed(1) + '%' : '0%';
  document.getElementById("statsSlowest").textContent = stats.maxDuration ? Math.round(stats.maxDuration) + ' ms' : '-';
  document.getElementById("statsMostDomain").textContent = stats.topDomains && stats.topDomains[0] ? stats.topDomains[0].domain : '-';
  document.getElementById("statsMostType").textContent = stats.requestTypes && stats.requestTypes[0] ? stats.requestTypes[0].type : '-';
  document.getElementById("statsMostMethod").textContent = stats.mostMethod || '-';
};

// Show request details panel
function showRequestDetails(request) {
  if (!requestDetails) return;
  document.getElementById("detailUrl").textContent = request.url;
  document.getElementById("detailMethod").textContent = request.method;

  document.getElementById("detailStatus").textContent =
    request.statusCode || request.status || "-";
  document.getElementById("detailType").textContent = request.type || "-";
  document.getElementById("detailDomain").textContent = request.domain || "-";
  document.getElementById("detailPath").textContent = request.path || "-";
  document.getElementById("detailSize").textContent = request.size
    ? formatBytes(request.size)
    : "-";
  document.getElementById("detailStartTime").textContent = request.startTime
    ? new Date(request.startTime).toLocaleTimeString()
    : "-";
  document.getElementById("detailEndTime").textContent = request.endTime
    ? new Date(request.endTime).toLocaleTimeString()
    : "-";
  document.getElementById("detailDuration").textContent = request.duration
    ? `${Math.round(request.duration)}ms`
    : "-";

  const timings = request.timings || {};
  const maxDuration = request.duration || 0;

  updateTimingBar("dnsBar", "dnsTime", timings.dns || 0, maxDuration);
  updateTimingBar("tcpBar", "tcpTime", timings.tcp || 0, maxDuration);
  updateTimingBar("sslBar", "sslTime", timings.ssl || 0, maxDuration);
  updateTimingBar("ttfbBar", "ttfbTime", timings.ttfb || 0, maxDuration);
  updateTimingBar(
    "downloadBar",
    "downloadTime",
    timings.download || 0,
    maxDuration
  );

  const headersContainer = document.getElementById("headersContainer");
  headersContainer.innerHTML = "";

  fetchRequestHeaders(request.id, (response) => {
    if (response && response.headers && response.headers.length > 0) {
      const table = document.createElement("table");
      table.className = "headers-table";

      const thead = document.createElement("thead");
      thead.innerHTML = "<tr><th>Name</th><th>Value</th></tr>";
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      response.headers.forEach((header) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${header.name}</td>
            <td>${header.value}</td>
          `;
        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      headersContainer.appendChild(table);
    } else {
      headersContainer.innerHTML =
        '<p class="no-data">No headers available</p>';
    }
  });

  requestDetails.classList.add("visible");
}

// Update a timing bar
function updateTimingBar(barId, timeId, duration, maxDuration) {
  const bar = document.getElementById(barId);
  const timeEl = document.getElementById(timeId);

  if (!bar || !timeEl) return;

  if (maxDuration > 0 && duration > 0) {
    const percentage = Math.min((duration / maxDuration) * 100, 100);
    bar.style.width = `${percentage}%`;
  } else {
    bar.style.width = "0%";
  }

  timeEl.textContent = `${Math.round(duration)}ms`;
}

// Hide request details panel
function hideRequestDetails() {
  if (!requestDetails) return;
  requestDetails.classList.remove("visible");
}

// Clear all requests
function clearRequests() {
  eventRequest("getConfig", {}, (response) => {
    const confirmNeeded =
      response?.config?.general?.confirmClearRequests ?? true;
    if (
      !confirmNeeded ||
      confirm(
        "Are you sure you want to clear all captured requests? This cannot be undone."
      )
    ) {
      eventRequest("clearRequests", {}, (clearResp) => {
        if (clearResp && clearResp.success) {
          loadRequests();
          hideRequestDetails();
          showNotification("All requests cleared successfully");
        }
      });
    }
  });
}

function updateSortIndicators() {
  const ths = document.querySelectorAll('#requestsTable th.sortable');
  ths.forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.getAttribute('data-sort') === sortState.column) {
      th.classList.add(sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

// --- Live Indicator for Requests Tab ---
let liveIndicator = null;
let lastRequestCount = 0;

function showLiveIndicator() {
  if (!liveIndicator) {
    liveIndicator = document.createElement("span");
    liveIndicator.id = "liveIndicator";
    liveIndicator.textContent = "● Live";
    liveIndicator.style.color = "#28a745";
    liveIndicator.style.fontWeight = "bold";
    liveIndicator.style.marginLeft = "12px";
    const statsPanel = document.querySelector(".stats-panel");
    if (statsPanel) statsPanel.appendChild(liveIndicator);
  }
  liveIndicator.style.display = "inline";
}

function hideLiveIndicator() {
  if (liveIndicator) liveIndicator.style.display = "none";
}

// --- Expandable Rows for Requests Table ---
function renderExpandableRow(request, row) {
  // Only one expanded at a time
  const existing = document.querySelector(".request-details-row");
  if (existing) existing.remove();

  const detailsRow = document.createElement("tr");
  detailsRow.className = "request-details-row";
  const detailsCell = document.createElement("td");
  detailsCell.colSpan = 8;
  detailsCell.style.background = "#f9f9f9";
  detailsCell.style.padding = "12px 24px";
  detailsCell.innerHTML = `
    <div><b>URL:</b> ${request.url}</div>
    <div><b>Status:</b> ${request.statusCode || request.status || "-"} ${request.statusText || ""}</div>
    <div><b>Type:</b> ${request.type || "-"}</div>
    <div><b>Domain:</b> ${request.domain || "-"}</div>
    <div><b>Path:</b> ${request.path || "-"}</div>
    <div><b>Duration:</b> ${request.duration ? Math.round(request.duration) + "ms" : "-"}</div>
    <div><b>Size:</b> ${request.size ? formatBytes(request.size) : "-"}</div>
    <div><b>Start Time:</b> ${request.startTime ? new Date(request.startTime).toLocaleTimeString() : "-"}</div>
    <div><b>End Time:</b> ${request.endTime ? new Date(request.endTime).toLocaleTimeString() : "-"}</div>
    <div><b>Headers:</b> <span class="expand-headers" style="color:#007bff;cursor:pointer;">Show</span></div>
    <div class="headers-content" style="display:none;"></div>
  `;
  detailsRow.appendChild(detailsCell);
  row.parentNode.insertBefore(detailsRow, row.nextSibling);

  // Toggle headers
  const showHeaders = detailsCell.querySelector(".expand-headers");
  const headersContent = detailsCell.querySelector(".headers-content");
  let headersLoaded = false;
  showHeaders.addEventListener("click", () => {
    if (!headersLoaded) {
      fetchRequestHeaders(request.id, (response) => {
        if (response && response.headers && response.headers.length > 0) {
          headersContent.innerHTML = `<table class='headers-table'><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${response.headers.map(h => `<tr><td>${h.name}</td><td>${h.value}</td></tr>`).join("")}</tbody></table>`;
        } else {
          headersContent.innerHTML = '<p class="no-data">No headers available</p>';
        }
        headersLoaded = true;
        headersContent.style.display = "block";
        showHeaders.textContent = "Hide";
      });
    } else {
      if (headersContent.style.display === "none") {
        headersContent.style.display = "block";
        showHeaders.textContent = "Hide";
      } else {
        headersContent.style.display = "none";
        showHeaders.textContent = "Show";
      }
    }
  });
}

// Patch renderRequestsTable to support expandable rows and live indicator
const originalRenderRequestsTable2 = renderRequestsTable;
renderRequestsTable = function(requests) {
  if (!requestsTableBody) return;
  lastLoadedRequests = requests;
  let filtered = requests;
  if (activeFilters.quick && activeFilters.quick !== "all") {
    if (activeFilters.quick === "success") {
      filtered = filtered.filter(r => r.statusCode >= 200 && r.statusCode < 300);
    } else if (activeFilters.quick === "error") {
      filtered = filtered.filter(r => r.statusCode >= 400 || r.status === "error");
    } else if (activeFilters.quick === "slow") {
      filtered = filtered.filter(r => r.duration && r.duration > 1000);
    }
  }
  if (searchQuery) {
    filtered = filtered.filter(r =>
      (r.method && r.method.toLowerCase().includes(searchQuery)) ||
      (r.domain && r.domain.toLowerCase().includes(searchQuery)) ||
      (r.path && r.path.toLowerCase().includes(searchQuery)) ||
      (r.statusCode && String(r.statusCode).includes(searchQuery)) ||
      (r.status && String(r.status).toLowerCase().includes(searchQuery)) ||
      (r.type && r.type.toLowerCase().includes(searchQuery)) ||
      (r.url && r.url.toLowerCase().includes(searchQuery))
    );
  }
  if (sortState.column) {
    filtered = filtered.slice().sort((a, b) => {
      let valA = a[sortState.column];
      let valB = b[sortState.column];
      if (sortState.column === 'size' || sortState.column === 'duration') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (sortState.column === 'time') {
        valA = a.startTime;
        valB = b.startTime;
      } else {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      }
      if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  requestsTableBody.innerHTML = "";
  if (filtered.length === 0) {
    requestsTableBody.innerHTML =
      '<tr><td colspan="8">No requests captured yet.</td></tr>';
    hideLiveIndicator();
    return;
  }
  filtered.forEach((request) => {
    const row = document.createElement("tr");
    row.dataset.requestId = request.id;
    let statusClass = "";
    if (request.statusCode >= 200 && request.statusCode < 300) {
      statusClass = "status-success";
    } else if (request.statusCode >= 400) {
      statusClass = "status-error";
    } else if (request.statusCode >= 300 && request.statusCode < 400) {
      statusClass = "status-redirect";
    } else if (request.status === "pending") {
      statusClass = "status-pending";
    }
    row.innerHTML = `
      <td>${request.method}</td>
      <td>${request.domain || "-"}</td>
      <td class="path-cell" title="${request.path || "-"}">${
      request.path || "-"
    }</td>
      <td class="${statusClass}">${
      request.statusCode || request.status || "-"
    }</td>
      <td>${request.type || "-"}</td>
      <td>${request.size ? formatBytes(request.size) : "-"}</td>
      <td>${request.duration ? `${Math.round(request.duration)}ms` : "-"}</td>
      <td>${new Date(request.startTime).toLocaleTimeString()}</td>
    `;
    row.addEventListener("click", () => {
      // Remove any existing expanded row
      const existing = document.querySelector(".request-details-row");
      if (existing) existing.remove();
      renderExpandableRow(request, row);
    });
    requestsTableBody.appendChild(row);
  });
  // Show live indicator if new requests are being captured
  if (filtered.length > lastRequestCount) {
    showLiveIndicator();
  } else {
    hideLiveIndicator();
  }
  lastRequestCount = filtered.length;
  renderDomainSummaryAndSparklines(filtered);
};

/* --- UI/UX POLISH FOR REQUESTS TAB --- */
// Add loading spinner
let requestsLoadingSpinner = null;
function showRequestsLoading() {
  if (!requestsLoadingSpinner) {
    requestsLoadingSpinner = document.createElement("div");
    requestsLoadingSpinner.id = "requestsLoadingSpinner";
    requestsLoadingSpinner.setAttribute("role", "status");
    requestsLoadingSpinner.setAttribute("aria-live", "polite");
    requestsLoadingSpinner.innerHTML = `<div class="spinner" title="Loading requests..." aria-label="Loading requests"></div>`;
    requestsLoadingSpinner.style.display = "flex";
    requestsLoadingSpinner.style.justifyContent = "center";
    requestsLoadingSpinner.style.alignItems = "center";
    requestsLoadingSpinner.style.padding = "24px 0";
    requestsLoadingSpinner.style.width = "100%";
    requestsLoadingSpinner.style.background = "var(--background-color)";
    requestsTableBody.parentNode.insertBefore(requestsLoadingSpinner, requestsTableBody);
  }
  requestsLoadingSpinner.style.display = "flex";
}
function hideRequestsLoading() {
  if (requestsLoadingSpinner) requestsLoadingSpinner.style.display = "none";
}

// Patch loadRequests to show spinner
const originalLoadRequests = loadRequests;
loadRequests = function() {
  showRequestsLoading();
  setTimeout(() => { originalLoadRequests(); }, 100); // Simulate async for UX
};

// Patch renderRequestsTable to hide spinner and add empty state tip
const originalRenderRequestsTable4 = renderRequestsTable;
renderRequestsTable = function(requests) {
  hideRequestsLoading();
  originalRenderRequestsTable4(requests);
  // Add empty state tip
  if (requestsTableBody && requestsTableBody.innerHTML.includes('No requests captured yet.')) {
    requestsTableBody.innerHTML = `<tr><td colspan="8" class="empty-message">No requests captured yet.<br><span style='font-size:13px;color:#888;'>Tip: Browse a website or open DevTools to start capturing network requests.</span></td></tr>`;
  }
};

// Add ARIA and tooltips to quick filter buttons and domain selector
function enhanceAccessibilityAndTooltips() {
  const quickBtns = document.querySelectorAll('.quick-filter-btn');
  quickBtns.forEach(btn => {
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
    if (btn.dataset.filter === 'all') btn.title = 'Show all requests';
    if (btn.dataset.filter === 'success') btn.title = 'Show only successful (2xx) requests';
    if (btn.dataset.filter === 'error') btn.title = 'Show only error (4xx/5xx) requests';
    if (btn.dataset.filter === 'slow') btn.title = 'Show only slow requests (>1s)';
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') btn.click(); });
  });
  const domainSelect = document.getElementById('domainSummarySelect');
  if (domainSelect) {
    domainSelect.setAttribute('aria-label', 'Select domain to view summary and sparkline');
    domainSelect.title = 'Select domain to view summary and sparkline';
  }
}

// Patch renderDomainSummaryAndSparklines to call accessibility enhancer
const originalRenderDomainSummaryAndSparklines = renderDomainSummaryAndSparklines;
renderDomainSummaryAndSparklines = function(requests) {
  originalRenderDomainSummaryAndSparklines(requests);
  enhanceAccessibilityAndTooltips();
};

// Add hover/active states for quick filter buttons and table rows via JS (for theme support)
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.innerHTML = `
    .quick-filter-btn { margin-right: 6px; padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--surface-color); color: var(--text-primary-color); font-size: 13px; cursor: pointer; transition: background 0.2s, color 0.2s; }
    .quick-filter-btn.active, .quick-filter-btn:focus-visible { background: var(--primary-color); color: #fff; border-color: var(--primary-color); outline: none; }
    .quick-filter-btn:hover { background: var(--primary-color); color: #fff; }
    .domain-summary { margin-bottom: 4px; font-size: 13px; line-height: 1.6; }
    .spinner { border: 4px solid #eee; border-top: 4px solid var(--primary-color); border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
    tr.request-details-row td { background: var(--surface-color); }
    tr:hover:not(.request-details-row) { background: var(--primary-color); color: #fff; }
    .empty-message { text-align: center; color: #888; font-size: 15px; padding: 32px 0; }
  `;
  document.head.appendChild(style);
});
