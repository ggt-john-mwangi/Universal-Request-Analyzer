// Request capture module - captures network requests

import { parseUrl } from "../utils/url-utils.js";
import { generateId } from "../utils/id-generator.js";

// Performance metrics capture and analysis
class PerformanceMetricsCollector {
  constructor(config) {
    this.enabled = config.enabled;
    this.samplingRate = config.samplingRate;
    this.metrics = new Map();
    this.retentionPeriod = config.retentionPeriod;
  }

  shouldCapture() {
    return this.enabled && Math.random() * 100 <= this.samplingRate;
  }

  captureRequestStart(requestId, timestamp) {
    if (!this.shouldCapture()) return;

    this.metrics.set(requestId, {
      startTime: timestamp,
      dnsStart: 0,
      dnsEnd: 0,
      connectStart: 0,
      connectEnd: 0,
      sslStart: 0,
      sslEnd: 0,
      sendStart: 0,
      sendEnd: 0,
      receiveStart: 0,
      receiveEnd: 0,
      endTime: 0,
      total: 0,
    });
  }

  updateRequestTiming(requestId, timing) {
    if (!this.metrics.has(requestId)) return;

    const metric = this.metrics.get(requestId);

    // Update timing information
    if (timing) {
      metric.dnsStart = timing.dnsStart || 0;
      metric.dnsEnd = timing.dnsEnd || 0;
      metric.connectStart = timing.connectStart || 0;
      metric.connectEnd = timing.connectEnd || 0;
      metric.sslStart = timing.sslStart || 0;
      metric.sslEnd = timing.sslEnd || 0;
      metric.sendStart = timing.sendStart || 0;
      metric.sendEnd = timing.sendEnd || 0;
      metric.receiveStart = timing.receiveStart || 0;
      metric.receiveEnd = timing.receiveEnd || 0;
    }
  }

  finalizeRequest(requestId, endTime) {
    if (!this.metrics.has(requestId)) return;

    const metric = this.metrics.get(requestId);
    metric.endTime = endTime;

    // Calculate timing breakdowns
    metric.dns = metric.dnsEnd - metric.dnsStart || 0;
    metric.tcp =
      metric.connectEnd -
        metric.connectStart -
        (metric.sslEnd - metric.sslStart) || 0;
    metric.ssl = metric.sslEnd - metric.sslStart || 0;
    metric.ttfb = metric.receiveStart - metric.sendEnd || 0;
    metric.download = metric.receiveEnd - metric.receiveStart || 0;
    metric.total = metric.endTime - metric.startTime || 0;

    return metric;
  }

  getMetrics(requestId) {
    return this.metrics.get(requestId);
  }

  cleanupOldMetrics() {
    const now = Date.now();
    for (const [requestId, metric] of this.metrics.entries()) {
      if (now - metric.endTime > this.retentionPeriod) {
        this.metrics.delete(requestId);
      }
    }
  }
}

// Export the collector instance
export const performanceMetricsCollector = new PerformanceMetricsCollector({
  enabled: false, // Will be updated from config
  samplingRate: 100,
  retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
});

let dbManager = null;
let eventBus = null;
let config = null;
let capturedRequests = [];

// Ensure captureFilters is initialized with default values
function initializeCaptureFilters(config) {
  // Ensure config and captureFilters are initialized with default values
  if (!config || config === null) {
    config = {
      captureFilters: {
        includeTypes: [],
        includeDomains: [],
        excludeDomains: [],
      },
      enabled: false,
      maxStoredRequests: 10000,
    };
  } else if (!config.captureFilters) {
    config.captureFilters = {
      includeTypes: [],
      includeDomains: [],
      excludeDomains: [],
    };
  }

  config.captureFilters.includeTypes = config.captureFilters.includeTypes || [];
  config.captureFilters.includeDomains =
    config.captureFilters.includeDomains || [];
  config.captureFilters.excludeDomains =
    config.captureFilters.excludeDomains || [];
}

