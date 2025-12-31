/**
 * Message Router
 * Central routing system for all extension messages
 * Consolidates popup-message-handler.js and message-handler.js
 */

import { authHandlers } from "./handlers/auth-handlers.js";
import { statsHandlers } from "./handlers/stats-handlers.js";
import { queryHandlers } from "./handlers/query-handlers.js";
import { settingsHandlers } from "./handlers/settings-handlers.js";
import { exportHandlers } from "./handlers/export-handlers.js";
import { runnerHandlers } from "./handlers/runner-handlers.js";
import { collectionHandlers } from "./handlers/collection-handlers.js";
import { analyticsHandlers } from "./handlers/analytics-handlers.js";
import { alertHandlers } from "./handlers/alert-handlers.js";
import { vitalsHandlers } from "./handlers/vitals-handlers.js";
import { databaseHandlers } from "./handlers/database-handlers.js";
import { domainHandlers } from "./handlers/domain-handlers.js";
import { requestHandlers } from "./handlers/request-handlers.js";
import { uiHandlers } from "./handlers/ui-handlers.js";
import { medallionHandlers } from "./handlers/medallion-handlers.js";
import requestRunner from "../capture/request-runner.js";
import runnerCollections from "../capture/runner-collections.js";

// Action name aliases for backward compatibility
// Maps old action names (from Options page) to new handler names
const ACTION_ALIASES = {
  // Dashboard aliases
  getAvailableDomains: "getDomains", // Dashboard domain list

  // Database/Data Purge aliases
  performCleanup: "cleanupOldRecords", // Data purge action
  purgeOldData: "cleanupOldRecords", // Alternative name
  purgeAllData: "clearDatabase", // Clear all data
  purgeByCustomFilter: "deleteRequests", // Delete by filter

  // Settings aliases (legacy compatibility)
  updateTrackingSites: "updateCaptureSettings", // Capture settings
  updateTrackingMode: "updateCaptureSettings", // Capture mode
  getRetentionSettings: "getSettings", // Get all settings (filter client-side)
  updateRetentionSettings: "updateSettings", // Update settings
  updateAutoCleanupSettings: "updateSettings", // Update settings

  // Query aliases
  getAvailableTable: "getTableList", // Database table list
};

// Central handler registry - combines all feature handlers
const handlers = new Map([
  ...authHandlers,
  ...statsHandlers,
  ...queryHandlers,
  ...settingsHandlers,
  ...exportHandlers,
  ...runnerHandlers,
  ...collectionHandlers,
  ...analyticsHandlers,
  ...alertHandlers,
  ...vitalsHandlers,
  ...databaseHandlers,
  ...domainHandlers,
  ...requestHandlers,
  ...uiHandlers,
  ...medallionHandlers,
]);

/**
 * Initialize message router (backward compatible with popup-message-handler API)
 * @param {Object} auth - Auth manager (localAuthManager)
 * @param {Object} database - Database manager (medallionDb or dbManager)
 * @returns {Function} Message handler function
 */
export function initializeMessageRouter(auth, database) {
  // Initialize requestRunner with database manager (same as popup-message-handler)
  if (database && requestRunner) {
    requestRunner.setDbManager(database);
  }

  // Initialize runnerCollections with database manager (same as popup-message-handler)
  if (database && runnerCollections) {
    runnerCollections.setDbManager(database);
  }

  // Store dependencies for handlers
  const context = {
    auth,
    database,
  };

  /**
   * Handle incoming message
   * @param {Object} message - Message object with action and data
   * @param {Object} sender - Message sender info
   * @returns {Promise<Object>} Response object
   */
  async function handleMessage(message, sender) {
    const { action } = message;

    // Resolve action alias (if any)
    const resolvedAction = ACTION_ALIASES[action] || action;

    const handler = handlers.get(resolvedAction);
    if (!handler) {
      console.warn(`No handler registered for action: ${resolvedAction}`);
      console.warn("Available actions:", Array.from(handlers.keys()).sort());
      // Return null to allow fallback to other handlers (e.g., handleMedallionMessages)
      return null;
    }

    try {
      const result = await handler(message, sender, context);
      return result; // ✅ CRITICAL: Return the result!
    } catch (error) {
      console.error(`[MessageRouter] Handler error for ${action}:`, error);
      return {
        success: false,
        error: error.message || "Unknown error",
        stack: error.stack,
      };
    }
  }

  return handleMessage;
}

/**
 * Setup message router with automatic listener registration
 * Alternative API for direct integration (not currently used)
 * @param {Object} auth - Auth manager
 * @param {Object} database - Database manager
 * @returns {Object} Router instance with handler function
 */
export function setupMessageRouter(auth, database) {
  const handler = initializeMessageRouter(auth, database);

  // Set up message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handler(message, sender)
      .then(sendResponse)
      .catch((error) => {
        console.error("[MessageRouter] Unhandled error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  });

  return { handler };
}

/**
 * Get list of all registered actions
 * Useful for debugging and documentation
 * @returns {string[]} Array of action names
 */
export function getRegisteredActions() {
  return Array.from(handlers.keys()).sort();
}

/**
 * Check if an action is registered
 * @param {string} action - Action name to check
 * @returns {boolean} True if handler exists
 */
export function hasHandler(action) {
  return handlers.has(action);
}

/**
 * Backward compatibility exports
 * Allows existing code to work without changes
 */
export { initializeMessageRouter as initializePopupMessageHandler };
export { setupMessageRouter as setupMessageHandlers };
