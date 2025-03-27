// Notification manager - handles system notifications

let eventBus = null
let config = null

// Set up notification system
export function setupNotifications(notificationConfig, events) {
  config = notificationConfig
  eventBus = events

  // Subscribe to events that should trigger notifications
  setupNotificationSubscriptions()

  console.log("Notification system initialized")

  return {
    showNotification,
    updateNotificationConfig,
  }
}

// Set up event subscriptions for notifications
function setupNotificationSubscriptions() {
  // Export completed notification
  eventBus.subscribe("export:completed", (data) => {
    if (config.notifyOnExport) {
      showNotification({
        title: "Export Complete",
        message: `Data exported successfully as ${data.format.toUpperCase()}`,
        type: "success",
      })
    }
  })

  // Database error notification
  eventBus.subscribe("database:error", (data) => {
    if (config.notifyOnError) {
      showNotification({
        title: "Database Error",
        message: data.message || "An error occurred with the database",
        type: "error",
      })
    }
  })

  // Authentication notifications
  eventBus.subscribe("auth:login", (data) => {
    if (config.notifyOnAuth) {
      showNotification({
        title: "Logged In",
        message: `Logged in as ${data.email}`,
        type: "info",
      })
    }
  })

  eventBus.subscribe("auth:logout", () => {
    if (config.notifyOnAuth) {
      showNotification({
        title: "Logged Out",
        message: "You have been logged out",
        type: "info",
      })
    }
  })

  // Encryption notifications
  eventBus.subscribe("encryption:key_generated", () => {
    if (config.notifyOnEncryption) {
      showNotification({
        title: "Encryption Key Generated",
        message: "A new encryption key has been generated and saved",
        type: "success",
      })
    }
  })

  eventBus.subscribe("encryption:enabled", () => {
    if (config.notifyOnEncryption) {
      showNotification({
        title: "Encryption Enabled",
        message: "Database encryption has been enabled",
        type: "success",
      })
    }
  })

  eventBus.subscribe("encryption:disabled", () => {
    if (config.notifyOnEncryption) {
      showNotification({
        title: "Encryption Disabled",
        message: "Database encryption has been disabled",
        type: "warning",
      })
    }
  })

  // Sync notifications
  eventBus.subscribe("sync:started", () => {
    if (config.notifyOnSync) {
      showNotification({
        title: "Sync Started",
        message: "Synchronizing data with remote server",
        type: "info",
      })
    }
  })

  eventBus.subscribe("sync:completed", (data) => {
    if (config.notifyOnSync) {
      showNotification({
        title: "Sync Complete",
        message: `Synchronized ${data.itemCount} items`,
        type: "success",
      })
    }
  })

  eventBus.subscribe("sync:error", (data) => {
    if (config.notifyOnError) {
      showNotification({
        title: "Sync Error",
        message: data.message || "An error occurred during synchronization",
        type: "error",
      })
    }
  })
}

// Show a notification
function showNotification(options) {
  // Check if notifications are enabled
  if (!config.enabled) {
    return
  }

  // Default options
  const defaultOptions = {
    type: "basic",
    iconUrl: chrome.runtime.getURL(`assets/icons/icon128.png`),
    title: "Universal Request Analyzer",
    message: "",
    priority: 0,
  }

  // Merge options
  const notificationOptions = { ...defaultOptions, ...options }

  // Set icon based on type if not provided
  if (!options.iconUrl) {
    switch (options.type) {
      case "success":
        notificationOptions.iconUrl = chrome.runtime.getURL("assets/icons/success.png")
        break
      case "error":
        notificationOptions.iconUrl = chrome.runtime.getURL("assets/icons/error.png")
        break
      case "warning":
        notificationOptions.iconUrl = chrome.runtime.getURL("assets/icons/warning.png")
        break
      case "info":
        notificationOptions.iconUrl = chrome.runtime.getURL("assets/icons/info.png")
        break
    }
  }

  // Create notification
  if (typeof chrome !== "undefined" && chrome.notifications) {
    chrome.notifications.create(
      {
        type: "basic",
        iconUrl: notificationOptions.iconUrl,
        title: notificationOptions.title,
        message: notificationOptions.message,
        priority: notificationOptions.priority,
      },
      (notificationId) => {
        // Auto-close notification after timeout if specified
        if (config.autoClose && config.autoCloseTimeout > 0) {
          setTimeout(() => {
            chrome.notifications.clear(notificationId)
          }, config.autoCloseTimeout)
        }
      },
    )
  } else {
    console.warn("Chrome notifications are not available.")
  }
}

// Update notification configuration
function updateNotificationConfig(newConfig) {
  config = { ...config, ...newConfig }
}

