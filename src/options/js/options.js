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
const captureServerSentEvents = document.getElementById("captureServerSentEvents");
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
const clearSqlBtn = document.getElementById("clearSqlBtn");

// DOM elements - Import
const importFile = document.getElementById("importFile");
const importDataBtn = document.getElementById("importDataBtn");
const exportFilenameInput = document.getElementById("exportFilename"); // Added filename input

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

// Load options when the page loads
document.addEventListener("DOMContentLoaded", () => {
  loadOptions();
  setupSidebarNavigation();
  loadDatabaseInfo(); // Initial load of DB stats, schema, errors

  // Ensure event listeners are attached correctly
  if (exportDbBtn) {
    exportDbBtn.addEventListener("click", exportDatabase);
  } else {
    console.error("Export DB button not found!");
  }

  if (importDataBtn) {
    importDataBtn.addEventListener("click", importData);
  } else {
    console.error("Import Data button not found!");
  }

  if (refreshDbInfoBtn) {
    refreshDbInfoBtn.addEventListener("click", loadDatabaseInfo);
  }
  if (executeSqlBtn) {
    executeSqlBtn.addEventListener("click", executeRawSql);
  }
  if (clearSqlBtn) {
    clearSqlBtn.addEventListener("click", () => {
      rawSqlInput.value = '';
      sqlResultsOutput.textContent = '';
      sqlResultsOutput.classList.remove('error');
    });
  }
});

// Add event listeners for buttons if they exist
if (exportDbBtn) {
  exportDbBtn.addEventListener("click", exportDatabase);
}
if (clearDbBtn) {
  clearDbBtn.addEventListener("click", clearDatabase);
}
if (importDataBtn) {
  importDataBtn.addEventListener("click", importData);
}

// Add event listeners
if (saveButton) {
  saveButton.addEventListener("click", saveOptions);
} else {
  document
    .querySelectorAll(".settings-container input, .settings-container select")
    .forEach((element) => {
      element.addEventListener("change", saveOptions);
    });
  console.warn(
    "No #saveOptionsBtn found, saving on every change. Consider adding a dedicated save button."
  );
}
resetBtn.addEventListener("click", resetOptions);

// Setup sidebar navigation
function setupSidebarNavigation() {
  const navLinks = document.querySelectorAll(".options-sidebar .nav-link");
  const sections = document.querySelectorAll(".option-section");

  navLinks.forEach(link => {
    link.addEventListener("click", (event) => {
      event.preventDefault(); // Prevent default anchor link behavior

      const targetSectionId = link.getAttribute("data-section");
      const targetSection = document.getElementById(targetSectionId);

      // Update active link
      navLinks.forEach(navLink => navLink.classList.remove("active"));
      link.classList.add("active");

      // Update active section
      sections.forEach(section => section.classList.remove("active"));
      if (targetSection) {
        targetSection.classList.add("active");
      }
    });
  });
}

