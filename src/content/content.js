import { setupCrossBrowserCompat } from "../background/compat/browser-compat";
import { getHarmonizedConfig, listenForConfigUpdates } from "../popup/js/settings-manager.js";

// Ensure compatibility layer is set up if needed (though likely not necessary for just runtime)
setupCrossBrowserCompat();

// --- Harmonized Config/Filters Sync System ---
// On load, fetch config/filters from background
getHarmonizedConfig().then((config) => {
  // Use config for all settings/filters in content script
  // ...apply config to content script logic if needed...
});

// Listen for config updates from background
listenForConfigUpdates((newConfig) => {
  // Update content script logic with newConfig if needed
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
    // Send the performance data to the background script
    debugSendMessage({
      action: "performanceData",
      entries: networkRequests.map((entry) => ({
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
})

// Start observing resource timing entries
observer.observe({ entryTypes: ["resource"] })

// Listen for page navigation events
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // Page is now visible, send current URL to background
    debugSendMessage({
      action: "pageNavigation",
      url: window.location.href,
      title: document.title,
    })
  }
})

// Send initial page load information
window.addEventListener("load", () => {
  // Use the Navigation Timing API for page load metrics
  const navigationTiming = performance.getEntriesByType("navigation")[0]

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

  if (resources.length > 0) {
    debugSendMessage({
      action: "pageResources",
      url: window.location.href,
      resources: resources.map((resource) => ({
        name: resource.name,
        type: resource.initiatorType,
        duration: resource.duration,
        size: resource.transferSize || 0,
      })),
    })
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

