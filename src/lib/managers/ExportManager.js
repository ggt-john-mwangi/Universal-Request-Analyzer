/**
 * ExportManager - Shared export/import functionality
 * Consolidates duplicate export functionality
 */

import { formatTimestamp, downloadFile } from '../utils/helpers.js';

export class ExportManager {
  constructor(options = {}) {
    this.options = {
      appName: options.appName || 'Universal Request Analyzer',
      defaultFormat: options.defaultFormat || 'json',
      compression: options.compression !== false,
      includeMetadata: options.includeMetadata !== false
    };
  }

  /**
   * Export data in specified format
   */
  async export(data, format, filename) {
    const exportFn = this.getExportFunction(format);
    
    if (!exportFn) {
      throw new Error(`Unsupported export format: ${format}`);
    }

    const exportedData = await exportFn(data);
    const finalFilename = filename || this.generateFilename(format);
    
    downloadFile(exportedData, finalFilename, this.getMimeType(format));
    
    return {
      format,
      filename: finalFilename,
      size: exportedData.length
    };
  }

  /**
   * Export as JSON
   */
  async exportJSON(data) {
    const exportData = this.options.includeMetadata 
      ? this.addMetadata(data)
      : data;

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export as CSV
   */
  async exportCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('CSV export requires array of objects');
    }

    // Get all unique keys from all objects
    const keys = [...new Set(data.flatMap(Object.keys))];
    
    // Create header row
    const header = keys.join(',');
    
    // Create data rows
    const rows = data.map(item => {
      return keys.map(key => {
        const value = item[key];
        
        // Handle different value types
        if (value === null || value === undefined) {
          return '';
        }
        
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        
        const stringValue = String(value);
        
        // Escape values containing commas or quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
      }).join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Export as HAR (HTTP Archive)
   */
  async exportHAR(requests) {
    if (!Array.isArray(requests)) {
      throw new Error('HAR export requires array of requests');
    }

    const har = {
      log: {
        version: '1.2',
        creator: {
          name: this.options.appName,
          version: '1.0.0'
        },
        entries: requests.map(req => this.requestToHAREntry(req))
      }
    };

    return JSON.stringify(har, null, 2);
  }

  /**
   * Convert request to HAR entry format
   */
  requestToHAREntry(request) {
    return {
      startedDateTime: new Date(request.timestamp || Date.now()).toISOString(),
      time: request.duration || 0,
      request: {
        method: request.method || 'GET',
        url: request.url || '',
        httpVersion: 'HTTP/1.1',
        headers: this.convertHeaders(request.requestHeaders),
        queryString: this.parseQueryString(request.url),
        cookies: [],
        headersSize: -1,
        bodySize: -1
      },
      response: {
        status: request.status || 0,
        statusText: request.statusText || '',
        httpVersion: 'HTTP/1.1',
        headers: this.convertHeaders(request.responseHeaders),
        cookies: [],
        content: {
          size: request.size || 0,
          mimeType: request.type || 'application/octet-stream'
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: request.size || 0
      },
      cache: {},
      timings: {
        blocked: -1,
        dns: request.timings?.dns || -1,
        connect: request.timings?.tcp || -1,
        send: 0,
        wait: request.timings?.ttfb || -1,
        receive: request.timings?.download || -1,
        ssl: request.timings?.ssl || -1
      }
    };
  }

  /**
   * Convert headers to HAR format
   */
  convertHeaders(headers) {
    if (!headers) return [];
    
    if (Array.isArray(headers)) {
      return headers.map(h => ({
        name: h.name,
        value: h.value
      }));
    }
    
    if (typeof headers === 'object') {
      return Object.entries(headers).map(([name, value]) => ({
        name,
        value: String(value)
      }));
    }
    
    return [];
  }

  /**
   * Parse query string from URL
   */
  parseQueryString(url) {
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
  }

  /**
   * Import data from file
   */
  async import(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const format = this.detectFormat(file.name, content);
          const parseFn = this.getImportFunction(format);
          
          if (!parseFn) {
            reject(new Error(`Unsupported import format: ${format}`));
            return;
          }
          
          const data = parseFn(content);
          resolve({
            format,
            data,
            filename: file.name,
            size: file.size
          });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Import JSON
   */
  importJSON(content) {
    const data = JSON.parse(content);
    
    // Check if data has metadata wrapper
    if (data.metadata && data.data) {
      return data.data;
    }
    
    return data;
  }

  /**
   * Import CSV
   */
  importCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return [];
    }
    
    const headers = this.parseCSVLine(lines[0]);
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const obj = {};
      
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      
      data.push(obj);
    }
    
    return data;
  }

  /**
   * Parse CSV line handling quoted values
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current);
    return values;
  }

  /**
   * Import HAR
   */
  importHAR(content) {
    const har = JSON.parse(content);
    
    if (!har.log || !har.log.entries) {
      throw new Error('Invalid HAR format');
    }
    
    return har.log.entries.map(entry => this.harEntryToRequest(entry));
  }

  /**
   * Convert HAR entry to request format
   */
  harEntryToRequest(entry) {
    return {
      url: entry.request.url,
      method: entry.request.method,
      status: entry.response.status,
      statusText: entry.response.statusText,
      type: entry.response.content.mimeType,
      size: entry.response.content.size,
      duration: entry.time,
      timestamp: new Date(entry.startedDateTime).getTime(),
      requestHeaders: entry.request.headers,
      responseHeaders: entry.response.headers,
      timings: {
        dns: entry.timings.dns,
        tcp: entry.timings.connect,
        ssl: entry.timings.ssl,
        ttfb: entry.timings.wait,
        download: entry.timings.receive
      }
    };
  }

  /**
   * Add metadata to export
   */
  addMetadata(data) {
    return {
      metadata: {
        version: '1.0.0',
        exported: new Date().toISOString(),
        exportedBy: this.options.appName,
        count: Array.isArray(data) ? data.length : 1
      },
      data
    };
  }

  /**
   * Generate filename
   */
  generateFilename(format) {
    const timestamp = formatTimestamp(Date.now(), 'short').replace(/[/:\s]/g, '-');
    return `export-${timestamp}.${format}`;
  }

  /**
   * Detect format from filename or content
   */
  detectFormat(filename, content) {
    const ext = filename.split('.').pop().toLowerCase();
    
    // Check extension
    if (['json', 'csv', 'har'].includes(ext)) {
      return ext;
    }
    
    // Try to detect from content
    try {
      const parsed = JSON.parse(content);
      if (parsed.log && parsed.log.entries) {
        return 'har';
      }
      return 'json';
    } catch {
      return 'csv';
    }
  }

  /**
   * Get export function for format
   */
  getExportFunction(format) {
    const exportFunctions = {
      json: this.exportJSON.bind(this),
      csv: this.exportCSV.bind(this),
      har: this.exportHAR.bind(this)
    };
    
    return exportFunctions[format];
  }

  /**
   * Get import function for format
   */
  getImportFunction(format) {
    const importFunctions = {
      json: this.importJSON.bind(this),
      csv: this.importCSV.bind(this),
      har: this.importHAR.bind(this)
    };
    
    return importFunctions[format];
  }

  /**
   * Get MIME type for format
   */
  getMimeType(format) {
    const mimeTypes = {
      json: 'application/json',
      csv: 'text/csv',
      har: 'application/json'
    };
    
    return mimeTypes[format] || 'text/plain';
  }
}

/**
 * Factory function to create export manager
 */
export function createExportManager(options) {
  return new ExportManager(options);
}