// Ensure config.captureFilters has default values
if (!config.captureFilters) {
  config.captureFilters = {
    includeTypes: [],
    includeDomains: [],
    excludeDomains: [],
  };
}

// Set up request capture
export function setupRequestCapture(captureConfig, database, events) {
  config = captureConfig;
  dbManager = database;
  eventBus = events;

  // Update performance metrics collector config
  performanceMetricsCollector.enabled = config.performanceMetrics.enabled;
  performanceMetricsCollector.samplingRate =
    config.performanceMetrics.samplingRate;

  // Ensure config.captureFilters has default values
  initializeCaptureFilters(config);

  // Set up listeners for web requests
  setupWebRequestListeners();

  // Set up message listener for content script data
  setupContentScriptListener();

  console.log("Request capture initialized");

  // Set up periodic cleanup of old metrics
  setInterval(() => {
    performanceMetricsCollector.cleanupOldMetrics();
  }, 60 * 60 * 1000); // Run cleanup every hour

  return {
    enableCapture,
    disableCapture,
    updateCaptureConfig,
  };
}

// Set up web request listeners
function setupWebRequestListeners() {
  // Listen for web requests
  if (typeof chrome !== "undefined" && chrome.webRequest) {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        // Start performance capture if enabled
        if (config.performanceMetrics.enabled) {
          performanceMetricsCollector.captureRequestStart(
            details.requestId,
            details.timeStamp
          );
        }

        handleBeforeRequest(details);
      },
      { urls: ["<all_urls>"] }
    );

    // Listen for headers received
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        // Update performance metrics if enabled
        if (config.performanceMetrics.enabled) {
          const timing = details.timing;
          performanceMetricsCollector.updateRequestTiming(
            details.requestId,
            timing
          );
        }

        handleHeadersReceived(details);
      },
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );

    // Listen for completed requests
    chrome.webRequest.onCompleted.addListener(
      (details) => {
        // Finalize performance metrics if enabled
        if (config.performanceMetrics.enabled) {
          const metrics = performanceMetricsCollector.finalizeRequest(
            details.requestId,
            details.timeStamp
          );
          if (metrics) {
            // Save metrics to database
            dbManager.saveRequestMetrics(details.requestId, metrics);
          }
        }

        handleRequestCompleted(details);
      },
      { urls: ["<all_urls>"] }
    );

    // Listen for error requests
    chrome.webRequest.onErrorOccurred.addListener(handleRequestError, {
      urls: ["<all_urls>"],
    });
  }
}

// Handle before request event
function handleBeforeRequest(details) {
  if (!config.enabled) return;

  // Check if we should capture this request type
  if (!shouldCaptureRequest(details)) return;

  const { domain, path } = parseUrl(details.url);

  const request = {
    id: details.requestId,
    url: details.url,
    method: details.method,
    type: details.type,
    domain: domain,
    path: path,
    startTime: details.timeStamp,
    timestamp: Date.now(),
    tabId: details.tabId,
    status: "pending",
    size: 0,
    timings: {
      startTime: details.timeStamp,
      endTime: null,
      duration: null,
      dns: 0,
      tcp: 0,
      ssl: 0,
      ttfb: 0,
      download: 0,
    },
  };

  // Get the page URL
  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError) {
        // Tab might not exist anymore
        return;
      }

      if (tab && tab.url) {
        request.pageUrl = tab.url;
        updateRequestData(details.requestId, request);
      }
    });
  }
}

// Handle headers received event
function handleHeadersReceived(details) {
  if (!config.enabled) return;

  const request = capturedRequests.find((req) => req.id === details.requestId);
  if (!request) return;

  // Extract content length from headers
  const contentLengthHeader = details.responseHeaders.find(
    (h) => h.name.toLowerCase() === "content-length"
  );

  if (contentLengthHeader) {
    request.size = Number.parseInt(contentLengthHeader.value, 10) || 0;
  }

  // Store headers if needed
  if (config.captureHeaders && dbManager) {
    dbManager.saveRequestHeaders(
      details.requestId,
      details.responseHeaders.map((h) => ({
        name: h.name,
        value: h.value,
      }))
    );
  }

  updateRequestData(details.requestId, request);
}

