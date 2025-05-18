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

  chrome.runtime.onMessage.addListener((message, sender) => {
    console.log('[MessageHandler] Incoming message:', message, sender);
    // --- Event-based: always respond with chrome.runtime.sendMessage, never sendResponse or return true ---
    if (message.action === "getConfig") {
      (async () => {
        try {
          const config = await configManager.getConfig();
          // Ensure event-based response includes themeData if present
          let themeData = undefined;
          if (config && config.themeData) {
            themeData = config.themeData;
          } else if (config && config.ui && config.ui.theme) {
            // Fallback for legacy config
            themeData = { currentTheme: config.ui.theme };
          } else if (config && config.theme) {
            // Fallback for theme at root
            themeData = { currentTheme: config.theme };
          }
          sendEventResponse("getConfigResult", message.requestId, {
            success: true,
            config: { ...config, themeData },
          });
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
      if (message.requestId && message.requestIdFor) {
        getRequestHeadersEventBased(message.requestId, message.requestIdFor);
        return;
      } else if (message.requestId) {
        getRequestHeadersEventBased(message.requestId, message.requestId);
        return;
      }
      return;
    }
    if (message.action === "getRequestTimings") {
      if (message.requestId && message.requestIdFor) {
        getRequestTimingsEventBased(message.requestId, message.requestIdFor);
        return;
      } else if (message.requestId) {
        getRequestTimingsEventBased(message.requestId, message.requestId);
        return;
      }
      return;
    }
    // --- Performance Analytics: Resource Timings, Page Load Metrics, Resource Breakdown ---
    if (message.action === "getResourceTimings") {
      (async () => {
        try {
          const timings = await dbManager.getResourceTimings(message.filters || {});
          sendEventResponse("getResourceTimingsResult", message.requestId, { success: true, timings });
        } catch (error) {
          sendEventResponse("getResourceTimingsResult", message.requestId, { success: false, error: error.message });
        }
      })();
      return;
    }
    if (message.action === "getPageLoadMetrics") {
      (async () => {
        try {
          const metrics = await dbManager.getPageLoadMetrics(message.filters || {});
          sendEventResponse("getPageLoadMetricsResult", message.requestId, { success: true, metrics });
        } catch (error) {
          sendEventResponse("getPageLoadMetricsResult", message.requestId, { success: false, error: error.message });
        }
      })();
      return;
    }
    if (message.action === "getResourceBreakdown") {
      (async () => {
        try {
          const breakdown = await dbManager.getResourceBreakdown(message.filters || {});
          sendEventResponse("getResourceBreakdownResult", message.requestId, { success: true, breakdown });
        } catch (error) {
          sendEventResponse("getResourceBreakdownResult", message.requestId, { success: false, error: error.message });
        }
      })();
      return;
    }
    if (message.action === "getStats") {
      handleGetStats(message, sender);
      return;
    }
    if (message.action === "devtoolsRequestCaptured" && message.request) {
      console.log('[MessageHandler] devtoolsRequestCaptured payload:', message.request);
      try {
        const req = message.request;
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
        if (dbManager && typeof dbManager.saveRequest === 'function') {
          dbManager.saveRequest(req);
          if (dbManager.saveRequestTimings && req.timings) {
            dbManager.saveRequestTimings(req.id, req.timings);
          }
        }
        if (typeof captureManager?.updateRequestData === 'function') {
          captureManager.updateRequestData(req.id, req);
        }
        chrome.runtime.sendMessage({ action: "devtoolsRequestCapturedResult", success: true });
      } catch (err) {
        console.error('[MessageHandler] Error handling devtoolsRequestCaptured:', err);
        chrome.runtime.sendMessage({ action: "devtoolsRequestCapturedResult", success: false, error: err.message });
      }
      return;
    }
    if (message.action === "executeRawSql") {
      handleExecuteRawSql(message, sender); // Calls the async handler
      return;
    }
    if (message.action === 'getApiPerformanceOverTime') {
      (async () => {
        try {
          const stats = await dbManager.getApiPerformanceOverTime(message.filters || {});
          sendEventResponse("getApiPerformanceOverTimeResult", message.requestId, { success: true, ...stats });
        } catch (error) {
          sendEventResponse("getApiPerformanceOverTimeResult", message.requestId, { success: false, error: error.message });
        }
      })();
      return;
    }
    handleMessage(message, sender, logErrorToDb);
    return;
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

async function handleMessage(message, sender, logErrorToDbFunc) {
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
      "getBackupList",
      "deleteBackup",
      "getHistoryLog",
      "clearHistoryLog",
    ];
    if (requiresDb.includes(message.action) && !dbManager) {
      console.error(`[MessageHandler] ${message.action}: dbManager is null!`);
      chrome.runtime.sendMessage({ action: `${message.action}Result`, success: false, error: "Database not initialized" });
      return;
    }

    switch (message.action) {
      case "getRequests":
      case "getRequestsFromDB":
        handleGetRequests(message, sender); // Async handler
        return;
      case "clearRequests":
        handleClearRequests(message); // Async handler
        return;
      case "getRequestHeaders":
        handleGetRequestHeaders(message);
        return;
      case "getDatabaseInfo":
        handleGetDatabaseInfo();
        return;
      case "getDatabaseStats":
        handleGetStats(message, sender);
        return;
      case "getDatabaseSchemaSummary":
        handleGetDatabaseSchemaSummary(message, sender);
        return;
      case "getLoggedErrors":
        handleGetLoggedErrors(message, sender);
        return;
      case "executeRawSql":
        handleExecuteRawSql(message, sender); // Calls the async handler
        return;
      case "getDistinctValues":
        handleGetDistinctValues(message);
        return;
      case "getApiPaths":
        handleGetApiPaths();
        return;
      case "getFilteredStats":
        handleGetFilteredStats(message, sender);
        return;
      case "exportData":
        handleExportData(message);
        return;
      case "importData":
        if (
          !importManager ||
          typeof importManager.handleImportData !== "function"
        ) {
          console.error(
            "[MessageHandler] importManager or handleImportData not available."
          );
          chrome.runtime.sendMessage({ action: "importDataResult", success: false, error: "Import manager not ready." });
          return;
        }
        handleImportData(message);
        return;
      case "importDatabaseFile":
        handleImportDatabaseFile(message);
        return;
      case "getConfig":
        handleGetConfig(message);
        return;
      case "updateConfig":
        handleUpdateConfig(message);
        return;
      case "checkAuth":
        handleCheckAuth();
        return;
      case "login":
        handleLogin(message);
        return;
      case "logout":
        handleLogout();
        return;
      case "encryptData":
        handleEncryptData(message);
        return;
      case "decryptData":
        handleDecryptData(message);
        return;
      case "getDistinctDomains":
        handleGetDistinctDomains();
        return;
      case "backupDatabase":
        handleBackupDatabase(message);
        return;
      case "restoreDatabase":
        handleRestoreDatabase(message);
        return;
      case "vacuumDatabase":
        handleVacuumDatabase(message);
        return;
      case "getTableContents":
        handleGetTableContents(message);
        return;
      case "getEncryptionStatus":
        handleGetEncryptionStatus();
        return;
      case "encryptDatabase":
        handleEncryptDatabase(message);
        return;
      case "decryptDatabase":
        handleDecryptDatabase(message);
        return;
      case "getSqlHistory":
        handleGetSqlHistory(message);
        return;
      case "getBackupList":
        handleGetBackupList(message);
        return;
      case "deleteBackup":
        handleDeleteBackup(message);
        return;
      case "getHistoryLog":
        handleGetHistoryLog(message);
        return;
      case "clearHistoryLog":
        handleClearHistoryLog(message);
        return;
      case "resetConfig":
        if (!configManager || typeof configManager.resetConfig !== "function") {
          chrome.runtime.sendMessage({ action: "resetConfigResult", success: false, error: "Config manager not available" });
          return;
        }
        try {
          await configManager.resetConfig();
          chrome.runtime.sendMessage({ action: "resetConfigResult", success: true });
        } catch (error) {
          chrome.runtime.sendMessage({ action: "resetConfigResult", success: false, error: error.message });
        }
        return;
      default:
        console.warn(
          "[MessageHandler] Unknown action received:",
          message.action
        );
        chrome.runtime.sendMessage({ action: `${message.action}Result`, success: false, error: `Unknown action: ${message.action}` });
        return;
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
      chrome.runtime.sendMessage({
        action: `${message?.action}Result`,
        success: false,
        error: `Internal server error processing action ${message?.action}`,
      });
    } catch (sendError) {
      console.error(
        "[MessageHandler] Failed to send error response:",
        sendError
      );
    }
    return;
  }
}

// Add handler for getStats to support legacy popup calls
async function handleGetStats(message, sender) {
  try {
    if (typeof dbManager.getFilteredStats === 'function') {
      const stats = await dbManager.getFilteredStats({});
      sendEventResponse("getStatsResult", message.requestId, { success: true, stats });
    } else {
      throw new Error("getFilteredStats not available");
    }
  } catch (error) {
    sendEventResponse("getStatsResult", message.requestId, { success: false, error: error.message });
  }
}

async function handleGetRequests(message, sender) {
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
    if (!dbManager || typeof dbManager.getRequests !== "function") {
      console.error("[MessageHandler] handleGetRequests: dbManager.getRequests is not a function");
      sendEventResponse("getRequestsResult", requestId, { success: false, error: "Database not initialized" });
      return;
    }
    const result = await dbManager.getRequests(
      filters,
      page,
      limit,
      sortBy,
      sortOrder
    );
    console.log(
      `[MessageHandler] handleGetRequests: Retrieved ${result.requests?.length} requests.`,
      result.requests
    );
    sendEventResponse("getRequestsResult", requestId, { ...result, success: true });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetRequests: Error getting requests:",
      error
    );
    const apiError = new DatabaseError("Error getting requests", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("getRequestsResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleClearRequests(message) {
  console.log("[MessageHandler] handleClearRequests: Called");
  try {
    if (typeof dbManager.clearRequests !== "function") {
      throw new Error("dbManager.clearRequests is not a function");
    }
    await dbManager.clearRequests();
    console.log(
      "[MessageHandler] handleClearRequests: Requests cleared successfully."
    );
    sendEventResponse("clearRequestsResult", message.requestId, { success: true });
  } catch (error) {
    console.error(
      "[MessageHandler] handleClearRequests: Error clearing requests:",
      error
    );
    const apiError = new DatabaseError("Error clearing requests", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("clearRequestsResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleGetRequestHeaders(message) {
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
    sendEventResponse("getRequestHeadersResult", message.requestId, { success: true, headers });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetRequestHeaders: Error getting headers:",
      error
    );
    const apiError = new DatabaseError("Error getting request headers", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("getRequestHeadersResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleGetDatabaseInfo() {
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
    chrome.runtime.sendMessage({ action: "getDatabaseInfoResult", success: true, info });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetDatabaseInfo: Error getting database info:",
      error
    );
    const apiError = new DatabaseError("Error getting database info", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    chrome.runtime.sendMessage({ action: "getDatabaseInfoResult", success: false, error: apiError.message });
  }
}

async function handleGetDatabaseSchemaSummary(message, sender) {
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
    sendEventResponse("getDatabaseSchemaSummaryResult", message.requestId, { success: true, summary });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetDatabaseSchemaSummary: Error getting schema summary:",
      error
    );
    const apiError = new DatabaseError("Error getting schema summary", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("getDatabaseSchemaSummaryResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleGetLoggedErrors(message, sender) {
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
    );
    sendEventResponse("getLoggedErrorsResult", message.requestId, { success: true, errors });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetLoggedErrors: Error getting logged errors:",
      error
    );
    const apiError = new DatabaseError("Error getting logged errors", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("getLoggedErrorsResult", message.requestId, { success: false, error: apiError.message });
  }
}

// --- Enhanced Raw SQL Execution Handler ---
async function handleExecuteRawSql(message, sender) {
  console.log('[Background] handleExecuteRawSql: Received', message);
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
    console.log('[Background] handleExecuteRawSql: Executing SQL:', sql);
    const result = await dbManager.executeRawSql(sql, { exportCsv });
    console.log('[Background] handleExecuteRawSql: Sending result:', result);
    sendEventResponse("executeRawSqlResult", requestId, { success: true, results: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      "[MessageHandler] handleExecuteRawSql: Error executing raw SQL:",
      errorMessage,
      error.stack
    );
    const errorResponse = { success: false, error: errorMessage };
    if (error instanceof Error && error.stack) {
      errorResponse.stack = error.stack;
    }
    console.log('[Background] handleExecuteRawSql: Sending error:', errorResponse);
    sendEventResponse("executeRawSqlResult", message.requestId, errorResponse);
  }
}

async function handleGetDistinctValues(message) {
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
    sendEventResponse("getDistinctValuesResult", message.requestId, { success: true, values });
  } catch (error) {
    console.error("[MessageHandler] Error getting distinct values:", error);
    const apiError = new DatabaseError("Error getting distinct values", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("getDistinctValuesResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleGetApiPaths() {
  console.log("[MessageHandler] handleGetApiPaths: Called");
  try {
    if (typeof dbManager.getApiPaths !== "function") {
      throw new Error("dbManager.getApiPaths is not a function");
    }
    const paths = await dbManager.getApiPaths();
    chrome.runtime.sendMessage({ action: "getApiPathsResult", success: true, paths });
  } catch (error) {
    console.error("[MessageHandler] Error getting API paths:", error);
    const apiError = new DatabaseError("Error getting API paths", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    chrome.runtime.sendMessage({ action: "getApiPathsResult", success: false, error: apiError.message });
  }
}

async function handleGetFilteredStats(message, sender) {
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

async function handleExportData(message) {
  console.log(
    "[MessageHandler] handleExportData: Called with format:",
    message.format
  );
  if (!exportManager || typeof exportManager.handleExportData !== "function") {
    console.error(
      "[MessageHandler] exportManager or handleExportData not available."
    );
    sendEventResponse("exportDataResult", message.requestId, { success: false, error: "Export manager not ready." });
    return;
  }
  try {
    const { format, requestId } = message;
    const data = await dbManager.exportDatabase(format);
    sendEventResponse("exportDataResult", requestId, { success: true, data });
  } catch (error) {
    console.error(
      "[MessageHandler] handleExportData: Error exporting data:",
      error
    );
    const apiError = new DatabaseError("Error exporting data", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("exportDataResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleImportDatabaseFile(message) {
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
    sendEventResponse("importDatabaseFileResult", message.requestId, { success: true, message: "Database imported successfully. Reload might be required." });
  } catch (error) {
    console.error("[MessageHandler] Error importing database file:", error);
    const apiError = new DatabaseError("Error importing database file", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("importDatabaseFileResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleGetConfig(message = {}) {
  console.log("[MessageHandler] handleGetConfig: Called");
  if (!configManager || typeof configManager.getConfig !== "function") {
    console.error("[MessageHandler] configManager or getConfig not available.");
    sendEventResponse("getConfigResult", message.requestId, { success: false, error: "Configuration manager not ready." });
    return;
  }
  try {
    const config = await configManager.getConfig();
    console.log("[MessageHandler] handleGetConfig: Retrieved config:", config);
    sendEventResponse("getConfigResult", message.requestId, { success: true, config });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetConfig: Error getting config:",
      error
    );
    const apiError = new ConfigError("Error getting configuration", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("getConfigResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleUpdateConfig(message) {
  console.log(
    "[MessageHandler] handleUpdateConfig: Called with data:",
    message.data
  );
  if (!configManager || typeof configManager.updateConfig !== "function") {
    console.error(
      "[MessageHandler] configManager or updateConfig not available."
    );
    sendEventResponse("updateConfigResult", message.requestId, { success: false, error: "Configuration manager not ready." });
    return;
  }
  try {
    await configManager.updateConfig(message.config || message.data);
    console.log(
      "[MessageHandler] handleUpdateConfig: Config updated successfully."
    );
    const updatedConfig = await configManager.getConfig();
    sendEventResponse("updateConfigResult", message.requestId, { success: true, config: updatedConfig });
  } catch (error) {
    console.error(
      "[MessageHandler] handleUpdateConfig: Error updating config:",
      error
    );
    const apiError = new ConfigError("Error updating configuration", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendEventResponse("updateConfigResult", message.requestId, { success: false, error: apiError.message });
  }
}

async function handleCheckAuth() {
  console.log("[MessageHandler] handleCheckAuth: Called");
  if (!authManager || typeof authManager.isAuthenticated !== "function") {
    console.error(
      "[MessageHandler] authManager or isAuthenticated not available."
    );
    chrome.runtime.sendMessage({
      action: "checkAuthResult",
      success: true,
      isAuthenticated: false,
      error: "Authentication manager not ready.",
    });
    return;
  }
  try {
    const isAuthenticated = await authManager.isAuthenticated();
    console.log("[MessageHandler] handleCheckAuth: Status:", isAuthenticated);
    chrome.runtime.sendMessage({ action: "checkAuthResult", success: true, isAuthenticated });
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
    chrome.runtime.sendMessage({
      action: "checkAuthResult",
      success: false,
      error: apiError.message,
      isAuthenticated: false,
    });
  }
}

async function handleLogin(message) {
  console.log("[MessageHandler] handleLogin: Called");
  if (!authManager || typeof authManager.login !== "function") {
    console.error("[MessageHandler] authManager or login not available.");
    chrome.runtime.sendMessage({
      action: "loginResult",
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
    chrome.runtime.sendMessage({ action: "loginResult", success });
  } catch (error) {
    console.error("[MessageHandler] handleLogin: Error during login:", error);
    const apiError = new AuthError(`Login failed: ${error.message}`, error);
    if (logErrorToDb) await logErrorToDb(apiError);
    chrome.runtime.sendMessage({ action: "loginResult", success: false, error: apiError.message });
  }
}

async function handleLogout() {
  console.log("[MessageHandler] handleLogout: Called");
  if (!authManager || typeof authManager.logout !== "function") {
    console.error("[MessageHandler] authManager or logout not available.");
    chrome.runtime.sendMessage({
      action: "logoutResult",
      success: false,
      error: "Authentication manager not ready.",
    });
    return;
  }
  try {
    await authManager.logout();
    console.log("[MessageHandler] handleLogout: Success");
    chrome.runtime.sendMessage({ action: "logoutResult", success: true });
  } catch (error) {
    console.error("[MessageHandler] handleLogout: Error during logout:", error);
    const apiError = new AuthError("Logout failed", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    chrome.runtime.sendMessage({ action: "logoutResult", success: false, error: apiError.message });
  }
}

async function handleEncryptData(message) {
  console.log("[MessageHandler] handleEncryptData: Called");
  if (!encryptionManager || typeof encryptionManager.encrypt !== "function") {
    console.error(
      "[MessageHandler] encryptionManager or encrypt not available."
    );
    chrome.runtime.sendMessage({ action: "encryptDataResult", success: false, error: "Encryption manager not ready." });
    return;
  }
  try {
    const { data } = message;
    if (data === undefined || data === null) {
      throw new Error("Data to encrypt cannot be null or undefined.");
    }
    const encryptedData = await encryptionManager.encrypt(data);
    console.log("[MessageHandler] handleEncryptData: Success");
    chrome.runtime.sendMessage({ action: "encryptDataResult", success: true, encryptedData });
  } catch (error) {
    console.error(
      "[MessageHandler] handleEncryptData: Error encrypting data:",
      error
    );
    const apiError = new EncryptionError("Encryption failed", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    chrome.runtime.sendMessage({ action: "encryptDataResult", success: false, error: apiError.message });
  }
}

async function handleDecryptData(message) {
  console.log("[MessageHandler] handleDecryptData: Called");
  if (!encryptionManager || typeof encryptionManager.decrypt !== "function") {
    console.error(
      "[MessageHandler] encryptionManager or decrypt not available."
    );
    chrome.runtime.sendMessage({ action: "decryptDataResult", success: false, error: "Encryption manager not ready." });
    return;
  }
  try {
    const { encryptedData } = message;
    if (encryptedData === undefined || encryptedData === null) {
      throw new Error("Encrypted data cannot be null or undefined.");
    }
    const data = await encryptionManager.decrypt(encryptedData);
    console.log("[MessageHandler] handleDecryptData: Success");
    chrome.runtime.sendMessage({ action: "decryptDataResult", success: true, data });
  } catch (error) {
    console.error(
      "[MessageHandler] handleDecryptData: Error decrypting data:",
      error
    );
    const apiError = new EncryptionError("Decryption failed", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    chrome.runtime.sendMessage({ action: "decryptDataResult", success: false, error: apiError.message });
  }
}

async function handleGetDistinctDomains() {
  console.log("[MessageHandler] handleGetDistinctDomains: Called");
  try {
    const domains = await dbManager.getDistinctDomains();
    chrome.runtime.sendMessage({ action: "getDistinctDomainsResult", success: true, domains: domains || [] });
  } catch (error) {
    console.error(
      "[MessageHandler] handleGetDistinctDomains: Error handling GET_DISTINCT_DOMAINS:",
      error
    );
    chrome.runtime.sendMessage({ action: "getDistinctDomainsResult", success: false, error: error.message, domains: [] });
  }
}

async function handleBackupDatabase(message = {}) {
  try {
    if (!dbManager || typeof dbManager.backupDatabase !== "function")
      throw new Error("dbManager.backupDatabase not available");
    const backupKey = await dbManager.backupDatabase();
    sendEventResponse("backupDatabaseResult", message.requestId, { success: true, backupKey });
  } catch (error) {
    sendEventResponse("backupDatabaseResult", message.requestId, { success: false, error: error.message });
  }
}

async function handleRestoreDatabase(message) {
  try {
    if (!dbManager || typeof dbManager.replaceDatabase !== "function")
      throw new Error("dbManager.replaceDatabase not available");
    const { data, requestId } = message;
    if (!data) throw new Error("No backup data provided");
    await dbManager.replaceDatabase(data);
    sendEventResponse("restoreDatabaseResult", requestId, { success: true });
  } catch (error) {
    sendEventResponse("restoreDatabaseResult", message.requestId, { success: false, error: error.message });
  }
}

async function handleVacuumDatabase(message = {}) {
  try {
    if (!dbManager || typeof dbManager.vacuumDatabase !== "function")
      throw new Error("dbManager.vacuumDatabase not available");
    await dbManager.vacuumDatabase();
    sendEventResponse("vacuumDatabaseResult", message.requestId, { success: true });
  } catch (error) {
    sendEventResponse("vacuumDatabaseResult", message.requestId, { success: false, error: error.message });
  }
}

async function handleGetTableContents(message) {
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
    sendEventResponse("getTableContentsResult", requestId, { success: true, data: results[0] });
  } catch (error) {
    sendEventResponse("getTableContentsResult", message.requestId, { success: false, error: error.message });
  }
}

async function handleGetEncryptionStatus() {
  try {
    if (!dbManager || !dbManager.encryptionManager)
      throw new Error("encryptionManager not available");
    const enabled =
      dbManager.encryptionManager.isEnabled &&
      dbManager.encryptionManager.isEnabled();
    chrome.runtime.sendMessage({ action: "getEncryptionStatusResult", success: true, enabled });
  } catch (error) {
    chrome.runtime.sendMessage({ action: "getEncryptionStatusResult", success: false, error: error.message });
  }
}

async function handleEncryptDatabase(message) {
  try {
    if (!dbManager || typeof dbManager.encryptDatabase !== "function")
      throw new Error("dbManager.encryptDatabase not available");
    const { key } = message;
    if (!key) throw new Error("No encryption key provided");
    await dbManager.encryptDatabase(key);
    chrome.runtime.sendMessage({ action: "encryptDatabaseResult", success: true });
  } catch (error) {
    chrome.runtime.sendMessage({ action: "encryptDatabaseResult", success: false, error: error.message });
  }
}

async function handleDecryptDatabase(message) {
  try {
    if (!dbManager || typeof dbManager.decryptDatabase !== "function")
      throw new Error("dbManager.decryptDatabase not available");
    const { key } = message;
    if (!key) throw new Error("No decryption key provided");
    await dbManager.decryptDatabase(key);
    chrome.runtime.sendMessage({ action: "decryptDatabaseResult", success: true });
  } catch (error) {
    chrome.runtime.sendMessage({ action: "decryptDatabaseResult", success: false, error: error.message });
  }
}

// --- Raw SQL Query History Handler ---
async function handleGetSqlHistory(message) {
  try {
    if (!dbManager || typeof dbManager.getSqlHistory !== "function")
      throw new Error("dbManager.getSqlHistory not available");
    const history = await dbManager.getSqlHistory();
    sendEventResponse("getSqlHistoryResult", message.requestId, { success: true, history });
  } catch (error) {
    sendEventResponse("getSqlHistoryResult", message.requestId, { success: false, error: error.message });
  }
}

// --- Backup/Restore/History Event Handlers ---
async function handleGetBackupList(message) {
  try {
    if (!dbManager || typeof dbManager.getBackupList !== "function")
      throw new Error("dbManager.getBackupList not available");
    const backups = await dbManager.getBackupList();
    sendEventResponse("getBackupListResult", message.requestId, { success: true, backups });
  } catch (error) {
    sendEventResponse("getBackupListResult", message.requestId, { success: false, error: error.message });
  }
}

async function handleDeleteBackup(message) {
  try {
    if (!dbManager || typeof dbManager.deleteBackup !== "function")
      throw new Error("dbManager.deleteBackup not available");
    const { key } = message;
    await dbManager.deleteBackup(key);
    sendEventResponse("deleteBackupResult", message.requestId, { success: true });
  } catch (error) {
    sendEventResponse("deleteBackupResult", message.requestId, { success: false, error: error.message });
  }
}

async function handleGetHistoryLog(message) {
  try {
    if (!dbManager || typeof dbManager.getHistoryLog !== "function")
      throw new Error("dbManager.getHistoryLog not available");
    const history = await dbManager.getHistoryLog();
    sendEventResponse("getHistoryLogResult", message.requestId, { success: true, history });
  } catch (error) {
    sendEventResponse("getHistoryLogResult", message.requestId, { success: false, error: error.message });
  }
}

async function handleClearHistoryLog(message) {
  try {
    if (!dbManager || typeof dbManager.clearHistoryLog !== "function")
      throw new Error("dbManager.clearHistoryLog not available");
    await dbManager.clearHistoryLog();
    sendEventResponse("clearHistoryLogResult", message.requestId, { success: true });
  } catch (error) {
    sendEventResponse("clearHistoryLogResult", message.requestId, { success: false, error: error.message });
  }
}
