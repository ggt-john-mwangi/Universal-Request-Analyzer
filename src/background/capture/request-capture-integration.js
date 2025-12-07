// Request Capture Integration with Medallion Architecture
// Integrates browser request capture with Bronze layer storage

import { generateId } from "../utils/id-generator.js";
import { parseUrl } from "../utils/url-utils.js";

/**
 * RequestCaptureIntegration - Bridges request capture and medallion storage
 */
export class RequestCaptureIntegration {
  constructor(dbManager, eventBus, config) {
    this.dbManager = dbManager;
    this.eventBus = eventBus;
    this.config = config;
    this.pendingRequests = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Initialize request capture listeners
   */
  initialize() {
    // Listen for webRequest events
    if (typeof chrome !== 'undefined' && chrome.webRequest) {
      this.setupWebRequestListeners();
    }

    // Listen for performance entries
    this.setupPerformanceListener();

    console.log('Request capture integration initialized');
  }

  /**
   * Setup webRequest API listeners
   */
  setupWebRequestListeners() {
    const filters = {
      urls: this.config?.filters?.includePatterns || ['<all_urls>']
    };

    // Capture request start
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.handleRequestStart(details),
      filters,
      ['requestBody']
    );

    // Capture request headers
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => this.handleRequestHeaders(details),
      filters,
      ['requestHeaders']
    );

