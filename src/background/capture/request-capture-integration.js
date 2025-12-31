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
    console.log("🔧 Initializing RequestCaptureIntegration...");
    console.log("  - dbManager available:", !!this.dbManager);
    console.log(
      "  - dbManager.medallion available:",
      !!this.dbManager?.medallion
    );
    console.log("  - eventBus available:", !!this.eventBus);

    // Listen for webRequest events
    if (typeof chrome !== "undefined" && chrome.webRequest) {
      console.log("  - chrome.webRequest API available");
      this.setupWebRequestListeners();
    } else {
      console.error("  ❌ chrome.webRequest API NOT available!");
    }

    // Listen for performance entries
    this.setupPerformanceListener();

    console.log("✅ Request capture integration initialized");
  }

  /**
   * Setup webRequest API listeners
   */
  setupWebRequestListeners() {
    const filters = {
      urls: this.config?.filters?.includePatterns || ["<all_urls>"],
    };

    console.log("Setting up webRequest listeners with filters:", filters);

    // Capture request start
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.handleRequestStart(details),
      filters,
      ["requestBody"]
    );
    console.log("✓ onBeforeRequest listener registered");

    // Capture request headers
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => this.handleRequestHeaders(details),
      filters,
      ["requestHeaders"]
    );
    console.log("✓ onBeforeSendHeaders listener registered");

    // Capture response headers
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => this.handleResponseHeaders(details),
      filters,
      ["responseHeaders"]
    );
    console.log("✓ onHeadersReceived listener registered");

    // Capture request completion
    chrome.webRequest.onCompleted.addListener(
      (details) => this.handleRequestComplete(details),
      filters,
      ["responseHeaders"]
    );
    console.log("✓ onCompleted listener registered");

    // Capture request errors
    chrome.webRequest.onErrorOccurred.addListener(
      (details) => this.handleRequestError(details),
      filters
    );
    console.log("✓ onErrorOccurred listener registered");
  }

  /**
   * Setup performance API listener
   */
  setupPerformanceListener() {
    this.eventBus?.subscribe("performance:entry", (data) => {
      this.handlePerformanceEntry(data);
    });
  }

  /**
   * Check if request should be captured based on filters
   */
  shouldCaptureRequest(details, domain) {
    // Check if capture is enabled
    if (this.config.enabled === false) {
      console.log("❌ Capture disabled globally");
      return false;
    }

    // Check request type filters
    const includeTypes = this.config.captureFilters?.includeTypes || [];
    if (includeTypes.length > 0 && !includeTypes.includes(details.type)) {
      console.log(`❌ Filtered by type: ${details.type} not in`, includeTypes);
      return false;
    }

    // Check domain filters
    const includeDomains = this.config.captureFilters?.includeDomains || [];
    const excludeDomains = this.config.captureFilters?.excludeDomains || [];
    const trackOnlyConfigured = this.config.trackOnlyConfiguredSites ?? true;

    // Check exclusions first (always honored)
    if (excludeDomains.includes(domain)) {
      console.log(`❌ Domain excluded: ${domain}`);
      return false;
    }

    // Check inclusions based on tracking mode
    if (trackOnlyConfigured) {
      // Mode: Track ONLY configured sites
      if (includeDomains.length === 0) {
        console.log("❌ No domains configured, trackOnlyConfigured=true");
        return false;
      }
      if (!includeDomains.includes(domain)) {
        console.log(`❌ Domain not in include list: ${domain}`);
        return false;
      }
    } else {
      // Mode: Track all EXCEPT excluded
      if (includeDomains.length > 0 && !includeDomains.includes(domain)) {
        console.log(`❌ Domain not in include list: ${domain}`);
        return false;
      }
    }

    return true;
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
        domain: null, // Will be set from page URL (tab.url hostname)
        path: urlParts?.pathname || "",
        queryString: urlParts?.search || "",
        protocol: urlParts?.protocol || "",
        requestBody: details.requestBody
          ? JSON.stringify(details.requestBody)
          : null,
        pageUrl: null, // Will be populated asynchronously
      };

      // Store in pending requests FIRST (must be synchronous)
      this.pendingRequests.set(requestId, requestData);

      // Get the page URL from the tab asynchronously (non-blocking)
      // Domain is extracted from PAGE URL, not request URL
      // This groups API requests under the page/domain that made them
      if (details.tabId && details.tabId > 0) {
        chrome.tabs
          .get(details.tabId)
          .then((tab) => {
            if (tab && tab.url) {
              requestData.pageUrl = tab.url;
              // Extract domain from PAGE URL (the tab's domain)
              try {
                const pageUrlObj = new URL(tab.url);
                requestData.domain = pageUrlObj.hostname;

                // Check filters now that we have the domain
                if (!this.shouldCaptureRequest(details, requestData.domain)) {
                  console.log(
                    "❌ Request filtered:",
                    details.method,
                    details.url,
                    "(domain:",
                    requestData.domain,
                    ")"
                  );
                  this.pendingRequests.delete(requestId);
                  return;
                }

                console.log(
                  "✅ Request captured:",
                  details.method,
                  details.url,
                  "(domain:",
                  requestData.domain,
                  ")"
                );
              } catch (e) {
                // Fallback to request URL hostname if page URL parsing fails
                requestData.domain = urlParts?.hostname || "";
                console.warn(
                  "  → Failed to parse page URL, using request hostname:",
                  requestData.domain
                );
              }
            }
          })
          .catch((tabError) => {
            // Fallback to request URL hostname if tab fetch fails
            requestData.domain = urlParts?.hostname || "";
            console.warn(
              "Failed to get tab info for tabId",
              details.tabId,
              "- using request hostname:",
              tabError.message
            );
          });
      } else {
        // No tab ID (background request) - use request URL hostname
        requestData.domain = urlParts?.hostname || "";
      }

      // Emit event
      this.eventBus?.publish("request:started", { requestId, timestamp });
    } catch (error) {
      console.error("Error handling request start:", error);
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
        (h) => h.name.toLowerCase() === "content-length"
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
      this.eventBus?.publish("request:completed", {
        requestId,
        duration: pending.duration,
      });
    } catch (error) {
      console.error("Error handling request completion:", error);

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
      this.eventBus?.publish("request:error", {
        requestId,
        error: details.error,
      });
    } catch (error) {
      console.error("Error handling request error:", error);
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
      sslDuration:
        entry.secureConnectionStart > 0
          ? entry.connectEnd - entry.secureConnectionStart
          : 0,
      requestStart: entry.requestStart,
      requestEnd: entry.responseStart,
      requestDuration: entry.responseStart - entry.requestStart,
      responseStart: entry.responseStart,
      responseEnd: entry.responseEnd,
      responseDuration: entry.responseEnd - entry.responseStart,
    };

    this.performanceMetrics.set(requestId, timings);
  }

  /**
   * Save request to Bronze layer
   */
  async saveToBronze(requestData, perfMetrics = null) {
    try {
      console.log(
        "💾 Saving request to Bronze:",
        requestData.method,
        requestData.url
      );
      console.log("  📊 Request data being saved:", {
        id: requestData.id,
        domain: requestData.domain,
        pageUrl: requestData.pageUrl,
        tabId: requestData.tabId,
        status: requestData.status,
        duration: requestData.duration,
        type: requestData.type,
      });

      if (!this.dbManager?.medallion) {
        console.error(
          "❌ Medallion manager not available! dbManager:",
          !!this.dbManager,
          "medallion:",
          !!this.dbManager?.medallion
        );
        return;
      }

      // Insert request into Bronze
      await this.dbManager.medallion.insertBronzeRequest(requestData);
      console.log("✅ Request saved to Bronze layer:", requestData.id);

      // Insert headers if available
      if (requestData.requestHeaders?.length > 0) {
        const headers = {};
        requestData.requestHeaders.forEach((h) => {
          headers[h.name] = h.value;
        });
        await this.dbManager.medallion.insertBronzeHeaders(
          requestData.id,
          headers,
          "request"
        );
      }

      if (requestData.responseHeaders?.length > 0) {
        const headers = {};
        requestData.responseHeaders.forEach((h) => {
          headers[h.name] = h.value;
        });
        await this.dbManager.medallion.insertBronzeHeaders(
          requestData.id,
          headers,
          "response"
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
        eventType: "request",
        eventName: requestData.error ? "request_failed" : "request_completed",
        source: "webRequest",
        data: {
          method: requestData.method,
          status: requestData.status,
          duration: requestData.duration,
        },
        requestId: requestData.id,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Failed to save to Bronze layer:", error);
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
        errorType: error.name || "RequestError",
        message: error.message,
        stack: error.stack,
        source: "request-capture",
        requestId,
        severity: "medium",
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("Failed to log error to Bronze:", err);
    }
  }

  /**
   * Get capture statistics
   */
  getStatistics() {
    return {
      pendingRequests: this.pendingRequests.size,
      performanceMetrics: this.performanceMetrics.size,
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
  const integration = new RequestCaptureIntegration(
    dbManager,
    eventBus,
    config
  );
  integration.initialize();

  // Cleanup every minute
  setInterval(() => integration.cleanup(), 60000);

  return integration;
}
