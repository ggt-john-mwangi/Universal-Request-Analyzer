import "../css/options.css"; // Ensure the CSS file is imported
import "../../styles.css"; // Import the global styles.css

// Import component modules - Assuming they execute setup code on import
// or export functions that might be called elsewhere if needed.
// If they export specific functions to be run, call them here.
import "../components/capture-settings.js";
import "../components/capture-filters.js";
import "../components/auto-export.js";
import "../components/database-info.js";
import "../components/visualization.js";
import renderAnalyticsSection from "../components/analytics.js";

// DOM elements - General
const maxStoredRequests = document.getElementById("maxStoredRequests");
const autoStartCapture = document.getElementById("autoStartCapture");
const showNotifications = document.getElementById("showNotifications");
const confirmClearRequests = document.getElementById("confirmClearRequests");
const defaultExportFormat = document.getElementById("defaultExportFormat");
const dateFormat = document.getElementById("dateFormat");
const timeZone = document.getElementById("timeZone");

// DOM elements - Capture
const captureEnabled = document.getElementById("captureEnabled");
const includeHeaders = document.getElementById("includeHeaders");
const includeTiming = document.getElementById("includeTiming");
const includeContent = document.getElementById("includeContent");
const maxContentSize = document.getElementById("maxContentSize");
const captureWebSockets = document.getElementById("captureWebSockets");
const captureServerSentEvents = document.getElementById(
  "captureServerSentEvents"
);
const captureTypeCheckboxes = document.querySelectorAll(
  'input[name="captureType"]'
);
const includeDomains = document.getElementById("includeDomains");
const excludeDomains = document.getElementById("excludeDomains");

// DOM elements - Display
const requestsPerPage = document.getElementById("requestsPerPage");
const expandedDetails = document.getElementById("expandedDetails");
const showStatusColors = document.getElementById("showStatusColors");
const showTimingBars = document.getElementById("showTimingBars");
const defaultTab = document.getElementById("defaultTab");

// DOM elements - Auto Export
const autoExport = document.getElementById("autoExport");
const exportFormat = document.getElementById("exportFormat");
const exportInterval = document.getElementById("exportInterval");
const exportPath = document.getElementById("exportPath");
const lastExport = document.getElementById("lastExport");

// DOM elements - Visualization
const plotEnabled = document.getElementById("plotEnabled");
const plotTypeCheckboxes = document.querySelectorAll('input[name="plotType"]');

// DOM elements - Advanced
const enableDebugMode = document.getElementById("enableDebugMode");
const persistFilters = document.getElementById("persistFilters");
const useCompression = document.getElementById("useCompression");
const backgroundMode = document.getElementById("backgroundMode");
const syncInterval = document.getElementById("syncInterval");
const logErrorsToDatabase = document.getElementById("logErrorsToDatabase");
const logErrorsToConsole = document.getElementById("logErrorsToConsole");

// DOM elements - Database & Actions
const saveButton = document.getElementById("saveOptionsBtn");
const resetBtn = document.getElementById("resetBtn");
const exportDbBtn = document.getElementById("exportDbBtn");
const clearDbBtn = document.getElementById("clearDbBtn");
const notification = document.getElementById("notification");
const dbTotalRequests = document.getElementById("dbTotalRequests");
const dbSize = document.getElementById("dbSize");
const exportDbFilename = document.getElementById("exportDbFilename"); // Add input field selector
const dbSchemaSummary = document.getElementById("dbSchemaSummary");
const dbErrorsTableBody = document.getElementById("dbErrorsTableBody");
const refreshDbInfoBtn = document.getElementById("refreshDbInfoBtn"); // Button to refresh all DB info
const rawSqlInput = document.getElementById("rawSqlInput");
const executeSqlBtn = document.getElementById("executeSqlBtn");
const sqlResultsOutput = document.getElementById("sqlResultsOutput");
const clearSqlBtn = document.getElementById("clearSqlBtn"); // Added selector for clear button

// DOM elements - Import
const importFile = document.getElementById("importFile");
const importDataBtn = document.getElementById("importDataBtn");
const exportFilenameInput = document.getElementById("exportFilename"); // Added filename input

// DOM elements - Theme
const themeSelect = document.getElementById("theme-select");
if (themeSelect) {
  themeSelect.addEventListener("change", (e) => {
    const selectedTheme = e.target.value;
    // Save to config
    chrome.runtime.sendMessage(
      { action: "updateConfig", config: { ui: { theme: selectedTheme } } },
      (response) => {
        if (response && response.success) {
          // Apply theme immediately if themeManager is available
          if (window.themeManager && window.themeManager.applyTheme) {
            window.themeManager.setTheme(selectedTheme);
          }
        }
      }
    );
  });
}

// --- Database Tools & Advanced Features ---
const backupDbBtn = document.getElementById("backupDbBtn");
const restoreBackupSelect = document.getElementById("restoreBackupSelect");
const restoreBackupBtn = document.getElementById("restoreBackupBtn");
const vacuumDbBtn = document.getElementById("vacuumDbBtn");
const dbHealthStatus = document.getElementById("dbHealthStatus");
const tableSelect = document.getElementById("tableSelect");
const viewTableBtn = document.getElementById("viewTableBtn");
const tableViewContainer = document.getElementById("tableViewContainer");
const historyLogList = document.getElementById("historyLogList");
const encryptDbBtn = document.getElementById("encryptDbBtn");
const decryptDbBtn = document.getElementById("decryptDbBtn");
const encryptionStatus = document.getElementById("encryptionStatus");
const deleteBackupBtn = document.getElementById("deleteBackupBtn");
const tableSearch = document.getElementById("tableSearch");
const tablePagination = document.getElementById("tablePagination");
const exportTableBtn = document.getElementById("exportTableBtn");
const clearHistoryLogBtn = document.getElementById("clearHistoryLogBtn");
const encryptionWarning = document.getElementById("encryptionWarning");
const encryptionKeyInput = document.getElementById("encryptionKeyInput");
const toggleKeyVisibility = document.getElementById("toggleKeyVisibility");
const saveDbSettingsBtn = document.getElementById("saveDbSettingsBtn");

let backupMetaCache = {};
let allTables = [];
let currentTableRows = [];
let currentTablePage = 1;
const ROWS_PER_PAGE = 100;

