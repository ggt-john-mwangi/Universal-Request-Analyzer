// DOM elements
const captureEnabled = document.getElementById("captureEnabled")
const maxStoredRequests = document.getElementById("maxStoredRequests")
const captureTypeCheckboxes = document.querySelectorAll('input[name="captureType"]')
const includeDomains = document.getElementById("includeDomains")
const excludeDomains = document.getElementById("excludeDomains")
const autoExport = document.getElementById("autoExport")
const exportFormat = document.getElementById("exportFormat")
const exportInterval = document.getElementById("exportInterval")
const exportPath = document.getElementById("exportPath")
const plotEnabled = document.getElementById("plotEnabled")
const plotTypeCheckboxes = document.querySelectorAll('input[name="plotType"]')
const saveBtn = document.getElementById("saveBtn")
const resetBtn = document.getElementById("resetBtn")
const exportDbBtn = document.getElementById("exportDbBtn")
const clearDbBtn = document.getElementById("clearDbBtn")
const notification = document.getElementById("notification")
const dbTotalRequests = document.getElementById("dbTotalRequests")
const dbSize = document.getElementById("dbSize")
const lastExport = document.getElementById("lastExport")

// Default configuration
const defaultConfig = {
  maxStoredRequests: 10000,
  captureEnabled: true,
  autoExport: false,
  exportFormat: "json",
  exportInterval: 60, // minutes
  exportPath: "",
  plotEnabled: true,
  plotTypes: ["responseTime", "statusCodes", "domains", "requestTypes", "timeDistribution"],
  captureFilters: {
    includeDomains: [],
    excludeDomains: [],
    includeTypes: ["xmlhttprequest", "fetch", "script", "stylesheet", "image", "font", "other"],
  },
  lastExportTime: null,
}

// Load options when the page loads
document.addEventListener("DOMContentLoaded", loadOptions)

// Add event listeners
saveBtn.addEventListener("click", saveOptions)
resetBtn.addEventListener("click", resetOptions)
exportDbBtn.addEventListener("click", exportDatabase)
clearDbBtn.addEventListener("click", clearDatabase)

// Load options from storage
function loadOptions() {
  chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
    if (response && response.config) {
      const config = response.config

      // Update UI with config values
      captureEnabled.checked = config.captureEnabled
      maxStoredRequests.value = config.maxStoredRequests

      // Update capture type checkboxes
      captureTypeCheckboxes.forEach((checkbox) => {
        checkbox.checked = config.captureFilters.includeTypes.includes(checkbox.value)
      })

      // Update domain filters
      includeDomains.value = config.captureFilters.includeDomains.join(", ")
      excludeDomains.value = config.captureFilters.excludeDomains.join(", ")

      // Update auto export settings
      autoExport.checked = config.autoExport
      exportFormat.value = config.exportFormat
      exportInterval.value = config.exportInterval / 60000 // Convert ms to minutes
      exportPath.value = config.exportPath || ""

      // Update plot settings
      plotEnabled.checked = config.plotEnabled

      // Update plot type checkboxes
      plotTypeCheckboxes.forEach((checkbox) => {
        checkbox.checked = config.plotTypes.includes(checkbox.value)
      })

      // Update last export time
      if (config.lastExportTime) {
        lastExport.textContent = new Date(config.lastExportTime).toLocaleString()
      }
    }
  })

  // Load database info
  loadDatabaseInfo()
}

// Load database information
function loadDatabaseInfo() {
  chrome.runtime.sendMessage({ action: "getDatabaseInfo" }, (response) => {
    if (response && !response.error) {
      dbTotalRequests.textContent = response.totalRequests.toLocaleString()
      dbSize.textContent = formatBytes(response.databaseSize)
    }
  })
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

// Save options to storage
function saveOptions() {
  // Get values from UI
  const newConfig = {
    captureEnabled: captureEnabled.checked,
    maxStoredRequests: Number.parseInt(maxStoredRequests.value, 10),
    autoExport: autoExport.checked,
    exportFormat: exportFormat.value,
    exportInterval: Number.parseInt(exportInterval.value, 10) * 60000, // Convert minutes to ms
    exportPath: exportPath.value.trim(),
    plotEnabled: plotEnabled.checked,
    plotTypes: Array.from(plotTypeCheckboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value),
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
  }

  // Save to background script
  chrome.runtime.sendMessage(
    {
      action: "updateConfig",
      config: newConfig,
    },
    (response) => {
      if (response && response.success) {
        showNotification("Options saved successfully!")
      } else {
        showNotification("Error saving options", true)
      }
    },
  )
}

// Reset options to defaults
function resetOptions() {
  if (confirm("Are you sure you want to reset all options to default values?")) {
    // Save default config to background script
    chrome.runtime.sendMessage(
      {
        action: "updateConfig",
        config: defaultConfig,
      },
      (response) => {
        if (response && response.success) {
          // Reload options
          loadOptions()
          showNotification("Options reset to defaults")
        } else {
          showNotification("Error resetting options", true)
        }
      },
    )
  }
}

// Export database
function exportDatabase() {
  const format = exportFormat.value
  const filename = `request-analyzer-database-${new Date().toISOString().slice(0, 10)}`

  chrome.runtime.sendMessage(
    {
      action: "exportData",
      format: format,
      filename: filename,
    },
    (response) => {
      if (response && response.success) {
        showNotification(`Database exported successfully as ${format.toUpperCase()}`)
        loadDatabaseInfo()
      } else {
        showNotification("Error exporting database", true)
      }
    },
  )
}

// Clear database
function clearDatabase() {
  if (confirm("Are you sure you want to clear all captured requests? This cannot be undone.")) {
    chrome.runtime.sendMessage({ action: "clearRequests" }, (response) => {
      if (response && response.success) {
        showNotification("Database cleared successfully")
        loadDatabaseInfo()
      } else {
        showNotification("Error clearing database", true)
      }
    })
  }
}

// Show notification
function showNotification(message, isError = false) {
  notification.textContent = message
  notification.className = "notification" + (isError ? " error" : "")
  notification.classList.add("visible")

  setTimeout(() => {
    notification.classList.remove("visible")
  }, 5000)
}

