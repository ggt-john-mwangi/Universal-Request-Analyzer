// Import necessary modules
import "../components/dashboard.js";
import "../components/auto-export.js";
import "../components/capture-filters.js";
import "../components/capture-settings.js";
import "../../lib/shared-components/chart-components.js";
import "../../lib/shared-components/chart-renderer.js";
import "../../lib/shared-components/data-filter-panel.js";
import "../../lib/shared-components/data-loader.js";
import "../components/data-purge.js";
import "../../lib/shared-components/data-visualization.js";
import "../components/export-db.js";
import "../../lib/shared-components/export-panel.js";
import "../../lib/shared-components/filters.js";
import "../../lib/shared-components/notifications.js";
import "../../lib/shared-components/performance-monitor.js";
import settingsManager from "../../lib/shared-components/settings-manager.js";
import "../../lib/shared-components/settings-ui.js";
import "../../lib/shared-components/tab-manager.js";
import "../components/visualization.js";
import "../../auth/acl-manager.js";
import "../../config/feature-flags.js";
import themeManager from "../../config/theme-manager.js";
import "../../lib/chart.min.js";

// DOM elements
const captureEnabled = document.getElementById("captureEnabled");
const maxStoredRequests = document.getElementById("maxStoredRequests");
const captureTypeCheckboxes = document.querySelectorAll(
  'input[name="captureType"]'
);
const includeDomains = document.getElementById("includeDomains");
const excludeDomains = document.getElementById("excludeDomains");
const autoExport = document.getElementById("autoExport");
const exportFormat = document.getElementById("exportFormat");
const exportInterval = document.getElementById("exportInterval");
const exportPath = document.getElementById("exportPath");
const plotEnabled = document.getElementById("plotEnabled");
const plotTypeCheckboxes = document.querySelectorAll('input[name="plotType"]');
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const exportDbBtn = document.getElementById("exportDbBtn");
const clearDbBtn = document.getElementById("clearDbBtn");
const notification = document.getElementById("notification");
const dbTotalRequests = document.getElementById("dbTotalRequests");
const dbSize = document.getElementById("dbSize");
const lastExport = document.getElementById("lastExport");

// Add import/export elements
const exportSettingsBtn = document.getElementById("exportSettingsBtn");
const importSettingsBtn = document.getElementById("importSettingsBtn");
const importSettingsFile = document.getElementById("importSettingsFile");

// Theme elements
const currentThemeSelect = document.getElementById("currentTheme");
const themesContainer = document.querySelector(".themes-container");
const saveThemeBtn = document.getElementById("saveThemeBtn");
const resetThemeBtn = document.getElementById("resetThemeBtn");

// Load when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log('Options page: DOM loaded, initializing...');
    
    // Initialize settings manager
    console.log('Options page: Initializing settings manager...');
    await settingsManager.initialize();
    console.log('Options page: Settings manager initialized');

    // Initialize theme manager
    console.log('Options page: Initializing theme manager...');
    const currentTheme = settingsManager.getAllSettings()?.theme?.current || "light";
    await themeManager.initialize({
      initialTheme: currentTheme,
      onUpdate: handleThemeUpdate,
    });
    console.log('Options page: Theme manager initialized');

    // Load initial settings
    console.log('Options page: Loading options...');
    await loadOptions();
    console.log('Options page: Options loaded');

    // Add settings change listener
    settingsManager.addSettingsListener(handleSettingsChange);

    // Initialize data purge component
    const dataPurgeContainer = document.getElementById("dataPurge");
    if (dataPurgeContainer) {
      console.log('Options page: Rendering data purge component...');
      dataPurgeContainer.appendChild(renderDataPurge());
    }

    // Set up tab navigation
    console.log('Options page: Setting up tab navigation...');
    setupTabNavigation();

    // Render theme options
    console.log('Options page: Rendering theme options...');
    renderThemeOptions();
    
    console.log('Options page: Initialization complete!');
  } catch (error) {
    console.error("Error initializing options:", error);
    console.error("Error stack:", error.stack);
    showNotification("Failed to initialize options: " + error.message, true);
  }
});