// Default configuration
const localDefaultConfig = {
  general: {
    maxStoredRequests: 10000,
    autoStartCapture: true,
    showNotifications: true,
    confirmClearRequests: true,
    defaultExportFormat: "json",
    dateFormat: "YYYY-MM-DD HH:mm:ss",
    timeZone: "local",
  },
  captureEnabled: true,
  capture: {
    includeHeaders: true,
    includeTiming: true,
    includeContent: false,
    maxContentSize: 1024 * 1024,
    captureWebSockets: false,
    captureServerSentEvents: false,
  },
  captureFilters: {
    includeDomains: [],
    excludeDomains: [],
    includeTypes: [
      "xmlhttprequest",
      "fetch",
      "script",
      "stylesheet",
      "image",
      "font",
      "other",
    ],
  },
  display: {
    requestsPerPage: 50,
    expandedDetails: false,
    showStatusColors: true,
    showTimingBars: true,
    defaultTab: "requests",
    columnOrder: [
      "method",
      "domain",
      "path",
      "status",
      "type",
      "size",
      "duration",
      "time",
    ],
  },
  autoExport: false,
  exportFormat: "json",
  exportInterval: 86400000,
  exportPath: "",
  plotEnabled: true,
  plotTypes: [
    "responseTime",
    "statusCodes",
    "domains",
    "requestTypes",
    "timeDistribution",
  ],
  advanced: {
    enableDebugMode: false,
    persistFilters: true,
    useCompression: false,
    backgroundMode: "default",
    syncInterval: 60,
    logErrorsToDatabase: true,
    logErrorsToConsole: true,
  },
  notifications: {
    enabled: true,
  },
  lastExportTime: null,
};

// --- Event-based request/response helpers ---
const pendingRequests = {};
function eventRequest(action, payload, callback) {
  const requestId = generateRequestId();
  pendingRequests[requestId] = callback;
  chrome.runtime.sendMessage({ ...payload, action, requestId });
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.requestId && pendingRequests[message.requestId]) {
    pendingRequests[message.requestId](message);
    delete pendingRequests[message.requestId];
  }
});

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

// --- Event-based Data Call System ---
function generateRequestId() {
  return "req_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
}

// --- Global event listeners for backend events (config:updated, etc.) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle config:updated event from backend (e.g., from another tab or after save)
  if (message && message.type === "config:updated") {
    showNotification("Configuration updated.");
    loadOptions(); // Reload options to reflect new config
  }
  // You can add more global event handlers here as needed
});

// Load options when the page loads
    analyticsSection.innerHTML = "";
    analyticsSection.appendChild(renderAnalyticsSection());
  
  // Initial Load for new features
  loadBackupList();
  checkDbHealth();
  loadTableList();
  loadHistoryLog();
  updateEncryptionStatus();


