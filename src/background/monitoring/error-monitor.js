// Error monitoring system

let eventBus = null
let errorLog = []
const MAX_ERROR_LOG_SIZE = 100
let configManager = null; // Added: To access config

// Set up error monitoring
export function setupErrorMonitoring(events, cfgManager) { // Added cfgManager
  eventBus = events
  configManager = cfgManager; // Added: Store config manager

  // Set up global error handler
  setupGlobalErrorHandler()

  // Expose error monitor to background page
  if (typeof window !== "undefined") {
    window.errorMonitor = {
      reportError,
      reportCriticalError,
      getErrorLog,
      clearErrorLog,
    }
  }

  console.log("Error monitoring initialized")

  return {
    reportError,
    reportCriticalError,
    getErrorLog,
    clearErrorLog,
  }
}

// Set up global error handler
function setupGlobalErrorHandler() {
  if (typeof window !== "undefined") {
    // Handle uncaught exceptions
    window.addEventListener("error", (event) => {
      reportError("uncaught_exception", event.error || new Error(event.message))

      // Don't prevent default error handling
      return false
    })

    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      reportError("unhandled_rejection", event.reason)

      // Don't prevent default error handling
      return false
    })
  }
}

// Report an error
function reportError(errorType, error) {
  try {
    // Create error entry
    const errorEntry = {
      type: errorType, // Keep original type for console/event
      category: errorType, // Use type as category for DB logging
      message: error.message || String(error),
      stack: error.stack,
      timestamp: Date.now(),
      context: error.context || {}, // Include context if available
    }

    // Add to in-memory error log (optional, could be removed if DB is primary)
    errorLog.unshift(errorEntry)
    if (errorLog.length > MAX_ERROR_LOG_SIZE) {
      errorLog = errorLog.slice(0, MAX_ERROR_LOG_SIZE)
    }

    // Added: Check config before logging to console
    const logToConsoleEnabled = configManager?.getConfigValue('advanced.logErrorsToConsole', true);
    if (logToConsoleEnabled) {
      console.error(`[${errorType}]`, error);
    }

    // Publish error event (always publish regardless of logging settings)
    if (eventBus) {
      eventBus.publish("error:reported", errorEntry)
    }

    // Log to database (the function in db-manager will check its own toggle)
    // Ensure dbManager is available or use messaging to send error to background
    // Assuming dbManager is accessible via a global or passed reference
    // This might need adjustment based on how dbManager is exposed/accessed
    if (typeof window !== 'undefined' && window.dbManager) {
        window.dbManager.logErrorToDatabase(errorEntry); // Pass the structured entry
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // If in a context without direct access, send a message
        chrome.runtime.sendMessage({ action: "logErrorToDb", errorData: errorEntry });
    }

    return errorEntry
  } catch (e) {
    // Last resort error logging
    console.error("Error in error reporting:", e)
    return null
  }
}

// Report a critical error
function reportCriticalError(errorType, error) {
  try {
    // Report error
    const errorEntry = reportError(errorType, error)

    // Check if chrome is defined (running in a Chrome extension context)
    if (typeof chrome !== "undefined" && chrome.notifications) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("assets/icons/error.png"),
        title: "Critical Error",
        message: `A critical error occurred: ${error.message || String(error)}`,
        priority: 2,
      })
    }

    // Publish critical error event
    if (eventBus) {
      eventBus.publish("error:critical", errorEntry)
    }

    return errorEntry
  } catch (e) {
    // Last resort error logging
    console.error("Error in critical error reporting:", e)
    return null
  }
}

// Get error log
function getErrorLog() {
  return [...errorLog]
}

// Clear error log
function clearErrorLog() {
  errorLog = []

  // Publish error log cleared event
  if (eventBus) {
    eventBus.publish("error:log_cleared", { timestamp: Date.now() })
  }

  return true
}