// Load options from storage
async function loadOptions() {
  try {
    const allSettings = settingsManager.getAllSettings();
    const settings = allSettings.settings;

    // Update capture settings - with null checks
    if (captureEnabled) captureEnabled.checked = settings?.capture?.enabled ?? true;
    if (maxStoredRequests) maxStoredRequests.value = settings?.general?.maxStoredRequests ?? 10000;

    // Update capture types
    if (captureTypeCheckboxes && captureTypeCheckboxes.length > 0) {
      const includeTypes = settings?.capture?.captureFilters?.includeTypes || [];
      captureTypeCheckboxes.forEach((checkbox) => {
        checkbox.checked = includeTypes.includes(checkbox.value);
      });
    }

    // Update domains
    if (includeDomains) {
      includeDomains.value = (settings?.capture?.captureFilters?.includeDomains || []).join(", ");
    }
    if (excludeDomains) {
      excludeDomains.value = (settings?.capture?.captureFilters?.excludeDomains || []).join(", ");
    }

    // Update export settings
    if (autoExport) autoExport.checked = settings?.general?.autoExport ?? false;
    if (exportFormat) exportFormat.value = settings?.general?.defaultExportFormat || 'json';
    if (exportInterval) exportInterval.value = (settings?.general?.autoExportInterval || 3600000) / 60000; // Convert to minutes
    if (exportPath) exportPath.value = settings?.general?.exportPath || "";

    // Update visualization settings
    if (plotEnabled) plotEnabled.checked = settings?.display?.showCharts ?? true;
    if (plotTypeCheckboxes && plotTypeCheckboxes.length > 0) {
      const enabledCharts = settings?.display?.enabledCharts || [];
      plotTypeCheckboxes.forEach((checkbox) => {
        checkbox.checked = enabledCharts.includes(checkbox.value);
      });
    }

    // Update theme settings
    if (currentThemeSelect && themeManager) {
      currentThemeSelect.value = themeManager.currentTheme || 'light';
      renderThemeCards();
    }

    // Load database info
    await loadDatabaseInfo();
    if (typeof loadSqliteExportToggle === 'function') {
      loadSqliteExportToggle();
    }
  } catch (error) {
    console.error('Error in loadOptions:', error);
    showNotification('Error loading some settings: ' + error.message, true);
  }
}

// Load database information
async function loadDatabaseInfo() {
  try {
    // Skip if elements don't exist
    if (!dbTotalRequests && !dbSize && !lastExport) {
      console.log('Database info elements not found, skipping...');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'getDashboardStats',
      timeRange: 86400
    });

    if (response && response.success && response.stats) {
      const stats = response.stats;
      
      if (dbTotalRequests) {
        dbTotalRequests.textContent = stats.totalRequests || 0;
      }
      
      // Estimate database size
      const totalRecords = (stats.layerCounts?.bronze || 0) + 
                          (stats.layerCounts?.silver || 0) + 
                          (stats.layerCounts?.gold || 0);
      const estimatedSize = Math.round(totalRecords * 0.5); // ~0.5KB per record
      
      if (dbSize) {
        dbSize.textContent = estimatedSize < 1024 
          ? `${estimatedSize} KB` 
          : `${(estimatedSize / 1024).toFixed(2)} MB`;
      }
      
      if (lastExport) {
        // Get last export time from storage
        const result = await chrome.storage.local.get('lastExportTime');
        if (result.lastExportTime) {
          lastExport.textContent = new Date(result.lastExportTime).toLocaleString();
        } else {
          lastExport.textContent = 'Never';
        }
      }
    }
  } catch (error) {
    console.error('Failed to load database info:', error);
  }
}

// Placeholder for SQLite export toggle (if needed by other components)
function loadSqliteExportToggle() {
  console.log('loadSqliteExportToggle called');
  // Implementation can be added here if needed
}

// Handle settings changes from other views
function handleSettingsChange(newSettings) {
  // Update UI elements with new settings
  captureEnabled.checked = newSettings.capture.enabled;
  maxStoredRequests.value = newSettings.general.maxStoredRequests;

  // Update theme UI if needed
  if (
    newSettings.theme &&
    newSettings.theme.current !== currentThemeSelect.value
  ) {
    currentThemeSelect.value = newSettings.theme.current;
    renderThemeCards();
  }
}

// Handle theme updates
function handleThemeUpdate(themeData) {
  currentThemeSelect.value = themeData.theme;
  renderThemeCards();
}