// Add event listeners for buttons if they exist
if (exportDbBtn) {
  exportDbBtn.addEventListener("click", function () {
    const requestId = `exportDb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function handler(response) {
      if (response && response.requestId === requestId) {
        showNotification(response.success ? "Database exported successfully." : ("Export failed: " + (response?.error || "Unknown error")), !response.success);
        chrome.runtime.onMessage.removeListener(handler);
        loadDatabaseInfo();
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    exportDbBtn.disabled = true;
    exportDbBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
    chrome.runtime.sendMessage({ action: "exportData", format: "sqlite", requestId });
    setTimeout(() => {
      exportDbBtn.disabled = false;
      exportDbBtn.innerHTML = "Export Database (.sqlite)";
    }, 3000);
  });
}
if (clearDbBtn) {
  clearDbBtn.addEventListener("click", function () {
    const requestId = `clearDb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function handler(response) {
      if (response && response.requestId === requestId) {
        showNotification(response.success ? "Database cleared successfully." : ("Error clearing database: " + (response?.error || "Unknown error")), !response.success);
        chrome.runtime.onMessage.removeListener(handler);
        loadDatabaseInfo();
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    clearDbBtn.disabled = true;
    clearDbBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';
    chrome.runtime.sendMessage({ action: "clearRequests", requestId });
    setTimeout(() => {
      clearDbBtn.disabled = false;
      clearDbBtn.innerHTML = "Clear Database";
    }, 3000);
  });
}
if (importDataBtn) {
  importDataBtn.addEventListener("click", function () {
    const requestId = `importData_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function handler(response) {
      if (response && response.requestId === requestId) {
        showNotification(response.success ? "Data imported successfully." : ("Error importing data: " + (response?.error || "Unknown error")), !response.success);
        chrome.runtime.onMessage.removeListener(handler);
        loadDatabaseInfo();
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    importDataBtn.disabled = true;
    importDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
    // You should call your importData logic here and ensure it sends the requestId
    // For now, just send a dummy message:
    chrome.runtime.sendMessage({ action: "importData", requestId });
    setTimeout(() => {
      importDataBtn.disabled = false;
      importDataBtn.innerHTML = "Import";
    }, 3000);
  });
}
if (refreshDbInfoBtn) {
  refreshDbInfoBtn.addEventListener("click", function () {
    const requestId = `refreshDbInfo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function handler(response) {
      if (response && response.requestId === requestId) {
        showNotification(response.success ? "Database info refreshed." : ("Error refreshing info: " + (response?.error || "Unknown error")), !response.success);
        chrome.runtime.onMessage.removeListener(handler);
        loadDatabaseInfo();
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    refreshDbInfoBtn.disabled = true;
    refreshDbInfoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    chrome.runtime.sendMessage({ action: "getDatabaseInfo", requestId });
    setTimeout(() => {
      refreshDbInfoBtn.disabled = false;
      refreshDbInfoBtn.innerHTML = "Refresh Info";
    }, 2000);
  });
}
if (saveButton) {
  saveButton.addEventListener("click", function () {
    const requestId = `saveAll_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function handler(response) {
      if (response && response.requestId === requestId) {
        showNotification(response.success ? "All settings saved successfully!" : ("Error saving settings: " + (response?.error || "Unknown error")), !response.success);
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    // Call saveOptions but ensure it sends the requestId
    saveOptions(requestId);
  });
}
resetBtn.addEventListener("click", function () {
  const requestId = `resetAll_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  function handler(response) {
    if (response && response.requestId === requestId) {
      showNotification(response.success ? "Options reset to defaults" : ("Error resetting options: " + (response?.error || "Unknown error")), !response.success);
      chrome.runtime.onMessage.removeListener(handler);
      loadOptions();
    }
  }
  chrome.runtime.onMessage.addListener(handler);
  chrome.runtime.sendMessage({ action: "resetConfig", requestId });
});

// Setup sidebar navigation
function setupSidebarNavigation() {
  const navLinks = document.querySelectorAll(".options-sidebar .nav-link");
  const sections = document.querySelectorAll(".option-section");

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault(); // Prevent default anchor link behavior

      const targetSectionId = link.getAttribute("data-section");
      const targetSection = document.getElementById(targetSectionId);
      const subSectionAnchor = link.getAttribute("href"); // Get the href like #errors, #raw-sql

      // Update active link
      navLinks.forEach((navLink) => navLink.classList.remove("active"));
      link.classList.add("active");

      // Update active section
      sections.forEach((section) => section.classList.remove("active"));
      if (targetSection) {
        targetSection.classList.add("active");

        // If analytics-section, render analytics content
        if (targetSectionId === "analytics-section") {
          targetSection.innerHTML = "";
          targetSection.appendChild(renderAnalyticsSection());
        }

        // Scroll to sub-section if applicable (within the activated section)
        if (subSectionAnchor && subSectionAnchor.startsWith("#")) {
          // Find the corresponding h3 within the target section
          let targetElement = null;
          if (subSectionAnchor === "#errors") {
            targetElement = targetSection.querySelector("h3:nth-of-type(2)"); // Assuming Error Log is the 2nd h3
          } else if (subSectionAnchor === "#raw-sql") {
            targetElement = targetSection.querySelector("h3:nth-of-type(3)"); // Assuming Raw SQL is the 3rd h3
          } else if (subSectionAnchor === "#database-diagnostics") {
            targetElement = targetSection.querySelector("h3:nth-of-type(1)"); // Assuming Summary is the 1st h3
          }

          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }
      }
    });
  });

  // Activate section based on initial hash or default
  const initialHash = window.location.hash;
  let foundActive = false;
  if (initialHash) {
    navLinks.forEach((link) => {
      if (link.getAttribute("href") === initialHash) {
        link.click(); // Simulate click to activate section and scroll
        foundActive = true;
      }
    });
  }
  // If no hash or hash didn't match, activate the first link/section
  if (!foundActive) {
    navLinks[0]?.click();
  }
}

// Load options from storage
function loadOptions() {
  eventRequest("getConfig", {}, (response) => {
    if (response && response.config) {
      console.log("Loaded config from background:", response.config);
      updateUIFromConfig(response.config); // Use loaded config
    } else {
      console.error(
        "Failed to load config from background script:",
        response?.error || "No config received. Using defaults."
      );
      updateUIFromConfig(localDefaultConfig); // Use local defaults as fallback
    }
  });

  loadDatabaseInfo();
}

// Function to update UI elements based on a config object
function updateUIFromConfig(config) {
  // Ensure config is not null/undefined, default to localDefaultConfig if it is
  config = config || localDefaultConfig;

  // General Settings
  const generalConf = config.general || localDefaultConfig.general;
  if (maxStoredRequests)
    maxStoredRequests.value = generalConf.maxStoredRequests;
  if (autoStartCapture) autoStartCapture.checked = generalConf.autoStartCapture;
  if (showNotifications)
    showNotifications.checked = generalConf.showNotifications;
  if (confirmClearRequests)
    confirmClearRequests.checked = generalConf.confirmClearRequests;
  if (defaultExportFormat)
    defaultExportFormat.value = generalConf.defaultExportFormat;
  if (dateFormat) dateFormat.value = generalConf.dateFormat;
  if (timeZone) timeZone.value = generalConf.timeZone;

  // Capture Settings
  if (captureEnabled)
    captureEnabled.checked =
      config.captureEnabled ?? localDefaultConfig.captureEnabled;
  const captureConf = config.capture || localDefaultConfig.capture;
  if (includeHeaders) includeHeaders.checked = captureConf.includeHeaders;
  if (includeTiming) includeTiming.checked = captureConf.includeTiming;
  if (includeContent) includeContent.checked = captureConf.includeContent;
  if (maxContentSize) maxContentSize.value = captureConf.maxContentSize;
  if (captureWebSockets)
    captureWebSockets.checked = captureConf.captureWebSockets;
  if (captureServerSentEvents)
    captureServerSentEvents.checked = captureConf.captureServerSentEvents;

  // Capture Filters
  const captureFiltersConf =
    config.captureFilters || localDefaultConfig.captureFilters;
  if (captureTypeCheckboxes) {
    captureTypeCheckboxes.forEach((checkbox) => {
      checkbox.checked = (captureFiltersConf.includeTypes || []).includes(
        checkbox.value
      );
    });
  }
  if (includeDomains)
    includeDomains.value = (captureFiltersConf.includeDomains || []).join(", ");
  if (excludeDomains)
    excludeDomains.value = (captureFiltersConf.excludeDomains || []).join(", ");

  // Display Settings
  const displayConf = config.display || localDefaultConfig.display;
  if (requestsPerPage) requestsPerPage.value = displayConf.requestsPerPage;
  if (expandedDetails) expandedDetails.checked = displayConf.expandedDetails;
  if (showStatusColors) showStatusColors.checked = displayConf.showStatusColors;
  if (showTimingBars) showTimingBars.checked = displayConf.showTimingBars;
  if (defaultTab) defaultTab.value = displayConf.defaultTab;

  // Auto Export Settings
  if (autoExport)
    autoExport.checked = config.autoExport ?? localDefaultConfig.autoExport;
  if (exportFormat)
    exportFormat.value = config.exportFormat ?? localDefaultConfig.exportFormat;
  if (exportInterval)
    exportInterval.value =
      (config.exportInterval ?? localDefaultConfig.exportInterval) / 60000;
  if (exportPath)
    exportPath.value = config.exportPath ?? localDefaultConfig.exportPath;
  if (lastExport) {
    lastExport.textContent = config.lastExportTime
      ? new Date(config.lastExportTime).toLocaleString()
      : "Never";
  }

  // Plot Settings
  if (plotEnabled)
    plotEnabled.checked = config.plotEnabled ?? localDefaultConfig.plotEnabled;
  const plotTypes = config.plotTypes ?? localDefaultConfig.plotTypes;
  if (plotTypeCheckboxes) {
    plotTypeCheckboxes.forEach((checkbox) => {
      checkbox.checked = (plotTypes || []).includes(checkbox.value);
    });
  }

  // Advanced Settings
  const advancedConf = config.advanced || localDefaultConfig.advanced;
  if (enableDebugMode) enableDebugMode.checked = advancedConf.enableDebugMode;
  if (persistFilters) persistFilters.checked = advancedConf.persistFilters;
  if (useCompression) useCompression.checked = advancedConf.useCompression;
  if (backgroundMode) backgroundMode.value = advancedConf.backgroundMode;
  if (syncInterval) syncInterval.value = advancedConf.syncInterval;
  logErrorsToDatabase.checked =
    advancedConf.logErrorsToDatabase ??
    localDefaultConfig.advanced.logErrorsToDatabase;
  logErrorsToConsole.checked =
    advancedConf.logErrorsToConsole ??
    localDefaultConfig.advanced.logErrorsToConsole;
}

// Load database information (Stats, Schema, Errors)
function loadDatabaseInfo() {
  showNotification("Loading database info...");

  // 1. Load Stats (event-based)
  const statsRequestId = generateRequestId();
  pendingRequests[statsRequestId] = (response) => {
    if (response && response.success) {
      dbTotalRequests.textContent =
        response.stats.requestCount?.toLocaleString() || "0";
      if (dbSize) dbSize.textContent = formatBytes(response.stats.size || 0);
      if (lastExport && response.stats.lastExportTime) {
        lastExport.textContent = new Date(
          response.stats.lastExportTime
        ).toLocaleString();
      } else if (lastExport) {
        lastExport.textContent = "Never";
      }
    } else {
      dbTotalRequests.textContent = "No data found";
      if (dbSize) dbSize.textContent = "No data found";
      if (lastExport) lastExport.textContent = "No data found";
      showNotification(
        `Error loading DB stats: ${response?.error || "Unknown error"}`,
        true
      );
    }
  };
  chrome.runtime.sendMessage({
    action: "getDatabaseStats",
    requestId: statsRequestId,
  });

  // 2. Load Schema Summary (event-based)
  if (dbSchemaSummary) {
    const schemaRequestId = generateRequestId();
    dbSchemaSummary.innerHTML = "<li>Loading schema...</li>";
    pendingRequests[schemaRequestId] = (response) => {
      if (chrome.runtime.lastError) {
        dbSchemaSummary.innerHTML = `<li>Error loading schema: ${chrome.runtime.lastError.message}</li>`;
        showNotification(
          `Error loading DB schema: ${chrome.runtime.lastError.message}`,
          true
        );
        return;
      }
      if (response && response.success && Array.isArray(response.summary)) {
        dbSchemaSummary.innerHTML = "";
        if (response.summary.length > 0) {
          response.summary.forEach((table) => {
            const li = document.createElement("li");
            li.textContent = `${
              table.name
            }: ${table.rows.toLocaleString()} rows`;
            dbSchemaSummary.appendChild(li);
          });
        } else {
          dbSchemaSummary.innerHTML =
            "<li>No tables found in the database.</li>";
        }
      } else if (response && response.error) {
        dbSchemaSummary.innerHTML = `<li>Error loading schema: ${response.error}</li>`;
        showNotification(`Error loading DB schema: ${response.error}`, true);
      } else {
        dbSchemaSummary.innerHTML =
          "<li>Error: No response from background script.</li>";
        showNotification(
          "No response from background script for schema summary.",
          true
        );
      }
    };
    chrome.runtime.sendMessage({
      action: "getDatabaseSchemaSummary",
      requestId: schemaRequestId,
    });
  }

  // 3. Load Logged Errors (event-based)
  if (dbErrorsTableBody) {
    const errorsRequestId = generateRequestId();
    dbErrorsTableBody.innerHTML =
      '<tr><td colspan="5">Loading errors...</td></tr>';
    pendingRequests[errorsRequestId] = (response) => {
      if (chrome.runtime.lastError) {
        dbErrorsTableBody.innerHTML = `<tr><td colspan="5">Error loading logged errors: ${chrome.runtime.lastError.message}</td></tr>`;
        showNotification(
          `Error loading logged errors: ${chrome.runtime.lastError.message}`,
          true
        );
        return;
      }
      if (response && response.success && response.errors) {
        dbErrorsTableBody.innerHTML = "";
        if (response.errors.length > 0) {
          response.errors.forEach((error) => {
            const row = document.createElement("tr");
            const contextStr =
              typeof error.context === "string"
                ? error.context
                : JSON.stringify(error.context);
            row.innerHTML = `
                <td>${error.id}</td>
                <td>${new Date(error.timestamp).toLocaleString()}</td>
                <td>${error.category || "N/A"}</td>
                <td title="${error.stack || ""}">${error.message}</td>
                <td><pre>${contextStr}</pre></td>
            `;
            dbErrorsTableBody.appendChild(row);
          });
        } else {
          dbErrorsTableBody.innerHTML =
            '<tr><td colspan="5">No errors logged in the database.</td></tr>';
        }
      } else {
        dbErrorsTableBody.innerHTML =
          '<tr><td colspan="5">Error loading logged errors.</td></tr>';
        showNotification(
          `Error loading logged errors: ${response?.error || "Unknown error"}`,
          true
        );
      }
    };
    chrome.runtime.sendMessage({
      action: "getLoggedErrors",
      limit: 50,
      requestId: errorsRequestId,
    });
  }
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return "0 Bytes"; // Handle null, undefined, or 0
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Ensure result is a number before calling toFixed
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return size + " " + sizes[i];
}

// Save options to storage
function saveOptions(requestId) {
  const newConfig = {
    general: {
      maxStoredRequests: maxStoredRequests ? Number.parseInt(maxStoredRequests.value, 10) || 10000 : 10000,
      autoStartCapture: autoStartCapture ? autoStartCapture.checked : false,
      showNotifications: showNotifications ? showNotifications.checked : true,
      confirmClearRequests: confirmClearRequests ? confirmClearRequests.checked : true,
      defaultExportFormat: defaultExportFormat ? defaultExportFormat.value : 'json',
      dateFormat: dateFormat ? dateFormat.value : 'YYYY-MM-DD HH:mm:ss',
      timeZone: timeZone ? timeZone.value : 'local',
    },
    captureEnabled: captureEnabled ? captureEnabled.checked : true,
    capture: {
      includeHeaders: includeHeaders ? includeHeaders.checked : true,
      includeTiming: includeTiming ? includeTiming.checked : true,
      includeContent: includeContent ? includeContent.checked : false,
      maxContentSize: maxContentSize ? Number.parseInt(maxContentSize.value, 10) || 1024 * 1024 : 1024 * 1024,
      captureWebSockets: captureWebSockets ? captureWebSockets.checked : false,
      captureServerSentEvents: captureServerSentEvents ? captureServerSentEvents.checked : false,
    },
    captureFilters: {
      includeDomains: includeDomains ? includeDomains.value.split(",").map((d) => d.trim()).filter((d) => d) : [],
      excludeDomains: excludeDomains ? excludeDomains.value.split(",").map((d) => d.trim()).filter((d) => d) : [],
      includeTypes: captureTypeCheckboxes ? Array.from(captureTypeCheckboxes).filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value) : [],
    },
    display: {
      requestsPerPage: requestsPerPage ? Number.parseInt(requestsPerPage.value, 10) || 50 : 50,
      expandedDetails: expandedDetails ? expandedDetails.checked : false,
      showStatusColors: showStatusColors ? showStatusColors.checked : true,
      showTimingBars: showTimingBars ? showTimingBars.checked : true,
      defaultTab: defaultTab ? defaultTab.value : 'requests',
      columnOrder: [
        "method",
        "domain",
        "path",
        "status",
        "type",
        "size",
        "duration",
        "time",
      ],
    },
    autoExport: autoExport ? autoExport.checked : false,
    exportFormat: exportFormat ? exportFormat.value : 'json',
    exportInterval: exportInterval ? Number.parseInt(exportInterval.value, 10) * 60000 : 86400000,
    exportPath: exportPath ? exportPath.value.trim() : '',
    plotEnabled: plotEnabled ? plotEnabled.checked : true,
    plotTypes: plotTypeCheckboxes ? Array.from(plotTypeCheckboxes).filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value) : [],
    advanced: {
      enableDebugMode: enableDebugMode ? enableDebugMode.checked : false,
      persistFilters: persistFilters ? persistFilters.checked : true,
      useCompression: useCompression ? useCompression.checked : false,
      backgroundMode: backgroundMode ? backgroundMode.value : 'default',
      syncInterval: syncInterval ? Number.parseInt(syncInterval.value, 10) || 60 : 60,
      logErrorsToDatabase: logErrorsToDatabase ? logErrorsToDatabase.checked : true,
      logErrorsToConsole: logErrorsToConsole ? logErrorsToConsole.checked : true,
    },
  };

  // Event-based: send request, listen for event response
  chrome.runtime.sendMessage({
    action: "updateConfig",
    data: newConfig, // Use 'data' instead of 'config'
    requestId,
  });
}

