/**
 * Message handler for communication with popup and content scripts
 */

import { ApiError } from "../errors/error-types.js";
import { logErrorToDatabase } from "../database/db-manager.js";
import { handleImportData } from "../import/import-manager.js";
import * as exportManager from "../export/export-manager.js"; // Import export manager

let dbManager = null;
let authManager = null;
let encryptionManager = null;
let eventBus = null;

// Set up message handlers
export function setupMessageHandlers(database, auth, encryption, events) {
  dbManager = database;
  authManager = auth;
  encryptionManager = encryption;
  eventBus = events;

  // Listen for messages from popup and content scripts
  chrome.runtime.onMessage.addListener(handleMessage);

  // Listen for external messages (from websites)
  chrome.runtime.onMessageExternal.addListener(handleExternalMessage);

  console.log("Message handlers initialized");
}

// Handle messages from popup and content scripts
async function handleMessage(message, sender, sendResponse) {
  try {
    // Database-related messages
    if (
      message.action === "getRequests" ||
      message.action === "getRequestsFromDB"
    ) {
      handleGetRequests(message, sendResponse);
      return true; // Keep the message channel open for async response
    }

    // Export-related messages - Consolidate all export types under 'exportData'
    else if (message.action === "exportData") {
      // Ensure exportManager is initialized
      if (!exportManager) {
        console.error("Export manager is not initialized.");
        sendResponse({ success: false, error: "Export manager not initialized." });
        return false; // Indicate sync response
      }

      try {
        // Use filename from message or generate a default
        const filename = message.filename || `request-analyzer-export-${new Date().toISOString().slice(0, 10)}`;
        const format = message.format || 'json'; // Default to json if not specified

        console.log(`[MessageHandler] Received exportData request: format=${format}, filename=${filename}`); // Added logging

        const result = await exportManager.exportData({
          format: format,
          filename: filename,
          filters: message.filters, // Pass filters if provided
          // Add other options from exportManager if needed (e.g., prettyPrint, compression)
          prettyPrint: message.prettyPrint !== undefined ? message.prettyPrint : true,
          compression: message.compression !== undefined ? message.compression : false,
          includeHeaders: message.includeHeaders !== undefined ? message.includeHeaders : true, // For CSV
        });
        console.log("[MessageHandler] Export result:", result); // Added logging
        sendResponse({ success: true, ...result });
      } catch (error) {
        console.error(`[MessageHandler] Failed to export data as ${message.format}:`, error);
        // Ensure the error object is properly structured
        const errorMessage = error instanceof Error ? error.message : String(error);
        sendResponse({ success: false, error: errorMessage || "Unknown export error" });
      }
      return true; // Keep channel open for async response
    }

    // Import-related messages
    else if (message.action === "importData") {
      handleImportData(message, sendResponse);
      return true;
    } else if (message.action === "importDatabaseFile") {
      handleImportDatabaseFile(message, sendResponse);
      return true;
    }

    // Clear requests
    else if (message.action === "clearRequests") {
      handleClearRequests(sendResponse);
      return true;
    }

    // Get database stats
    else if (message.action === "getDatabaseStats") {
      handleGetDatabaseStats(sendResponse);
      return true;
    }

    // Get database size
    else if (message.action === "getDatabaseSize") {
      handleGetDatabaseSize(sendResponse);
      return true;
    }

    // Config-related messages
    else if (message.action === "getConfig") {
      handleGetConfig(sendResponse);
      return true;
    } else if (message.action === "updateConfig") {
      handleUpdateConfig(message, sendResponse);
      return true;
    }

    // Auth-related messages
    else if (message.action === "login") {
      handleLogin(message, sendResponse);
      return true;
    } else if (message.action === "logout") {
      handleLogout(sendResponse);
      return true;
    } else if (message.action === "register") {
      handleRegister(message, sendResponse);
      return true;
    } else if (message.action === "getCurrentUser") {
      handleGetCurrentUser(sendResponse);
      return true;
    } else if (message.action === "refreshToken") {
      handleRefreshToken(sendResponse);
      return true;
    } else if (message.action === "generateCsrfToken") {
      handleGenerateCsrfToken(sendResponse);
      return true;
    }

    // Encryption-related messages
    else if (message.action === "generateEncryptionKey") {
      handleGenerateEncryptionKey(sendResponse);
      return true;
    } else if (message.action === "setEncryptionKey") {
      handleSetEncryptionKey(message, sendResponse);
      return true;
    } else if (message.action === "exportEncryptionKey") {
      handleExportEncryptionKey(sendResponse);
      return true;
    } else if (message.action === "enableEncryption") {
      handleEnableEncryption(sendResponse);
      return true;
    } else if (message.action === "disableEncryption") {
      handleDisableEncryption(sendResponse);
      return true;
    }

    // Visualization-related messages
    else if (message.action === "getDistinctValues") {
      handleGetDistinctValues(message, sendResponse);
      return true;
    } else if (message.action === "getApiPaths") {
      handleGetApiPaths(sendResponse);
      return true;
    } else if (message.action === "getFilteredStats") {
      handleGetFilteredStats(message, sendResponse);
      return true;
    }

    // Unknown action
    sendResponse({ error: `Unknown action: ${message.action}` });
    return false;
  } catch (error) {
    console.error(`Error handling message ${message.action}:`, error);
    sendResponse({ error: error.message });
    return false;
  }
}