// Save options to storage
async function saveOptions() {
  const newSettings = {
    capture: {
      enabled: captureEnabled.checked,
      captureFilters: {
        includeTypes: Array.from(captureTypeCheckboxes)
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => checkbox.value),
        includeDomains: includeDomains.value
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d),
        excludeDomains: excludeDomains.value
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d),
      },
    },
    general: {
      maxStoredRequests: Number.parseInt(maxStoredRequests.value, 10),
      autoExport: autoExport.checked,
      defaultExportFormat: exportFormat.value,
      autoExportInterval: Number.parseInt(exportInterval.value, 10) * 60000,
      exportPath: exportPath.value.trim(),
    },
    display: {
      showCharts: plotEnabled.checked,
      enabledCharts: Array.from(plotTypeCheckboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value),
    },
    theme: {
      current: themeManager.currentTheme,
    },
  };

  const success = await settingsManager.updateSettings(newSettings);
  if (success) {
    showNotification("Options saved successfully!");
  } else {
    showNotification("Error saving options", true);
  }
}

// Reset options to defaults
async function resetOptions() {
  const success = await settingsManager.resetAllToDefaults();
  if (success) {
    await loadOptions();
    showNotification("Options reset to defaults!");
  } else {
    showNotification("Error resetting options", true);
  }
}

