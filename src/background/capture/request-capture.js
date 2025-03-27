// Request capture module - captures network requests

import { parseUrl } from "../utils/url-utils.js"
import { generateId } from "../utils/id-generator.js"

let dbManager = null
let eventBus = null
let config = null
let capturedRequests = []

// Set up request capture
export function setupRequestCapture(captureConfig, database, events) {
  config = captureConfig
  dbManager = database
  eventBus = events

  // Set up listeners for web requests
  setupWebRequestListeners()

  // Set up message listener for content script data
  setupContentScriptListener()

  console.log("Request capture initialized")

  return {
    enableCapture,
    disableCapture,
    updateCaptureConfig,
  }
}

// Set up web request listeners
function setupWebRequestListeners() {
  // Listen for web requests
  if (typeof chrome !== "undefined" && chrome.webRequest) {
    chrome.webRequest.onBeforeRequest.addListener(handleBeforeRequest, { urls: ["<all_urls>"] })

    // Listen for headers received
    chrome.webRequest.onHeadersReceived.addListener(handleHeadersReceived, { urls: ["<all_urls>"] }, [
      "responseHeaders",
    ])

    // Listen for completed requests
    chrome.webRequest.onCompleted.addListener(handleRequestCompleted, { urls: ["<all_urls>"] })

    // Listen for error requests
    chrome.webRequest.onErrorOccurred.addListener(handleRequestError, { urls: ["<all_urls>"] })
  }
}

// Handle before request event
function handleBeforeRequest(details) {
  if (!config.enabled) return

  // Check if we should capture this request type
  if (!shouldCaptureRequest(details)) return

  const { domain, path } = parseUrl(details.url)

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
  }

  // Get the page URL
  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError) {
        // Tab might not exist anymore
        return
      }

      if (tab && tab.url) {
        request.pageUrl = tab.url
        updateRequestData(details.requestId, request)
      }
    })
  }
}

// Handle headers received event
function handleHeadersReceived(details) {
  if (!config.enabled) return

  const request = capturedRequests.find((req) => req.id === details.requestId)
  if (!request) return

  // Extract content length from headers
  const contentLengthHeader = details.responseHeaders.find((h) => h.name.toLowerCase() === "content-length")

  if (contentLengthHeader) {
    request.size = Number.parseInt(contentLengthHeader.value, 10) || 0
  }

  // Store headers if needed
  if (config.captureHeaders && dbManager) {
    dbManager.saveRequestHeaders(
      details.requestId,
      details.responseHeaders.map((h) => ({
        name: h.name,
        value: h.value,
      })),
    )
  }

  updateRequestData(details.requestId, request)
}

// Handle request completed event
function handleRequestCompleted(details) {
  if (!config.enabled) return

  const endTime = details.timeStamp
  const request = capturedRequests.find((req) => req.id === details.requestId)

  if (request) {
    request.status = "completed"
    request.statusCode = details.statusCode
    request.statusText = details.statusLine
    request.timings.endTime = endTime
    request.timings.duration = endTime - request.timings.startTime

    updateRequestData(details.requestId, request)

    // Send updated data to popup if open
    eventBus.publish("request:updated", { request })
  }
}

// Handle request error event
function handleRequestError(details) {
  if (!config.enabled) return

  const request = capturedRequests.find((req) => req.id === details.requestId)

  if (request) {
    request.status = "error"
    request.error = details.error
    request.timings.endTime = details.timeStamp
    request.timings.duration = details.timeStamp - request.timings.startTime

    updateRequestData(details.requestId, request)
  }
}

// Set up content script listener
function setupContentScriptListener() {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!config.enabled) return

      if (message.action === "performanceData") {
        handlePerformanceData(message.entries, sender.tab)
        sendResponse({ success: true })
      } else if (message.action === "pageLoad") {
        handlePageLoad(message, sender.tab)
        sendResponse({ success: true })
      } else if (message.action === "pageNavigation") {
        handlePageNavigation(message, sender.tab)
        sendResponse({ success: true })
      } else if (message.action === "xhrCompleted" || message.action === "fetchCompleted") {
        handleXhrFetchCompleted(message, sender.tab)
        sendResponse({ success: true })
      } else if (message.action === "fetchError") {
        handleFetchError(message, sender.tab)
        sendResponse({ success: true })
      }
    })
  }
}

// Handle performance data from content script
function handlePerformanceData(entries, tab) {
  if (!config.enabled || !entries || entries.length === 0) return

  entries.forEach((entry) => {
    // Try to find an existing request that matches this performance entry
    const existingRequest = capturedRequests.find(
      (req) => req.url === entry.name && Math.abs(req.startTime - entry.startTime) < 100,
    )

    if (existingRequest) {
      // Update existing request with performance data
      existingRequest.timings = {
        ...existingRequest.timings,
        dns: entry.timings.dns,
        tcp: entry.timings.tcp,
        ssl: entry.timings.ssl,
        ttfb: entry.timings.ttfb,
        download: entry.timings.download,
      }

      // Update size if available
      if (entry.size && !existingRequest.size) {
        existingRequest.size = entry.size
      }

      updateRequestData(existingRequest.id, existingRequest)
    } else if (shouldCaptureByUrl(entry.name)) {
      // Create a new request from performance data
      const { domain, path } = parseUrl(entry.name)

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
      }

      updateRequestData(request.id, request)
    }
  })
}

