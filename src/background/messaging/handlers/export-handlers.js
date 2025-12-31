/**
 * Export Handlers
 * Handles data export operations (HAR, JSON, CSV, SQLite)
 * Ported from popup-message-handler.js
 */

/**
 * Helper: Calculate CRC32 checksum for ZIP files
 */
function calculateCRC32(bytes) {
  const crcTable = makeCRCTable();
  let crc = 0 ^ -1;

  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

/**
 * Helper: Generate CRC32 lookup table
 */
function makeCRCTable() {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}

/**
 * Helper: Create a simple ZIP archive from an array of files
 * Uses minimal ZIP format (no compression for simplicity)
 */
function createZipArchive(files) {
  const textEncoder = new TextEncoder();
  const centralDirectory = [];
  let offset = 0;
  const fileData = [];

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const contentBytes = textEncoder.encode(file.content);
    const crc32 = calculateCRC32(contentBytes);

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localHeaderView = new DataView(localHeader.buffer);

    localHeaderView.setUint32(0, 0x04034b50, true); // Local file header signature
    localHeaderView.setUint16(4, 10, true); // Version needed to extract
    localHeaderView.setUint16(6, 0, true); // General purpose bit flag
    localHeaderView.setUint16(8, 0, true); // Compression method (0 = no compression)
    localHeaderView.setUint16(10, 0, true); // File modification time
    localHeaderView.setUint16(12, 0, true); // File modification date
    localHeaderView.setUint32(14, crc32, true); // CRC-32
    localHeaderView.setUint32(18, contentBytes.length, true); // Compressed size
    localHeaderView.setUint32(22, contentBytes.length, true); // Uncompressed size
    localHeaderView.setUint16(26, nameBytes.length, true); // File name length
    localHeaderView.setUint16(28, 0, true); // Extra field length

    localHeader.set(nameBytes, 30);
    fileData.push(localHeader, contentBytes);

    // Central directory header
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralHeaderView = new DataView(centralHeader.buffer);

    centralHeaderView.setUint32(0, 0x02014b50, true); // Central directory signature
    centralHeaderView.setUint16(4, 10, true); // Version made by
    centralHeaderView.setUint16(6, 10, true); // Version needed to extract
    centralHeaderView.setUint16(8, 0, true); // General purpose bit flag
    centralHeaderView.setUint16(10, 0, true); // Compression method
    centralHeaderView.setUint16(12, 0, true); // File modification time
    centralHeaderView.setUint16(14, 0, true); // File modification date
    centralHeaderView.setUint32(16, crc32, true); // CRC-32
    centralHeaderView.setUint32(20, contentBytes.length, true); // Compressed size
    centralHeaderView.setUint32(24, contentBytes.length, true); // Uncompressed size
    centralHeaderView.setUint16(28, nameBytes.length, true); // File name length
    centralHeaderView.setUint16(30, 0, true); // Extra field length
    centralHeaderView.setUint16(32, 0, true); // File comment length
    centralHeaderView.setUint16(34, 0, true); // Disk number start
    centralHeaderView.setUint16(36, 0, true); // Internal file attributes
    centralHeaderView.setUint32(38, 0, true); // External file attributes
    centralHeaderView.setUint32(42, offset, true); // Relative offset of local header

    centralHeader.set(nameBytes, 46);
    centralDirectory.push(centralHeader);

    offset += localHeader.length + contentBytes.length;
  }

  // End of central directory record
  const eocdHeader = new Uint8Array(22);
  const eocdView = new DataView(eocdHeader.buffer);
  const centralDirSize = centralDirectory.reduce(
    (sum, dir) => sum + dir.length,
    0
  );

  eocdView.setUint32(0, 0x06054b50, true); // End of central directory signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk where central directory starts
  eocdView.setUint16(8, files.length, true); // Number of central directory records on this disk
  eocdView.setUint16(10, files.length, true); // Total number of central directory records
  eocdView.setUint32(12, centralDirSize, true); // Size of central directory
  eocdView.setUint32(16, offset, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true); // ZIP file comment length

  // Concatenate all parts
  const totalSize =
    fileData.reduce((sum, arr) => sum + arr.length, 0) +
    centralDirSize +
    eocdHeader.length;
  const zipData = new Uint8Array(totalSize);
  let zipOffset = 0;

  for (const data of fileData) {
    zipData.set(data, zipOffset);
    zipOffset += data.length;
  }

  for (const dir of centralDirectory) {
    zipData.set(dir, zipOffset);
    zipOffset += dir.length;
  }

  zipData.set(eocdHeader, zipOffset);

  return zipData;
}

/**
 * Handle export filtered data
 */
