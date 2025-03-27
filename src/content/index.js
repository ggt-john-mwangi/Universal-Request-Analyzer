// Content script for the Universal Request Analyzer
// This script runs in the context of web pages

// Import browser polyfill for cross-browser compatibility
import browser from "webextension-polyfill"

// Initialize content script
function initialize() {
  console.log("Universal Request Analyzer content script initialized")

  // Set up message listener
  browser.runtime.onMessage.addListener(handleMessage)

  // Inject page script if needed
  injectPageScript()

  // Set up page event listeners
  setupPageEventListeners()
}

// Handle messages from background script
function handleMessage(message, sender, sendResponse) {
  if (message.action === "getPageInfo") {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      referrer: document.referrer,
      loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
      userAgent: navigator.userAgent,
    }

    sendResponse(pageInfo)
    return true
  }

  if (message.action === "captureDOM") {
    const domInfo = {
      bodySize: document.body.innerHTML.length,
      elementsCount: document.getElementsByTagName("*").length,
      imagesCount: document.getElementsByTagName("img").length,
      scriptsCount: document.getElementsByTagName("script").length,
      stylesheetsCount: document.getElementsByTagName("link").length,
      formsCount: document.getElementsByTagName("form").length,
    }

    sendResponse(domInfo)
    return true
  }

  return false
}

// Inject page script
function injectPageScript() {
  try {
    const script = document.createElement("script")
    script.textContent = `
      // Page script code
      window.addEventListener('message', function(event) {
        // Only accept messages from this window
        if (event.source !== window) return;
        
        if (event.data.type && event.data.type === 'FROM_PAGE_TO_CONTENT') {
          // Forward to content script
          window.dispatchEvent(new CustomEvent('requestAnalyzerEvent', { 
            detail: event.data 
          }));
        }
      });
      
      // Intercept fetch requests
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const startTime = performance.now();
        const request = args[0];
        let url;
        
        if (typeof request === 'string') {
          url = request;
        } else if (request instanceof Request) {
          url = request.url;
        }
        
        // Send request info to content script
        window.postMessage({
          type: 'FROM_PAGE_TO_CONTENT',
          action: 'fetchStarted',
          url: url,
          timestamp: Date.now()
        }, '*');
        
        return originalFetch.apply(this, args)
          .then(response => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Send response info to content script
            window.postMessage({
              type: 'FROM_PAGE_TO_CONTENT',
              action: 'fetchCompleted',
              url: url,
              status: response.status,
              duration: duration,
              timestamp: Date.now()
            }, '*');
            
            return response;
          })
          .catch(error => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Send error info to content script
            window.postMessage({
              type: 'FROM_PAGE_TO_CONTENT',
              action: 'fetchError',
              url: url,
              error: error.message,
              duration: duration,
              timestamp: Date.now()
            }, '*');
            
            throw error;
          });
      };
      
      // Intercept XMLHttpRequest
      const originalXhrOpen = XMLHttpRequest.prototype.open;
      const originalXhrSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._requestMethod = method;
        this._requestUrl = url;
        this._requestStartTime = performance.now();
        
        return originalXhrOpen.apply(this, [method, url, ...args]);
      };
      
      XMLHttpRequest.prototype.send = function(...args) {
        // Send request info to content script
        window.postMessage({
          type: 'FROM_PAGE_TO_CONTENT',
          action: 'xhrStarted',
          url: this._requestUrl,
          method: this._requestMethod,
          timestamp: Date.now()
        }, '*');
        
        this.addEventListener('load', function() {
          const endTime = performance.now();
          const duration = endTime - this._requestStartTime;
          
          // Send response info to content script
          window.postMessage({
            type: 'FROM_PAGE_TO_CONTENT',
            action: 'xhrCompleted',
            url: this._requestUrl,
            method: this._requestMethod,
            status: this.status,
            duration: duration,
            timestamp: Date.now()
          }, '*');
        });
        
        this.addEventListener('error', function() {
          const endTime = performance.now();
          const duration = endTime - this._requestStartTime;
          
          // Send error info to content script
          window.postMessage({
            type: 'FROM_PAGE_TO_CONTENT',
            action: 'xhrError',
            url: this._requestUrl,
            method: this._requestMethod,
            duration: duration,
            timestamp: Date.now()
          }, '*');
        });
        
        return originalXhrSend.apply(this, args);
      };
      
      console.log('Universal Request Analyzer page script initialized');
    `

    document.documentElement.appendChild(script)
    script.remove()

    console.log("Page script injected")
  } catch (error) {
    console.error("Failed to inject page script:", error)
  }
}

// Set up page event listeners
function setupPageEventListeners() {
  // Listen for events from page script
  window.addEventListener("requestAnalyzerEvent", (event) => {
    const data = event.detail

    if (data.action === "fetchStarted" || data.action === "xhrStarted") {
      // Forward to background script
      browser.runtime.sendMessage({
        action: "pageRequestStarted",
        url: data.url,
        method: data.method || "GET",
        type: data.action === "fetchStarted" ? "fetch" : "xhr",
        timestamp: data.timestamp,
        pageUrl: window.location.href,
      })
    }

    if (data.action === "fetchCompleted" || data.action === "xhrCompleted") {
      // Forward to background script
      browser.runtime.sendMessage({
        action: "pageRequestCompleted",
        url: data.url,
        method: data.method || "GET",
        type: data.action === "fetchCompleted" ? "fetch" : "xhr",
        status: data.status,
        duration: data.duration,
        timestamp: data.timestamp,
        pageUrl: window.location.href,
      })
    }

    if (data.action === "fetchError" || data.action === "xhrError") {
      // Forward to background script
      browser.runtime.sendMessage({
        action: "pageRequestError",
        url: data.url,
        method: data.method || "GET",
        type: data.action === "fetchError" ? "fetch" : "xhr",
        error: data.error,
        duration: data.duration,
        timestamp: data.timestamp,
        pageUrl: window.location.href,
      })
    }
  })

  // Listen for page navigation events
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      browser.runtime.sendMessage({
        action: "pageVisible",
        url: window.location.href,
        timestamp: Date.now(),
      })
    } else {
      browser.runtime.sendMessage({
        action: "pageHidden",
        url: window.location.href,
        timestamp: Date.now(),
      })
    }
  })
}

// Initialize content script
initialize()

