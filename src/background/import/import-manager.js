import { parse as parseCsv } from 'papaparse'; // Assuming papaparse is installed or available
import { initSqlJs } from "../database/sql-js-loader.js"; // Corrected import

let dbManagerInstance = null;
let sqlJs = null;

export function setupImportManager(dbManager) {
  dbManagerInstance = dbManager;
  // Use the correct function name here
  initSqlJs().then(SQL => {
    sqlJs = SQL;
    console.log("SQL.js loaded for import manager.");
  }).catch(err => {
    console.error("Failed to load SQL.js for import:", err);
  });
}

export async function handleImportData(request) {
  if (!dbManagerInstance) {
    console.error("Import Manager: DB Manager not initialized.");
    return { success: false, error: "Database not ready" };
  }

  const { format, data } = request;
  let parsedData = null;
  let importResult = { success: false, error: "Unknown error" };

  try {
    switch (format) {
      case 'json':
        parsedData = parseJsonImport(data);
        break;
      case 'csv':
        parsedData = parseCsvImport(data);
        break;
      case 'sqlite':
        if (!sqlJs) {
          return { success: false, error: "SQL.js not loaded yet" };
        }
        parsedData = await parseSqliteImport(data);
        break;
      default:
        return { success: false, error: `Unsupported import format: ${format}` };
    }

    if (parsedData && parsedData.length > 0) {
      // Transform data for bulk insertion
      const dataToSave = transformForBulkSave(parsedData);

      if (dataToSave.requests.length > 0) {
          // Call the correct DB function
          importResult = await dbManagerInstance.saveImportedData(dataToSave);
          console.log(`Import successful: ${importResult.count} requests imported from ${format}.`);
      } else {
          console.warn("No valid requests found after transformation.");
          importResult = { success: true, count: 0, message: "No valid requests found to import." };
      }

    } else if (!parsedData) {
        // Error during parsing
        return { success: false, error: "Failed to parse import data." };
    } else {
        // Parsed data is empty
        console.log("No data found in the imported file.");
        importResult = { success: true, count: 0, message: "No data found in the imported file." };
    }

    return importResult;

  } catch (error) {
    console.error(`Error importing data from ${format}:`, error);
    return { success: false, error: `Import failed: ${error.message}` };
  }
}

function parseJsonImport(jsonDataString) {
  try {
    const data = JSON.parse(jsonDataString);
    // Assuming the JSON is an array of request objects matching the export format
    if (Array.isArray(data)) {
      return data;
    } else if (data && typeof data === 'object' && Array.isArray(data.requests)) {
      // Handle potential wrapper object like { requests: [...] }
      return data.requests;
    } else {
      console.error("Invalid JSON import format. Expected an array of requests.");
      return null;
    }
  } catch (error) {
    console.error("Failed to parse JSON import data:", error);
    return null;
  }
}

function parseCsvImport(csvDataString) {
  try {
    const results = parseCsv(csvDataString, {
      header: true, // Assumes first row is header
      skipEmptyLines: true,
      dynamicTyping: true, // Automatically convert numbers, booleans
    });

    if (results.errors && results.errors.length > 0) {
        console.warn("CSV parsing errors:", results.errors);
        // Decide if partial import is okay or fail entirely
    }

    // Papaparse returns data in results.data
    return results.data;
  } catch (error) {
    console.error("Failed to parse CSV import data:", error);
    return null;
  }
}

async function parseSqliteImport(sqliteDataBuffer) {
  if (!sqlJs) {
    console.error("SQL.js is not loaded.");
    return null;
  }
  try {
    // Use the loaded sqlJs object correctly
    const importedDb = new sqlJs.Database(new Uint8Array(sqliteDataBuffer));
    // Assuming the imported DB has the same 'requests' table structure
    const stmt = importedDb.prepare("SELECT * FROM requests");
    const requests = [];
    while (stmt.step()) {
      requests.push(stmt.getAsObject());
    }
    stmt.free();
    importedDb.close();
    return requests;
  } catch (error) {
    console.error("Failed to parse SQLite import data:", error);
    return null;
  }
}

// Transform parsed data into the structure expected by saveImportedData
function transformForBulkSave(parsedRequests) {
    const requests = [];
    const headers = [];
    const timings = [];

    parsedRequests.forEach(req => {
        const validated = validateAndTransformRequest(req);
        if (validated) {
            requests.push(validated.requestData);
            if (validated.headerData) {
                headers.push(...validated.headerData);
            }
            if (validated.timingData) {
                timings.push(validated.timingData);
            }
        }
    });

    return { requests, headers, timings };
}

// Validate and transform a single request, preparing data for DB insertion
function validateAndTransformRequest(req) {
  if (!req || typeof req !== 'object') return null;

  // Generate a unique ID if one isn't provided or isn't valid
  const requestId = req.id && typeof req.id === 'string' ? req.id : generateId();

  // Basic request data validation and transformation
  const requestData = {
    id: requestId,
    url: req.url || '',
    method: req.method || 'GET',
    type: req.type || 'other',
    status: typeof req.status === 'number' ? req.status : (typeof req.statusCode === 'number' ? req.statusCode : 0),
    statusText: req.statusText || '',
    domain: req.domain || (req.url ? new URL(req.url).hostname : ''),
    path: req.path || (req.url ? new URL(req.url).pathname + new URL(req.url).search : ''),
    startTime: typeof req.startTime === 'number' ? req.startTime : 0,
    endTime: typeof req.endTime === 'number' ? req.endTime : 0,
    duration: typeof req.duration === 'number' ? req.duration : (req.endTime && req.startTime ? req.endTime - req.startTime : 0),
    size: typeof req.size === 'number' ? req.size : 0,
    timestamp: typeof req.timestamp === 'number' ? req.timestamp : Date.now(),
    tabId: typeof req.tabId === 'number' ? req.tabId : 0,
    pageUrl: req.pageUrl || '',
    error: req.error || '',
  };

  // Further validation (e.g., URL format)
  if (!requestData.url || !requestData.url.startsWith('http')) {
      console.warn('Skipping request with invalid URL:', req);
      return null;
  }

  // Prepare header data
  let headerData = [];
  if (req.headers && typeof req.headers === 'object') {
      // Handle headers provided as an object { name: value, ... }
      headerData = Object.entries(req.headers).map(([name, value]) => ({
          requestId: requestId,
          name: name,
          value: String(value) // Ensure value is a string
      }));
  } else if (Array.isArray(req.headers)) {
      // Handle headers provided as an array [{ name: '...', value: '...' }, ...]
      headerData = req.headers.map(h => ({
          requestId: requestId,
          name: h.name,
          value: String(h.value)
      }));
  }

  // Prepare timing data
  let timingData = null;
  const t = req.timings || req; // Timings might be nested or flat
  if (t && (t.dns != null || t.tcp != null || t.ssl != null || t.ttfb != null || t.download != null)) {
      timingData = {
          requestId: requestId,
          dns: typeof t.dns === 'number' ? t.dns : 0,
          tcp: typeof t.tcp === 'number' ? t.tcp : 0,
          ssl: typeof t.ssl === 'number' ? t.ssl : 0,
          ttfb: typeof t.ttfb === 'number' ? t.ttfb : 0,
          download: typeof t.download === 'number' ? t.download : 0,
      };
  }

  return { requestData, headerData, timingData };
}

// Placeholder for ID generation if needed during import
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
