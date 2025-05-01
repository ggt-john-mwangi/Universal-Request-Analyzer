// Error monitoring system - tracks and handles errors across the extension

class ErrorMonitor {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.errorLog = new Map();
    this.errorCounts = new Map();
    this.maxLogSize = 1000;
    this.retryStrategies = new Map();
  }

  // Initialize error monitoring
  initialize() {
    this.setupErrorListeners();
    this.setupPeriodicCleanup();
    this.registerRetryStrategies();
  }

  // Set up error event listeners
  setupErrorListeners() {
    // Listen for service errors
    this.eventBus.subscribe("service:stateChanged", (data) => {
      if (data.status === "failed") {
        this.handleServiceError(data);
      }
    });

    // Listen for message errors
    this.eventBus.subscribe("message:error", (data) => {
      this.logError("message", data);
    });

    // Listen for database errors
    this.eventBus.subscribe("database:error", (data) => {
      this.logError("database", data);
    });

    // Listen for auth errors
    this.eventBus.subscribe("auth:error", (data) => {
      this.logError("auth", data);
    });

    // Listen for sync errors
    this.eventBus.subscribe("sync:error", (data) => {
      this.logError("sync", data);
    });

    // Listen for export errors
    this.eventBus.subscribe("export:error", (data) => {
      this.logError("export", data);
    });

    // Listen for encryption errors
    this.eventBus.subscribe("encryption:error", (data) => {
      this.logError("encryption", data);
    });
  }

  // Register retry strategies for different error types
  registerRetryStrategies() {
    // Database connection errors
    this.retryStrategies.set("database:connection", {
      maxRetries: 3,
      backoffMs: 1000,
      backoffMultiplier: 2,
    });

    // Authentication errors
    this.retryStrategies.set("auth:token", {
      maxRetries: 2,
      backoffMs: 500,
      backoffMultiplier: 2,
    });

    // Sync errors
    this.retryStrategies.set("sync:network", {
      maxRetries: 5,
      backoffMs: 2000,
      backoffMultiplier: 1.5,
    });
  }

  // Handle service-specific errors
  handleServiceError(data) {
    const { service, error } = data;
    this.logError(service, error);

    // Check if we have a retry strategy for this service
    const strategy = this.retryStrategies.get(`${service}:${error.type}`);
    if (strategy) {
      this.handleRetry(service, error, strategy);
    }

    // Publish error event
    this.eventBus.publish("monitor:error", {
      service,
      error: error.message,
      timestamp: Date.now(),
    });
  }

  // Handle retrying failed operations
  async handleRetry(service, error, strategy) {
    const errorKey = `${service}:${error.type}`;
    const retryCount = this.errorCounts.get(errorKey) || 0;

    if (retryCount < strategy.maxRetries) {
      const backoffTime =
        strategy.backoffMs * Math.pow(strategy.backoffMultiplier, retryCount);

      // Update retry count
      this.errorCounts.set(errorKey, retryCount + 1);

      // Wait for backoff time
      await new Promise((resolve) => setTimeout(resolve, backoffTime));

      // Publish retry event
      this.eventBus.publish("monitor:retry", {
        service,
        attempt: retryCount + 1,
        timestamp: Date.now(),
      });

      // Trigger service retry
      this.eventBus.publish(`${service}:retry`, {
        error,
        attempt: retryCount + 1,
      });
    } else {
      // Max retries reached
      this.eventBus.publish("monitor:retryFailed", {
        service,
        error: error.message,
        attempts: retryCount,
        timestamp: Date.now(),
      });
    }
  }

  // Log an error
  logError(category, error) {
    const timestamp = Date.now();
    const errorKey = `${category}:${timestamp}`;

    // Create error entry
    const errorEntry = {
      category,
      message: error.message || error,
      stack: error.stack,
      timestamp,
      context: error.context || {},
    };

    // Add to error log
    this.errorLog.set(errorKey, errorEntry);

    // Update error counts
    const categoryCount = this.errorCounts.get(category) || 0;
    this.errorCounts.set(category, categoryCount + 1);

    // Cleanup if log is too large
    if (this.errorLog.size > this.maxLogSize) {
      this.cleanup();
    }

    console.error(`[${category}]`, error);
  }

  // Set up periodic cleanup
  setupPeriodicCleanup() {
    // Clean up old errors every hour
    setInterval(() => this.cleanup(), 3600000);
  }

  // Clean up old error logs
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Remove old entries
    for (const [key, entry] of this.errorLog.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.errorLog.delete(key);
      }
    }

    // Reset error counts
    this.errorCounts.clear();
  }

  // Get error statistics
  getStats() {
    return {
      totalErrors: this.errorLog.size,
      categoryCounts: Object.fromEntries(this.errorCounts),
      recentErrors: Array.from(this.errorLog.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10),
    };
  }

  // Get errors by category
  getErrorsByCategory(category) {
    return Array.from(this.errorLog.values())
      .filter((error) => error.category === category)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
}

// Set up error monitoring
export function setupErrorMonitoring(eventBus) {
  const monitor = new ErrorMonitor(eventBus);
  monitor.initialize();
  return monitor;
}
