/**
 * Message handler for communication with popup and content scripts
 */

import { ApiError } from "../errors/error-types.js";
import { logErrorToDatabase } from "../database/db-manager.js";

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
function handleMessage(message, sender, sendResponse) {
  try {
    // Database-related messages
    if (
      message.action === "getRequests" ||
      message.action === "getRequestsFromDB"
    ) {
      handleGetRequests(message, sendResponse);
      return true; // Keep the message channel open for async response
    } else if (message.action === "clearRequests") {
      handleClearRequests(sendResponse);
      return true;
    } else if (message.action === "getRequestHeaders") {
      handleGetRequestHeaders(message, sendResponse);
      return true;
    } else if (message.action === "getStats") {
      handleGetStats(sendResponse);
      return true;
    } else if (message.action === "getDatabaseInfo") {
      handleGetDatabaseInfo(sendResponse);
      return true;
    } else if (message.action === "getNetworkStats") {
      handleGetNetworkStats(sendResponse);
      return true;
    } else if (message.action === "exportDatabase") {
      const { format, filename } = message;
      try {
        const data = dbManager.exportDatabase(format);
        const blob = new Blob([data], { type: "application/x-sqlite3" });

        // Use a file writer API or alternative method to save the blob
        chrome.fileSystem.chooseEntry(
          { type: "saveFile", suggestedName: filename },
          (fileEntry) => {
            if (chrome.runtime.lastError) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
              return;
            }

            fileEntry.createWriter((fileWriter) => {
              fileWriter.onwriteend = () => {
                sendResponse({ success: true });
              };

              fileWriter.onerror = (error) => {
                console.error("Failed to write file:", error);
                sendResponse({ success: false, error: error.message });
              };

              fileWriter.write(blob);
            });
          }
        );
      } catch (error) {
        console.error("Failed to export database:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Keep the message channel open for async response
    }

    // Export-related messages
    else if (
      message.action === "exportData" &&
      config.export.enableSqliteExport
    ) {
      handleExportData(message, sendResponse);
      return true;
    } else if (message.action === "exportData") {
      sendResponse({ error: "SQLite export is disabled by configuration." });
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

// Handle external messages (from websites)
function handleExternalMessage(message, sender, sendResponse) {
  try {
    // Validate sender
    if (!isValidExternalSender(sender.url)) {
      sendResponse({ error: "Unauthorized sender" });
      return false;
    }

    // API-related messages
    if (message.action === "api:getRequests") {
      handleApiGetRequests(message, sender, sendResponse);
      return true;
    } else if (message.action === "api:getStats") {
      handleApiGetStats(message, sender, sendResponse);
      return true;
    }

    // Unknown action
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

    // Check if domain or subdomain is allowed
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
      lastExport: null, // This would be stored in config
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

// Handle exportData message
function handleExportData(message, sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const { format, filename } = message;

    // Export data
    const data = dbManager.exportDatabase(format);

    // Create blob
    let blob;
    let mimeType;

    switch (format) {
      case "sqlite":
        blob = new Blob([data], { type: "application/x-sqlite3" });
        mimeType = "application/x-sqlite3";
        break;
      case "json":
        blob = new Blob([data], { type: "application/json" });
        mimeType = "application/json";
        break;
      case "csv":
        blob = new Blob([data], { type: "text/csv" });
        mimeType = "text/csv";
        break;
      default:
        sendResponse({ error: `Unsupported format: ${format}` });
        return;
    }

    // Create download URL
    const blobUrl = URL.createObjectURL(blob);

    // Download file
    chrome.downloads.download(
      {
        url: blobUrl,
        filename: `${filename}.${format}`,
        saveAs: true,
        conflictAction: "uniquify",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          // Show notification
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("assets/icons/icon128.png"),
            title: "Export Complete",
            message: `Data exported successfully as ${format.toUpperCase()}`,
            priority: 0,
          });

          // Update last export time in config
          // This would be handled by the config manager

          sendResponse({ success: true, downloadId });
        }
      }
    );
  } catch (error) {
    console.error("Error exporting data:", error);
    sendResponse({ error: error.message });
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
      // Publish config updated event
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

    // Extract values from result
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
    // Query for paths that look like APIs
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

    // Extract paths from result
    const paths = result[0].values.map((row) => row[0]);

    sendResponse({ paths });
  } catch (error) {
    console.error("Error getting API paths:", error);
    sendResponse({ error: error.message });
  }
}

// Handle getFilteredStats message
function handleGetFilteredStats(message, sendResponse) {
  if (!dbManager) {
    sendResponse({ error: "Database not initialized" });
    return;
  }

  try {
    const filters = message.filters || {};

    // Build WHERE clause based on filters
    let whereClause = "1=1";
    const params = [];

    if (filters.domain) {
      whereClause += " AND domain = ?";
      params.push(filters.domain);
    }

    if (filters.pageUrl) {
      whereClause += " AND pageUrl = ?";
      params.push(filters.pageUrl);
    }

    if (filters.path) {
      whereClause += " AND path = ?";
      params.push(filters.path);
    }

    if (filters.method) {
      whereClause += " AND method = ?";
      params.push(filters.method);
    }

    if (filters.status) {
      whereClause += " AND status = ?";
      params.push(filters.status);
    }

    if (filters.statusPrefix) {
      whereClause += " AND status >= ? AND status < ?";
      params.push(Number.parseInt(filters.statusPrefix) * 100);
      params.push((Number.parseInt(filters.statusPrefix) + 1) * 100);
    }

    if (filters.startDate) {
      whereClause += " AND timestamp >= ?";
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += " AND timestamp <= ?";
      params.push(filters.endDate);
    }

    // Get total requests
    const totalResult = dbManager.executeQuery(
      `SELECT COUNT(*) FROM requests WHERE ${whereClause}`,
      params
    );

    const totalRequests = totalResult[0] ? totalResult[0].values[0][0] : 0;

    // Get average response time
    const avgTimeResult = dbManager.executeQuery(
      `SELECT AVG(duration) FROM requests WHERE ${whereClause} AND duration > 0`,
      params
    );

    const avgResponseTime = avgTimeResult[0]
      ? Math.round(avgTimeResult[0].values[0][0] || 0)
      : 0;

    // Get success rate
    const successResult = dbManager.executeQuery(
      `SELECT COUNT(*) FROM requests WHERE ${whereClause} AND status >= 200 AND status < 400`,
      params
    );

    const successCount = successResult[0] ? successResult[0].values[0][0] : 0;
    const successRate =
      totalRequests > 0 ? Math.round((successCount / totalRequests) * 100) : 0;

    // Get status code distribution
    const statusResult = dbManager.executeQuery(
      `SELECT status, COUNT(*) as count
       FROM requests
       WHERE ${whereClause} AND status > 0
       GROUP BY status
       ORDER BY count DESC`,
      params
    );

    const statusCodes = {};
    if (statusResult[0]) {
      statusResult[0].values.forEach((row) => {
        statusCodes[row[0]] = row[1];
      });
    }

    // Get request type distribution
    const typeResult = dbManager.executeQuery(
      `SELECT type, COUNT(*) as count
       FROM requests
       WHERE ${whereClause}
       GROUP BY type
       ORDER BY count DESC`,
      params
    );

    const requestTypes = {};
    if (typeResult[0]) {
      typeResult[0].values.forEach((row) => {
        requestTypes[row[0]] = row[1];
      });
    }

    // Get time distribution (last 24 hours by hour)
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const timeResult = dbManager.executeQuery(
      `SELECT 
         CAST((timestamp - ${oneDayAgo}) / (3600 * 1000) AS INTEGER) as hour,
         COUNT(*) as count
       FROM requests
       WHERE ${whereClause} AND timestamp >= ${oneDayAgo}
       GROUP BY hour
       ORDER BY hour`,
      params
    );

    const timeDistribution = {};
    // Initialize all hours with 0
    for (let i = 0; i < 24; i++) {
      timeDistribution[i] = 0;
    }

    // Fill in actual data
    if (timeResult[0]) {
      timeResult[0].values.forEach((row) => {
        const hour = Math.min(Math.max(0, row[0]), 23);
        timeDistribution[hour] = row[1];
      });
    }

    // Get response times for histogram
    const responseTimeResult = dbManager.executeQuery(
      `SELECT duration
       FROM requests
       WHERE ${whereClause} AND duration > 0
       ORDER BY duration`,
      params
    );

    const responseTimes = responseTimeResult[0]
      ? responseTimeResult[0].values.map((row) => row[0])
      : [];

    // Get response sizes for histogram
    const sizeResult = dbManager.executeQuery(
      `SELECT size
       FROM requests
       WHERE ${whereClause} AND size > 0
       ORDER BY size`,
      params
    );

    const sizes = sizeResult[0]
      ? sizeResult[0].values.map((row) => row[0])
      : [];

    // Get average size
    const avgSizeResult = dbManager.executeQuery(
      `SELECT AVG(size) FROM requests WHERE ${whereClause} AND size > 0`,
      params
    );

    const avgSize = avgSizeResult[0]
      ? Math.round(avgSizeResult[0].values[0][0] || 0)
      : 0;

    // Return all stats
    sendResponse({
      totalRequests,
      avgResponseTime,
      successRate,
      statusCodes,
      requestTypes,
      timeDistribution,
      responseTimes,
      sizes,
      avgSize,
      filters: message.filters,
    });
  } catch (error) {
    console.error("Error getting filtered stats:", error);
    sendResponse({ error: error.message });
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