// Handle importDatabaseFile message
async function handleImportDatabaseFile(message, sendResponse) {
  if (!dbManager) {
    sendResponse({ success: false, error: "Database manager not initialized" });
    return;
  }
  if (!(message.data instanceof ArrayBuffer)) {
    sendResponse({ success: false, error: "Invalid data format for SQLite import. Expected ArrayBuffer." });
    return;
  }

  try {
    const success = await dbManager.replaceDatabase(new Uint8Array(message.data));
    if (success) {
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Failed to replace database." });
    }
  } catch (error) {
    console.error("Error importing SQLite database file:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle getDatabaseStats message
function handleGetDatabaseStats(sendResponse) {
  if (!dbManager) {
    sendResponse({ success: false, error: "Database not initialized" });
    return;
  }
  (async () => {
    try {
      const stats = await dbManager.getDatabaseStats();
      sendResponse({ success: true, stats });
    } catch (error) {
      console.error("Error getting database stats:", error);
      sendResponse({ success: false, error: error.message });
    }
  })(); // Immediately invoke async function
}

// Handle getDatabaseSize message
function handleGetDatabaseSize(sendResponse) {
  if (!dbManager) {
    sendResponse({ success: false, error: "Database not initialized" });
    return;
  }
  (async () => {
    try {
      const size = await dbManager.getDatabaseSize();
      sendResponse({ success: true, size });
    } catch (error) {
      console.error("Error getting database size:", error);
      sendResponse({ success: false, error: error.message });
    }
  })(); // Immediately invoke async function
}

// Handle external messages (from websites)
function handleExternalMessage(message, sender, sendResponse) {
  try {
    if (!isValidExternalSender(sender.url)) {
      sendResponse({ error: "Unauthorized sender" });
      return false;
    }

    if (message.action === "api:getRequests") {
      handleApiGetRequests(message, sender, sendResponse);
      return true;
    } else if (message.action === "api:getStats") {
      handleApiGetStats(message, sender, sendResponse);
      return true;
    }

    sendResponse({ error: `Unknown action: ${message.action}` });
    return false;
  } catch (error) {
    console.error(`Error handling external message ${message.action}:`, error);
    sendResponse({ error: error.message });
    return false;
  }
}

// Check if external sender is valid
function isValidExternalSender(url) {
  try {
    const allowedDomains = ["example.com"];
    const urlObj = new URL(url);

    return allowedDomains.some(
      (domain) =>
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch (error) {
    return false;
  }
}

// Handle getRequests message
function handleGetRequests(message, sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const filters = message.filters || {};
    const page = message.page || 1;
    const limit = message.limit || 100;

    const result = dbManager.getRequests({ page, limit, filters });
    sendResponse(result);
  } catch (error) {
    const apiError = new ApiError("Error getting requests", error);
    logErrorToDatabase(dbManager, apiError);
    sendResponse({ error: apiError.message });
  }
}

// Handle clearRequests message
function handleClearRequests(sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    dbManager.clearDatabase();
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error clearing requests:", error);
    sendResponse({ error: error.message });
  }
}

// Handle getRequestHeaders message
function handleGetRequestHeaders(message, sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const headers = dbManager.getRequestHeaders(message.requestId);
    sendResponse({ headers });
  } catch (error) {
    console.error("Error getting request headers:", error);
    sendResponse({ error: error.message });
  }
}

// Handle getStats message
function handleGetStats(sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const stats = dbManager.getDatabaseStats();
    sendResponse({ stats });
  } catch (error) {
    const apiError = new ApiError("Error getting stats", error);
    logErrorToDatabase(dbManager, apiError);
    sendResponse({ error: apiError.message });
  }
}

// Handle getDatabaseInfo message
function handleGetDatabaseInfo(sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const databaseSize = dbManager.getDatabaseSize();
    const stats = dbManager.getDatabaseStats();

    sendResponse({
      databaseSize,
      totalRequests: stats.totalRequests,
      lastExport: null,
    });
  } catch (error) {
    console.error("Error getting database info:", error);
    sendResponse({ error: error.message });
  }
}

