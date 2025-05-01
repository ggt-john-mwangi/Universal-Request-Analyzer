import eventBus from "../messaging/event-bus";

// Custom error types
export class RequestAnalyzerError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "RequestAnalyzerError";
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
  }
}

export class ValidationError extends RequestAnalyzerError {
  constructor(message, details = {}) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class DatabaseError extends RequestAnalyzerError {
  constructor(message, details = {}) {
    super(message, "DATABASE_ERROR", details);
    this.name = "DatabaseError";
  }
}

export class NetworkError extends RequestAnalyzerError {
  constructor(message, details = {}) {
    super(message, "NETWORK_ERROR", details);
    this.name = "NetworkError";
  }
}

class ErrorManager {
  constructor() {
    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.errorHandlers = new Map();

    // Subscribe to error events on the event bus
    eventBus.subscribe("error", this.handleError.bind(this));
  }

  // Register an error handler for specific error types
  registerHandler(errorType, handler) {
    if (!this.errorHandlers.has(errorType)) {
      this.errorHandlers.set(errorType, new Set());
    }
    this.errorHandlers.get(errorType).add(handler);

    return () => {
      const handlers = this.errorHandlers.get(errorType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.errorHandlers.delete(errorType);
        }
      }
    };
  }

  // Main error handling method
  async handleError(error) {
    const errorRecord = this.createErrorRecord(error);
    this.storeError(errorRecord);

    // Publish to event bus
    await eventBus.publish("error:recorded", errorRecord);

    // Execute specific handlers
    const handlers = this.errorHandlers.get(error.name) || new Set();
    for (const handler of handlers) {
      try {
        await handler(errorRecord);
      } catch (handlerError) {
        console.error("Error in error handler:", handlerError);
      }
    }

    return errorRecord;
  }

  // Create standardized error record
  createErrorRecord(error) {
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      name: error.name || "Error",
      message: error.message,
      code: error.code || "UNKNOWN_ERROR",
      stack: error.stack,
      details: error.details || {},
      browserInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
    };
  }

  // Store error in history
  storeError(errorRecord) {
    this.errorHistory.unshift(errorRecord);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.pop();
    }
  }

  // Get error history with optional filters
  getErrorHistory(filters = {}) {
    let filteredErrors = [...this.errorHistory];

    if (filters.type) {
      filteredErrors = filteredErrors.filter((e) => e.name === filters.type);
    }

    if (filters.code) {
      filteredErrors = filteredErrors.filter((e) => e.code === filters.code);
    }

    if (filters.from) {
      filteredErrors = filteredErrors.filter(
        (e) => e.timestamp >= filters.from
      );
    }

    if (filters.to) {
      filteredErrors = filteredErrors.filter((e) => e.timestamp <= filters.to);
    }

    if (filters.limit) {
      filteredErrors = filteredErrors.slice(0, filters.limit);
    }

    return filteredErrors;
  }

  // Clear error history
  clearErrorHistory() {
    this.errorHistory = [];
  }

  // Utility method to create and handle an error
  async reportError(errorType, message, details = {}) {
    let error;
    switch (errorType) {
      case "validation":
        error = new ValidationError(message, details);
        break;
      case "database":
        error = new DatabaseError(message, details);
        break;
      case "network":
        error = new NetworkError(message, details);
        break;
      default:
        error = new RequestAnalyzerError(message, "GENERIC_ERROR", details);
    }

    return this.handleError(error);
  }
}

// Create and export singleton instance
const errorManager = new ErrorManager();
export default errorManager;
