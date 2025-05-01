import { setupImportManager } from "./import/import-manager.js";
import { setupApiEndpoints } from "./api/api-manager.js"; // Assuming API manager exists

let dbManager;
let configManager;
let captureManager;
let exportManager;
let importManager;
let authManager;
let encryptionManager;
let errorMonitor;
let apiManager; // Assuming API manager exists

export function setupMessageHandler(
  dbMgr,
  cfgMgr,
  captureMgr,
  exportMgr,
  importMgr,
  authMgr,
  encMgr,
  errMonitor,
  apiMgr // Assuming API manager exists
) {
  dbManager = dbMgr;
  configManager = cfgMgr;
  captureManager = captureMgr;
  exportManager = exportMgr;
  importManager = importMgr;
  authManager = authMgr;
  encryptionManager = encMgr;
  errorMonitor = errMonitor;
  apiManager = apiMgr; // Store API manager

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender, sendResponse);
    // Indicate that the response will be sent asynchronously
    return true;
  });

  // Handle external messages (e.g., from web pages via content scripts)
  chrome.runtime.onMessageExternal.addListener(
    (request, sender, sendResponse) => {
      // Delegate to API manager if it exists and handles external requests
      if (apiManager && typeof apiManager.handleApiRequest === "function") {
        const response = apiManager.handleApiRequest(request, sender);
        sendResponse(response);
      } else {
        console.warn("Received external message but no API manager configured.");
        sendResponse({ error: "API not available" });
      }
      return true; // Indicate async response
    }
  );

  console.log("Message handler initialized");
}

async function handleMessage(request, sender, sendResponse) {
  console.log("Received message:", request.action, request); // Log received action

  try {
    let response = { success: true }; // Default success response

    switch (request.action) {
      // ... existing cases ...
      case "getDbStats": // Renamed from getDatabaseStats for consistency? Or keep original? Let's assume getDbStats is used by options.js
      case "getDatabaseStats": // Handle both potential names
        response.stats = await dbManager.getDatabaseStats();
        break;
      case "clearRequests":
        await dbManager.clearDatabase();
        break;
      case "exportData":
        response = await exportManager.exportData(request); // Pass full request options
        break;
      case "importData":
        response.importedCount = await importManager.importData(
          request.format,
          request.data
        );
        break;
      case "importDatabaseFile": // Handle SQLite file import separately
         await dbManager.replaceDatabase(request.data); // Assuming data is ArrayBuffer
         // Optionally re-initialize or reload parts of the extension
         // response.needsReload = true; // Inform the caller if needed
         break;
      case "getNetworkStats": // Example: Placeholder for devtools stats
        // response.stats = await getNetworkStats(); // Implement this function
        response.stats = { timestamps: [], responseTimes: [] }; // Placeholder
        break;
      case "getPerformanceStats": // Example: Placeholder for devtools stats
        // response.stats = await getPerformanceStats(); // Implement this function
        response.stats = { timestamps: [], responseTimes: [] }; // Placeholder
        break;
      case "logErrorToDb": // Action called by error-monitor if no direct DB access
        if (request.errorData) {
          dbManager.logErrorToDatabase(request.errorData); // Log the error passed in the message
        } else {
          response = { success: false, error: "No error data provided" };
        }
        break;

      // Added Actions:
      case "getDbSchemaSummary":
        response.summary = await dbManager.getDatabaseSchemaSummary();
        break;
      case "getLoggedErrors":
        response.errors = await dbManager.getLoggedErrors(request.limit || 100);
        break;
      case "executeRawSql":
        if (typeof request.sql !== 'string' || request.sql.trim() === '') {
           throw new Error("SQL query must be a non-empty string.");
        }
        response.results = await dbManager.executeRawSql(request.sql);
        break;

      default:
        console.warn(`Unknown action: ${request.action}`);
        response = { success: false, error: `Unknown action: ${request.action}` };
    }

    console.log("Sending response for:", request.action, response);
    sendResponse(response);
  } catch (error) {
    console.error(`Error handling action ${request.action}:`, error);
    // Ensure error details are sent back for debugging
    sendResponse({
      success: false,
      error: error.message || "An unknown error occurred",
      stack: error.stack, // Include stack trace if available
      details: error instanceof DatabaseError ? error.originalError : null // Include original error if DatabaseError
    });
  }
}

// Placeholder/Example functions (implement these based on actual needs)
// async function getNetworkStats() { return { timestamps: [], responseTimes: [] }; }
// async function getPerformanceStats() { return { timestamps: [], responseTimes: [] }; }