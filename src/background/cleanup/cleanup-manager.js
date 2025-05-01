// Cleanup manager - handles service cleanup and resource management

let dbManager = null;
let eventBus = null;
let config = null;
let cleanupTasks = new Map();

// Set up cleanup manager
export function setupCleanupManager(cleanupConfig, database, events) {
  dbManager = database;
  eventBus = events;
  config = cleanupConfig;

  // Register core cleanup tasks
  registerCleanupTasks();

  // Listen for cleanup events
  setupCleanupSubscriptions();

  console.log("Cleanup manager initialized");

  return {
    cleanup,
    registerCleanupTask,
    removeCleanupTask,
  };
}

// Register default cleanup tasks
function registerCleanupTasks() {
  // Database cleanup task
  registerCleanupTask("database", async () => {
    if (dbManager) {
      await dbManager.cleanup();
      eventBus.publish("cleanup:task:completed", { task: "database" });
    }
  });

  // Request cache cleanup
  registerCleanupTask("requestCache", async () => {
    try {
      await chrome.webRequest.handlerBehaviorChanged();
      eventBus.publish("cleanup:task:completed", { task: "requestCache" });
    } catch (error) {
      console.warn("Failed to clear request cache:", error);
    }
  });

  // Runtime connections cleanup
  registerCleanupTask("connections", () => {
    try {
      const ports = chrome.runtime.connect.ports || [];
      ports.forEach((port) => port.disconnect());
      eventBus.publish("cleanup:task:completed", { task: "connections" });
    } catch (error) {
      console.warn("Failed to cleanup connections:", error);
    }
  });
}

// Set up cleanup event subscriptions
function setupCleanupSubscriptions() {
  // Listen for service state changes
  eventBus.subscribe("service:stateChanged", async (data) => {
    const { service, status } = data;
    if (status === "failed") {
      // Perform cleanup for failed service
      await cleanupService(service);
    }
  });

  // Listen for extension unload
  chrome.runtime.onSuspend.addListener(async () => {
    await cleanup();
  });
}

// Register a new cleanup task
function registerCleanupTask(name, task) {
  if (typeof task !== "function") {
    throw new Error("Cleanup task must be a function");
  }
  cleanupTasks.set(name, task);
}

// Remove a cleanup task
function removeCleanupTask(name) {
  return cleanupTasks.delete(name);
}

// Clean up a specific service
async function cleanupService(serviceName) {
  eventBus.publish("cleanup:service:started", { service: serviceName });

  try {
    const task = cleanupTasks.get(serviceName);
    if (task) {
      await task();
      eventBus.publish("cleanup:service:completed", {
        service: serviceName,
        status: "success",
      });
    }
  } catch (error) {
    console.error(`Failed to cleanup service ${serviceName}:`, error);
    eventBus.publish("cleanup:service:completed", {
      service: serviceName,
      status: "failed",
      error: error.message,
    });
  }
}

// Perform full cleanup
async function cleanup() {
  eventBus.publish("cleanup:started", {
    timestamp: Date.now(),
    tasksCount: cleanupTasks.size,
  });

  const results = {
    successful: [],
    failed: [],
  };

  // Execute all cleanup tasks
  for (const [name, task] of cleanupTasks) {
    try {
      await task();
      results.successful.push(name);
    } catch (error) {
      console.error(`Cleanup task ${name} failed:`, error);
      results.failed.push({
        name,
        error: error.message,
      });
    }
  }

  // Publish cleanup results
  eventBus.publish("cleanup:completed", {
    timestamp: Date.now(),
    results,
  });

  return results;
}
