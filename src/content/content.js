import { setupCrossBrowserCompat } from "../background/compat/browser-compat";
import { getHarmonizedConfig, listenForConigUpdates } from "../popup/js/settings-manager.js";
f
// DEBUG: Content script loaded
console.log('[URA content.js] Content script injected on', window.location.href);

// Ensure compatibility layer is set up if needed (though likely not necessary for just runtime)
setupCrossBrowserCompat();

// --- Harmonized Config/Filters Sync System ---
let currentConfig = null;

// Helper: check if a request/resource should be captured
function shouldCaptureResource(type, url) {
  if (!currentConfig || !currentConfig.captureFilters) return true; // fallback: capture all
  let { includeTypes = [], includeDomains = [], excludeDomains = [] } = currentConfig.captureFilters;
  // Defensive: ensure includeTypes is always an array
  if (!Array.isArray(includeTypes)) includeTypes = [];
  try {
    const domain = (new URL(url)).hostname;
    if (excludeDomains.includes(domain)) return false;
    if (includeDomains.length > 0 && !includeDomains.includes(domain)) return false;
    if (includeTypes.length > 0 && !includeTypes.includes(type)) return false;
    return true;
  } catch (e) {
    return true;
  }
}

// On load, fetch config/filters from background
getHarmonizedConfig().then((config) => {
  currentConfig = config;
});

// Listen for config updates from background
listenForConfigUpdates((newConfig) => {
  currentConfig = newConfig;
});

// Add debug logging for all outgoing messages
function debugSendMessage(message, callback) {
  console.log('[Content] Sending message to background:', message);
  chrome.runtime.sendMessage(message, (response) => {
    console.log('[Content] Got response from background:', response);
    if (callback) callback(response);
  });
}

// Content script to capture performance metrics from the page

// Create a performance observer to monitor resource timing entries
const observer = new PerformanceObserver((list) => {
  const entries = list.getEntries()
  // Filter for network requests
  const networkRequests = entries.filter((entry) => entry.entryType === "resource")
  if (networkRequests.length > 0) {
    // Only send entries that match current config/filters
    const filtered = networkRequests.filter(entry => shouldCaptureResource(entry.initiatorType, entry.name));
    if (filtered.length > 0) {
      debugSendMessage({
        action: "performanceData",
        entries: filtered.map((entry) => ({
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
          initiatorType: entry.initiatorType,
          // Include detailed timing information
          timings: {
            dns: entry.domainLookupEnd - entry.domainLookupStart,
            tcp: entry.connectEnd - entry.connectStart,
            ssl: entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0,
            ttfb: entry.responseStart - entry.requestStart,
            download: entry.responseEnd - entry.responseStart,
            total: entry.responseEnd - entry.startTime,
          },
          // Include transfer size if available
          size: entry.transferSize || 0,
          // Include encoded body size if available
          encodedBodySize: entry.encodedBodySize || 0,
          // Include decoded body size if available
          decodedBodySize: entry.decodedBodySize || 0,
        })),
      })
    }
  }
})

// Start observing resource timing entries
observer.observe({ entryTypes: ["resource"] })

// Listen for page navigation events
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (!shouldCaptureResource("navigation", window.location.href)) return;
    debugSendMessage({
      action: "pageNavigation",
      url: window.location.href,
      title: document.title,
    })
  }
})

// --- Save current domain to chrome.storage.local for popup default ---
(function saveCurrentDomainToStorage() {
  try {
    const domain = window.location.hostname;
    console.log('[URA content.js] Attempting to set lastActiveDomain:', domain);
    if (domain && chrome.storage && chrome.storage.local && chrome.storage.local.set) {
      chrome.storage.local.set({ lastActiveDomain: domain }, () => {
        console.log('[URA content.js] lastActiveDomain set in storage:', domain);
      });
    }
  } catch (e) {
    console.error('[URA content.js] Error setting lastActiveDomain:', e);
  }
})();

