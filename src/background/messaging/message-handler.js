/**
 * Message handler for communication with popup and content scripts
 */

import { DatabaseError, ConfigError, AuthError, EncryptionError } from "../errors/error-types.js";
import { handleImportData } from "../import/import-manager.js";

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
    return handleMessage(message, sender, sendResponse, logErrorToDb);
  });

  console.log("[MessageHandler] Initialized with all managers.");
  if (dbManager) {
    console.log("[MessageHandler] dbManager is available during setup.");
  } else {
    console.warn("[MessageHandler] dbManager is NOT available during setup.");
  }
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
    ];
    if (requiresDb.includes(message.action) && !dbManager) {
      console.error(`[MessageHandler] ${message.action}: dbManager is null!`);
      sendResponse({ success: false, error: "Database not initialized" });
      return false;
    }

    switch (message.action) {
      case "getRequests":
      case "getRequestsFromDB":
        handleGetRequests(message, sendResponse);
        return true;
      case "clearRequests":
        handleClearRequests(sendResponse);
        return true;
      case "getRequestHeaders":
        handleGetRequestHeaders(message, sendResponse);
        return true;
      case "getDatabaseInfo":
        handleGetDatabaseInfo(sendResponse);
        return true;
      case "getDatabaseStats":
        handleGetStats(sendResponse);
        return true;
      case "getDatabaseSchemaSummary":
        handleGetDatabaseSchemaSummary(sendResponse);
        return true;
      case "getLoggedErrors":
        handleGetLoggedErrors(message, sendResponse);
        return true;
      case "executeRawSql":
        handleExecuteRawSql(message, sendResponse);
        return true;
      case "getDistinctValues":
        handleGetDistinctValues(message, sendResponse);
        return true;
      case "getApiPaths":
        handleGetApiPaths(sendResponse);
        return true;
      case "getFilteredStats":
        handleGetFilteredStats(message, sendResponse);
        return true;
      case "exportData":
        handleExportData(message, sendResponse);
        return true;
      case "importData":
        if (
          !importManager ||
          typeof importManager.handleImportData !== "function"
        ) {
          console.error("[MessageHandler] importManager or handleImportData not available.");
          sendResponse({ success: false, error: "Import manager not ready." });
          return false;
        }
        importManager.handleImportData(message, sendResponse);
        return true;
      case "importDatabaseFile":
        handleImportDatabaseFile(message, sendResponse);
        return true;
      case "getConfig":
        handleGetConfig(sendResponse);
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
      default:
        console.warn("[MessageHandler] Unknown action received:", message.action);
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
        console.error("[MessageHandler] Failed to log uncaught error to DB:", logDbError);
      }
    }
    try {
      sendResponse({
        success: false,
        error: `Internal server error processing action ${message?.action}`,
      });
    } catch (sendError) {
      console.error("[MessageHandler] Failed to send error response:", sendError);
    }
    return false;
  }
}

