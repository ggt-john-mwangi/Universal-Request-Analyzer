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
    // Initialize settings manager
    await settingsManager.initialize();

    // Initialize theme manager
    await themeManager.initialize({
      initialTheme: settingsManager.getAllSettings().theme.current || "light",
      onUpdate: handleThemeUpdate,
    });

    // Load initial settings
    await loadOptions();

    // Add settings change listener
    settingsManager.addSettingsListener(handleSettingsChange);

    // Initialize data purge component
    const dataPurgeContainer = document.getElementById("dataPurge");
    if (dataPurgeContainer) {
      dataPurgeContainer.appendChild(renderDataPurge());
    }

    // Set up tab navigation
    setupTabNavigation();

    // Render theme options
    renderThemeOptions();
  } catch (error) {
    console.error("Error initializing options:", error);
    showNotification("Failed to initialize options", true);
  }
});

// Load options from storage
async function loadOptions() {
  const allSettings = settingsManager.getAllSettings();
  const settings = allSettings.settings;

  // Update capture settings
  captureEnabled.checked = settings.capture.enabled;
  maxStoredRequests.value = settings.general.maxStoredRequests;

  // Update capture types
  captureTypeCheckboxes.forEach((checkbox) => {
    checkbox.checked = settings.capture.captureFilters.includeTypes.includes(
      checkbox.value
    );
  });

  // Update domains
  includeDomains.value =
    settings.capture.captureFilters.includeDomains.join(", ");
  excludeDomains.value =
    settings.capture.captureFilters.excludeDomains.join(", ");

  // Update export settings
  autoExport.checked = settings.general.autoExport;
  exportFormat.value = settings.general.defaultExportFormat;
  exportInterval.value = settings.general.autoExportInterval / 60000; // Convert to minutes
  exportPath.value = settings.general.exportPath || "";

  // Update visualization settings
  plotEnabled.checked = settings.display.showCharts;
  plotTypeCheckboxes.forEach((checkbox) => {
    checkbox.checked = settings.display.enabledCharts.includes(checkbox.value);
  });

  // Update theme settings
  currentThemeSelect.value = themeManager.currentTheme;
  renderThemeCards();

  // Load database info
  await loadDatabaseInfo();
  loadSqliteExportToggle();
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
