// Custom error types

// Base error class
export class AppError extends Error {
  constructor(message, originalError = null) {
    super(message)
    this.name = this.constructor.name
    this.originalError = originalError

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

// Database error
export class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, originalError)
  }
}

// Authentication error
export class AuthError extends AppError {
  constructor(message, originalError = null) {
    super(message, originalError)
  }
}

// Encryption error
export class EncryptionError extends AppError {
  constructor(message, originalError = null) {
    super(message, originalError)
  }
}

// Sync error
export class SyncError extends AppError {
  constructor(message, originalError = null) {
    super(message, originalError)
  }
}

// API error
export class ApiError extends AppError {
  constructor(message, originalError = null) {
    super(message, originalError)
  }
}

// Configuration error
export class ConfigError extends AppError {
  constructor(message, originalError = null) {
    super(message, originalError)
  }
}

// Export error
export class ExportError extends AppError {
  constructor(message, originalError = null) {
    super(message, originalError)
  }
}

// Permission error
export class PermissionError extends AppError {
  constructor(message, originalError = null) {
    super(message, originalError)
  }
}