// Handle request completed event
function handleRequestCompleted(details) {
  if (!config.enabled) return;

  const endTime = details.timeStamp;
  const request = capturedRequests.find((req) => req.id === details.requestId);

  if (request) {
    request.status = "completed";
    request.statusCode = details.statusCode;
    request.statusText = details.statusLine;
    request.timings.endTime = endTime;
    request.timings.duration = endTime - request.timings.startTime;

    updateRequestData(details.requestId, request);

    // Send updated data to popup if open
    eventBus.publish("request:updated", { request });
  }
}

// Handle request error event
function handleRequestError(details) {
  if (!config.enabled) return;

  const request = capturedRequests.find((req) => req.id === details.requestId);

  if (request) {
    request.status = "error";
    request.error = details.error;
    request.timings.endTime = details.timeStamp;
    request.timings.duration = details.timeStamp - request.timings.startTime;

    updateRequestData(details.requestId, request);
  }
}

// Set up content script listener
function setupContentScriptListener() {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!config.enabled) return;

      if (message.action === "performanceData") {
        handlePerformanceData(message.entries, sender.tab);
        sendResponse({ success: true });
      } else if (message.action === "pageLoad") {
        handlePageLoad(message, sender.tab);
        sendResponse({ success: true });
      } else if (message.action === "pageNavigation") {
        handlePageNavigation(message, sender.tab);
        sendResponse({ success: true });
      } else if (message.action === "webVital") {
        handleWebVital(message, sender.tab);
        sendResponse({ success: true });
      } else if (message.action === "securityIssue") {
        handleSecurityIssue(message, sender.tab);
        sendResponse({ success: true });
      } else if (message.action === "thirdPartyDomains") {
        handleThirdPartyDomains(message, sender.tab);
        sendResponse({ success: true });
      } else if (
        message.action === "xhrCompleted" ||
        message.action === "fetchCompleted"
      ) {
        handleXhrFetchCompleted(message, sender.tab);
        sendResponse({ success: true });
      } else if (message.action === "fetchError") {
        handleFetchError(message, sender.tab);
        sendResponse({ success: true });
      } else if (message.action === "getPerformanceMetrics") {
        // Return aggregated metrics for the popup
        const metrics = Array.from(
          performanceMetricsCollector.metrics.values()
        );
        const avgMetrics = {
          dns: average(metrics.map((m) => m.dns)),
          tcp: average(metrics.map((m) => m.tcp)),
          ssl: average(metrics.map((m) => m.ssl)),
          ttfb: average(metrics.map((m) => m.ttfb)),
          download: average(metrics.map((m) => m.download)),
          total: average(metrics.map((m) => m.total)),
        };
        sendResponse(avgMetrics);
        return true;
      }
    });
  }
}