// Reset options to defaults
function resetOptions() {
  if (
    confirm("Are you sure you want to reset all options to default values?")
  ) {
    const requestId = generateRequestId();
    pendingRequests[requestId] = (response) => {
      if (response && response.success) {
        loadOptions();
        showNotification("Options reset to defaults");
      } else {
        showNotification("Error resetting options", true);
      }
    };
    chrome.runtime.sendMessage({
      action: "resetConfig",
      requestId,
    });
  }
}

// Export database
function exportDatabase() {
  // First, get database stats to show size in confirmation
  eventRequest("getDatabaseStats", {}, (statsResponse) => {
    let dbSizeBytes = 0;
    let dbSizeFormatted = "Unknown size";
    if (statsResponse && statsResponse.success && statsResponse.stats) {
      dbSizeBytes = statsResponse.stats.size || 0;
      dbSizeFormatted = formatBytes(dbSizeBytes);
    } else if (statsResponse && statsResponse.error) {
      console.warn("Could not fetch database size:", statsResponse.error);
      showNotification(
        `Could not fetch database size: ${statsResponse.error}`,
        true
      );
    }

    // Get filename from input or generate default
    const defaultFilename = `ura-database-export-${new Date()
      .toISOString()
      .slice(0, 10)}`;
    const filename = exportFilenameInput.value.trim() || defaultFilename;

    // Confirmation dialog
    const confirmMessage = `Export the entire database (${dbSizeFormatted}) as '${filename}.sqlite'?`;

    if (confirm(confirmMessage)) {
      showNotification(`Starting database export as ${filename}.sqlite...`);
      eventRequest(
        "exportData",
        {
          format: "sqlite",
          filename: filename, // Pass the user-provided or default filename
        },
        (response) => {
          if (response && response.success) {
            showNotification(
              `Database exported successfully. Download ID: ${
                response.downloadId || "N/A"
              }`
            );
            loadDatabaseInfo(); // Refresh last export time
          } else {
            showNotification(
              `Error exporting database: ${response?.error || "Unknown error"}`,
              true
            );
            console.error("Export Error Response:", response); // Log error details
          }
        }
      );
    } else {
      showNotification("Database export cancelled.");
    }
  });
}