async function handleGetRequests(message, sendResponse) {
  console.log("[MessageHandler] handleGetRequests: Called with filters:", message.filters);
  try {
    const { filters, page = 1, limit = 50, sortBy, sortOrder } = message;
    const result = await dbManager.getRequests(filters, page, limit, sortBy, sortOrder);
    console.log(`[MessageHandler] handleGetRequests: Retrieved ${result.requests?.length} requests.`);
    sendResponse({ success: true, ...result });
  } catch (error) {
    console.error("[MessageHandler] handleGetRequests: Error getting requests:", error);
    const apiError = new DatabaseError("Error getting requests", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleClearRequests(sendResponse) {
  console.log("[MessageHandler] handleClearRequests: Called");
  try {
    if (typeof dbManager.clearRequests !== "function") {
      throw new Error("dbManager.clearRequests is not a function");
    }
    await dbManager.clearRequests();
    console.log("[MessageHandler] handleClearRequests: Requests cleared successfully.");
    sendResponse({ success: true });
  } catch (error) {
    console.error("[MessageHandler] handleClearRequests: Error clearing requests:", error);
    const apiError = new DatabaseError("Error clearing requests", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetRequestHeaders(message, sendResponse) {
  console.log("[MessageHandler] handleGetRequestHeaders: Called for requestId:", message.requestId);
  try {
    if (typeof dbManager.getRequestHeaders !== "function") {
      throw new Error("dbManager.getRequestHeaders is not a function");
    }
    const headers = await dbManager.getRequestHeaders(message.requestId);
    console.log("[MessageHandler] handleGetRequestHeaders: Retrieved headers:", headers);
    sendResponse({ success: true, headers });
  } catch (error) {
    console.error("[MessageHandler] handleGetRequestHeaders: Error getting headers:", error);
    const apiError = new DatabaseError("Error getting request headers", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetDatabaseInfo(sendResponse) {
  console.log("[MessageHandler] handleGetDatabaseInfo: Called");
  try {
    if (typeof dbManager.getDatabaseInfo !== "function") {
      throw new Error("dbManager.getDatabaseInfo is not a function");
    }
    const info = await dbManager.getDatabaseInfo();
    console.log("[MessageHandler] handleGetDatabaseInfo: Retrieved info:", info);
    sendResponse({ success: true, info });
  } catch (error) {
    console.error("[MessageHandler] handleGetDatabaseInfo: Error getting database info:", error);
    const apiError = new DatabaseError("Error getting database info", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetStats(sendResponse) {
  console.log("[MessageHandler] handleGetStats: Called");
  try {
    if (typeof dbManager.getDatabaseStats !== "function") {
      throw new Error("dbManager.getDatabaseStats is not a function");
    }
    const stats = await dbManager.getDatabaseStats();
    console.log("[MessageHandler] handleGetStats: Retrieved stats:", stats);
    sendResponse({ success: true, stats });
  } catch (error) {
    console.error("[MessageHandler] handleGetStats: Error getting database stats:", error);
    const apiError = new DatabaseError("Error getting database stats", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetDatabaseSchemaSummary(sendResponse) {
  console.log("[MessageHandler] handleGetDatabaseSchemaSummary: Called");
  try {
    if (typeof dbManager.getDatabaseSchemaSummary !== "function") {
      throw new Error("dbManager.getDatabaseSchemaSummary is not a function");
    }
    const summary = await dbManager.getDatabaseSchemaSummary();
    console.log("[MessageHandler] handleGetDatabaseSchemaSummary: Retrieved summary:", summary);
    sendResponse({ success: true, summary });
  } catch (error) {
    console.error("[MessageHandler] handleGetDatabaseSchemaSummary: Error getting schema summary:", error);
    const apiError = new DatabaseError("Error getting schema summary", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetLoggedErrors(message, sendResponse) {
  console.log("[MessageHandler] handleGetLoggedErrors: Called");
  try {
    if (typeof dbManager.getLoggedErrors !== "function") {
      throw new Error("dbManager.getLoggedErrors is not a function");
    }
    const { limit = 50, offset = 0 } = message;
    const errors = await dbManager.getLoggedErrors(limit, offset);
    console.log(`[MessageHandler] handleGetLoggedErrors: Retrieved ${errors?.length} errors.`);
    sendResponse({ success: true, errors });
  } catch (error) {
    console.error("[MessageHandler] handleGetLoggedErrors: Error getting logged errors:", error);
    const apiError = new DatabaseError("Error getting logged errors", error);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleExecuteRawSql(message, sendResponse) {
  console.log("[MessageHandler] handleExecuteRawSql: Called with SQL:", message.sql);
  try {
    if (typeof dbManager.executeRawSql !== "function") {
      throw new Error("dbManager.executeRawSql is not a function");
    }
    const { sql, params } = message;

    let allowExecution = false;
    if (configManager && typeof configManager.getConfigValue === "function") {
      try {
        allowExecution = await configManager.getConfigValue("allowRawSqlExecution");
      } catch (configError) {
        console.warn("[MessageHandler] Failed to get 'allowRawSqlExecution' config:", configError);
      }
    }

    const lowerSql = sql.toLowerCase().trim();
    const isModificationQuery =
      lowerSql.startsWith("insert") ||
      lowerSql.startsWith("update") ||
      lowerSql.startsWith("delete") ||
      lowerSql.startsWith("drop") ||
      lowerSql.startsWith("alter");

    if (isModificationQuery && !allowExecution) {
      throw new Error("Raw SQL execution for modification queries is disabled in configuration.");
    }

    const result = await dbManager.executeRawSql(sql, params);
    console.log("[MessageHandler] handleExecuteRawSql: Execution successful.");
    sendResponse({ success: true, result });
  } catch (error) {
    console.error("[MessageHandler] handleExecuteRawSql: Error executing raw SQL:", error);
    const apiError = new DatabaseError("Error executing raw SQL", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetDistinctValues(message, sendResponse) {
  console.log("[MessageHandler] handleGetDistinctValues: Called for field:", message.field);
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

async function handleGetFilteredStats(message, sendResponse) {
  console.log("[MessageHandler] handleGetFilteredStats: Called with filters:", message.filters);
  try {
    if (typeof dbManager.getFilteredStats !== "function") {
      throw new Error("dbManager.getFilteredStats is not a function");
    }
    const { filters } = message;
    const stats = await dbManager.getFilteredStats(filters);
    sendResponse({ success: true, stats });
  } catch (error) {
    console.error("[MessageHandler] Error getting filtered stats:", error);
    const apiError = new DatabaseError("Error getting filtered stats", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleExportData(message, sendResponse) {
  console.log("[MessageHandler] handleExportData: Called with format:", message.format);
  if (!exportManager || typeof exportManager.handleExportData !== "function") {
    console.error("[MessageHandler] exportManager or handleExportData not available.");
    sendResponse({ success: false, error: "Export manager not ready." });
    return;
  }
  try {
    await exportManager.handleExportData(message, sendResponse);
  } catch (error) {
    console.error("[MessageHandler] handleExportData: Error exporting data:", error);
    const apiError = new Error(`Error exporting data: ${error.message}`);
    if (logErrorToDb) await logErrorToDb(apiError);
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
    sendResponse({ success: true, message: "Database imported successfully. Reload might be required." });
  } catch (error) {
    console.error("[MessageHandler] Error importing database file:", error);
    const apiError = new DatabaseError("Error importing database file", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleGetConfig(sendResponse) {
  console.log("[MessageHandler] handleGetConfig: Called");
  if (!configManager || typeof configManager.getConfig !== "function") {
    console.error("[MessageHandler] configManager or getConfig not available.");
    sendResponse({ success: false, error: "Configuration manager not ready." });
    return;
  }
  try {
    const config = await configManager.getConfig();
    console.log("[MessageHandler] handleGetConfig: Retrieved config:", config);
    sendResponse({ success: true, config });
  } catch (error) {
    console.error("[MessageHandler] handleGetConfig: Error getting config:", error);
    const apiError = new ConfigError("Error getting configuration", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleUpdateConfig(message, sendResponse) {
  console.log("[MessageHandler] handleUpdateConfig: Called with data:", message.data);
  if (!configManager || typeof configManager.updateConfig !== "function") {
    console.error("[MessageHandler] configManager or updateConfig not available.");
    sendResponse({ success: false, error: "Configuration manager not ready." });
    return;
  }
  try {
    await configManager.updateConfig(message.data);
    console.log("[MessageHandler] handleUpdateConfig: Config updated successfully.");
    const updatedConfig = await configManager.getConfig();
    sendResponse({ success: true, config: updatedConfig });
  } catch (error) {
    console.error("[MessageHandler] handleUpdateConfig: Error updating config:", error);
    const apiError = new ConfigError("Error updating configuration", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleCheckAuth(sendResponse) {
  console.log("[MessageHandler] handleCheckAuth: Called");
  if (!authManager || typeof authManager.isAuthenticated !== "function") {
    console.error("[MessageHandler] authManager or isAuthenticated not available.");
    sendResponse({ success: true, isAuthenticated: false, error: "Authentication manager not ready." });
    return;
  }
  try {
    const isAuthenticated = await authManager.isAuthenticated();
    console.log("[MessageHandler] handleCheckAuth: Status:", isAuthenticated);
    sendResponse({ success: true, isAuthenticated });
  } catch (error) {
    console.error("[MessageHandler] handleCheckAuth: Error checking auth status:", error);
    const apiError = new AuthError("Error checking authentication status", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message, isAuthenticated: false });
  }
}

async function handleLogin(message, sendResponse) {
  console.log("[MessageHandler] handleLogin: Called");
  if (!authManager || typeof authManager.login !== "function") {
    console.error("[MessageHandler] authManager or login not available.");
    sendResponse({ success: false, error: "Authentication manager not ready." });
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
    sendResponse({ success: false, error: "Authentication manager not ready." });
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
    console.error("[MessageHandler] encryptionManager or encrypt not available.");
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
    console.error("[MessageHandler] handleEncryptData: Error encrypting data:", error);
    const apiError = new EncryptionError("Encryption failed", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}

async function handleDecryptData(message, sendResponse) {
  console.log("[MessageHandler] handleDecryptData: Called");
  if (!encryptionManager || typeof encryptionManager.decrypt !== "function") {
    console.error("[MessageHandler] encryptionManager or decrypt not available.");
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
    console.error("[MessageHandler] handleDecryptData: Error decrypting data:", error);
    const apiError = new EncryptionError("Decryption failed", error);
    if (logErrorToDb) await logErrorToDb(apiError);
    sendResponse({ success: false, error: apiError.message });
  }
}
