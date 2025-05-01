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
};

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

let activePanel = null; // Keep track of the currently open panel
let tabsContainer = null; // Added for tab switching

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
        }
      } else {
        loadRequests();
      }
      showNotification("Data refreshed.");
    }

    // --- Event Listeners ---
    console.log("popup.js: Attaching event listeners...");

    if (filterBtn && filterPanel) {
      filterBtn.addEventListener("click", () => {
        console.log("popup.js: Filter button clicked"); // Log button click
        togglePanel(filterPanel);
      });
    } else {
      console.warn("popup.js: Filter button or panel not found for listener.");
    }
    if (exportBtn && exportPanel) {
      exportBtn.addEventListener("click", () => {
        console.log("popup.js: Export button clicked"); // Log button click
        togglePanel(exportPanel);
      });
    } else {
      console.warn("popup.js: Export button or panel not found for listener.");
    }
    if (importBtn && importPanel) {
      importBtn.addEventListener("click", () => {
        console.log("popup.js: Import button clicked"); // Log button click
        togglePanel(importPanel);
      });
    } else {
      console.warn("popup.js: Import button or panel not found for listener.");
    }

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

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        console.log("popup.js: Clear button clicked"); // Log button click
        clearRequests();
      });
    } else {
      console.warn("popup.js: Clear button not found for listener.");
    }
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        console.log("popup.js: Refresh button clicked"); // Log button click
        handleRefresh();
      });
    } else {
      console.warn("popup.js: Refresh button not found for listener.");
    }
    if (OptionsPage) OptionsPage.addEventListener("click", openOptionsPage);
    if (closeDetails) closeDetails.addEventListener("click", hideRequestDetails);

    if (prevPageBtn) prevPageBtn.addEventListener("click", () => changePage(currentPage - 1));
    if (nextPageBtn) nextPageBtn.addEventListener("click", () => changePage(currentPage + 1));

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

function applyFilters() {
  activeFilters.status = statusFilter?.value || "all";
  activeFilters.type = typeFilter?.value || "all";
  activeFilters.domain = domainFilter?.value.trim() || "";
  activeFilters.url = urlFilter?.value.trim() || "";
  activeFilters.startDate = startDateFilter?.value || "";
  activeFilters.endDate = endDateFilter?.value || "";

  currentPage = 1;
  loadRequests();
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

  activeFilters = { status: "all", type: "all", domain: "", url: "", startDate: "", endDate: "" };
  currentPage = 1;
  loadRequests();
  showNotification("Filters reset.");
}

function loadExportPanelData() {
  chrome.runtime.sendMessage({ action: "getDbStats" }, (response) => {
    if (response && response.size && exportDbSizeSpan) {
      exportDbSizeSpan.textContent = formatBytes(response.size);
    } else if (exportDbSizeSpan) {
      exportDbSizeSpan.textContent = "N/A";
    }
  });
  if (exportFilenameInput) {
    const date = new Date().toISOString().slice(0, 10);
    exportFilenameInput.value = `ura-export-${date}`;
  }
  if (exportFormatSelect) {
    exportFormatSelect.value = config?.export?.defaultFormat || config?.display?.defaultExportFormat || "json";
  }
}

function handleExportData() {
  const format = exportFormatSelect?.value || "json";
  const filename = exportFilenameInput?.value.trim() || `ura-export-${Date.now()}`;

  showNotification(`Exporting data as ${format.toUpperCase()}...`);
  chrome.runtime.sendMessage({ action: "exportData", format: format, filename: filename }, (response) => {
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

    const messagePayload = {
      action: "importData",
      format: format,
      data: fileContent,
    };

    chrome.runtime.sendMessage(messagePayload, (response) => {
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
  chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
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
  chrome.runtime.sendMessage(
    {
      action: "getRequests",
      page: currentPage,
      limit: itemsPerPage,
      filters: activeFilters,
    },
    (response) => {
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

// Render the requests table
function renderRequestsTable(requests) {
  if (!requestsTableBody) return;
  requestsTableBody.innerHTML = "";

  if (requests.length === 0) {
    requestsTableBody.innerHTML =
      '<tr><td colspan="8">No requests captured yet.</td></tr>';
    return;
  }

  requests.forEach((request) => {
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

    row.addEventListener("click", () => showRequestDetails(request));

    requestsTableBody.appendChild(row);
  });
}

// Update stats summary panel
function updateStatsSummary(stats) {
  if (!totalRequestsEl || !avgResponseTimeEl || !successRateEl) return;

  if (stats?.error) {
    totalRequestsEl.textContent = "Error";
    avgResponseTimeEl.textContent = "Error";
    successRateEl.textContent = "Error";
    return;
  }

  totalRequestsEl.textContent =
    (stats?.totalRequests ?? totalItems)?.toLocaleString() || "0";
  avgResponseTimeEl.textContent = stats?.avgResponseTime
    ? `${Math.round(stats.avgResponseTime)} ms`
    : "0 ms";
  successRateEl.textContent = stats?.successRate
    ? `${stats.successRate.toFixed(1)}%`
    : "0%";
}

// Load overall stats for the stats tab
function loadStats() {
  console.log("Loading overall stats...");
}

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

  chrome.runtime.sendMessage(
    {
      action: "getRequestHeaders",
      requestId: request.id,
    },
    (response) => {
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
    }
  );

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
  chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
    const confirmNeeded =
      response?.config?.general?.confirmClearRequests ?? true;
    if (
      !confirmNeeded ||
      confirm(
        "Are you sure you want to clear all captured requests? This cannot be undone."
      )
    ) {
      chrome.runtime.sendMessage({ action: "clearRequests" }, (response) => {
        if (response && response.success) {
          loadRequests();
          hideRequestDetails();
          showNotification("All requests cleared successfully");
        }
      });
    }
  });
}
