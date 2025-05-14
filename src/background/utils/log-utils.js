// src/background/utils/log-utils.js
// Centralized log utility for UI and background

/**
 * log(level, ...args): For background scripts only.
 * - Logs to console (if enabled in config from DB)
 * - Logs errors to DB (if enabled in config from DB)
 */
export async function log(level, ...args) {
  // Try to get config from DB (async), fallback to default
  let config = { enableConsoleLogging: true, logErrorsToDatabase: true };
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      // Try to get config from db-manager/config-manager if available
      if (window && window.dbManager && typeof window.dbManager.getConfig === 'function') {
        config = await window.dbManager.getConfig();
      } else if (typeof importScripts === 'function') {
        // In worker context, try to import config
        // fallback: do nothing
      }
    }
  } catch {}
  // Console logging (if enabled)
  if (config.enableConsoleLogging !== false && typeof console[level] === 'function') {
    console[level](...args);
  }
  // Error logging to DB (background only)
  if (level === 'error' && config.logErrorsToDatabase && typeof window !== 'undefined' && window.dbManager && typeof window.dbManager.logErrorToDatabase === 'function') {
    let errorObj = null;
    for (const arg of args) {
      if (arg instanceof Error) {
        errorObj = arg;
        break;
      }
    }
    if (!errorObj) {
      errorObj = new Error(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    }
    window.dbManager.logErrorToDatabase(window.dbManager, errorObj);
  }
}

/**
 * uiLog(level, ...args): For UI scripts only.
 * - Logs to console (if enabled in config from DB or fallback)
 * - For errors, sends to background for DB logging (if enabled in config)
 */
export function uiLog(level, ...args) {
  // Try to get config from global (set by background), fallback to default
  const config = (typeof window !== 'undefined' && window.__URA_LOG_CONFIG__) || { enableConsoleLogging: true, logErrorsToDatabase: true };
  if (config.enableConsoleLogging !== false && typeof console[level] === 'function') {
    console[level](...args);
  }
  if (level === 'error' && config.logErrorsToDatabase && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    let errorObj = null;
    for (const arg of args) {
      if (arg instanceof Error) {
        errorObj = arg;
        break;
      }
    }
    if (!errorObj) {
      errorObj = new Error(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    }
    chrome.runtime.sendMessage({
      action: 'logErrorToDb',
      error: {
        message: errorObj.message,
        stack: errorObj.stack,
        context: {},
      },
    });
  }
}