// Clear database
function clearDatabase() {
  if (
    !confirmClearRequests.checked ||
    confirm(
      "Are you sure you want to clear all captured requests? This action cannot be undone."
    )
  ) {
    showNotification("Clearing database...");
    eventRequest("clearRequests", {}, (response) => {
      if (response && response.success) {
        showNotification("Database cleared successfully.");
        loadDatabaseInfo(); // Refresh stats
      } else {
        showNotification(
          `Error clearing database: ${response?.error || "Unknown error"}`,
          true
        );
      }
    });
  } else {
    showNotification("Database clear cancelled.");
  }
}

// Import data from file
function importData() {
  const file = importFile.files[0];
  if (!file) {
    showNotification("Please select a file to import.", true);
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    const fileContent = event.target.result; // ArrayBuffer for SQLite, string for others
    const fileType = file.name.split(".").pop().toLowerCase();
    let format;
    let action;
    let dataToSend;

    if (fileType === "json") {
      format = "json";
      action = "importData"; // Action for row-based import
      dataToSend = fileContent.toString(); // Send as string
    } else if (fileType === "csv") {
      format = "csv";
      action = "importData"; // Action for row-based import
      dataToSend = fileContent.toString(); // Send as string
    } else if (fileType === "sqlite" || fileType === "db") {
      format = "sqlite";
      action = "importDatabaseFile"; // Specific action for replacing DB
      dataToSend = fileContent; // Send ArrayBuffer directly
    } else {
      showNotification(
        "Unsupported file type. Please select JSON, CSV, or SQLite.",
        true
      );
      importFile.value = ""; // Clear file input
      return;
    }

    showNotification(`Starting data import from ${file.name}...`);

    eventRequest(
      action,
      {
        format: format,
        data: dataToSend,
      },
      (response) => {
        if (response && response.success) {
          let successMsg = `Successfully imported data from ${file.name}.`;
          if (format === "sqlite") {
            successMsg = `Successfully imported database from ${file.name}.`;
          } else if (response.importedCount !== undefined) {
            successMsg = `Successfully imported ${response.importedCount} records from ${file.name}.`;
          }
          showNotification(successMsg + " Refreshing stats...");
          // Refresh database info after import
          loadDatabaseInfo();
        } else {
          showNotification(
            `Error importing data: ${response?.error || "Unknown error"}`,
            true
          );
        }
        // Clear the file input
        importFile.value = "";
      }
    );
  };

  reader.onerror = function () {
    showNotification("Error reading file.", true);
    importFile.value = ""; // Clear file input
  };

  // Read file based on type
  if (fileType === "sqlite" || fileType === "db") {
    reader.readAsArrayBuffer(file); // Read SQLite as ArrayBuffer
  } else {
    reader.readAsText(file); // Read JSON/CSV as text
  }
}

