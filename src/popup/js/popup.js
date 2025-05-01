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
import "./settings-ui.js";

// --- Global Variables ---

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
let tabButtons = null;
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
let exportDbBtn = null;
let refreshBtn = null;
let statusFilter = null;
let typeFilter = null;
let domainFilter = null;
let urlFilter = null;
let startDateFilter = null;
let endDateFilter = null;

let activePanel = null; // Keep track of the currently open panel

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize theme manager and apply theme
  await themeManager.initialize({
    initialTheme: "light", // Or load from storage if preferred
  });

  // Initialize Settings UI if the settings tab exists
  if (document.getElementById("settings-tab")) {
    initSettingsUI();
  }

  // Assign DOM elements inside DOMContentLoaded
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
  tabButtons = document.querySelectorAll(".tab-btn");
  tabContents = document.querySelectorAll(".tab-content");
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
  exportDbBtn = document.getElementById("exportDbBtn");
  refreshBtn = document.getElementById("refreshBtn");
  statusFilter = document.getElementById("statusFilter");
  typeFilter = document.getElementById("typeFilter");
  domainFilter = document.getElementById("domainFilter");
  urlFilter = document.getElementById("urlFilter");
  startDateFilter = document.getElementById("startDateFilter");
  endDateFilter = document.getElementById("endDateFilter");

  // --- Utility Functions ---
  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    return size + " " + sizes[i];
  }

  function showNotification(message, isError = false) {
    if (notificationElement) {
      notificationElement.textContent = message;
      notificationElement.className = `notification ${
        isError ? "error" : "success"
      }`;
      notificationElement.style.display = "block";
      setTimeout(
        () => {
          notificationElement.style.display = "none";
        },
        isError ? 6000 : 4000
      );
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
    if (!panelElement) return; // Safety check

    const isOpening =
      panelElement.style.display === "none" ||
      panelElement.style.display === "";

    // Close currently active panel if it's different
    if (activePanel && activePanel !== panelElement) {
      activePanel.style.display = "none";
    }

    // Toggle the target panel
    if (isOpening) {
      panelElement.style.display = "block";
      activePanel = panelElement;
      // Special handling when opening specific panels
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

  // --- Export Panel Logic ---

  // Load data needed for the export panel (formats, db size)
  function loadExportPanelData() {
    if (!exportFormatSelect || !exportDbSizeSpan) return;

    // Set default filename
    if (exportFilenameInput) {
      exportFilenameInput.value = `request-analyzer-export-${new Date()
        .toISOString()
        .slice(0, 10)}`;
    }

    // Fetch DB Stats (including size)
    exportDbSizeSpan.textContent = "Loading...";
    chrome.runtime.sendMessage({ action: "getDatabaseStats" }, (response) => {
      if (response && response.success && response.stats) {
        exportDbSizeSpan.textContent = formatBytes(response.stats.size || 0);
      } else {
        exportDbSizeSpan.textContent = "Error";
        console.error(
          "Failed to get DB stats for export panel:",
          response?.error
        );
      }
    });

    // Fetch Export Formats
    chrome.runtime.sendMessage({ action: "getExportFormats" }, (response) => {
      exportFormatSelect.innerHTML = ""; // Clear existing options
      if (response && response.formats && response.formats.length > 0) {
        response.formats.forEach((format) => {
          const option = document.createElement("option");
          option.value = format.id;
          option.textContent = `${format.name} (.${format.id})`;
          exportFormatSelect.appendChild(option);
        });
      } else {
        // Add a default/error option if formats fail to load
        const option = document.createElement("option");
        option.value = "json";
        option.textContent = "JSON (.json)";
        exportFormatSelect.appendChild(option);
        console.error("Failed to get export formats:", response?.error);
      }
    });
  }

  // Handle the export data action (using exportData message)
  function handleExportData() {
    const format = exportFormatSelect ? exportFormatSelect.value : "json";
    const filename =
      (exportFilenameInput && exportFilenameInput.value.trim()) ||
      `request-analyzer-export-${new Date().toISOString().slice(0, 10)}`;
    const dbSizeText = exportDbSizeSpan
      ? exportDbSizeSpan.textContent
      : "Unknown size";

    const confirmMessage = `Export data as ${format.toUpperCase()} (${dbSizeText}) with filename "${filename}.${format}"?`;

    if (confirm(confirmMessage)) {
      showNotification(`Starting data export as ${filename}.${format}...`);
      chrome.runtime.sendMessage(
        {
          action: "exportData",
          format: format,
          filename: filename,
          prettyPrint: true,
          compression: false,
          includeHeaders: true,
        },
        (response) => {
          if (response && response.success) {
            togglePanel(exportPanel); // Close panel on success
            showNotification(
              `Data exported successfully. Download ID: ${
                response.downloadId || "N/A"
              }`
            );
          } else {
            showNotification(
              `Error exporting data: ${response?.error || "Unknown error"}`,
              true
            );
            console.error("Export Error Response:", response);
          }
        }
      );
    } else {
      showNotification("Data export cancelled.");
    }
  }

  // --- Database Export Logic ---

  // Handle the export database action
  function handleExportDatabase() {
    // Optional: Add confirmation if desired
    // if (!confirm("Export the entire request database?")) {
    //   showNotification("Database export cancelled.");
    //   return;
    // }

    showNotification("Starting database export..."); // Provide immediate feedback

    chrome.runtime.sendMessage({ action: "exportDatabase" }, (response) => {
      if (response && response.success) {
        showNotification(
          `Database exported successfully. Download ID: ${
            response.downloadId || "N/A"
          }`
        );
      } else {
        showNotification(
          `Error exporting database: ${response?.error || "Unknown error"}`,
          true
        );
        console.error("Database Export Error Response:", response);
      }
    });
  }

  // --- Import Panel Logic ---

  function resetImportPanel() {
    if (importFile) importFile.value = ""; // Clear file input
    if (importStatus) importStatus.textContent = ""; // Clear status message
  }

  // Handle the import data action
  function handleImportData() {
    const file = importFile ? importFile.files[0] : null;

    if (!file) {
      showNotification("Please select a file to import.", true);
      if (importStatus) importStatus.textContent = "No file selected.";
      return;
    }

    if (importStatus) importStatus.textContent = `Reading ${file.name}...`;

    const reader = new FileReader();
    reader.onload = function (event) {
      const fileContent = event.target.result;
      const fileType = file.name.split(".").pop().toLowerCase();
      let format;
      let action;
      let dataToSend;

      if (fileType === "json") {
        format = "json";
        action = "importData";
        dataToSend = fileContent.toString();
      } else if (fileType === "csv") {
        format = "csv";
        action = "importData";
        dataToSend = fileContent.toString();
      } else if (fileType === "sqlite" || fileType === "db") {
        format = "sqlite";
        action = "importDatabaseFile";
        dataToSend = fileContent;
      } else {
        showNotification(
          "Unsupported file type. Please select JSON, CSV, or SQLite.",
          true
        );
        if (importStatus) importStatus.textContent = "Unsupported file type.";
        resetImportPanel();
        return;
      }

      if (importStatus)
        importStatus.textContent = `Importing data as ${format.toUpperCase()}...`;
      showNotification(`Starting data import from ${file.name}...`);

      chrome.runtime.sendMessage(
        {
          action: action,
          format: format,
          data: dataToSend,
        },
        (response) => {
          if (response && response.success) {
            let successMsg = `Successfully imported data from ${file.name}.`;
            if (format === "sqlite") {
              successMsg = `Successfully imported database from ${file.name}. Reloading...`;
              loadRequests();
            } else if (response.importedCount !== undefined) {
              successMsg += ` Imported ${response.importedCount} records.`;
              loadRequests();
            }
            showNotification(successMsg);
            if (importStatus) importStatus.textContent = successMsg;
            togglePanel(importPanel);
          } else {
            const errorMsg = `Error importing data: ${
              response?.error || "Unknown error"
            }`;
            showNotification(errorMsg, true);
            if (importStatus) importStatus.textContent = errorMsg;
          }
        }
      );
    };

    reader.onerror = function () {
      const errorMsg = "Error reading the selected file.";
      showNotification(errorMsg, true);
      if (importStatus) importStatus.textContent = errorMsg;
      resetImportPanel();
    };

    if (file.name.endsWith(".sqlite") || file.name.endsWith(".db")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  // --- Refresh Logic ---
  function handleRefresh() {
    console.log("Refreshing data...");
    loadRequests();
    loadStats();
    showNotification("Data refreshed.");
  }

  // --- Event Listeners ---

  // Panel Toggles
  if (exportBtn && exportPanel) {
    exportBtn.addEventListener("click", () => togglePanel(exportPanel));
  }
  if (cancelExportBtn && exportPanel) {
    cancelExportBtn.addEventListener("click", () => togglePanel(exportPanel));
  }
  if (importBtn && importPanel) {
    importBtn.addEventListener("click", () => togglePanel(importPanel));
  }
  if (cancelImportBtn && importPanel) {
    cancelImportBtn.addEventListener("click", () => togglePanel(importPanel));
  }
  if (filterBtn && filterPanel) {
    filterBtn.addEventListener("click", () => togglePanel(filterPanel));
  }
  if (refreshBtn) {
    refreshBtn.addEventListener("click", handleRefresh);
  }

  // Panel Actions
  if (doExportBtn) {
    doExportBtn.addEventListener("click", handleExportData);
  }
  if (doImportBtn) {
    doImportBtn.addEventListener("click", handleImportData);
  }

  // Other buttons
  if (clearBtn) {
    clearBtn.addEventListener("click", clearRequests);
  }
  if (OptionsPage) {
    OptionsPage.addEventListener("click", openOptionsPage);
  }

  // Initial data load
  loadRequests();
  loadStats();

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (
      message.action === "requestUpdated" ||
      message.action === "requestsCleared" ||
      message.action === "database:imported"
    ) {
      loadRequests();
      loadStats();
    }
  });
});

// Open options page function
function openOptionsPage() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("src/options/options.html"));
  }
}