// Load options from storage
function loadOptions() {
  chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
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
  if (maxStoredRequests) maxStoredRequests.value = generalConf.maxStoredRequests;
  if (autoStartCapture) autoStartCapture.checked = generalConf.autoStartCapture;
  if (showNotifications) showNotifications.checked = generalConf.showNotifications;
  if (confirmClearRequests) confirmClearRequests.checked = generalConf.confirmClearRequests;
  if (defaultExportFormat) defaultExportFormat.value = generalConf.defaultExportFormat;
  if (dateFormat) dateFormat.value = generalConf.dateFormat;
  if (timeZone) timeZone.value = generalConf.timeZone;

  // Capture Settings
  if (captureEnabled) captureEnabled.checked = config.captureEnabled ?? localDefaultConfig.captureEnabled;
  const captureConf = config.capture || localDefaultConfig.capture;
  if (includeHeaders) includeHeaders.checked = captureConf.includeHeaders;
  if (includeTiming) includeTiming.checked = captureConf.includeTiming;
  if (includeContent) includeContent.checked = captureConf.includeContent;
  if (maxContentSize) maxContentSize.value = captureConf.maxContentSize;
  if (captureWebSockets) captureWebSockets.checked = captureConf.captureWebSockets;
  if (captureServerSentEvents) captureServerSentEvents.checked = captureConf.captureServerSentEvents;

  // Capture Filters
  const captureFiltersConf = config.captureFilters || localDefaultConfig.captureFilters;
  if (captureTypeCheckboxes) {
    captureTypeCheckboxes.forEach((checkbox) => {
      checkbox.checked = (captureFiltersConf.includeTypes || []).includes(
        checkbox.value
      );
    });
  }
  if (includeDomains) includeDomains.value = (captureFiltersConf.includeDomains || []).join(", ");
  if (excludeDomains) excludeDomains.value = (captureFiltersConf.excludeDomains || []).join(", ");

  // Display Settings
  const displayConf = config.display || localDefaultConfig.display;
  if (requestsPerPage) requestsPerPage.value = displayConf.requestsPerPage;
  if (expandedDetails) expandedDetails.checked = displayConf.expandedDetails;
  if (showStatusColors) showStatusColors.checked = displayConf.showStatusColors;
  if (showTimingBars) showTimingBars.checked = displayConf.showTimingBars;
  if (defaultTab) defaultTab.value = displayConf.defaultTab;

  // Auto Export Settings
  if (autoExport) autoExport.checked = config.autoExport ?? localDefaultConfig.autoExport;
  if (exportFormat) exportFormat.value = config.exportFormat ?? localDefaultConfig.exportFormat;
  if (exportInterval) exportInterval.value = (config.exportInterval ?? localDefaultConfig.exportInterval) / 60000;
  if (exportPath) exportPath.value = config.exportPath ?? localDefaultConfig.exportPath;
  if (lastExport) {
    lastExport.textContent = config.lastExportTime
      ? new Date(config.lastExportTime).toLocaleString()
      : "Never";
  }

  // Plot Settings
  if (plotEnabled) plotEnabled.checked = config.plotEnabled ?? localDefaultConfig.plotEnabled;
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
  logErrorsToDatabase.checked = advancedConf.logErrorsToDatabase ?? localDefaultConfig.advanced.logErrorsToDatabase;
  logErrorsToConsole.checked = advancedConf.logErrorsToConsole ?? localDefaultConfig.advanced.logErrorsToConsole;
}

// Load database information (Stats, Schema, Errors)
function loadDatabaseInfo() {
  showNotification("Loading database info...");

  // 1. Load Stats
  chrome.runtime.sendMessage({ action: "getDbStats" }, (response) => {
    if (response && response.success) {
      dbTotalRequests.textContent = response.stats.requestCount?.toLocaleString() || "0"; // Use requestCount
      if (dbSize) {
        dbSize.textContent = formatBytes(response.stats.size || 0); // Use size
      }
      if (lastExport && response.stats.lastExportTime) {
        lastExport.textContent = new Date(
          response.stats.lastExportTime
        ).toLocaleString();
      } else if (lastExport) {
        lastExport.textContent = "Never";
      }
    } else {
      console.error("Failed to load DB stats:", response?.error);
      dbTotalRequests.textContent = "Error";
      if (dbSize) dbSize.textContent = "Error";
      if (lastExport) lastExport.textContent = "Error";
      showNotification(`Error loading DB stats: ${response?.error || 'Unknown error'}`, true);
    }
  });

  // 2. Load Schema Summary
  if (dbSchemaSummary) {
      dbSchemaSummary.innerHTML = '<li>Loading schema...</li>'; // Clear previous
      chrome.runtime.sendMessage({ action: "getDbSchemaSummary" }, (response) => {
          if (response && response.success && response.summary) {
              dbSchemaSummary.innerHTML = ''; // Clear loading message
              if (response.summary.length > 0) {
                  response.summary.forEach(table => {
                      const li = document.createElement('li');
                      li.textContent = `${table.name}: ${table.rows.toLocaleString()} rows`;
                      dbSchemaSummary.appendChild(li);
                  });
              } else {
                  dbSchemaSummary.innerHTML = '<li>No tables found or unable to retrieve schema.</li>';
              }
          } else {
              console.error("Failed to load DB schema:", response?.error);
              dbSchemaSummary.innerHTML = '<li>Error loading schema.</li>';
              showNotification(`Error loading DB schema: ${response?.error || 'Unknown error'}`, true);
          }
      });
  } else {
      console.warn("#dbSchemaSummary element not found.");
  }

  // 3. Load Logged Errors
  if (dbErrorsTableBody) {
      dbErrorsTableBody.innerHTML = '<tr><td colspan="5">Loading errors...</td></tr>'; // Clear previous
      chrome.runtime.sendMessage({ action: "getLoggedErrors", limit: 50 }, (response) => { // Limit initial load
          if (response && response.success && response.errors) {
              dbErrorsTableBody.innerHTML = ''; // Clear loading message
              if (response.errors.length > 0) {
                  response.errors.forEach(error => {
                      const row = document.createElement('tr');
                      const contextStr = typeof error.context === 'string' ? error.context : JSON.stringify(error.context);
                      row.innerHTML = `
                          <td>${error.id}</td>
                          <td>${new Date(error.timestamp).toLocaleString()}</td>
                          <td>${error.category || 'N/A'}</td>
                          <td title="${error.stack || ''}">${error.message}</td>
                          <td><pre>${contextStr}</pre></td>
                      `;
                      dbErrorsTableBody.appendChild(row);
                  });
              } else {
                  dbErrorsTableBody.innerHTML = '<tr><td colspan="5">No errors logged in the database.</td></tr>';
              }
          } else {
              console.error("Failed to load logged errors:", response?.error);
              dbErrorsTableBody.innerHTML = '<tr><td colspan="5">Error loading logged errors.</td></tr>';
              showNotification(`Error loading logged errors: ${response?.error || 'Unknown error'}`, true);
          }
      });
  } else {
      console.warn("#dbErrorsTableBody element not found.");
  }
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes'; // Handle null, undefined, or 0
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Ensure result is a number before calling toFixed
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return size + ' ' + sizes[i];
}