// Show notification
function showNotification(message, isError = false) {
  notification.textContent = message;
  notification.className = "notification" + (isError ? " error" : "");
  notification.classList.add("visible");

  setTimeout(() => {
    notification.classList.remove("visible");
  }, 5000);
}

// --- Raw SQL Executor Enhancements (Backend-integrated) ---
let sqlHistory = [];
let pendingSqlRequests = {};

// Listen for event-based SQL results
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message &&
    message.action === "executeRawSqlResult" &&
    message.requestId
  ) {
    const cb = pendingSqlRequests[message.requestId];
    if (cb) {
      cb(message);
      delete pendingSqlRequests[message.requestId];
    }
  }
});

function fetchSqlHistory() {
  eventRequest("getSqlHistory", {}, (response) => {
    if (response && response.success && Array.isArray(response.history)) {
      sqlHistory = response.history;
      renderSqlHistory();
    } else {
      sqlHistory = [];
      renderSqlHistory();
    }
  });
}

function renderSqlHistory() {
  let container = document.getElementById("sqlHistoryContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "sqlHistoryContainer";
    container.style.marginTop = "10px";
    container.style.fontSize = "13px";
    container.style.color = "var(--text-secondary-color)";
    sqlResultsOutput.parentElement.insertBefore(container, sqlResultsOutput);
  }
  if (!sqlHistory.length) {
    container.innerHTML = "<em>No recent queries.</em>";
    return;
  }
  container.innerHTML =
    "<b>Recent Queries:</b> " +
    sqlHistory
      .map(
        (q, i) =>
          `<span class="sql-history-item" style="cursor:pointer; margin-right:8px;" data-idx="${i}">${q
            .replace(/\s+/g, " ")
            .slice(0, 60)}${q.length > 60 ? "..." : ""}</span>`
      )
      .join("");
  container.querySelectorAll(".sql-history-item").forEach((el) => {
    el.onclick = () => {
      const idx = Number(el.dataset.idx);
      rawSqlInput.value = sqlHistory[idx];
      rawSqlInput.focus();
    };
  });
}

// Keyboard shortcut: Ctrl+Enter to execute
rawSqlInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    executeSqlBtn.click();
    e.preventDefault();
  }
});

// Export results as CSV (via backend if possible)
function exportSqlResultsAsCSV() {
  const sql = rawSqlInput.value.trim();
  if (!sql) return showNotification("No SQL query to export.", true);
  eventRequest("executeRawSql", { sql, exportCsv: true }, (response) => {
    if (
      response &&
      response.success &&
      response.results &&
      response.results.csv
    ) {
      const csv = response.results.csv;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sql-results.csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } else {
      showNotification("No CSV results to export.", true);
    }
  });
}

// Add export button dynamically if table result
function maybeAddExportButton() {
  let btn = document.getElementById("exportSqlResultsBtn");
  if (sqlResultsOutput.querySelector("table")) {
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "exportSqlResultsBtn";
      btn.innerHTML = '<i class="fas fa-file-csv"></i> Export Results as CSV';
      btn.className = "secondary";
      btn.style.margin = "10px 0 0 0";
      btn.onclick = exportSqlResultsAsCSV;
      sqlResultsOutput.parentElement.insertBefore(
        btn,
        sqlResultsOutput.nextSibling
      );
    }
  } else if (btn) {
    btn.remove();
  }
}

// Basic syntax highlighting for SQL keywords
function highlightSql(sql) {
  const keywords = [
    "select",
    "from",
    "where",
    "insert",
    "into",
    "update",
    "delete",
    "create",
    "drop",
    "table",
    "values",
    "set",
    "and",
    "or",
    "not",
    "null",
    "is",
    "in",
    "as",
    "on",
    "join",
    "left",
    "right",
    "inner",
    "outer",
    "group",
    "by",
    "order",
    "limit",
    "offset",
    "having",
    "distinct",
    "union",
    "all",
    "case",
    "when",
    "then",
    "else",
    "end",
    "like",
    "between",
    "exists",
    "primary",
    "key",
    "foreign",
    "references",
    "default",
    "if",
    "exists",
    "alter",
    "add",
    "column",
    "index",
    "view",
    "trigger",
    "pragma",
    "explain",
  ];
  let re = new RegExp("\\b(" + keywords.join("|") + ")\\b", "gi");
  return sql.replace(re, '<span class="sql-keyword">$1</span>');
}

function executeRawSql() {
  const sql = rawSqlInput.value.trim();
  if (!sql) {
    showNotification("Please enter a SQL query.", true);
    return;
  }
  sqlResultsOutput.innerHTML = "<span>Executing query...</span>";
  sqlResultsOutput.classList.remove("error");
  executeSqlBtn.disabled = true;
  clearSqlBtn.disabled = true;

  const requestId = generateRequestId();
  pendingSqlRequests[requestId] = (response) => {
    executeSqlBtn.disabled = false;
    clearSqlBtn.disabled = false;
    fetchSqlHistory(); // Refresh history from backend
    if (response && response.success && response.results) {
      try {
        const firstResult = Array.isArray(response.results)
          ? response.results[0]
          : response.results.mappedResults?.[0];
        if (
          firstResult &&
          Array.isArray(firstResult.columns) &&
          Array.isArray(firstResult.values)
        ) {
          let html =
            '<div style="overflow:auto"><table class="sql-result-table"><thead><tr>';
          firstResult.columns.forEach((col) => {
            html += `<th>${col}</th>`;
          });
          html += "</tr></thead><tbody>";
          if (firstResult.values.length === 0) {
            html += `<tr><td colspan="${firstResult.columns.length}"><em>No rows returned.</em></td></tr>`;
          } else {
            firstResult.values.forEach((row) => {
              html +=
                "<tr>" +
                row
                  .map(
                    (cell) =>
                      `<td>${
                        cell === null
                          ? "<em>null</em>"
                          : highlightSql(String(cell))
                      }</td>`
                  )
                  .join("") +
                "</tr>";
            });
          }
          html += "</tbody></table></div>";
          sqlResultsOutput.innerHTML = html;
        } else {
          sqlResultsOutput.innerHTML = `<div class="sql-nonselect-msg">Query executed successfully.</div>`;
        }
        showNotification("SQL query executed successfully.", false);
      } catch (jsonError) {
        sqlResultsOutput.innerHTML = `<pre class='error'>Error formatting results: ${
          jsonError.message
        }\n\nRaw Results:\n${JSON.stringify(response.results)}</pre>`;
        sqlResultsOutput.classList.add("error");
        showNotification(
          "SQL query executed, but result formatting failed.",
          true
        );
      }
    } else {
      const errorMsg = response?.error || "Unknown error executing SQL.";
      sqlResultsOutput.innerHTML = `<pre class='error'>Error: ${errorMsg}\n${
        response?.stack || ""
      }</pre>`;
      sqlResultsOutput.classList.add("error");
      showNotification(`Error executing SQL: ${errorMsg}`, true);
      console.error("Raw SQL Execution Error:", response);
    }
    maybeAddExportButton();
  };

  eventRequest(
    "executeRawSql",
    { sql, requestId },
    pendingSqlRequests[requestId]
  );
}

