// Base error class for the application
export class AppError extends Error {
  constructor(message, code = "UNKNOWN_ERROR", details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// Database related errors
export class DatabaseError extends AppError {
  constructor(message, details = {}) {
    super(message, "DATABASE_ERROR", details);
  }
}

// Configuration related errors
export class ConfigError extends AppError {
  constructor(message, details = {}) {
    super(message, "CONFIG_ERROR", details);
  }
}

// Authentication related errors
export class AuthError extends AppError {
  constructor(message, details = {}) {
    super(message, "AUTH_ERROR", details);
  }
}

// Feature flag related errors
export class FeatureError extends AppError {
  constructor(message, details = {}) {
    super(message, "FEATURE_ERROR", details);
  }
}

// Validation errors
export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, "VALIDATION_ERROR", details);
  }
}

// Network related errors
export class NetworkError extends AppError {
  constructor(message, details = {}) {
    super(message, "NETWORK_ERROR", details);
  }
}

// Performance related errors
export class PerformanceError extends AppError {
  constructor(message, details = {}) {
    super(message, "PERFORMANCE_ERROR", details);
  }
}

// Security related errors
export class SecurityError extends AppError {
  constructor(message, details = {}) {
    super(message, "SECURITY_ERROR", details);
  }
}

// Error handler function
export function handleError(error, context = {}) {
  const errorData = {
    ...(error instanceof AppError
      ? error.toJSON()
      : {
          name: error.name,
          message: error.message,
          code: "UNKNOWN_ERROR",
          details: {},
          timestamp: new Date(),
        }),
    context,
  };

  // Log error
  console.error("Error occurred:", errorData);

  // Report to monitoring system if available
  if (typeof window !== "undefined" && window.errorReporter) {
    window.errorReporter.report(errorData);
  }

  return errorData;
}