// Export settings to file
function exportSettings() {
  const exportData = settingsManager.exportSettings();
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `request-analyzer-settings-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification("Settings exported successfully!");
}

// Import settings from file
async function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        const success = await settingsManager.importSettings(importData);

        if (success) {
          await loadOptions(); // Reload UI with new settings
          showNotification("Settings imported successfully!");
        } else {
          showNotification("Failed to import settings", true);
        }
      } catch (error) {
        console.error("Import error:", error);
        showNotification("Invalid settings file", true);
      }
    };
    reader.readAsText(file);
  } catch (error) {
    console.error("File read error:", error);
    showNotification("Failed to read settings file", true);
  }

  // Clear the file input for future imports
  event.target.value = "";
}

// Render theme options
function renderThemeOptions() {
  // Handle theme selection change
  currentThemeSelect.addEventListener("change", async (e) => {
    const themeId = e.target.value;
    await themeManager.setTheme(themeId);
  });

  // Handle theme save
  saveThemeBtn.addEventListener("click", async () => {
    const success = await settingsManager.updateSettings({
      theme: {
        current: themeManager.currentTheme,
      },
    });

    if (success) {
      showNotification("Theme settings saved successfully!");
    } else {
      showNotification("Error saving theme settings", true);
    }
  });

  // Handle theme reset
  resetThemeBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to reset theme settings to defaults?")) {
      await themeManager.resetToDefaults();
      currentThemeSelect.value = themeManager.currentTheme;
      renderThemeCards();
      showNotification("Theme settings reset to defaults!");
    }
  });

  // Initial render of theme cards
  renderThemeCards();
}

// Render theme preview cards
function renderThemeCards() {
  const themes = themeManager.getThemesInfo();
  themesContainer.innerHTML = themes
    .map(
      (theme) => `
    <div class="theme-card ${
      theme.isCurrentTheme ? "current-theme" : ""
    }" data-theme-id="${theme.id}">
      <div class="theme-preview" style="background-color: ${
        theme.previewColors.background
      }">
        <div class="theme-preview-header" style="
          background-color: ${theme.previewColors.surface};
          color: ${theme.previewColors.text};
          border: 1px solid ${theme.previewColors.primary};">
          ${theme.name}
        </div>
      </div>
      <div class="theme-info">
        <div class="theme-name">${theme.name}</div>
        <div class="theme-description">${theme.description}</div>
      </div>
      <div class="theme-actions">
        <button class="theme-apply-btn" data-theme-id="${theme.id}"
          ${theme.isCurrentTheme ? "disabled" : ""}>
          ${theme.isCurrentTheme ? "Current Theme" : "Apply Theme"}
        </button>
      </div>
    </div>
  `
    )
    .join("");

  // Add theme card click handlers
  document.querySelectorAll(".theme-apply-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const themeId = e.target.dataset.themeId;
      await themeManager.setTheme(themeId);
      currentThemeSelect.value = themeId;
      renderThemeCards();
      showNotification(
        `${themeManager.themes[themeId].name} theme applied successfully!`
      );
    });
  });
}

// Setup tab navigation
function setupTabNavigation() {
  const tabs = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active class from all tabs and contents
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Add active class to clicked tab and corresponding content
      tab.classList.add("active");
      const tabId = tab.dataset.tab;
      document.getElementById(tabId).classList.add("active");
    });
  });
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

// Add event listeners
if (saveBtn) {
  saveBtn.addEventListener("click", saveOptions);
}
if (resetBtn) {
  resetBtn.addEventListener("click", resetOptions);
}
if (exportDbBtn) {
  exportDbBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage(
    {
      action: "exportDatabase",
      format: exportFormat.value,
      filename: `database-export-${new Date().toISOString().slice(0, 10)}.${
        exportFormat.value
      }`,
    },
    (response) => {
      if (response && response.success) {
        showNotification("Database exported successfully!");
        lastExport.textContent = new Date().toLocaleString();
      } else {
        showNotification("Failed to export database", true);
      }
    }
  );
  });
}

if (clearDbBtn) {
  clearDbBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all stored requests?")) {
      chrome.runtime.sendMessage({ action: "clearDatabase" }, (response) => {
        if (response && response.success) {
          showNotification("Database cleared successfully!");
          loadDatabaseInfo();
        } else {
          showNotification("Failed to clear database", true);
        }
      });
    }
  });
}

// Add import/export event listeners
if (exportSettingsBtn) {
  exportSettingsBtn.addEventListener("click", exportSettings);
}
if (importSettingsBtn && importSettingsFile) {
  importSettingsBtn.addEventListener("click", () => importSettingsFile.click());
  importSettingsFile.addEventListener("change", importSettings);
}

// Advanced Tab Functionality
function initializeAdvancedTab() {
  // Execute Query
  const executeQueryBtn = document.getElementById('executeQueryBtn');
  const clearQueryBtn = document.getElementById('clearQueryBtn');
  const advancedQuery = document.getElementById('advancedQuery');
  const queryResult = document.getElementById('queryResult');

  if (executeQueryBtn) {
    executeQueryBtn.addEventListener('click', async () => {
      const query = advancedQuery?.value?.trim();
      if (!query) {
        showNotification('Please enter a query', true);
        return;
      }

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'executeDirectQuery',
          query: query
        });

        if (response.success && queryResult) {
          displayQueryResult(response.result, queryResult);
          showNotification('Query executed successfully');
        } else {
          if (queryResult) {
            queryResult.innerHTML = `<p style="color: red;">Error: ${response.error || 'Query failed'}</p>`;
          }
          showNotification('Query failed: ' + (response.error || 'Unknown error'), true);
        }
      } catch (error) {
        console.error('Query execution error:', error);
        if (queryResult) {
          queryResult.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
        showNotification('Query execution failed', true);
      }
    });
  }

  if (clearQueryBtn && advancedQuery && queryResult) {
    clearQueryBtn.addEventListener('click', () => {
      advancedQuery.value = '';
      queryResult.innerHTML = '<p class="placeholder">Execute a query to see results...</p>';
    });
  }

  // Inspect Schema
  const inspectSchemaBtn = document.getElementById('inspectSchemaBtn');
  if (inspectSchemaBtn) {
    inspectSchemaBtn.addEventListener('click', async () => {
      const query = "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name";
      if (advancedQuery) advancedQuery.value = query;
      
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'executeDirectQuery',
          query: query
        });

        if (response.success && queryResult) {
          displayQueryResult(response.result, queryResult);
          showNotification('Schema loaded successfully');
        }
      } catch (error) {
        showNotification('Failed to load schema', true);
      }
    });
  }

  // View Logs
  const viewLogsBtn = document.getElementById('viewLogsBtn');
  if (viewLogsBtn) {
    viewLogsBtn.addEventListener('click', () => {
      console.log('=== Universal Request Analyzer Debug Info ===');
      console.log('Extension version: 1.0.0');
      console.log('Current time:', new Date().toISOString());
      showNotification('Check browser console for logs');
    });
  }

  // Test Connection
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'ping'
        });
        
        if (response && response.success) {
          showNotification('✓ Background script connection successful');
        } else {
          showNotification('⚠ Background script not responding properly', true);
        }
      } catch (error) {
        showNotification('✗ Failed to connect to background script', true);
      }
    });
  }

  // Force Processing
  const forceProcessBtn = document.getElementById('forceProcessBtn');
  if (forceProcessBtn) {
    forceProcessBtn.addEventListener('click', async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'processToSilver'
        });
        
        if (response && response.success) {
          showNotification(`Processed ${response.processed || 0} records to Silver layer`);
          await loadAdvancedStats();
        } else {
          showNotification('Processing failed', true);
        }
      } catch (error) {
        showNotification('Failed to trigger processing', true);
      }
    });
  }

  // Export Raw DB
  const exportRawDbBtn = document.getElementById('exportRawDbBtn');
  if (exportRawDbBtn) {
    exportRawDbBtn.addEventListener('click', async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'exportDatabase',
          format: 'sqlite'
        });
        
        if (response && response.success) {
          showNotification('Database export initiated');
        } else {
          showNotification('Export failed', true);
        }
      } catch (error) {
        showNotification('Failed to export database', true);
      }
    });
  }

  // Reset Database
  const resetDatabaseBtn = document.getElementById('resetDatabaseBtn');
  if (resetDatabaseBtn) {
    resetDatabaseBtn.addEventListener('click', async () => {
      if (confirm('⚠️ WARNING: This will delete ALL data and cannot be undone!\n\nAre you sure you want to reset the database?')) {
        if (confirm('This is your last chance. Really reset the database?')) {
          try {
            const response = await chrome.runtime.sendMessage({
              action: 'resetDatabase'
            });
            
            if (response && response.success) {
              showNotification('Database reset successfully');
              await loadAdvancedStats();
            } else {
              showNotification('Reset failed', true);
            }
          } catch (error) {
            showNotification('Failed to reset database', true);
          }
        }
      }
    });
  }

  // Clear Cache
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async () => {
      if (confirm('Clear extension cache and reload?')) {
        try {
          await chrome.storage.local.clear();
          showNotification('Cache cleared. Reloading...');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (error) {
          showNotification('Failed to clear cache', true);
        }
      }
    });
  }

  // Load advanced stats
  loadAdvancedStats();
}

// Display query result in table format
function displayQueryResult(result, container) {
  if (!result || !result[0]) {
    container.innerHTML = '<p class="placeholder">No results</p>';
    return;
  }

  const data = result[0];
  if (!data.columns || !data.values || data.values.length === 0) {
    container.innerHTML = '<p class="placeholder">No results</p>';
    return;
  }

  let html = '<table><thead><tr>';
  data.columns.forEach(col => {
    html += `<th>${col}</th>`;
  });
  html += '</tr></thead><tbody>';

  data.values.forEach(row => {
    html += '<tr>';
    row.forEach(cell => {
      const displayValue = cell === null ? 'NULL' : cell;
      html += `<td>${displayValue}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  html += `<p style="margin-top: 10px; color: #666; font-size: 12px;">Returned ${data.values.length} row(s)</p>`;
  container.innerHTML = html;
}