// Handle performance data from content script
function handlePerformanceData(entries, tab) {
  if (!config.enabled || !entries || entries.length === 0) return;

  entries.forEach((entry) => {
    // Try to find an existing request that matches this performance entry
    const existingRequest = capturedRequests.find(
      (req) =>
        req.url === entry.name &&
        Math.abs(req.startTime - entry.startTime) < 100
    );

    if (existingRequest) {
      // Update existing request with performance data
      existingRequest.timings = {
        ...existingRequest.timings,
        dns: entry.timings.dns,
        tcp: entry.timings.tcp,
        ssl: entry.timings.ssl,
        ttfb: entry.timings.ttfb,
        download: entry.timings.download,
      };

      // Update size if available
      if (entry.size && !existingRequest.size) {
        existingRequest.size = entry.size;
      }

      updateRequestData(existingRequest.id, existingRequest);
    } else if (shouldCaptureByUrl(entry.name)) {
      // Create a new request from performance data
      const { domain, path } = parseUrl(entry.name);

      const request = {
        id: generateId(),
        url: entry.name,
        method: "GET", // Assume GET as we don't know the method
        type: entry.initiatorType,
        domain: domain,
        path: path,
        startTime: entry.startTime,
        timestamp: Date.now(),
        tabId: tab ? tab.id : 0,
        pageUrl: tab ? tab.url : "",
        status: "completed", // Assume completed as we're getting this from PerformanceObserver
        size: entry.size || 0,
        timings: {
          startTime: entry.startTime,
          endTime: entry.startTime + entry.duration,
          duration: entry.duration,
          dns: entry.timings.dns,
          tcp: entry.timings.tcp,
          ssl: entry.timings.ssl,
          ttfb: entry.timings.ttfb,
          download: entry.timings.download,
        },
      };

      updateRequestData(request.id, request);
    }
  });
}

// Handle page load event
function handlePageLoad(data, tab) {
  if (!config.enabled) return;

  // Create a special request entry for the page load
  const { domain, path } = parseUrl(data.url);

  const request = {
    id: generateId(),
    url: data.url,
    method: "GET",
    type: "navigation",
    domain: domain,
    path: path,
    startTime:
      data.performance.navigationStart ||
      Date.now() - data.performance.loadTime,
    timestamp: Date.now(),
    tabId: tab ? tab.id : 0,
    pageUrl: data.url,
    status: "completed",
    statusCode: 200, // Assume 200 for page load
    timings: {
      startTime:
        data.performance.navigationStart ||
        Date.now() - data.performance.loadTime,
      endTime: data.performance.loadEventEnd || Date.now(),
      duration: data.performance.loadTime,
      dns: data.performance.dnsTime || 0,
      tcp: data.performance.tcpTime || 0,
      ssl: data.performance.sslTime || 0,
      ttfb: data.performance.ttfbTime || 0,
      download: data.performance.downloadTime || 0,
    },
  };

  updateRequestData(request.id, request);

  // Publish page load event
  eventBus.publish("page:loaded", {
    url: data.url,
    title: data.title,
    performance: data.performance,
  });
}

// Handle page navigation event
function handlePageNavigation(data, tab) {
  if (!config.enabled) return;

  // Publish page navigation event
  eventBus.publish("page:navigated", {
    url: data.url,
    title: data.title,
    tabId: tab ? tab.id : 0,
  });
}

