/**
 * Centralized Logging Utility
 * - Structured logging with levels (DEBUG, INFO, WARN, ERROR)
 * - Configurable via settings (log level, persist errors)
 * - Logs errors to bronze_errors table
 * - Color-coded console output
 * - Context-aware (background, options, popup, content)
 */

class Logger {
  constructor(context = "App") {
    this.context = context;
    this.logLevel = "INFO"; // Default, overridden by config
    this.persistErrors = true;
    this.colors = {
      DEBUG: "#6c757d", // Gray
      INFO: "#0dcaf0", // Cyan
      WARN: "#ffc107", // Yellow
      ERROR: "#dc3545", // Red
      SUCCESS: "#28a745", // Green
    };
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    this.initialized = false;

    // Load config when available
    this.loadConfig();
  }

  /**
   * Load logging configuration from settings
   */
  async loadConfig() {
    try {
      // Try to get from chrome.storage first (fastest)
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.local.get(["settings"]);
        const settings = result.settings?.settings || {};
        this.logLevel = settings.logging?.level || "INFO";
        this.persistErrors = settings.logging?.persistErrors === true; // Must be explicitly enabled
        this.initialized = true;
      }
    } catch (error) {
      // Silently fail - use defaults
      this.initialized = true;
    }
  }

  /**
   * Check if message should be logged based on level
   */
  shouldLog(level) {
    // SUCCESS always shows (user feedback)
    if (level === "SUCCESS") return true;
    return this.levels[level] >= this.levels[this.logLevel];
  }

  /**
   * Format log message with timestamp and context
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.context}] [${level}]`;
    return { prefix, message, data };
  }

  /**
   * Log to console with color coding
   */
  logToConsole(level, message, data = null) {
    if (!this.shouldLog(level)) return;

    const {
      prefix,
      message: msg,
      data: logData,
    } = this.formatMessage(level, message, data);
    const color = this.colors[level] || "#000";
    const style = `color: ${color}; font-weight: bold;`;

    if (logData) {
      console.log(`%c${prefix}`, style, msg, logData);
    } else {
      console.log(`%c${prefix}`, style, msg);
    }
  }

  /**
   * Persist error to bronze_errors table
   */
  async persistError(message, error, context) {
    if (!this.persistErrors) return;

    try {
      // Only persist in background context (has DB access)
      if (typeof chrome !== "undefined" && chrome.runtime) {
        await chrome.runtime.sendMessage({
          action: "logError",
          error: {
            message,
            stack: error?.stack || null,
            context: `${this.context}.${context || "unknown"}`,
            timestamp: Date.now(),
            url: globalThis.location?.href || null,
            user_agent: globalThis.navigator?.userAgent || null,
          },
        });
      }
    } catch (err) {
      // Fail silently - don't create infinite error loops
      console.error("[Logger] Failed to persist error:", err);
    }
  }

  /**
   * DEBUG level - verbose details for development
   * @param {string} message - Log message
   * @param {*} data - Optional data to log
   */
  debug(message, data = null) {
    this.logToConsole("DEBUG", message, data);
  }

  /**
   * INFO level - general informational messages
   * @param {string} message - Log message
   * @param {*} data - Optional data to log
   */
  info(message, data = null) {
    this.logToConsole("INFO", message, data);
  }

  /**
   * WARN level - warning messages that aren't critical
   * @param {string} message - Log message
   * @param {*} data - Optional data to log
   */
  warn(message, data = null) {
    this.logToConsole("WARN", message, data);
  }

  /**
   * ERROR level - error messages, persisted to database
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {string} context - Additional context
   */
  error(message, error = null, context = null) {
    this.logToConsole("ERROR", message, error);

    // Persist to database
    this.persistError(message, error, context);
  }

  /**
   * SUCCESS level - success messages for user feedback
   * @param {string} message - Success message
   * @param {*} data - Optional data to log
   */
  success(message, data = null) {
    this.logToConsole("SUCCESS", message, data);
  }

  /**
   * Create a child logger with extended context
   * @param {string} subContext - Additional context to append
   * @returns {Logger} New logger instance
   */
  child(subContext) {
    const childLogger = new Logger(`${this.context}.${subContext}`);
    childLogger.logLevel = this.logLevel;
    childLogger.persistErrors = this.persistErrors;
    childLogger.initialized = this.initialized;
    return childLogger;
  }

  /**
   * Group related logs together (collapsible in console)
   * @param {string} groupName - Name of the log group
   * @param {Function} callback - Function containing logs to group
   */
  group(groupName, callback) {
    if (!this.shouldLog("DEBUG")) return callback();

    console.group(`[${this.context}] ${groupName}`);
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  }

  /**
   * Time a function execution
   * @param {string} label - Label for the timer
   * @param {Function} callback - Function to time
   * @returns {Promise<*>} Result of callback
   */
  async time(label, callback) {
    const start = performance.now();
    this.debug(`⏱️ Starting: ${label}`);

    try {
      const result = await callback();
      const duration = (performance.now() - start).toFixed(2);
      this.debug(`✅ Completed: ${label} (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = (performance.now() - start).toFixed(2);
      this.error(`❌ Failed: ${label} (${duration}ms)`, error);
      throw error;
    }
  }
}

/**
 * Create logger instances for different contexts
 */
export function createLogger(context = "App") {
  return new Logger(context);
}

/**
 * Default logger instance
 */
export const logger = new Logger("URA");

/**
 * Convenience exports for direct usage
 */
export const debug = (msg, data) => logger.debug(msg, data);
export const info = (msg, data) => logger.info(msg, data);
export const warn = (msg, data) => logger.warn(msg, data);
export const error = (msg, err, ctx) => logger.error(msg, err, ctx);
export const success = (msg, data) => logger.success(msg, data);

export default logger;