// Load advanced statistics
async function loadAdvancedStats() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getDashboardStats',
      timeRange: 86400 // 24 hours
    });

    if (response && response.success && response.stats) {
      const stats = response.stats;
      
      // Update layer counts
      const bronzeCount = document.getElementById('advancedBronzeCount');
      const silverCount = document.getElementById('advancedSilverCount');
      const goldCount = document.getElementById('advancedGoldCount');
      
      if (bronzeCount) bronzeCount.textContent = stats.layerCounts?.bronze || 0;
      if (silverCount) silverCount.textContent = stats.layerCounts?.silver || 0;
      if (goldCount) goldCount.textContent = stats.layerCounts?.gold || 0;
      
      // Estimate database size (rough estimate)
      const totalRecords = (stats.layerCounts?.bronze || 0) + 
                          (stats.layerCounts?.silver || 0) + 
                          (stats.layerCounts?.gold || 0);
      const estimatedSize = Math.round(totalRecords * 0.5); // ~0.5KB per record
      const dbSizeEl = document.getElementById('advancedDbSize');
      if (dbSizeEl) {
        dbSizeEl.textContent = estimatedSize < 1024 
          ? `${estimatedSize} KB` 
          : `${(estimatedSize / 1024).toFixed(2)} MB`;
      }
    }
  } catch (error) {
    console.error('Failed to load advanced stats:', error);
  }
}

// Call this when the advanced tab is shown
document.addEventListener('DOMContentLoaded', () => {
  initializeAdvancedTab();
});
