/**
 * Message handler for communication with popup and content scripts
 */

import {
  DatabaseError,
  ConfigError,
  AuthError,
  EncryptionError,
} from "../errors/error-types.js";
import { handleImportData } from "../import/import-manager.js";
import { getRequestHeadersEventBased, getRequestTimingsEventBased } from "../database/db-manager.js";

// Declare variables to hold the managers passed from background.js
let dbManager = null;
let configManager = null;
let captureManager = null;
let exportManager = null;
let importManager = null;
let authManager = null;
let encryptionManager = null;
let errorMonitor = null;
let apiService = null;
let eventBus = null;
let logErrorToDb = null; // Function to log errors

// Updated setupMessageHandlers to accept all managers/services
export function setupMessageHandlers(
  database,
  config,
  capture,
  exporter,
  importer,
  auth,
  encryption,
  monitor,
  api,
  bus
) {
  dbManager = database;
  configManager = config;
  captureManager = capture;
  exportManager = exporter;
  importManager = importer;
  authManager = auth;
  encryptionManager = encryption;
  errorMonitor = monitor;
  apiService = api;
  eventBus = bus;

  logErrorToDb = (error) => {
    if (
      dbManager &&
      typeof dbManager.logError === "function" &&
      configManager?.getConfigValue?.("advanced.logErrorsToDatabase")
    ) {
      dbManager.logError(error);
    }
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[MessageHandler] Incoming message:', message, sender);
    if (message.action === "devtoolsRequestCaptured" && message.request) {
      console.log('[MessageHandler] devtoolsRequestCaptured payload:', message.request);
    }
    // --- Event-based: always respond with chrome.runtime.sendMessage, never sendResponse for async ---
    if (message.action === "getConfig") {
      (async () => {
        try {
          const config = await configManager.getConfig();
          sendEventResponse("getConfigResult", message.requestId, { success: true, config });
        } catch (error) {
          sendEventResponse("getConfigResult", message.requestId, { success: false, error: error.message });
        }
      })();
      return;
    }
    if (message.action === "getFilteredStats") {
      (async () => {
        try {
          const stats = await dbManager.getFilteredStats(message.filters || {});
          sendEventResponse("getFilteredStatsResult", message.requestId, { success: true, ...stats });
        } catch (error) {
          sendEventResponse("getFilteredStatsResult", message.requestId, { success: false, error: error.message });
        }
      })();
      return;
    }
    if (message.action === "getDistinctDomains") {
      (async () => {
        try {
          const domains = await dbManager.getDistinctDomains();
          sendEventResponse("getDistinctDomainsResult", message.requestId, { success: true, domains });
        } catch (error) {
          sendEventResponse("getDistinctDomainsResult", message.requestId, { success: false, error: error.message });
        }
      })();
      return;
    }
    if (message.action === "getDistinctValues") {
      (async () => {
        try {
          const values = await dbManager.getDistinctValues(message.field, message.filters || {});
          sendEventResponse("getDistinctValuesResult", message.requestId, { success: true, values });
        } catch (error) {
          sendEventResponse("getDistinctValuesResult", message.requestId, { success: false, error: error.message });
        }
      })();
      return;
    }
    if (message.action === "getRequestHeaders") {
      // Event-based: expects requestId
      if (message.requestId && message.requestIdFor) {
        getRequestHeadersEventBased(message.requestId, message.requestIdFor);
        return true;
      } else if (message.requestId) {
        getRequestHeadersEventBased(message.requestId, message.requestId);
        return true;
      }
      // fallback: legacy
      try {
        const headers = dbManager.getRequestHeaders(message.requestId);
        sendResponse({ success: true, headers });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
    if (message.action === "getRequestTimings") {
      if (message.requestId && message.requestIdFor) {
        getRequestTimingsEventBased(message.requestId, message.requestIdFor);
        return true;
      } else if (message.requestId) {
        getRequestTimingsEventBased(message.requestId, message.requestId);
        return true;
      }
      // fallback: legacy
      try {
        const timings = dbManager.getRequestTimings(message.requestId);
        sendResponse({ success: true, timings });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
    if (message.action === "getStats") {
      handleGetStats(message, sender, sendResponse);
      return true;
    }
    // Handle network requests sent from DevTools
    if (message.action === "devtoolsRequestCaptured" && message.request) {
      console.log('[MessageHandler] devtoolsRequestCaptured payload:', message.request);
      try {
        // Normalize and fill missing fields if needed
        const req = message.request;
        // Generate a unique ID if not present
        req.id = req.id || (typeof generateId === 'function' ? generateId() : Date.now() + Math.random().toString(36).slice(2));
        req.timestamp = req.timestamp || Date.now();
        req.status = req.status || req.statusCode || 0;
        req.statusText = req.statusText || '';
        req.domain = req.domain || (req.url ? (new URL(req.url)).hostname : '');
        req.path = req.path || (req.url ? (new URL(req.url)).pathname + (new URL(req.url)).search : '');
        req.type = req.type || 'other';
        req.method = req.method || 'GET';
        req.size = req.size || 0;
        req.tabId = req.tabId || (sender.tab ? sender.tab.id : 0);
        req.pageUrl = req.pageUrl || (sender.tab ? sender.tab.url : '');
        req.timings = req.timings || {};
        // Save to DB using dbManager
        if (dbManager && typeof dbManager.saveRequest === 'function') {
          dbManager.saveRequest(req);
          if (dbManager.saveRequestTimings && req.timings) {
            dbManager.saveRequestTimings(req.id, req.timings);
          }
        }
        // Optionally, update in-memory or event bus if needed
        if (typeof captureManager?.updateRequestData === 'function') {
          captureManager.updateRequestData(req.id, req);
        }
        // Respond if needed
        if (sendResponse) sendResponse({ success: true });
      } catch (err) {
        console.error('[MessageHandler] Error handling devtoolsRequestCaptured:', err);
        if (sendResponse) sendResponse({ success: false, error: err.message });
      }
      return true;
    }
    return handleMessage(message, sender, sendResponse, logErrorToDb);
  });

  console.log("[MessageHandler] Initialized with all managers.");
  if (dbManager) {
    console.log("[MessageHandler] dbManager is available during setup.");
  } else {
    console.warn("[MessageHandler] dbManager is NOT available during setup.");
  }
}

// --- Event-based handler helpers ---
function sendEventResponse(action, requestId, data) {
  if (requestId) {
    chrome.runtime.sendMessage({ action, requestId, ...data });
    return true;
  }
  return false;
}

async function handleMessage(message, sender, sendResponse, logErrorToDbFunc) {
  if (!logErrorToDb && typeof logErrorToDbFunc === "function") {
    logErrorToDb = logErrorToDbFunc;
  }

  try {
    console.log(
      "[MessageHandler] Received message:",
      message.action,
      "from",
      sender.tab ? "tab " + sender.tab.id : "extension"
    );

    const requiresDb = [
      "getRequests",
      "getRequestsFromDB",
      "clearRequests",
      "getRequestHeaders",
      "getDatabaseInfo",
      "getDatabaseStats",
      "getDatabaseSchemaSummary",
      "getLoggedErrors",
      "executeRawSql",
      "getDistinctValues",
      "getApiPaths",
      "getFilteredStats",
      "importDatabaseFile",
      "getDistinctDomains",
      "backupDatabase",
      "restoreDatabase",
      "vacuumDatabase",
      "getTableContents",
      "getEncryptionStatus",
      "encryptDatabase",
      "decryptDatabase",
      "getSqlHistory",
    ];
    if (requiresDb.includes(message.action) && !dbManager) {
      console.error(`[MessageHandler] ${message.action}: dbManager is null!`);
      sendResponse({ success: false, error: "Database not initialized" });
      return false;
    }

    switch (message.action) {
      case "getRequests":
      case "getRequestsFromDB":
        handleGetRequests(message, sender, sendResponse); // Async handler
        return true; // Indicates async response
      case "clearRequests":
        handleClearRequests(message, sendResponse); // Async handler
        return true; // Indicates async response
      case "getRequestHeaders":
        handleGetRequestHeaders(message, sendResponse);
        return true;
      case "getDatabaseInfo":
        handleGetDatabaseInfo(sendResponse);
        return true;
      case "getDatabaseStats":
        handleGetStats(message, sender, sendResponse);
        return true;
      case "getDatabaseSchemaSummary":
        handleGetDatabaseSchemaSummary(message, sender, sendResponse);
        return true;
      case "getLoggedErrors":
        handleGetLoggedErrors(message, sender, sendResponse);
        return true;
      case "executeRawSql":
        handleExecuteRawSql(message, sender).then(sendResponse); // Calls the async handler
        return true; // <--- This is the important part!
      case "getDistinctValues":
        handleGetDistinctValues(message, sendResponse);
        return true;
      case "getApiPaths":
        handleGetApiPaths(sendResponse);
        return true;
      case "getFilteredStats":
        handleGetFilteredStats(message, sender, sendResponse);
        return true;
      case "exportData":
        handleExportData(message, sendResponse);
        return true;
      case "importData":
        if (
          !importManager ||
          typeof importManager.handleImportData !== "function"
        ) {
          console.error(
            "[MessageHandler] importManager or handleImportData not available."
          );
          sendResponse({ success: false, error: "Import manager not ready." });
          return false;
        }
        handleImportData(message, sendResponse);
        return true;
      case "importDatabaseFile":
        handleImportDatabaseFile(message, sendResponse);
        return true;
      case "getConfig":
        handleGetConfig(sendResponse, message);
        return true;
      case "updateConfig":
        handleUpdateConfig(message, sendResponse);
        return true;
      case "checkAuth":
        handleCheckAuth(sendResponse);
        return true;
      case "login":
        handleLogin(message, sendResponse);
        return true;
      case "logout":
        handleLogout(sendResponse);
        return true;
      case "encryptData":
        handleEncryptData(message, sendResponse);
        return true;
      case "decryptData":
        handleDecryptData(message, sendResponse);
        return true;
      case "getDistinctDomains":
        handleGetDistinctDomains(sendResponse);
        return true;
      case "backupDatabase":
        handleBackupDatabase(sendResponse);
        return true;
      case "restoreDatabase":
        handleRestoreDatabase(message, sendResponse);
        return true;
      case "vacuumDatabase":
        handleVacuumDatabase(sendResponse);
        return true;
      case "getTableContents":
        handleGetTableContents(message, sendResponse);
        return true;
      case "getEncryptionStatus":
        handleGetEncryptionStatus(sendResponse);
        return true;
      case "encryptDatabase":
        handleEncryptDatabase(message, sendResponse);
        return true;
      case "decryptDatabase":
        handleDecryptDatabase(message, sendResponse);
        return true;
      case "getSqlHistory":
        handleGetSqlHistory(message, sendResponse);
        return true;
      case "resetConfig":
        if (!configManager || typeof configManager.resetConfig !== "function") {
          sendResponse({ success: false, error: "Config manager not available" });
          return false;
        }
        try {
          await configManager.resetConfig();
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true;
      default:
        console.warn(
          "[MessageHandler] Unknown action received:",
          message.action
        );
        sendResponse({ error: `Unknown action: ${message.action}` });
        return false;
    }
  } catch (error) {
    console.error("[MessageHandler] Uncaught error in handleMessage:", error);
    if (logErrorToDb) {
      try {
        await logErrorToDb(
          new Error(
            `Uncaught error in handleMessage for action ${message?.action}: ${error.message}`,
            { cause: error }
          )
        );
      } catch (logDbError) {
        console.error(
          "[MessageHandler] Failed to log uncaught error to DB:",
          logDbError
        );
      }
    }
    try {
      sendResponse({
        success: false,
        error: `Internal server error processing action ${message?.action}`,
      });
    } catch (sendError) {
      console.error(
        "[MessageHandler] Failed to send error response:",
        sendError
      );
    }
    return false;
  }
}

// Add handler for getStats to support legacy popup calls
async function handleGetStats(message, sender, sendResponse) {
  try {
    // Use getFilteredStats with empty filters for legacy support
    if (typeof dbManager.getFilteredStats === 'function') {
      const stats = await dbManager.getFilteredStats({});
      if (message.requestId) {
        chrome.runtime.sendMessage({ action: "getStatsResult", requestId: message.requestId, success: true, stats });
      } else {
        sendResponse({ success: true, stats });
      }
    } else {
      throw new Error("getFilteredStats not available");
    }
  } catch (error) {
    if (message.requestId) {
      chrome.runtime.sendMessage({ action: "getStatsResult", requestId: message.requestId, success: false, error: error.message });
    } else {
      sendResponse({ success: false, error: error.message });
    }
  }
}

async function handleGetRequests(message, sender, sendResponse) {
  console.log(
    "[MessageHandler] handleGetRequests: Called with filters:",
    message.filters
  );
  try {
    const {
      filters,
      page = 1,
      limit = 50,
      sortBy,
      sortOrder,
      requestId,
    } = message;
    const result = await dbManager.getRequests(
      filters,
      page,
      limit,
      sortBy,
      sortOrder
    );
    console.log(
      `[MessageHandler] handleGetRequests: Retrieved ${result.requests?.length} requests.`
    );
    if (sendEventResponse("getRequestsResult", requestId, { ...result, success: true })) return;
    sendResponse({ success: true, ...result });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetRequests: Error getting requests:",
      error
    );
    const apiError = new DatabaseError("Error getting requests", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    if (sendEventResponse("getRequestsResult", message.requestId, { success: false, error: apiError.message })) return;
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleClearRequests(message, sendResponse) {
  console.log("[MessageHandler] handleClearRequests: Called");
  try {
    if (typeof dbManager.clearRequests !== "function") {
      throw new Error("dbManager.clearRequests is not a function");
    }
    await dbManager.clearRequests();
    console.log(
      "[MessageHandler] handleClearRequests: Requests cleared successfully."
    );
    if (message.requestId) {
      chrome.runtime.sendMessage({ action: "clearRequestsResult", requestId: message.requestId, success: true });
    } else {
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error(
      "[MessageHandler] handleClearRequests: Error clearing requests:",
      error
    );
    const apiError = new DatabaseError("Error clearing requests", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    if (message.requestId) {
      chrome.runtime.sendMessage({ action: "clearRequestsResult", requestId: message.requestId, success: false, error: apiError.message });
    } else {
      sendResponse({ success: false, error: apiError.message });
    }
  }
}

async function handleGetRequestHeaders(message, sendResponse) {
  console.log(
    "[MessageHandler] handleGetRequestHeaders: Called for requestId:",
    message.requestId
  );
  try {
    if (typeof dbManager.getRequestHeaders !== "function") {
      throw new Error("dbManager.getRequestHeaders is not a function");
    }
    const headers = await dbManager.getRequestHeaders(message.requestId);
    console.log(
      "[MessageHandler] handleGetRequestHeaders: Retrieved headers:",
      headers
    );
    if (message.requestId) {
      chrome.runtime.sendMessage({ action: "getRequestHeadersResult", requestId: message.requestId, success: true, headers });
    } else {
      sendResponse({ success: true, headers });
    }
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetRequestHeaders: Error getting headers:",
      error
    );
    const apiError = new DatabaseError("Error getting request headers", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    if (message.requestId) {
      chrome.runtime.sendMessage({ action: "getRequestHeadersResult", requestId: message.requestId, success: false, error: apiError.message });
    } else {
      sendResponse({ success: false, error: apiError.message });
    }
  }
}

async function handleGetDatabaseInfo(sendResponse) {
  console.log("[MessageHandler] handleGetDatabaseInfo: Called");
  try {
    if (typeof dbManager.getDatabaseInfo !== "function") {
      throw new Error("dbManager.getDatabaseInfo is not a function");
    }
    const info = await dbManager.getDatabaseInfo();
    console.log(
      "[MessageHandler] handleGetDatabaseInfo: Retrieved info:",
      info
    );
    sendResponse({ success: true, info });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetDatabaseInfo: Error getting database info:",
      error
    );
    const apiError = new DatabaseError("Error getting database info", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetDatabaseSchemaSummary(message, sender, sendResponse) {
  console.log("[MessageHandler] handleGetDatabaseSchemaSummary: Called");
  try {
    if (typeof dbManager.getDatabaseSchemaSummary !== "function") {
      throw new Error("dbManager.getDatabaseSchemaSummary is not a function");
    }
    const summary = await dbManager.getDatabaseSchemaSummary();
    console.log(
      "[MessageHandler] handleGetDatabaseSchemaSummary: Retrieved summary:",
      summary
    );
    if (message.requestId) {
      chrome.runtime.sendMessage({
        action: "getDatabaseSchemaSummaryResult",
        requestId: message.requestId,
        success: true,
        summary,
      });
      return;
    }
    sendResponse({ success: true, summary });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetDatabaseSchemaSummary: Error getting schema summary:",
      error
    );
    const apiError = new DatabaseError("Error getting schema summary", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    if (message.requestId) {
      chrome.runtime.sendMessage({
        action: "getDatabaseSchemaSummaryResult",
        requestId: message.requestId,
        success: false,
        error: apiError.message,
      });
      return;
    }
    try {
      sendResponse({ success: false, error: apiError.message });
    } catch (e) {
      console.error(
        "Failed to send schema summary error response after catch:",
        e
      );
    }
  }
}

async function handleGetLoggedErrors(message, sender, sendResponse) {
  console.log("[MessageHandler] handleGetLoggedErrors: Called");
  try {
    if (typeof dbManager.getLoggedErrors !== "function") {
      throw new Error("dbManager.getLoggedErrors is not a function");
    }
    const { limit = 50, offset = 0 } = message;
    const errors = await dbManager.getLoggedErrors(limit, offset);
    console.log(
      `[MessageHandler] handleGetLoggedErrors: Retrieved ${errors?.length} errors.`,
      errors
    ); // Log errors data
    if (message.requestId) {
      chrome.runtime.sendMessage({
        action: "getLoggedErrorsResult",
        requestId: message.requestId,
        success: true,
        errors,
      });
      return;
    }
    sendResponse({ success: true, errors });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetLoggedErrors: Error getting logged errors:",
      error
    );
    const apiError = new DatabaseError("Error getting logged errors", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    if (message.requestId) {
      chrome.runtime.sendMessage({
        action: "getLoggedErrorsResult",
        requestId: message.requestId,
        success: false,
        error: apiError.message,
      });
      return;
    }
    try {
      sendResponse({ success: false, error: apiError.message });
    } catch (e) {
      console.error(
        "Failed to send logged errors error response after catch:",
        e
      );
    }
  }
}

// --- Enhanced Raw SQL Execution Handler ---
async function handleExecuteRawSql(message, sender) {
  console.log(
    "[MessageHandler] handleExecuteRawSql: Received request with SQL:",
    message.sql
  );
  try {
    if (!dbManager || typeof dbManager.executeRawSql !== "function") {
      console.error(
        "[MessageHandler] handleExecuteRawSql: dbManager or executeRawSql function is missing."
      );
      throw new Error("Database manager is not properly initialized.");
    }

    const { sql, exportCsv, requestId } = message;
    if (typeof sql !== "string" || !sql.trim()) {
      throw new Error("No SQL query provided.");
    }
    console.log(
      "[MessageHandler] handleExecuteRawSql: Calling dbManager.executeRawSql..."
    );

    const result = await dbManager.executeRawSql(sql, { exportCsv });

    console.log(
      "[MessageHandler] handleExecuteRawSql: Execution successful. Returning success response...",
      result
    );
    // If requestId is present, send event-based response
    if (requestId && sender && sender.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "executeRawSqlResult",
        requestId,
        success: true,
        results: result,
      });
      return; // Do not call sendResponse
    }
    return { success: true, results: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      "[MessageHandler] handleExecuteRawSql: Error executing raw SQL:",
      errorMessage,
      error.stack
    );

    // Log error to DB if configured
    if (
      logErrorToDb &&
      error instanceof Error &&
      configManager?.getConfigValue?.("advanced.logErrorsToDatabase")
    ) {
      try {
        await logErrorToDb(
          new DatabaseError(
            `Raw SQL execution failed in handler: ${errorMessage}`,
            error
          )
        );
      } catch (logDbError) {
        console.error(
          "[MessageHandler] handleExecuteRawSql: Failed to log error to database:",
          logDbError
        );
      }
    }
    if (message.requestId && sender && sender.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "executeRawSqlResult",
        requestId: message.requestId,
        success: false,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return;
    }
    const errorResponse = { success: false, error: errorMessage };
    if (error instanceof Error && error.stack) {
      errorResponse.stack = error.stack;
    }
    return errorResponse;
  }
}

async function handleGetDistinctValues(message, sendResponse) {
  console.log(
    "[MessageHandler] handleGetDistinctValues: Called for field:",
    message.field
  );
  try {
    if (typeof dbManager.getDistinctValues !== "function") {
      throw new Error("dbManager.getDistinctValues is not a function");
    }
    const { field, filters } = message;
    const values = await dbManager.getDistinctValues(field, filters);
    sendResponse({ success: true, values });
  } catch (error) {
    console.error("[MessageHandler] Error getting distinct values:", error);
    const apiError = new DatabaseError("Error getting distinct values", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetApiPaths(sendResponse) {
  console.log("[MessageHandler] handleGetApiPaths: Called");
  try {
    if (typeof dbManager.getApiPaths !== "function") {
      throw new Error("dbManager.getApiPaths is not a function");
    }
    const paths = await dbManager.getApiPaths();
    sendResponse({ success: true, paths });
  } catch (error) {
    console.error("[MessageHandler] Error getting API paths:", error);
    const apiError = new DatabaseError("Error getting API paths", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetFilteredStats(message, sender, sendResponse) {
  console.log(
    "[MessageHandler] handleGetFilteredStats: Called with filters:",
    message.filters
  );
  try {
    if (typeof dbManager.getFilteredStats !== "function") {
      throw new Error("dbManager.getFilteredStats is not a function");
    }
    const { filters, requestId } = message;
    const stats = await dbManager.getFilteredStats(filters);
    sendEventResponse("getFilteredStatsResult", requestId, { success: true, ...stats });
  } catch (error) {
    console.error("[MessageHandler] Error getting filtered stats:", error);
    const apiError = new DatabaseError("Error getting filtered stats", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("getFilteredStatsResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleExportData(message, sendResponse) {
  console.log(
    "[MessageHandler] handleExportData: Called with format:",
    message.format
  );
  if (!exportManager || typeof exportManager.handleExportData !== "function") {
    console.error(
      "[MessageHandler] exportManager or handleExportData not available."
    );
    sendResponse({ success: false, error: "Export manager not ready." });
    return;
  }
  try {
    const { format, requestId } = message;
    const data = await dbManager.exportDatabase(format);
    if (requestId) {
      chrome.runtime.sendMessage({ action: "exportDataResult", requestId, success: true, data });
    } else {
      sendResponse({ success: true, data });
    }
  } catch (error) {
    console.error(
      "[MessageHandler] handleExportData: Error exporting data:",
      error
    );
    const apiError = new DatabaseError("Error exporting data", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    if (message.requestId) {
      chrome.runtime.sendMessage({ action: "exportDataResult", requestId: message.requestId, success: false, error: apiError.message });
    } else {
      sendResponse({ success: false, error: apiError.message });
    }
  }
}

async function handleImportDatabaseFile(message, sendResponse) {
  console.log("[MessageHandler] handleImportDatabaseFile: Called");
  try {
    if (typeof dbManager.importDatabaseFile !== "function") {
      throw new Error("dbManager.importDatabaseFile is not a function");
    }
    const { fileData } = message;
    if (!fileData) {
      throw new Error("No file data provided for import.");
    }
    await dbManager.importDatabaseFile(fileData);
    sendResponse({
      success: true,
      message: "Database imported successfully. Reload might be required.",
    });
  } catch (error) {
    console.error("[MessageHandler] Error importing database file:", error);
    const apiError = new DatabaseError("Error importing database file", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetConfig(sendResponse, message = {}) {
  console.log("[MessageHandler] handleGetConfig: Called");
  if (!configManager || typeof configManager.getConfig !== "function") {
    console.error("[MessageHandler] configManager or getConfig not available.");
    try {
      if (message.requestId) {
        chrome.runtime.sendMessage({ action: "getConfigResult", requestId: message.requestId, success: false, error: "Configuration manager not ready." });
      } else {
        sendResponse({
          success: false,
          error: "Configuration manager not ready.",
        });
      }
    } catch (e) {
      console.error("Failed to send config error response:", e);
    }
    return;
  }
  try {
    const config = await configManager.getConfig();
    console.log("[MessageHandler] handleGetConfig: Retrieved config:", config);
    try {
      if (message.requestId) {
        chrome.runtime.sendMessage({ action: "getConfigResult", requestId: message.requestId, success: true, config });
      } else {
        sendResponse({ success: true, config });
      }
    } catch (sendError) {
      console.error(
        "[MessageHandler] Error during sendResponse for getConfig:",
        sendError,
        "Data:",
        config
      );
      try {
        sendResponse({
          success: false,
          error: `Failed to send config response: ${sendError.message}`,
        });
      } catch (e) {
        console.error("Failed to send fallback config error:", e);
      }
    }
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetConfig: Error getting config:",
      error
    );
    const apiError = new ConfigError("Error getting configuration", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    try {
      if (message.requestId) {
        chrome.runtime.sendMessage({ action: "getConfigResult", requestId: message.requestId, success: false, error: apiError.message });
      } else {
        sendResponse({ success: false, error: apiError.message });
      }
    } catch (e) {
      console.error("Failed to send config error response after catch:", e);
    }
  }
}

async function handleUpdateConfig(message, sendResponse) {
  console.log(
    "[MessageHandler] handleUpdateConfig: Called with data:",
    message.data
  );
  if (!configManager || typeof configManager.updateConfig !== "function") {
    console.error(
      "[MessageHandler] configManager or updateConfig not available."
    );
    if (message.requestId) {
      chrome.runtime.sendMessage({ action: "updateConfigResult", requestId: message.requestId, success: false, error: "Configuration manager not ready." });
    } else {
      sendResponse({ success: false, error: "Configuration manager not ready." });
    }
    return;
  }
  try {
    await configManager.updateConfig(message.config || message.data);
    console.log(
      "[MessageHandler] handleUpdateConfig: Config updated successfully."
    );
    const updatedConfig = await configManager.getConfig();
    if (message.requestId) {
      chrome.runtime.sendMessage({ action: "updateConfigResult", requestId: message.requestId, success: true, config: updatedConfig });
    } else {
      sendResponse({ success: true, config: updatedConfig });
    }
  } catch (error) {
    console.error(
      "[MessageHandler] handleUpdateConfig: Error updating config:",
      error
    );
    const apiError = new ConfigError("Error updating configuration", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    if (message.requestId) {
      chrome.runtime.sendMessage({ action: "updateConfigResult", requestId: message.requestId, success: false, error: apiError.message });
    } else {
      sendResponse({ success: false, error: apiError.message });
    }
  }
}

async function handleCheckAuth(sendResponse) {
  console.log("[MessageHandler] handleCheckAuth: Called");
  if (!authManager || typeof authManager.isAuthenticated !== "function") {
    console.error(
      "[MessageHandler] authManager or isAuthenticated not available."
    );
    sendResponse({
      success: true,
      isAuthenticated: false,
      error: "Authentication manager not ready.",
    });
    return;
  }
  try {
    const isAuthenticated = await authManager.isAuthenticated();
    console.log("[MessageHandler] handleCheckAuth: Status:", isAuthenticated);
    sendResponse({ success: true, isAuthenticated });
  } catch (error) {
    console.error(
      "[MessageHandler] handleCheckAuth: Error checking auth status:",
      error
    );
    const apiError = new AuthError(
      "Error checking authentication status",
      error
    );
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({
      success: false,
      error: apiError.message,
      isAuthenticated: false,
    });
  }
}

async function handleLogin(message, sendResponse) {
  console.log("[MessageHandler] handleLogin: Called");
  if (!authManager || typeof authManager.login !== "function") {
    console.error("[MessageHandler] authManager or login not available.");
    sendResponse({
      success: false,
      error: "Authentication manager not ready.",
    });
    return;
  }
  try {
    const { password } = message;
    if (typeof password !== "string" || password.length === 0) {
      throw new Error("Password is required for login.");
    }
    const success = await authManager.login(password);
    console.log("[MessageHandler] handleLogin: Success:", success);
    sendResponse({ success });
  } catch (error) {
    console.error("[MessageHandler] handleLogin: Error during login:", error);
    const apiError = new AuthError(`Login failed: ${error.message}`, error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleLogout(sendResponse) {
  console.log("[MessageHandler] handleLogout: Called");
  if (!authManager || typeof authManager.logout !== "function") {
    console.error("[MessageHandler] authManager or logout not available.");
    sendResponse({
      success: false,
      error: "Authentication manager not ready.",
    });
    return;
  }
  try {
    await authManager.logout();
    console.log("[MessageHandler] handleLogout: Success");
    sendResponse({ success: true });
  } catch (error) {
    console.error("[MessageHandler] handleLogout: Error during logout:", error);
    const apiError = new AuthError("Logout failed", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleEncryptData(message, sendResponse) {
  console.log("[MessageHandler] handleEncryptData: Called");
  if (!encryptionManager || typeof encryptionManager.encrypt !== "function") {
    console.error(
      "[MessageHandler] encryptionManager or encrypt not available."
    );
    sendResponse({ success: false, error: "Encryption manager not ready." });
    return;
  }
  try {
    const { data } = message;
    if (data === undefined || data === null) {
      throw new Error("Data to encrypt cannot be null or undefined.");
    }
    const encryptedData = await encryptionManager.encrypt(data);
    console.log("[MessageHandler] handleEncryptData: Success");
    sendResponse({ success: true, encryptedData });
  } catch (error) {
    console.error(
      "[MessageHandler] handleEncryptData: Error encrypting data:",
      error
    );
    const apiError = new EncryptionError("Encryption failed", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleDecryptData(message, sendResponse) {
  console.log("[MessageHandler] handleDecryptData: Called");
  if (!encryptionManager || typeof encryptionManager.decrypt !== "function") {
    console.error(
      "[MessageHandler] encryptionManager or decrypt not available."
    );
    sendResponse({ success: false, error: "Encryption manager not ready." });
    return;
  }
  try {
    const { encryptedData } = message;
    if (encryptedData === undefined || encryptedData === null) {
      throw new Error("Encrypted data cannot be null or undefined.");
    }
    const data = await encryptionManager.decrypt(encryptedData);
    console.log("[MessageHandler] handleDecryptData: Success");
    sendResponse({ success: true, data });
  } catch (error) {
    console.error(
      "[MessageHandler] handleDecryptData: Error decrypting data:",
      error
    );
    const apiError = new EncryptionError("Decryption failed", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetDistinctDomains(sendResponse) {
  console.log("[MessageHandler] handleGetDistinctDomains: Called");
  try {
    const domains = await dbManager.getDistinctDomains();
    sendResponse({ domains: domains || [] });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetDistinctDomains: Error handling GET_DISTINCT_DOMAINS:",
      error
    );
    sendResponse({ error: error.message, domains: [] });
  }
}

async function handleBackupDatabase(sendResponse, message = {}) {
  try {
    if (!dbManager || typeof dbManager.backupDatabase !== "function")
      throw new Error("dbManager.backupDatabase not available");
    const backupKey = await dbManager.backupDatabase();
    const response = { success: true, backupKey, action: "backupDatabase" };
    if (message.requestId) {
      chrome.runtime.sendMessage({ ...response, requestId: message.requestId });
    } else {
      sendResponse(response);
    }
  } catch (error) {
    const response = {
      success: false,
      error: error.message,
      action: "backupDatabase",
    };
    if (message && message.requestId) {
      chrome.runtime.sendMessage({ ...response, requestId: message.requestId });
    } else {
      sendResponse(response);
    }
  }
}

async function handleRestoreDatabase(message, sendResponse) {
  try {
    if (!dbManager || typeof dbManager.replaceDatabase !== "function")
      throw new Error("dbManager.replaceDatabase not available");
    const { data, requestId } = message;
    if (!data) throw new Error("No backup data provided");
    await dbManager.replaceDatabase(data);
    const response = { success: true, action: "restoreDatabase" };
    if (requestId) {
      chrome.runtime.sendMessage({ ...response, requestId });
    } else {
      sendResponse(response);
    }
  } catch (error) {
    const response = {
      success: false,
      error: error.message,
      action: "restoreDatabase",
    };
    if (message.requestId) {
      chrome.runtime.sendMessage({ ...response, requestId: message.requestId });
    } else {
      sendResponse(response);
    }
  }
}

async function handleVacuumDatabase(sendResponse, message = {}) {
  try {
    if (!dbManager || typeof dbManager.vacuumDatabase !== "function")
      throw new Error("dbManager.vacuumDatabase not available");
    await dbManager.vacuumDatabase();
    const response = { success: true, action: "vacuumDatabase" };
    if (message.requestId) {
      chrome.runtime.sendMessage({ ...response, requestId: message.requestId });
    } else {
      sendResponse(response);
    }
  } catch (error) {
    const response = {
      success: false,
      error: error.message,
      action: "vacuumDatabase",
    };
    if (message && message.requestId) {
      chrome.runtime.sendMessage({ ...response, requestId: message.requestId });
    } else {
      sendResponse(response);
    }
  }
}

async function handleGetTableContents(message, sendResponse) {
  try {
    if (!dbManager || typeof dbManager.executeRawSql !== "function")
      throw new Error("dbManager.executeRawSql not available");
    const { table, limit, requestId } = message;
    if (!table) throw new Error("No table specified");
    let sql;
    if (limit && Number(limit) > 0) {
      sql = `SELECT * FROM ${table} LIMIT ${Number(limit)}`;
    } else {
      sql = `SELECT * FROM ${table}`;
    }
    const results = await dbManager.executeRawSql(sql);
    const response = {
      success: true,
      data: results[0],
      action: "getTableContents",
    };
    if (requestId) {
      chrome.runtime.sendMessage({ ...response, requestId });
    } else {
      sendResponse(response);
    }
  } catch (error) {
    const response = {
      success: false,
      error: error.message,
      action: "getTableContents",
    };
    if (message.requestId) {
      chrome.runtime.sendMessage({ ...response, requestId: message.requestId });
    } else {
      sendResponse(response);
    }
  }
}

async function handleGetEncryptionStatus(sendResponse) {
  try {
    if (!dbManager || !dbManager.encryptionManager)
      throw new Error("encryptionManager not available");
    const enabled =
      dbManager.encryptionManager.isEnabled &&
      dbManager.encryptionManager.isEnabled();
    sendResponse({ success: true, enabled });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleEncryptDatabase(message, sendResponse) {
  try {
    if (!dbManager || typeof dbManager.encryptDatabase !== "function")
      throw new Error("dbManager.encryptDatabase not available");
    const { key } = message;
    if (!key) throw new Error("No encryption key provided");
    await dbManager.encryptDatabase(key);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleDecryptDatabase(message, sendResponse) {
  try {
    if (!dbManager || typeof dbManager.decryptDatabase !== "function")
      throw new Error("dbManager.decryptDatabase not available");
    const { key } = message;
    if (!key) throw new Error("No decryption key provided");
    await dbManager.decryptDatabase(key);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// --- Raw SQL Query History Handler ---
async function handleGetSqlHistory(message, sendResponse) {
  try {
    if (!dbManager || typeof dbManager.getSqlHistory !== "function")
      throw new Error("dbManager.getSqlHistory not available");
    const history = await dbManager.getSqlHistory();
    sendResponse({ success: true, history });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}