// --- Config Loading ---
function loadPopupConfig() {
  chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
    if (response && response.config) {
      config = response.config;
      itemsPerPage = config.display?.requestsPerPage || 50;
    } else {
      console.warn("Failed to load config, using defaults.");
      itemsPerPage = 50;
    }
    loadRequests();
  });
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
      if (response && response.requests) {
        totalItems = response.totalItems;
        totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        renderRequestsTable(response.requests);
        updatePagination();
        updateStatsSummary(response.stats);
      } else {
        console.error("Error loading requests:", response?.error);
        requestsTableBody.innerHTML =
          '<tr><td colspan="8">Error loading requests.</td></tr>';
      }
    }
  );
}

// Update pagination UI
function updatePagination() {
  if (!pageInfoEl || !prevPageBtn || !nextPageBtn) return; // Add checks
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
  if (!requestsTableBody) return; // Add check
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
  if (!totalRequestsEl || !avgResponseTimeEl || !successRateEl) return; // Add checks
  if (stats) {
    totalRequestsEl.textContent = stats.totalRequests.toLocaleString();
    avgResponseTimeEl.textContent = `${Math.round(
      stats.avgResponseTime || 0
    )}ms`;
    successRateEl.textContent = `${(stats.successRate || 0).toFixed(1)}%`;
  } else {
    totalRequestsEl.textContent = "0";
    avgResponseTimeEl.textContent = "0ms";
    successRateEl.textContent = "0.0%";
  }
}

// Load overall stats for the stats tab
function loadStats() {
  console.log("Loading overall stats...");
}

// Show request details panel
function showRequestDetails(request) {
  if (!requestDetails) return; // Add check
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
  if (!requestDetails) return; // Add check
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