// Handle Core Web Vitals metrics
function handleWebVital(data, tab) {
  if (!config.enabled || !dbManager) return;

  try {
    const { metric, value, rating, url, timestamp } = data;
    
    // Store the web vital metric in the database
    const entry = {
      request_id: null, // Not associated with a specific request
      entry_type: 'web-vital',
      name: metric,
      start_time: timestamp,
      duration: value,
      metrics: JSON.stringify({
        metric: metric,
        value: value,
        rating: rating,
        url: url,
      }),
      created_at: Date.now(),
    };

    // Insert into bronze_performance_entries table
    if (dbManager.executeQuery) {
      dbManager.executeQuery(
        `INSERT INTO bronze_performance_entries (request_id, entry_type, name, start_time, duration, metrics, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [entry.request_id, entry.entry_type, entry.name, entry.start_time, entry.duration, entry.metrics, entry.created_at]
      );
    }

    // Publish event for real-time updates
    eventBus.publish("webvital:captured", {
      metric: metric,
      value: value,
      rating: rating,
      url: url,
      tabId: tab ? tab.id : 0,
      timestamp: timestamp,
    });

    console.log(`Core Web Vital captured: ${metric} = ${value}ms (${rating})`);
  } catch (error) {
    console.error('Error handling web vital:', error);
  }
}

// Handle Security Issues (Mixed Content)
function handleSecurityIssue(data, tab) {
  if (!config.enabled || !dbManager) return;

  try {
    const { issues, pageUrl, timestamp } = data;
    
    issues.forEach(issue => {
      // Store security issue in events table
      const event = {
        event_type: 'security',
        event_name: issue.issue,
        source: pageUrl,
        data: JSON.stringify({
          url: issue.url,
          type: issue.type,
          severity: issue.severity,
          issue: issue.issue,
        }),
        request_id: null,
        user_id: null,
        session_id: null,
        timestamp: timestamp,
      };

      if (dbManager.executeQuery) {
        dbManager.executeQuery(
          `INSERT INTO bronze_events (event_type, event_name, source, data, request_id, user_id, session_id, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [event.event_type, event.event_name, event.source, event.data, event.request_id, event.user_id, event.session_id, event.timestamp]
        );
      }
    });

    // Publish event for real-time alerts
    eventBus.publish("security:issue", {
      issues: issues,
      pageUrl: pageUrl,
      tabId: tab ? tab.id : 0,
      timestamp: timestamp,
    });

    console.log(`Security issues detected: ${issues.length} mixed content warnings`);
  } catch (error) {
    console.error('Error handling security issue:', error);
  }
}

