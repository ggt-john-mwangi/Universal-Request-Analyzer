// Notification manager - handles system notifications

let eventBus = null;
let config = null;

// Set up notification system
export function setupNotifications(notificationConfig, events) {
  config = notificationConfig;
  eventBus = events;

  // Subscribe to events that should trigger notifications
  setupNotificationSubscriptions();

  console.log("Notification system initialized");

  return {
    showNotification,
    updateNotificationConfig,
  };
}

// Set up event subscriptions for notifications
function setupNotificationSubscriptions() {
  // Service state change notifications
  eventBus.subscribe("service:stateChanged", (data) => {
    if (config.notifyOnServiceChange) {
      const { service, status, error } = data;

      if (status === "failed") {
        showNotification({
          title: `Service Failed: ${service}`,
          message: error || "Service initialization failed",
          type: "error",
        });
      } else if (status === "ready" && config.notifyOnServiceReady) {
        showNotification({
          title: `Service Ready: ${service}`,
          message: `${service} service initialized successfully`,
          type: "success",
        });
      }
    }
  });

  // System ready notification
  eventBus.subscribe("system:ready", (data) => {
    if (config.notifyOnSystemReady) {
      const readyServices = Object.entries(data.services)
        .filter(([_, status]) => status === "ready")
        .map(([name]) => name);

      showNotification({
        title: "System Ready",
        message: `Initialized successfully with ${readyServices.length} services`,
        type: "success",
      });
    }
  });

  // System error notifications
  eventBus.subscribe("system:error", (data) => {
    if (config.notifyOnError) {
      showNotification({
        title: "System Error",
        message: data.error || "An error occurred during initialization",
        type: "error",
      });
    }
  });

  // Export notifications
  eventBus.subscribe("export:completed", (data) => {
    if (config.notifyOnExport) {
      showNotification({
        title: "Export Complete",
        message: `Data exported successfully as ${data.format.toUpperCase()}`,
        type: "success",
      });
    }
  });

  // Database notifications
  eventBus.subscribe("database:error", (data) => {
    if (config.notifyOnError) {
      showNotification({
        title: "Database Error",
        message: data.message || "An error occurred with the database",
        type: "error",
      });
    }
  });

  // Authentication notifications
  eventBus.subscribe("auth:login", (data) => {
    if (config.notifyOnAuth) {
      showNotification({
        title: "Logged In",
        message: `Logged in as ${data.email}`,
        type: "info",
      });
    }
  });

  eventBus.subscribe("auth:logout", () => {
    if (config.notifyOnAuth) {
      showNotification({
        title: "Logged Out",
        message: "You have been logged out",
        type: "info",
      });
    }
  });

  // Encryption notifications
  eventBus.subscribe("encryption:key_generated", () => {
    if (config.notifyOnEncryption) {
      showNotification({
        title: "Encryption Key Generated",
        message: "A new encryption key has been generated and saved",
        type: "success",
      });
    }
  });

  eventBus.subscribe("encryption:enabled", () => {
    if (config.notifyOnEncryption) {
      showNotification({
        title: "Encryption Enabled",
        message: "Database encryption has been enabled",
        type: "success",
      });
    }
  });

  eventBus.subscribe("encryption:disabled", () => {
    if (config.notifyOnEncryption) {
      showNotification({
        title: "Encryption Disabled",
        message: "Database encryption has been disabled",
        type: "warning",
      });
    }
  });

  // Sync notifications
  eventBus.subscribe("sync:started", () => {
    if (config.notifyOnSync) {
      showNotification({
        title: "Sync Started",
        message: "Synchronizing data with remote server",
        type: "info",
      });
    }
  });

  eventBus.subscribe("sync:completed", (data) => {
    if (config.notifyOnSync) {
      showNotification({
        title: "Sync Complete",
        message: `Synchronized ${data.itemCount} items`,
        type: "success",
      });
    }
  });

  eventBus.subscribe("sync:error", (data) => {
    if (config.notifyOnError) {
      showNotification({
        title: "Sync Error",
        message: data.message || "An error occurred during synchronization",
        type: "error",
      });
    }
  });

  // Cleanup notifications
  eventBus.subscribe("cleanup:started", () => {
    if (config.notifyOnCleanup) {
      showNotification({
        title: "Cleanup Started",
        message: "Starting database cleanup process",
        type: "info",
      });
    }
  });

  eventBus.subscribe("cleanup:completed", (data) => {
    if (config.notifyOnCleanup) {
      showNotification({
        title: "Cleanup Complete",
        message: `Cleaned up ${data.itemCount} items`,
        type: "success",
      });
    }
  });
}

// Show a notification
function showNotification(options) {
  if (!config.enabled) return;

  const notification = {
    type: "basic",
    iconUrl: chrome.runtime.getURL("assets/icons/icon128.png"),
    title: options.title,
    message: options.message,
    priority: options.type === "error" ? 2 : 0,
  };

  chrome.notifications.create(
    `${Date.now()}`,
    notification,
    (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to show notification:", chrome.runtime.lastError);
      }

      if (config.autoClose && options.type !== "error") {
        setTimeout(() => {
          chrome.notifications.clear(notificationId);
        }, config.autoCloseTimeout || 5000);
      }
    }
  );
}

// Update notification configuration
function updateNotificationConfig(newConfig) {
  config = { ...config, ...newConfig };
}