// Initial fetch of SQL history from backend
fetchSqlHistory();

// --- Backup/Restore UI: handle empty state ---
function loadBackupList() {
  chrome.storage.local.get(null, (items) => {
    const backups = Object.keys(items).filter((k) =>
      k.startsWith("database_backup_")
    );
    backupMetaCache = {};
    if (backups.length === 0) {
      restoreBackupSelect.innerHTML =
        '<option value="" disabled selected>No backups found</option>';
      return;
    }
    const options = backups.map((k) => {
      const meta = items[k]?.meta || {};
      backupMetaCache[k] = meta;
      return `<option value="${k}">${formatBackupOption(k, meta)}</option>`;
    });
    restoreBackupSelect.innerHTML = options.join("");
  });
}

if (backupDbBtn) {
  backupDbBtn.addEventListener("click", () => {
    eventRequest("backupDatabase", {}, (response) => {
      if (response && response.success) {
        showNotification("Backup created.");
        loadBackupList();
      } else {
        showNotification(
          "Backup failed: " + (response?.error || "Unknown error"),
          true
        );
      }
    });
  });
}

if (deleteBackupBtn) {
  deleteBackupBtn.addEventListener("click", () => {
    const key = restoreBackupSelect.value;
    if (!key) return showNotification("No backup selected.", true);
    if (!confirm("Delete this backup?")) return;
    chrome.storage.local.remove(key, () => {
      showNotification("Backup deleted.");
      loadBackupList();
    });
  });
}

if (restoreBackupBtn) {
  restoreBackupBtn.addEventListener("click", () => {
    const key = restoreBackupSelect.value;
    if (!key) return showNotification("No backup selected.", true);
    chrome.storage.local.get([key], (items) => {
      const data = items[key];
      if (!data) return showNotification("Backup not found.", true);
      eventRequest("restoreDatabase", { data }, (response) => {
        if (response && response.success) {
          showNotification("Database restored from backup.");
          loadDatabaseInfo();
        } else {
          showNotification(
            "Restore failed: " + (response?.error || "Unknown error"),
            true
          );
        }
      });
    });
  });
}

// --- Vacuum/Optimize Spinner ---
if (vacuumDbBtn) {
  vacuumDbBtn.addEventListener("click", () => {
    vacuumDbBtn.disabled = true;
    vacuumDbBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Optimizing...';
    eventRequest("vacuumDatabase", {}, (response) => {
      vacuumDbBtn.disabled = false;
      vacuumDbBtn.innerHTML = '<i class="fas fa-broom"></i> Optimize';
      if (response && response.success) {
        showNotification("Database optimized (VACUUM complete).");
        loadDatabaseInfo();
      } else {
        showNotification(
          "VACUUM failed: " + (response?.error || "Unknown error"),
          true
        );
      }
    });
  });
}

// --- Health Check Icon/Tooltip ---
function checkDbHealth() {
  eventRequest("getDatabaseStats", {}, (response) => {
    const icon = dbHealthStatus.querySelector("i");
    let status = "";
    let color = "#aaa";
    let tooltip = "";
    if (response && response.success) {
      status = "Healthy";
      color = "#28a745";
      tooltip = `Healthy\nLast checked: ${new Date().toLocaleTimeString()}`;
    } else {
      status = "Error";
      color = "#dc3545";
      tooltip = `Error: ${response?.error || "Unknown"}`;
    }
    icon.style.color = color;
    dbHealthStatus.title = tooltip;
    dbHealthStatus.innerHTML = `<i class="fas fa-circle" style="color:${color};font-size:12px;"></i> ${status}`;
  });
}

// --- Table Browser: event-based, show 5 rows, scrollable, export all as CSV ---
function loadTableList() {
  eventRequest("getDatabaseSchemaSummary", {}, (response) => {
    if (
      response &&
      response.success &&
      response.summary &&
      response.summary.length > 0
    ) {
      allTables = response.summary;
      renderTableDropdown();
      // Show first table by default
      if (allTables.length > 0) {
        tableSelect.value = allTables[0].name;
        viewSelectedTable();
      }
    } else {
      allTables = [];
      tableSelect.innerHTML =
        '<option value="" disabled selected>No tables found</option>';
      tableViewContainer.innerHTML =
        "<em>No tables found in the database.</em>";
    }
  });
}

function renderTableDropdown(filter = "") {
  const filtered = allTables.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  );
  if (filtered.length === 0) {
    tableSelect.innerHTML =
      '<option value="" disabled selected>No tables found</option>';
    return;
  }
  tableSelect.innerHTML = filtered
    .map((t) => `<option value="${t.name}">${t.name} (${t.rows})</option>`)
    .join("");
}

if (tableSearch) {
  tableSearch.addEventListener("input", (e) => {
    renderTableDropdown(e.target.value);
  });
}

if (viewTableBtn) {
  viewTableBtn.addEventListener("click", viewSelectedTable);
}

function viewSelectedTable() {
  const table = tableSelect.value;
  if (!table) {
    tableViewContainer.innerHTML = "<em>No table selected.</em>";
    return;
  }
  tableViewContainer.innerHTML = "<em>Loading table...</em>";
  const requestId = generateRequestId();
  pendingRequests[requestId] = (response) => {
    if (response && response.success && response.data) {
      renderTableViewLimited(response.data, 5);
    } else {
      tableViewContainer.innerHTML = `<div class='error'>Failed to load table: ${
        response?.error || "Unknown error"
      }</div>`;
    }
  };
  chrome.runtime.sendMessage({
    action: "getTableContents",
    table,
    limit: 5,
    requestId,
  });
}

