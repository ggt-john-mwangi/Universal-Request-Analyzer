// Import required modules and components (from shared library)
import "../../lib/shared-components/chart-components.js";
import "../../lib/shared-components/chart-renderer.js";
import "../../lib/shared-components/data-filter-panel.js";
import "../../lib/shared-components/data-loader.js";
import "../../lib/shared-components/data-visualization.js";
import "../../lib/shared-components/export-panel.js";
import "../../lib/shared-components/filters.js";
import "../../lib/shared-components/notifications.js";
import "../../lib/shared-components/performance-monitor.js";
import "../../lib/shared-components/settings-manager.js";
import "../../lib/shared-components/settings-ui.js";
import "../../lib/shared-components/tab-manager.js";
import "../../auth/acl-manager.js";
import "../../config/feature-flags.js";
import "../../config/theme-manager.js";

// Initialize the extension when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Initialize settings manager
    await settingsManager.initialize();

    // Initialize theme manager
    await themeManager.initialize({
      initialTheme: settingsManager.getAllSettings().theme.current || "light",
      onUpdate: (themeData) => {
        console.log("Theme updated:", themeData);
      },
    });

    // Initialize components
    initializeComponents();

    // Add settings change listener
    settingsManager.addSettingsListener(handleSettingsChange);

    // Set up event listeners
    setupEventListeners();

    // Load initial data
    // await loadRequests();
  } catch (error) {
    console.error("Error initializing popup:", error);
    notificationSystem.showError("Failed to initialize popup");
  }
});

// Initialize all components
function initializeComponents() {
  // Initialize data visualization
  const dataVizContainer = document.getElementById("data-visualization");
  if (dataVizContainer) {
    console.log("Data visualization container found:", dataVizContainer);
    // Check if the container is empty before creating a new instance
    if (dataVizContainer.children.length > 0) {
      console.warn("Data visualization container is not empty. Clearing it.");
      dataVizContainer.innerHTML = ""; // Clear existing content
    }
    const dataViz = new DataVisualization();
    dataVizContainer.appendChild(dataViz);
  }

  // Initialize data filter panel
  const filterContainer = document.getElementById("filter-panel");
  if (filterContainer) {
    console.log("Filter panel container found:", filterContainer);
    // Check if the container is empty before creating a new instance
    if (filterContainer.children.length > 0) {
      console.warn("Filter panel container is not empty. Clearing it.");
      filterContainer.innerHTML = ""; // Clear existing content
    }
    const filterPanel = new DataFilterPanel({
      onFilterChange: (filters) => {
        applyFilters(filters);
        exportPanel.setFilters(filters); // Update export panel with current filters
      },
    });
    filterContainer.appendChild(filterPanel);
  }

  // Initialize performance monitor
  const perfContainer = document.getElementById("performance-tab");
  if (perfContainer) {
    console.log("Performance monitor container found:", perfContainer);
    // Check if the container is empty before creating a new instance
    if (perfContainer.children.length > 0) {
      console.warn("Performance monitor container is not empty. Clearing it.");
      perfContainer.innerHTML = ""; // Clear existing content
    }
    performanceMonitor.initialize(perfContainer);
  }

  // Initialize export panel
  const exportContainer = document.getElementById("export-container");
  if (exportContainer) {
    console.log("Export panel container found:", exportContainer);
    // Check if the container is empty before creating a new instance
    if (exportContainer.children.length > 0) {
      console.warn("Export panel container is not empty. Clearing it.");
      exportContainer.innerHTML = ""; // Clear existing content
    }
    exportPanel.initialize(exportContainer);
  }

  // Initialize tab manager
  tabManager.initialize();

  // Register tab change handlers
  tabManager.onTabChange("performance", () => {
    if (performanceMonitor.isEnabled) {
      performanceMonitor.refreshPerformanceData();
    }
  });
}

// Set up event listeners for all interactive elements
function setupEventListeners() {
  // Clear data button
  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", confirmClearRequests);
  }

  // Export button
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) {
    console.log("Export button found:", exportBtn.innerText);
    exportBtn.addEventListener("click", () => exportPanel.show());
  }

  // Options page link
  const optionsLink = document.getElementById("openOptions");
  if (optionsLink) {
    optionsLink.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // Settings import/export
  const exportSettingsBtn = document.getElementById("exportSettingsBtn");
  const importSettingsBtn = document.getElementById("importSettingsBtn");
  const importSettingsFile = document.getElementById("importSettingsFile");

  if (exportSettingsBtn) {
    exportSettingsBtn.addEventListener("click", exportSettings);
  }
  if (importSettingsBtn && importSettingsFile) {
    importSettingsBtn.addEventListener("click", () =>
      importSettingsFile.click()
    );
    importSettingsFile.addEventListener("change", importSettings);
  }
}

// Confirm clear requests
function confirmClearRequests() {
  if (confirm("Are you sure you want to clear all captured requests?")) {
    clearRequests();
  }
}

// Clear all requests
async function clearRequests() {
  try {
    await chrome.runtime.sendMessage({ action: "clearRequests" });
    notificationSystem.showSuccess("All requests cleared successfully");
    loadRequests(); // Reload the empty state
  } catch (error) {
    console.error("Error clearing requests:", error);
    notificationSystem.showError("Failed to clear requests");
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
  notificationSystem.showSuccess("Settings exported successfully!");
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
          // Refresh UI with new settings
          updateUIFromSettings(settingsManager.getAllSettings().settings);
          notificationSystem.showSuccess("Settings imported successfully!");
        } else {
          notificationSystem.showError("Failed to import settings");
        }
      } catch (error) {
        console.error("Import error:", error);
        notificationSystem.showError("Invalid settings file");
      }
    };
    reader.readAsText(file);
  } catch (error) {
    console.error("File read error:", error);
    notificationSystem.showError("Failed to read settings file");
  }

  // Clear the file input for future imports
  event.target.value = "";
}

// Handle settings changes
function handleSettingsChange(settings) {
  // Update UI based on new settings
  updateUIFromSettings(settings);
}

// Update UI from settings
function updateUIFromSettings(settings) {
  // Theme
  if (settings.theme) {
    themeManager.setTheme(settings.theme.current);
  }

  // Other UI updates as needed
  if (settings.performance) {
    performanceMonitor.updatePerformanceMonitoring(
      settings.performance.enabled
    );
  }
}