// Handle getNetworkStats message
function handleGetNetworkStats(sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const stats = dbManager.getNetworkStats();
    sendResponse({ stats });
  } catch (error) {
    const apiError = new ApiError("Error fetching network stats", error);
    logErrorToDatabase(dbManager, apiError);
    sendResponse({ error: apiError.message });
  }
}

// Handle getConfig message
function handleGetConfig(sendResponse) {
  chrome.storage.local.get("analyzerConfig", (result) => {
    if (chrome.runtime.lastError) {
      sendResponse({ error: chrome.runtime.lastError.message });
    } else {
      sendResponse({ config: result.analyzerConfig || {} });
    }
  });
}

// Handle updateConfig message
function handleUpdateConfig(message, sendResponse) {
  chrome.storage.local.set({ analyzerConfig: message.config }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ error: chrome.runtime.lastError.message });
    } else {
      eventBus.publish("config:updated", message.config);
      sendResponse({ success: true });
    }
  });
}

// Handle login message
function handleLogin(message, sendResponse) {
  if (!authManager) {
    sendResponse({ error: "Auth manager not initialized" });
    return;
  }

  try {
    authManager
      .login(message.email, message.password)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
  } catch (error) {
    console.error("Error during login:", error);
    sendResponse({ error: error.message });
  }
}