function renderTableViewLimited(data, maxRows = 5) {
  if (!data || !data.columns) {
    tableViewContainer.innerHTML = "<em>No data</em>";
    return;
  }
  let html =
    '<div style="overflow-x:auto; max-height:180px; overflow-y:auto;"><table class="sql-result-table"><thead><tr>';
  data.columns.forEach((col) => {
    html += `<th>${col}</th>`;
  });
  html += "</tr></thead><tbody>";
  const rows = data.values ? data.values.slice(0, maxRows) : [];
  if (!rows.length) {
    html += `<tr><td colspan="${data.columns.length}"><em>No data in this table</em></td></tr>`;
  } else {
    rows.forEach((row) => {
      html +=
        "<tr>" +
        row
          .map((cell) => `<td>${cell === null ? "<em>null</em>" : cell}</td>`)
          .join("") +
        "</tr>";
    });
  }
  html += "</tbody></table></div>";
  tableViewContainer.innerHTML = html;
}

if (exportTableBtn) {
  exportTableBtn.addEventListener("click", () => {
    const table = tableSelect.value;
    if (!table) return showNotification("No table selected.", true);
    showNotification("Exporting table as CSV...");
    const requestId = generateRequestId();
    pendingRequests[requestId] = (response) => {
      if (response && response.success && response.data) {
        exportTableAsCSV(response.data, table);
      } else {
        showNotification(
          "Failed to export table: " + (response?.error || "Unknown error"),
          true
        );
      }
    };
    chrome.runtime.sendMessage({
      action: "getTableContents",
      table,
      limit: 0,
      requestId,
    });
  });
}
function exportTableAsCSV(data, tableName) {
  if (!data || !data.columns) return;
  const csvRows = [data.columns.join(",")];
  (data.values || []).forEach((row) => {
    csvRows.push(
      row
        .map(
          (cell) =>
            '"' + (cell === null ? "" : String(cell).replace(/"/g, '""')) + '"'
        )
        .join(",")
    );
  });
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(
    2,
    "0"
  )}${String(now.getMinutes()).padStart(2, "0")}${String(
    now.getSeconds()
  ).padStart(2, "0")}`;
  const filename = `${tableName}-${timestamp}.csv`;
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  showNotification(`Exported table '${tableName}' as CSV.`);
}

// --- Export/Import History: handle empty state ---
function loadHistoryLog() {
  const historyLogList = document.getElementById("historyLogList");
  if (!historyLogList) return;
  historyLogList.innerHTML = "<li>Loading history...</li>";
  eventRequest("getSqlHistory", {}, (response) => {
    if (response && response.success && Array.isArray(response.history)) {
      if (response.history.length === 0) {
        historyLogList.innerHTML = "<li>No history found.</li>";
        return;
      }
      historyLogList.innerHTML = response.history
        .map((entry) => {
          const date = new Date(entry.executed_at).toLocaleString();
          const status = entry.success ? "✅" : "❌";
          const error = entry.error_message
            ? `<div class='error-msg'>${entry.error_message}</div>`
            : "";
          return `<li><span class='history-date'>${date}</span> <span class='history-status'>${status}</span> <code class='history-query'>${entry.query}</code>${error}</li>`;
        })
        .join("");
    } else {
      historyLogList.innerHTML = "<li>Error loading history.</li>";
    }
  });
}

if (clearHistoryLogBtn) {
  clearHistoryLogBtn.addEventListener("click", () => {
    if (!confirm("Clear export/import history log?")) return;
    chrome.storage.local.get(null, (items) => {
      const keys = Object.keys(items).filter(
        (k) =>
          k.startsWith("export:") ||
          k.startsWith("import:") ||
          k.startsWith("database_backup_")
      );
      chrome.storage.local.remove(keys, () => {
        showNotification("History log cleared.");
        loadHistoryLog();
      });
    });
  });
}

// --- Encryption: single input, show/hide toggle, grid logic ---
if (toggleKeyVisibility && encryptionKeyInput) {
  toggleKeyVisibility.addEventListener("click", () => {
    if (encryptionKeyInput.type === "password") {
      encryptionKeyInput.type = "text";
      toggleKeyVisibility.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
      encryptionKeyInput.type = "password";
      toggleKeyVisibility.innerHTML = '<i class="fas fa-eye"></i>';
    }
  });
}

if (encryptDbBtn && encryptionKeyInput) {
  encryptDbBtn.addEventListener("click", () => {
    const key = encryptionKeyInput.value;
    if (!key) return showNotification("No key entered.", true);
    eventRequest("encryptDatabase", { key }, (response) => {
      if (response && response.success) {
        showNotification("Database encrypted.");
        updateEncryptionStatus();
      } else {
        showNotification(
          "Encryption failed: " + (response?.error || "Unknown error"),
          true
        );
      }
    });
  });
}

if (decryptDbBtn && encryptionKeyInput) {
  decryptDbBtn.addEventListener("click", () => {
    const key = encryptionKeyInput.value;
    if (!key) return showNotification("No key entered.", true);
    eventRequest("decryptDatabase", { key }, (response) => {
      if (response && response.success) {
        showNotification("Database decrypted.");
        updateEncryptionStatus();
      } else {
        showNotification(
          "Decryption failed: " + (response?.error || "Unknown error"),
          true
        );
      }
    });
  });
}

function updateEncryptionStatus() {
  eventRequest("getEncryptionStatus", {}, (response) => {
    const statusEl = encryptionStatus;
    if (response && response.enabled) {
      statusEl.innerHTML = '<i class="fas fa-lock"></i> Status: Encrypted';
      encryptionWarning.style.display = "none";
    } else {
      statusEl.innerHTML =
        '<i class="fas fa-lock-open"></i> Status: Unencrypted';
      encryptionWarning.style.display = "inline-block";
    }
  });
}

// Setup event listeners
function setupEventListeners() {
  // Database Diagnostics Listeners
  if (refreshDbInfoBtn) {
    refreshDbInfoBtn.addEventListener("click", function () {
      const originalText = refreshDbInfoBtn.innerHTML;
      refreshDbInfoBtn.disabled = true;
      refreshDbInfoBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
      loadDatabaseInfo();
      setTimeout(() => {
        refreshDbInfoBtn.disabled = false;
        refreshDbInfoBtn.innerHTML = originalText;
      }, 2000);
    });
  }
  if (executeSqlBtn) {
    executeSqlBtn.addEventListener("click", executeRawSql);
  }
  if (clearSqlBtn) {
    clearSqlBtn.addEventListener("click", () => {
      sqlResultsOutput.textContent = "Execute a query to see results.";
      sqlResultsOutput.classList.remove("error");
      rawSqlInput.value = ""; // Optionally clear the input too
    });
  }
  if (saveDbSettingsBtn) {
    saveDbSettingsBtn.addEventListener("click", () => {
      // For now, just show a notification. Extend as needed to save DB-related settings.
      showNotification("Database settings saved.");
    });
  }
}