// Save options to storage
function saveOptions() {
  const newConfig = {
    general: {
      maxStoredRequests: Number.parseInt(maxStoredRequests.value, 10) || 10000,
      autoStartCapture: autoStartCapture.checked,
      showNotifications: showNotifications.checked,
      confirmClearRequests: confirmClearRequests.checked,
      defaultExportFormat: defaultExportFormat.value,
      dateFormat: dateFormat.value,
      timeZone: timeZone.value,
    },
    captureEnabled: captureEnabled.checked,
    capture: {
      includeHeaders: includeHeaders.checked,
      includeTiming: includeTiming.checked,
      includeContent: includeContent.checked,
      maxContentSize: Number.parseInt(maxContentSize.value, 10) || 1024 * 1024,
      captureWebSockets: captureWebSockets.checked,
      captureServerSentEvents: captureServerSentEvents.checked,
    },
    captureFilters: {
      includeDomains: includeDomains.value
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d),
      excludeDomains: excludeDomains.value
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d),
      includeTypes: Array.from(captureTypeCheckboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value),
    },
    display: {
      requestsPerPage: Number.parseInt(requestsPerPage.value, 10) || 50,
      expandedDetails: expandedDetails.checked,
      showStatusColors: showStatusColors.checked,
      showTimingBars: showTimingBars.checked,
      defaultTab: defaultTab.value,
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
    autoExport: autoExport.checked,
    exportFormat: exportFormat.value,
    exportInterval: Number.parseInt(exportInterval.value, 10) * 60000,
    exportPath: exportPath.value.trim(),
    plotEnabled: plotEnabled.checked,
    plotTypes: Array.from(plotTypeCheckboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value),
    advanced: {
      enableDebugMode: enableDebugMode.checked,
      persistFilters: persistFilters.checked,
      useCompression: useCompression.checked,
      backgroundMode: backgroundMode.value,
      syncInterval: Number.parseInt(syncInterval.value, 10) || 60,
      logErrorsToDatabase: logErrorsToDatabase.checked,
      logErrorsToConsole: logErrorsToConsole.checked,
    },
  };

  chrome.runtime.sendMessage(
    {
      action: "updateConfig",
      config: newConfig,
    },
    (response) => {
      if (response && response.success) {
        showNotification("Options saved successfully!");
      } else {
        showNotification("Error saving options", true);
      }
    }
  );
}

// Reset options to defaults
function resetOptions() {
  if (
    confirm("Are you sure you want to reset all options to default values?")
  ) {
    chrome.runtime.sendMessage(
      {
        action: "resetConfig",
      },
      (response) => {
        if (response && response.success) {
          loadOptions();
          showNotification("Options reset to defaults");
        } else {
          showNotification("Error resetting options", true);
        }
      }
    );
  }
}