async function handleExportFilteredData(filters, format, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    console.warn(
      "handleExportFilteredData: Implementation delegated to specific export handlers"
    );
    return {
      success: true,
      data: {},
      format: format || "json",
      filename: `request-analyzer-export-${Date.now()}.${format || "json"}`,
    };
  } catch (error) {
    console.error("Export error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle export as HAR (HTTP Archive Format)
 */
async function handleExportAsHAR(filters, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { domain, timeRange } = filters || {};

    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const timeRangeMs = timeRange
      ? parseInt(timeRange) * 1000
      : 24 * 60 * 60 * 1000;
    const startTime = Date.now() - timeRangeMs;

    let query = `
      SELECT 
        id, method, url, status, status_text, type, duration,
        size_bytes, from_cache, timestamp, domain, page_url
      FROM bronze_requests
      WHERE timestamp > ${startTime}
    `;

    if (domain && domain !== "all") {
      query += ` AND domain = ${escapeStr(domain)}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT 500`;

    const results = database.db.exec(query);

    if (!results || results.length === 0) {
      return {
        success: true,
        har: {
          log: {
            version: "1.2",
            creator: {
              name: "Universal Request Analyzer",
              version: "1.0.0",
            },
            entries: [],
          },
        },
        count: 0,
      };
    }

    const columns = results[0].columns;
    const rows = results[0].values;

    const requests = rows.map((row) => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    const har = {
      log: {
        version: "1.2",
        creator: {
          name: "Universal Request Analyzer",
          version: "1.0.0",
        },
        browser: {
          name: "Chrome/Firefox/Edge",
          version: "Extension",
        },
        pages: [],
        entries: [],
      },
    };

    // Helper functions
    const parseQueryString = (url) => {
      if (!url) return [];
      try {
        const urlObj = new URL(url);
        const params = [];
        urlObj.searchParams.forEach((value, name) => {
          params.push({ name, value });
        });
        return params;
      } catch {
        return [];
      }
    };

    const getStatusText = (status) => {
      const statusTexts = {
        200: "OK",
        201: "Created",
        204: "No Content",
        301: "Moved Permanently",
        302: "Found",
        304: "Not Modified",
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        500: "Internal Server Error",
        502: "Bad Gateway",
        503: "Service Unavailable",
      };
      return statusTexts[status] || "";
    };

    const getMimeType = (type) => {
      const mimeTypes = {
        script: "application/javascript",
        stylesheet: "text/css",
        image: "image/*",
        font: "font/*",
        document: "text/html",
        xmlhttprequest: "application/json",
        fetch: "application/json",
      };
      return mimeTypes[type] || "application/octet-stream";
    };

    for (const req of requests) {
      const entry = {
        startedDateTime: new Date(req.timestamp).toISOString(),
        time: req.duration || 0,
        request: {
          method: req.method || "GET",
          url: req.url || "",
          httpVersion: "HTTP/1.1",
          cookies: [],
          headers: [],
          queryString: parseQueryString(req.url),
          headersSize: -1,
          bodySize: 0,
        },
        response: {
          status: req.status || 0,
          statusText: req.status_text || getStatusText(req.status),
          httpVersion: "HTTP/1.1",
          cookies: [],
          headers: [],
          content: {
            size: req.size_bytes || 0,
            mimeType: getMimeType(req.type),
            text: "",
          },
          redirectURL: "",
          headersSize: -1,
          bodySize: req.size_bytes || 0,
        },
        cache: {
          beforeRequest: req.from_cache ? {} : null,
          afterRequest: req.from_cache ? {} : null,
        },
        timings: {
          blocked: -1,
          dns: -1,
          connect: -1,
          send: 0,
          wait: req.duration || 0,
          receive: 0,
          ssl: -1,
        },
        serverIPAddress: "",
        connection: "",
        comment: req.domain
          ? `Domain: ${req.domain}, Page: ${req.page_url || "N/A"}`
          : "",
      };

      har.log.entries.push(entry);
    }

    return {
      success: true,
      har: har,
      count: har.log.entries.length,
    };
  } catch (error) {
    console.error("Export HAR error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle export to SQLite
 */
async function handleExportToSQLite(options, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const data = database.db.export();
    const uint8Data = new Uint8Array(data);

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `URA_Export_${timestamp}.sqlite`;

    return {
      success: true,
      data: Array.from(uint8Data),
      filename,
      size: uint8Data.length,
      mimeType: "application/x-sqlite3",
    };
  } catch (error) {
    console.error("[Export] SQLite export error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle export to JSON
 */
async function handleExportToJSON(options, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { tables = null, prettify = true } = options || {};

    const tableNamesResult = database.db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const allTables = tableNamesResult[0]?.values.map((row) => row[0]) || [];
    const tablesToExport = tables || allTables;

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: "1.0.0",
        tables: tablesToExport,
        recordCounts: {},
      },
      database: {},
    };

    for (const tableName of tablesToExport) {
      try {
        const result = database.db.exec(`SELECT * FROM ${tableName}`);

        if (result.length > 0) {
          const columns = result[0].columns;
          const rows = result[0].values.map((row) => {
            const obj = {};
            columns.forEach((col, idx) => {
              obj[col] = row[idx];
            });
            return obj;
          });

          exportData.database[tableName] = rows;
          exportData.metadata.recordCounts[tableName] = rows.length;
        } else {
          exportData.database[tableName] = [];
          exportData.metadata.recordCounts[tableName] = 0;
        }
      } catch (tableError) {
        console.warn(
          `[Export] Failed to export table ${tableName}:`,
          tableError
        );
        exportData.database[tableName] = [];
        exportData.metadata.recordCounts[tableName] = 0;
      }
    }

    const jsonString = JSON.stringify(exportData, null, prettify ? 2 : 0);
    const jsonBytes = new TextEncoder().encode(jsonString);

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `URA_Export_${timestamp}.json`;

    return {
      success: true,
      data: Array.from(jsonBytes),
      filename,
      size: jsonBytes.length,
      mimeType: "application/json",
      tableCount: tablesToExport.length,
      totalRecords: Object.values(exportData.metadata.recordCounts).reduce(
        (a, b) => a + b,
        0
      ),
    };
  } catch (error) {
    console.error("[Export] JSON export error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle export to CSV
 */
async function handleExportToCSV(options, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { tables = null, tableName = null } = options || {};

    if (tableName) {
      const result = database.db.exec(`SELECT * FROM ${tableName}`);

      if (result.length === 0) {
        return {
          success: false,
          error: `Table ${tableName} is empty or does not exist`,
        };
      }

      const columns = result[0].columns;
      const rows = result[0].values;

      let csv = columns.join(",") + "\n";
      for (const row of rows) {
        const escapedRow = row.map((val) => {
          if (val === null) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csv += escapedRow.join(",") + "\n";
      }

      const csvBytes = new TextEncoder().encode(csv);
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `${tableName}_${timestamp}.csv`;

      return {
        success: true,
        data: Array.from(csvBytes),
        filename,
        size: csvBytes.length,
        mimeType: "text/csv",
        recordCount: rows.length,
      };
    }

    const tableNamesResult = database.db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const allTables = tableNamesResult[0]?.values.map((row) => row[0]) || [];

    return {
      success: true,
      message: "Multiple table export requires specifying tableName",
      availableTables: allTables,
      hint: 'Call with { tableName: "table_name" } to export a specific table',
    };
  } catch (error) {
    console.error("[Export] CSV export error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle export all tables to CSV (ZIP archive)
 */
async function handleExportAllTablesToCSV(options, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const tableNamesResult = database.db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const allTables = tableNamesResult[0]?.values.map((row) => row[0]) || [];

    if (allTables.length === 0) {
      return { success: false, error: "No tables found in database" };
    }

    const csvFiles = [];
    for (const tableName of allTables) {
      try {
        const result = database.db.exec(`SELECT * FROM ${tableName}`);

        if (result.length === 0 || result[0].values.length === 0) {
          continue;
        }

        const columns = result[0].columns;
        const rows = result[0].values;

        let csv = columns.join(",") + "\n";
        for (const row of rows) {
          const escapedRow = row.map((val) => {
            if (val === null) return "";
            const str = String(val);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          });
          csv += escapedRow.join(",") + "\n";
        }

        csvFiles.push({
          name: `${tableName}.csv`,
          content: csv,
          recordCount: rows.length,
        });
      } catch (tableError) {
        console.warn(
          `[Export] Failed to export table ${tableName}:`,
          tableError
        );
      }
    }

    if (csvFiles.length === 0) {
      return { success: false, error: "No data to export" };
    }

    const zipData = createZipArchive(csvFiles);

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `URA_Export_${timestamp}.zip`;

    return {
      success: true,
      data: Array.from(zipData),
      filename,
      size: zipData.length,
      mimeType: "application/zip",
      fileCount: csvFiles.length,
      tables: csvFiles.map((f) => ({ name: f.name, records: f.recordCount })),
    };
  } catch (error) {
    console.error("[Export] Multi-table CSV export error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for export operations
 */
export const exportHandlers = new Map([
  [
    "exportFilteredData",
    async (message, sender, context) => {
      return await handleExportFilteredData(
        message.filters,
        message.format,
        context
      );
    },
  ],

  [
    "exportAsHAR",
    async (message, sender, context) => {
      return await handleExportAsHAR(message.filters, context);
    },
  ],

  [
    "exportToSQLite",
    async (message, sender, context) => {
      return await handleExportToSQLite(message.options, context);
    },
  ],

  [
    "exportToJSON",
    async (message, sender, context) => {
      return await handleExportToJSON(message.options, context);
    },
  ],

  [
    "exportToCSV",
    async (message, sender, context) => {
      return await handleExportToCSV(message.options, context);
    },
  ],

  [
    "exportAllTablesToCSV",
    async (message, sender, context) => {
      return await handleExportAllTablesToCSV(message.options, context);
    },
  ],
]);