// Handle Third-Party Domain Classification
function handleThirdPartyDomains(data, tab) {
  if (!config.enabled || !dbManager) return;

  try {
    const { domains, pageUrl, timestamp } = data;
    
    domains.forEach(domainInfo => {
      // Store third-party domain info in events table
      const event = {
        event_type: 'third-party',
        event_name: 'domain-detected',
        source: pageUrl,
        data: JSON.stringify({
          domain: domainInfo.domain,
          category: domainInfo.category,
          requestCount: domainInfo.requestCount,
          totalSize: domainInfo.resources.reduce((sum, r) => sum + r.size, 0),
          resourceTypes: [...new Set(domainInfo.resources.map(r => r.type))],
        }),
        request_id: null,
        user_id: null,
        session_id: null,
        timestamp: timestamp,
      };

      if (dbManager.executeQuery) {
        dbManager.executeQuery(
          `INSERT INTO bronze_events (event_type, event_name, source, data, request_id, user_id, session_id, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [event.event_type, event.event_name, event.source, event.data, event.request_id, event.user_id, event.session_id, event.timestamp]
        );
      }
    });

    // Publish event for real-time updates
    eventBus.publish("thirdparty:detected", {
      domains: domains,
      pageUrl: pageUrl,
      tabId: tab ? tab.id : 0,
      timestamp: timestamp,
    });

    console.log(`Third-party domains detected: ${domains.length} domains`);
  } catch (error) {
    console.error('Error handling third-party domains:', error);
  }
}

// Handle XHR/Fetch completed event
function handleXhrFetchCompleted(data, tab) {
  if (!config.enabled) return;

  // Try to find an existing request that matches
  const existingRequest = capturedRequests.find(
    (req) =>
      req.url === data.url && Math.abs(req.startTime - data.startTime) < 100
  );

  if (existingRequest) {
    // Update existing request
    existingRequest.status = "completed";
    existingRequest.statusCode = data.status;
    existingRequest.statusText = data.statusText;
    existingRequest.timings.endTime = data.endTime;
    existingRequest.timings.duration = data.duration;
    existingRequest.size = data.responseSize || existingRequest.size;

    updateRequestData(existingRequest.id, existingRequest);
  } else if (shouldCaptureByUrl(data.url)) {
    // Create a new request
    const { domain, path } = parseUrl(data.url);

    const request = {
      id: generateId(),
      url: data.url,
      method: data.method,
      type: data.action === "xhrCompleted" ? "xmlhttprequest" : "fetch",
      domain: domain,
      path: path,
      startTime: data.startTime,
      timestamp: Date.now(),
      tabId: tab ? tab.id : 0,
      pageUrl: tab ? tab.url : "",
      status: "completed",
      statusCode: data.status,
      statusText: data.statusText,
      size: data.responseSize || 0,
      timings: {
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        dns: 0, // We don't have detailed timing info from XHR/fetch
        tcp: 0,
        ssl: 0,
        ttfb: 0,
        download: 0,
      },
    };

    updateRequestData(request.id, request);
  }
}

// Handle fetch error event
function handleFetchError(data, tab) {
  if (!config.enabled) return;

  // Try to find an existing request that matches
  const existingRequest = capturedRequests.find(
    (req) =>
      req.url === data.url && Math.abs(req.startTime - data.startTime) < 100
  );

  if (existingRequest) {
    // Update existing request
    existingRequest.status = "error";
    existingRequest.error = data.error;
    existingRequest.timings.endTime = data.endTime;
    existingRequest.timings.duration = data.duration;

    updateRequestData(existingRequest.id, existingRequest);
  } else if (shouldCaptureByUrl(data.url)) {
    // Create a new request
    const { domain, path } = parseUrl(data.url);

    const request = {
      id: generateId(),
      url: data.url,
      method: data.method,
      type: "fetch",
      domain: domain,
      path: path,
      startTime: data.startTime,
      timestamp: Date.now(),
      tabId: tab ? tab.id : 0,
      pageUrl: tab ? tab.url : "",
      status: "error",
      error: data.error,
      timings: {
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        dns: 0,
        tcp: 0,
        ssl: 0,
        ttfb: 0,
        download: 0,
      },
    };

    updateRequestData(request.id, request);
  }
}

// Helper function to update request data
function updateRequestData(requestId, requestData) {
  const index = capturedRequests.findIndex((req) => req.id === requestId);

  if (index !== -1) {
    capturedRequests[index] = requestData;
  } else {
    capturedRequests.unshift(requestData);

    // Limit the number of stored requests in memory
    if (capturedRequests.length > config.maxStoredRequests) {
      capturedRequests = capturedRequests.slice(0, config.maxStoredRequests);
    }
  }

  // Save to database if available
  if (dbManager) {
    dbManager.saveRequest(requestData);

    // Save timing data if available
    if (requestData.timings) {
      dbManager.saveRequestTimings(requestData.id, requestData.timings);
    }
  }

  // Publish event
  eventBus.publish("request:captured", { id: requestId });
}

// Check if a request should be captured based on configuration
function shouldCaptureRequest(details) {
  initializeCaptureFilters(config); // Ensure captureFilters is properly initialized

  // Check request type
  if (!config.captureFilters.includeTypes.includes(details.type)) {
    return false;
  }

  // Check URL
  return shouldCaptureByUrl(details.url);
}

// Check if a URL should be captured based on configuration
function shouldCaptureByUrl(url) {
  try {
    const { domain } = parseUrl(url);

    // Check domain filters
    if (config.captureFilters.excludeDomains.includes(domain)) {
      return false;
    }

    if (
      config.captureFilters.includeDomains.length > 0 &&
      !config.captureFilters.includeDomains.includes(domain)
    ) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

// Enable request capture
function enableCapture() {
  config.enabled = true;
  eventBus.publish("capture:enabled", { timestamp: Date.now() });
}

// Disable request capture
function disableCapture() {
  config.enabled = false;
  eventBus.publish("capture:disabled", { timestamp: Date.now() });
}

// Update capture configuration
function updateCaptureConfig(newConfig) {
  config = { ...config, ...newConfig };
  initializeCaptureFilters(config); // Ensure captureFilters is properly initialized
  eventBus.publish("capture:config_updated", { timestamp: Date.now() });
}

// Utility function to calculate average
function average(array) {
  if (array.length === 0) return 0;
  return array.reduce((a, b) => a + b, 0) / array.length;
}