// Send initial page load information
window.addEventListener("load", () => {
  // Use the Navigation Timing API for page load metrics
  const navigationTiming = performance.getEntriesByType("navigation")[0]
  if (shouldCaptureResource("navigation", window.location.href)) {
    if (navigationTiming) {
      debugSendMessage({
        action: "pageLoad",
        url: window.location.href,
        title: document.title,
        performance: {
          // Navigation timing metrics
          dnsTime: navigationTiming.domainLookupEnd - navigationTiming.domainLookupStart,
          tcpTime: navigationTiming.connectEnd - navigationTiming.connectStart,
          sslTime:
            navigationTiming.secureConnectionStart > 0
              ? navigationTiming.connectEnd - navigationTiming.secureConnectionStart
              : 0,
          ttfbTime: navigationTiming.responseStart - navigationTiming.requestStart,
          downloadTime: navigationTiming.responseEnd - navigationTiming.responseStart,
          processingTime: navigationTiming.domComplete - navigationTiming.responseEnd,
          loadTime: navigationTiming.loadEventEnd - navigationTiming.startTime,
          // Page load metrics
          domInteractive: navigationTiming.domInteractive - navigationTiming.startTime,
          domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.startTime,
          domComplete: navigationTiming.domComplete - navigationTiming.startTime,
          // Transfer size metrics
          transferSize: navigationTiming.transferSize,
          encodedBodySize: navigationTiming.encodedBodySize,
          decodedBodySize: navigationTiming.decodedBodySize,
        },
      })
    } else {
      // Fallback for browsers that don't support Navigation Timing API v2
      debugSendMessage({
        action: "pageLoad",
        url: window.location.href,
        title: document.title,
        performance: {
          loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domInteractive: performance.timing.domInteractive - performance.timing.navigationStart,
          domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
          domComplete: performance.timing.domComplete - performance.timing.navigationStart,
        },
      })
    }
    // Collect all resources loaded on the page
    const resources = performance.getEntriesByType("resource")
    const filteredResources = resources.filter(r => shouldCaptureResource(r.initiatorType, r.name));
    if (filteredResources.length > 0) {
      debugSendMessage({
        action: "pageResources",
        url: window.location.href,
        resources: filteredResources.map((resource) => ({
          name: resource.name,
          type: resource.initiatorType,
          duration: resource.duration,
          size: resource.transferSize || 0,
        })),
      })
    }
  }
})
// Listen for XHR and fetch requests to capture additional data
;(() => {
  // Intercept XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open
  const originalXhrSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this._requestMethod = method
    this._requestUrl = url
    this._requestStartTime = Date.now()
    return originalXhrOpen.apply(this, [method, url, ...args])
  }
  XMLHttpRequest.prototype.send = function (body) {
    this._requestBody = body
    this.addEventListener("load", function () {
      const endTime = Date.now()
      const duration = endTime - this._requestStartTime
      try {
        if (!shouldCaptureResource("xmlhttprequest", this._requestUrl)) return;
        debugSendMessage({
          action: "xhrCompleted",
          method: this._requestMethod,
          url: this._requestUrl,
          status: this.status,
          statusText: this.statusText,
          duration: duration,
          responseSize: this.responseText ? this.responseText.length : 0,
          requestSize: this._requestBody ? this._requestBody.length : 0,
          startTime: this._requestStartTime,
          endTime: endTime,
        })
      } catch (e) {
        console.error("Error sending message:", e)
      }
    })
    return originalXhrSend.apply(this, arguments)
  }
  // Intercept fetch
  const originalFetch = window.fetch
  window.fetch = function (input, init) {
    const startTime = Date.now()
    const method = init && init.method ? init.method : "GET"
    const url = typeof input === "string" ? input : input.url
    if (!shouldCaptureResource("fetch", url)) {
      return originalFetch.apply(this, arguments);
    }
    return originalFetch
      .apply(this, arguments)
      .then((response) => {
        const endTime = Date.now()
        const duration = endTime - startTime
        const clonedResponse = response.clone()
        // Get response size
        clonedResponse.text().then((text) => {
          try {
            debugSendMessage({
              action: "fetchCompleted",
              method: method,
              url: url,
              status: response.status,
              statusText: response.statusText,
              duration: duration,
              responseSize: text.length,
              requestSize: init && init.body ? init.body.length : 0,
              startTime: startTime,
              endTime: endTime,
            })
          } catch (e) {
            console.error("Error sending message:", e)
          }
        })
        return response
      })
      .catch((error) => {
        const endTime = Date.now()
        const duration = endTime - startTime
        try {
          debugSendMessage({
            action: "fetchError",
            method: method,
            url: url,
            error: error.message,
            duration: duration,
            startTime: startTime,
            endTime: endTime,
          })
        } catch (e) {
          console.error("Error sending message:", e)
        }
        throw error
      })
  }
})()