// Handle logout message
function handleLogout(sendResponse) {
  if (!authManager) {
    sendResponse({ error: "Auth manager not initialized" });
    return;
  }

  try {
    authManager
      .logout()
      .then((result) => {
        sendResponse({ success: result });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
  } catch (error) {
    console.error("Error during logout:", error);
    sendResponse({ error: error.message });
  }
}

// Handle register message
function handleRegister(message, sendResponse) {
  if (!authManager) {
    sendResponse({ error: "Auth manager not initialized" });
    return;
  }

  try {
    authManager
      .register(message.email, message.password, message.name)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
  } catch (error) {
    console.error("Error during registration:", error);
    sendResponse({ error: error.message });
  }
}

// Handle getCurrentUser message
function handleGetCurrentUser(sendResponse) {
  if (!authManager) {
    sendResponse({ error: "Auth manager not initialized" });
    return;
  }

  try {
    const user = authManager.getCurrentUser();
    sendResponse({ user, isAuthenticated: authManager.isAuthenticated() });
  } catch (error) {
    console.error("Error getting current user:", error);
    sendResponse({ error: error.message });
  }
}

// Handle refreshToken message
function handleRefreshToken(sendResponse) {
  if (!authManager) {
    sendResponse({ error: "Auth manager not initialized" });
    return;
  }

  try {
    authManager
      .refreshToken()
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
  } catch (error) {
    console.error("Error refreshing token:", error);
    sendResponse({ error: error.message });
  }
}

// Handle generateCsrfToken message
function handleGenerateCsrfToken(sendResponse) {
  if (!authManager) {
    sendResponse({ error: "Auth manager not initialized" });
    return;
  }

  try {
    const token = authManager.generateCsrfToken();
    sendResponse({ token });
  } catch (error) {
    console.error("Error generating CSRF token:", error);
    sendResponse({ error: error.message });
  }
}

// Handle generateEncryptionKey message
function handleGenerateEncryptionKey(sendResponse) {
  if (!encryptionManager) {
    sendResponse({ error: "Encryption manager not initialized" });
    return;
  }

  try {
    const key = encryptionManager.generateKey();
    sendResponse({ key });
  } catch (error) {
    console.error("Error generating encryption key:", error);
    sendResponse({ error: error.message });
  }
}

// Handle setEncryptionKey message
function handleSetEncryptionKey(message, sendResponse) {
  if (!encryptionManager) {
    sendResponse({ error: "Encryption manager not initialized" });
    return;
  }

  try {
    encryptionManager.setKey(message.key);
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error setting encryption key:", error);
    sendResponse({ error: error.message });
  }
}

// Handle exportEncryptionKey message
function handleExportEncryptionKey(sendResponse) {
  if (!encryptionManager) {
    sendResponse({ error: "Encryption manager not initialized" });
    return;
  }

  try {
    encryptionManager.exportKey();
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error exporting encryption key:", error);
    sendResponse({ error: error.message });
  }
}

// Handle enableEncryption message
function handleEnableEncryption(sendResponse) {
  if (!encryptionManager) {
    sendResponse({ error: "Encryption manager not initialized" });
    return;
  }

  try {
    encryptionManager.enable();
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error enabling encryption:", error);
    sendResponse({ error: error.message });
  }
}

// Handle disableEncryption message
function handleDisableEncryption(sendResponse) {
  if (!encryptionManager) {
    sendResponse({ error: "Encryption manager not initialized" });
    return;
  }

  try {
    encryptionManager.disable();
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error disabling encryption:", error);
    sendResponse({ error: error.message });
  }
}

// Handle getDistinctValues message
function handleGetDistinctValues(message, sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const field = message.field;
    const allowedFields = ["domain", "pageUrl", "method", "type", "path"];

    if (!allowedFields.includes(field)) {
      sendResponse({ error: `Invalid field: ${field}` });
      return;
    }

    const query = `
      SELECT DISTINCT ${field} 
      FROM requests 
      WHERE ${field} IS NOT NULL AND ${field} != '' 
      ORDER BY ${field}
    `;

    const result = dbManager.executeQuery(query);

    if (!result[0]) {
      sendResponse({ values: [] });
      return;
    }

    const values = result[0].values.map((row) => row[0]);

    sendResponse({ values });
  } catch (error) {
    console.error(`Error getting distinct values for ${message.field}:`, error);
    sendResponse({ error: error.message });
  }
}

// Handle getApiPaths message
function handleGetApiPaths(sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const query = `
      SELECT DISTINCT path 
      FROM requests 
      WHERE 
        path LIKE '/api/%' OR 
        path LIKE '/v1/%' OR 
        path LIKE '/v2/%' OR 
        path LIKE '/v3/%' OR
        path LIKE '%.json' OR
        path LIKE '%.php' OR
        path LIKE '%.aspx'
      ORDER BY path
    `;

    const result = dbManager.executeQuery(query);

    if (!result[0]) {
      sendResponse({ paths: [] });
      return;
    }

    const paths = result[0].values.map((row) => row[0]);

    sendResponse({ paths });
  } catch (error) {
    console.error("Error getting API paths:", error);
    sendResponse({ error: error.message });
  }
}

// Handle getFilteredStats message
async function handleGetFilteredStats(message, sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }
  try {
    const { filters } = message;
    // Assuming dbManager.getFilteredStats exists and accepts filters
    const stats = await dbManager.getFilteredStats(filters);
    sendResponse({ success: true, ...stats, filters });
  } catch (error) {
    console.error("Error getting filtered stats:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle apiGetRequests message
function handleApiGetRequests(message, sender, sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const filters = message.filters || {};
    const page = message.page || 1;
    const limit = message.limit || 100;

    const result = dbManager.getRequests({ page, limit, filters });
    sendResponse(result);
  } catch (error) {
    console.error("Error getting requests:", error);
    sendResponse({ error: error.message });
  }
}

// Handle apiGetStats message
function handleApiGetStats(message, sender, sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const stats = dbManager.getDatabaseStats();
    sendResponse({ stats });
  } catch (error) {
    console.error("Error getting stats:", error);
    sendResponse({ error: error.message });
  }
}