    // Capture response headers
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => this.handleResponseHeaders(details),
      filters,
      ['responseHeaders']
    );

    // Capture request completion
    chrome.webRequest.onCompleted.addListener(
      (details) => this.handleRequestComplete(details),
      filters,
      ['responseHeaders']
    );

    // Capture request errors
    chrome.webRequest.onErrorOccurred.addListener(
      (details) => this.handleRequestError(details),
      filters
    );
  }

  /**
   * Setup performance API listener
   */
  setupPerformanceListener() {
    this.eventBus?.subscribe('performance:entry', (data) => {
      this.handlePerformanceEntry(data);
    });
  }

  /**
   * Handle request start
   */
  handleRequestStart(details) {
    try {
      const requestId = details.requestId.toString();
      const timestamp = Date.now();
      const urlParts = parseUrl(details.url);

      const requestData = {
        id: requestId,
        url: details.url,
        method: details.method,
        type: details.type,
        tabId: details.tabId,
        frameId: details.frameId,
        initiator: details.initiator,
        timestamp,
        startTime: details.timeStamp,
        domain: urlParts?.hostname || '',
        path: urlParts?.pathname || '',
        queryString: urlParts?.search || '',
        protocol: urlParts?.protocol || '',
        requestBody: details.requestBody ? JSON.stringify(details.requestBody) : null
      };

      // Store in pending requests
      this.pendingRequests.set(requestId, requestData);

      // Emit event
      this.eventBus?.publish('request:started', { requestId, timestamp });
    } catch (error) {
      console.error('Error handling request start:', error);
    }
  }

  /**
   * Handle request headers
   */
  handleRequestHeaders(details) {
    const requestId = details.requestId.toString();
    const pending = this.pendingRequests.get(requestId);

    if (pending) {
      pending.requestHeaders = details.requestHeaders || [];
    }
  }

  /**
   * Handle response headers
   */
  handleResponseHeaders(details) {
    const requestId = details.requestId.toString();
    const pending = this.pendingRequests.get(requestId);

    if (pending) {
      pending.status = details.statusCode;
      pending.statusText = details.statusLine;
      pending.responseHeaders = details.responseHeaders || [];
      
      // Extract content length
      const contentLength = details.responseHeaders?.find(
        h => h.name.toLowerCase() === 'content-length'
      );
      if (contentLength) {
        pending.sizeBytes = parseInt(contentLength.value, 10);
      }
    }
  }

  /**
   * Handle request completion
   */
  async handleRequestComplete(details) {
    try {
      const requestId = details.requestId.toString();
      const pending = this.pendingRequests.get(requestId);

      if (!pending) {
        return;
      }

      const endTime = Date.now();
      pending.endTime = details.timeStamp;
      pending.duration = pending.endTime - pending.startTime;
      pending.status = details.statusCode;
      pending.fromCache = details.fromCache || false;

      // Get performance metrics if available
      const perfMetrics = this.performanceMetrics.get(requestId);

      // Save to Bronze layer
      await this.saveToBronze(pending, perfMetrics);

      // Cleanup
      this.pendingRequests.delete(requestId);
      this.performanceMetrics.delete(requestId);

      // Emit event
      this.eventBus?.publish('request:completed', { 
        requestId, 
        duration: pending.duration 
      });
    } catch (error) {
      console.error('Error handling request completion:', error);
      
      // Log error to Bronze
      await this.logErrorToBronze(error, details.requestId.toString());
    }
  }

  /**
   * Handle request error
   */
  async handleRequestError(details) {
    try {
      const requestId = details.requestId.toString();
      const pending = this.pendingRequests.get(requestId);

      if (pending) {
        pending.error = details.error;
        pending.endTime = Date.now();
        pending.duration = pending.endTime - pending.startTime;

        // Save to Bronze layer
        await this.saveToBronze(pending);

        // Log error
        await this.logErrorToBronze(new Error(details.error), requestId);
      }

      // Cleanup
      this.pendingRequests.delete(requestId);
      this.performanceMetrics.delete(requestId);

      // Emit event
      this.eventBus?.publish('request:error', { 
        requestId, 
        error: details.error 
      });
    } catch (error) {
      console.error('Error handling request error:', error);
    }
  }

  /**
   * Handle performance entry
   */
  handlePerformanceEntry(data) {
    const { requestId, entry } = data;
    
    if (!requestId || !entry) {
      return;
    }

    const timings = {
      dnsStart: entry.domainLookupStart,
      dnsEnd: entry.domainLookupEnd,
      dnsDuration: entry.domainLookupEnd - entry.domainLookupStart,
      tcpStart: entry.connectStart,
      tcpEnd: entry.connectEnd,
      tcpDuration: entry.connectEnd - entry.connectStart,
      sslStart: entry.secureConnectionStart,
      sslEnd: entry.connectEnd,
      sslDuration: entry.secureConnectionStart > 0 
        ? entry.connectEnd - entry.secureConnectionStart 
        : 0,
      requestStart: entry.requestStart,
      requestEnd: entry.responseStart,
      requestDuration: entry.responseStart - entry.requestStart,
      responseStart: entry.responseStart,
      responseEnd: entry.responseEnd,
      responseDuration: entry.responseEnd - entry.responseStart
    };

    this.performanceMetrics.set(requestId, timings);
  }

  /**
   * Save request to Bronze layer
   */
  async saveToBronze(requestData, perfMetrics = null) {
    try {
      if (!this.dbManager?.medallion) {
        console.warn('Medallion manager not available');
        return;
      }

      // Insert request into Bronze
      await this.dbManager.medallion.insertBronzeRequest(requestData);

      // Insert headers if available
      if (requestData.requestHeaders?.length > 0) {
        const headers = {};
        requestData.requestHeaders.forEach(h => {
          headers[h.name] = h.value;
        });
        await this.dbManager.medallion.insertBronzeHeaders(
          requestData.id, 
          headers, 
          'request'
        );
      }

      if (requestData.responseHeaders?.length > 0) {
        const headers = {};
        requestData.responseHeaders.forEach(h => {
          headers[h.name] = h.value;
        });
        await this.dbManager.medallion.insertBronzeHeaders(
          requestData.id, 
          headers, 
          'response'
        );
      }

      // Insert timings if available
      if (perfMetrics) {
        await this.dbManager.medallion.insertBronzeTimings(
          requestData.id, 
          perfMetrics
        );
      }

      // Insert event
      await this.dbManager.medallion.insertBronzeEvent({
        eventType: 'request',
        eventName: requestData.error ? 'request_failed' : 'request_completed',
        source: 'webRequest',
        data: {
          method: requestData.method,
          status: requestData.status,
          duration: requestData.duration
        },
        requestId: requestData.id,
        timestamp: Date.now()
      });

      console.log(`Request ${requestData.id} saved to Bronze layer`);
    } catch (error) {
      console.error('Failed to save to Bronze layer:', error);
      throw error;
    }
  }

  /**
   * Log error to Bronze layer
   */
  async logErrorToBronze(error, requestId = null) {
    try {
      if (!this.dbManager?.medallion) {
        return;
      }

      await this.dbManager.medallion.insertBronzeError({
        errorType: error.name || 'RequestError',
        message: error.message,
        stack: error.stack,
        source: 'request-capture',
        requestId,
        severity: 'medium',
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Failed to log error to Bronze:', err);
    }
  }

  /**
   * Get capture statistics
   */
  getStatistics() {
    return {
      pendingRequests: this.pendingRequests.size,
      performanceMetrics: this.performanceMetrics.size
    };
  }

  /**
   * Cleanup old pending requests
   */
  cleanup() {
    const now = Date.now();
    const timeout = 60000; // 1 minute

    for (const [requestId, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > timeout) {
        this.pendingRequests.delete(requestId);
      }
    }

    for (const [requestId, metrics] of this.performanceMetrics.entries()) {
      if (!this.pendingRequests.has(requestId)) {
        this.performanceMetrics.delete(requestId);
      }
    }
  }
}

/**
 * Factory function to create and initialize request capture integration
 */
export function setupRequestCaptureIntegration(dbManager, eventBus, config) {
  const integration = new RequestCaptureIntegration(dbManager, eventBus, config);
  integration.initialize();
  
  // Cleanup every minute
  setInterval(() => integration.cleanup(), 60000);
  
  return integration;
}