// Export database
function exportDatabase() {
  // First, get database stats to show size in confirmation
  chrome.runtime.sendMessage({ action: "getDatabaseStats" }, (statsResponse) => {
    let dbSizeBytes = 0;
    let dbSizeFormatted = "Unknown size";
    if (statsResponse && statsResponse.success && statsResponse.stats) {
      dbSizeBytes = statsResponse.stats.size || 0;
      dbSizeFormatted = formatBytes(dbSizeBytes);
    } else if (statsResponse && statsResponse.error) {
      console.warn("Could not fetch database size:", statsResponse.error);
      showNotification(`Could not fetch database size: ${statsResponse.error}`, true);
    }

    // Get filename from input or generate default
    const defaultFilename = `ura-database-export-${new Date().toISOString().slice(0, 10)}`;
    const filename = exportFilenameInput.value.trim() || defaultFilename;

    // Confirmation dialog
    const confirmMessage = `Export the entire database (${dbSizeFormatted}) as '${filename}.sqlite'?`;

    if (confirm(confirmMessage)) {
      showNotification(`Starting database export as ${filename}.sqlite...`);
      chrome.runtime.sendMessage(
        {
          action: "exportData", // Use unified exportData action
          format: "sqlite",
          filename: filename, // Pass the user-provided or default filename
          // Add other options if needed by exportManager for sqlite
        },
        (response) => {
          if (response && response.success) {
            showNotification(`Database exported successfully. Download ID: ${response.downloadId || 'N/A'}`);
            loadDatabaseInfo(); // Refresh last export time
          } else {
            showNotification(`Error exporting database: ${response?.error || 'Unknown error'}`, true);
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
  if (!confirmClearRequests.checked || confirm("Are you sure you want to clear all captured requests? This action cannot be undone.")) {
    showNotification("Clearing database...");
    chrome.runtime.sendMessage({ action: "clearRequests" }, (response) => {
      if (response && response.success) {
        showNotification("Database cleared successfully.");
        loadDatabaseInfo(); // Refresh stats
      } else {
        showNotification(`Error clearing database: ${response?.error || 'Unknown error'}`, true);
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
    const fileType = file.name.split('.').pop().toLowerCase();
    let format;
    let action;
    let dataToSend;

    if (fileType === 'json') {
      format = 'json';
      action = 'importData'; // Action for row-based import
      dataToSend = fileContent.toString(); // Send as string
    } else if (fileType === 'csv') {
      format = 'csv';
      action = 'importData'; // Action for row-based import
      dataToSend = fileContent.toString(); // Send as string
    } else if (fileType === 'sqlite' || fileType === 'db') {
      format = 'sqlite';
      action = 'importDatabaseFile'; // Specific action for replacing DB
      dataToSend = fileContent; // Send ArrayBuffer directly
    } else {
      showNotification("Unsupported file type. Please select JSON, CSV, or SQLite.", true);
      importFile.value = ''; // Clear file input
      return;
    }

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
          if (format === 'sqlite') {
             successMsg = `Successfully imported database from ${file.name}.`;
          } else if (response.importedCount !== undefined) {
             successMsg = `Successfully imported ${response.importedCount} records from ${file.name}.`;
          }
          showNotification(successMsg + " Refreshing stats...");
          // Refresh database info after import
          loadDatabaseInfo();
        } else {
          showNotification(`Error importing data: ${response?.error || 'Unknown error'}`, true);
        }
        // Clear the file input
        importFile.value = '';
      }
    );
  };

  reader.onerror = function () {
    showNotification("Error reading file.", true);
    importFile.value = ''; // Clear file input
  };

  // Read file based on type
  if (fileType === 'sqlite' || fileType === 'db') {
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
  }, 5000)
}

// Execute Raw SQL
function executeRawSql() {
  const sql = rawSqlInput.value.trim();
  if (!sql) {
    showNotification("Please enter a SQL query.", true);
    return;
  }

  sqlResultsOutput.textContent = 'Executing query...';
  sqlResultsOutput.classList.remove('error');
  executeSqlBtn.disabled = true;
  clearSqlBtn.disabled = true;

  chrome.runtime.sendMessage({ action: "executeRawSql", sql: sql }, (response) => {
    executeSqlBtn.disabled = false;
    clearSqlBtn.disabled = false;
    if (response && response.success && response.results) {
      try {
        // Pretty print the JSON result
        sqlResultsOutput.textContent = JSON.stringify(response.results, null, 2);
        showNotification("SQL query executed successfully.", false);
      } catch (jsonError) {
        sqlResultsOutput.textContent = `Error formatting results: ${jsonError.message}\n\nRaw Results:\n${response.results}`;
        sqlResultsOutput.classList.add('error');
        showNotification("SQL query executed, but result formatting failed.", true);
      }
    } else {
      const errorMsg = response?.error || 'Unknown error executing SQL.';
      sqlResultsOutput.textContent = `Error: ${errorMsg}\n${response?.stack || ''}`;
      sqlResultsOutput.classList.add('error');
      showNotification(`Error executing SQL: ${errorMsg}`, true);
      console.error("Raw SQL Execution Error:", response);
    }
  });
}