// Handle page load event
function handlePageLoad(data, tab) {
  if (!config.enabled) return

  // Create a special request entry for the page load
  const { domain, path } = parseUrl(data.url)

  const request = {
    id: generateId(),
    url: data.url,
    method: "GET",
    type: "navigation",
    domain: domain,
    path: path,
    startTime: data.performance.navigationStart || Date.now() - data.performance.loadTime,
    timestamp: Date.now(),
    tabId: tab ? tab.id : 0,
    pageUrl: data.url,
    status: "completed",
    statusCode: 200, // Assume 200 for page load
    timings: {
      startTime: data.performance.navigationStart || Date.now() - data.performance.loadTime,
      endTime: data.performance.loadEventEnd || Date.now(),
      duration: data.performance.loadTime,
      dns: data.performance.dnsTime || 0,
      tcp: data.performance.tcpTime || 0,
      ssl: data.performance.sslTime || 0,
      ttfb: data.performance.ttfbTime || 0,
      download: data.performance.downloadTime || 0,
    },
  }

  updateRequestData(request.id, request)

  // Publish page load event
  eventBus.publish("page:loaded", {
    url: data.url,
    title: data.title,
    performance: data.performance,
  })
}

// Handle page navigation event
function handlePageNavigation(data, tab) {
  if (!config.enabled) return

  // Publish page navigation event
  eventBus.publish("page:navigated", {
    url: data.url,
    title: data.title,
    tabId: tab ? tab.id : 0,
  })
}

// Handle XHR/Fetch completed event
function handleXhrFetchCompleted(data, tab) {
  if (!config.enabled) return

  // Try to find an existing request that matches
  const existingRequest = capturedRequests.find(
    (req) => req.url === data.url && Math.abs(req.startTime - data.startTime) < 100,
  )

  if (existingRequest) {
    // Update existing request
    existingRequest.status = "completed"
    existingRequest.statusCode = data.status
    existingRequest.statusText = data.statusText
    existingRequest.timings.endTime = data.endTime
    existingRequest.timings.duration = data.duration
    existingRequest.size = data.responseSize || existingRequest.size

    updateRequestData(existingRequest.id, existingRequest)
  } else if (shouldCaptureByUrl(data.url)) {
    // Create a new request
    const { domain, path } = parseUrl(data.url)

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
    }

    updateRequestData(request.id, request)
  }
}

// Handle fetch error event
function handleFetchError(data, tab) {
  if (!config.enabled) return

  // Try to find an existing request that matches
  const existingRequest = capturedRequests.find(
    (req) => req.url === data.url && Math.abs(req.startTime - data.startTime) < 100,
  )

  if (existingRequest) {
    // Update existing request
    existingRequest.status = "error"
    existingRequest.error = data.error
    existingRequest.timings.endTime = data.endTime
    existingRequest.timings.duration = data.duration

    updateRequestData(existingRequest.id, existingRequest)
  } else if (shouldCaptureByUrl(data.url)) {
    // Create a new request
    const { domain, path } = parseUrl(data.url)

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
    }

    updateRequestData(request.id, request)
  }
}

// Helper function to update request data
function updateRequestData(requestId, requestData) {
  const index = capturedRequests.findIndex((req) => req.id === requestId)

  if (index !== -1) {
    capturedRequests[index] = requestData
  } else {
    capturedRequests.unshift(requestData)

    // Limit the number of stored requests in memory
    if (capturedRequests.length > config.maxStoredRequests) {
      capturedRequests = capturedRequests.slice(0, config.maxStoredRequests)
    }
  }

  // Save to database if available
  if (dbManager) {
    dbManager.saveRequest(requestData)

    // Save timing data if available
    if (requestData.timings) {
      dbManager.saveRequestTimings(requestData.id, requestData.timings)
    }
  }

  // Publish event
  eventBus.publish("request:captured", { id: requestId })
}

// Check if a request should be captured based on configuration
function shouldCaptureRequest(details) {
  // Check request type
  if (!config.captureFilters.includeTypes.includes(details.type)) {
    return false
  }

  // Check URL
  return shouldCaptureByUrl(details.url)
}

// Check if a URL should be captured based on configuration
function shouldCaptureByUrl(url) {
  try {
    const { domain } = parseUrl(url)

    // Check domain filters
    if (config.captureFilters.excludeDomains.includes(domain)) {
      return false
    }

    if (config.captureFilters.includeDomains.length > 0 && !config.captureFilters.includeDomains.includes(domain)) {
      return false
    }

    return true
  } catch (e) {
    return false
  }
}

// Enable request capture
function enableCapture() {
  config.enabled = true
  eventBus.publish("capture:enabled", { timestamp: Date.now() })
}

// Disable request capture
function disableCapture() {
  config.enabled = false
  eventBus.publish("capture:disabled", { timestamp: Date.now() })
}

// Update capture configuration
function updateCaptureConfig(newConfig) {
  config = { ...config, ...newConfig }
  eventBus.publish("capture:config_updated", { timestamp: Date.now() })
}

