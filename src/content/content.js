// Content script to capture performance metrics from the page

// Cross-browser API support
const browserAPI = globalThis.browser || globalThis.chrome;

// Check if current domain should be monitored
let shouldMonitor = false;
let configLoaded = false;

// Load configuration from storage (using local storage where settings-manager saves)
browserAPI.storage.local.get(["settings"], function (data) {
  const config = data.settings?.settings || {};
  configLoaded = true;

  const currentUrl = window.location.href;
  const currentDomain = window.location.hostname;

  console.log("[URA] Content script initializing for:", currentDomain);
  console.log("[URA] Full config:", JSON.stringify(config, null, 2));

  // Check capture configuration
  const captureConfig = config.capture || {};

  // Check if capture is disabled
  if (captureConfig.enabled === false) {
    console.log("[URA] Capture is disabled in settings. Monitoring disabled.");
    return;
  }

  const captureFilters = captureConfig.captureFilters || {};

  // Get exclude patterns with defaults
  const excludeDomains = captureFilters.excludeDomains || [
    "chrome://*",
    "edge://*",
    "about:*",
    "chrome-extension://*",
    "moz-extension://*",
  ];

  // Check if domain is excluded
  for (const pattern of excludeDomains) {
    if (matchesPattern(currentUrl, currentDomain, pattern)) {
      console.log(
        `[URA] Domain ${currentDomain} matches exclude pattern "${pattern}". Monitoring disabled.`
      );
      return;
    }
  }

  // Get include domains
  const includeDomains = captureFilters.includeDomains || [];

  if (includeDomains.length === 0) {
    // No domains configured, monitor all (except excluded)
    shouldMonitor = true;
    console.log(
      "[URA] ✓ No include domains configured. Monitoring ALL non-excluded sites."
    );
    console.log("[URA] ✓ shouldMonitor = true, initializing monitoring...");
    initializeMonitoring();
    return;
  }

  // Check if current domain matches any include pattern
  for (const pattern of includeDomains) {
    if (matchesPattern(currentUrl, currentDomain, pattern)) {
      shouldMonitor = true;
      console.log(
        `[URA] Domain ${currentDomain} matches include pattern "${pattern}". Monitoring enabled.`
      );
      initializeMonitoring();
      return;
    }
  }

  console.log(
    `[URA] Domain ${currentDomain} not in monitored list. Skipping data capture.`
  );
});

// Listen for settings updates
browserAPI.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.settings) {
    // Reload configuration when settings change
    location.reload(); // Simple approach: reload page to re-evaluate monitoring
  }
});

// Pattern matching function
function matchesPattern(url, domain, pattern) {
  // Remove whitespace
  pattern = pattern.trim();

  // Handle regex patterns (between slashes)
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    try {
      const regex = new RegExp(pattern.slice(1, -1));
      return regex.test(url) || regex.test(domain);
    } catch (e) {
      console.error("[URA] Invalid regex pattern:", pattern, e);
      return false;
    }
  }

  // Handle wildcard patterns
  if (pattern.includes("*")) {
    const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
    try {
      const regex = new RegExp("^" + regexPattern + "$");
      return regex.test(url) || regex.test(domain);
    } catch (e) {
      console.error("[URA] Invalid wildcard pattern:", pattern, e);
      return false;
    }
  }

  // Exact match or contains match
  return (
    url.includes(pattern) || domain.includes(pattern) || url.startsWith(pattern)
  );
}

// Initialize all monitoring features
function initializeMonitoring() {
  if (!shouldMonitor) return;

  console.log(
    "[URA] Initializing performance monitoring for",
    window.location.hostname
  );

  // Initialize Core Web Vitals and other observers
  initializeCoreWebVitals();
  initializePerformanceObserver();
  initializePageLoadMonitoring();
  initializeSecurityDetection();
  initializeEventTracking();
}

// Store Core Web Vitals metrics
const webVitals = {
  lcp: null,
  fid: null,
  cls: null,
  fcp: null,
  ttfb: null,
};

// Core Web Vitals initialization
function initializeCoreWebVitals() {
  // Core Web Vitals - Largest Contentful Paint (LCP)
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];

      webVitals.lcp = lastEntry.renderTime || lastEntry.loadTime;

      console.log(
        "[URA] LCP captured:",
        webVitals.lcp,
        "for",
        window.location.href
      );

      browserAPI.runtime.sendMessage(
        {
          action: "webVital",
          metric: "LCP",
          value: webVitals.lcp,
          rating:
            webVitals.lcp < 2500
              ? "good"
              : webVitals.lcp < 4000
              ? "needs-improvement"
              : "poor",
          url: window.location.href,
          timestamp: Date.now(),
        },
        (response) => {
          if (browserAPI.runtime.lastError) {
            console.error(
              "[URA] Failed to send LCP:",
              browserAPI.runtime.lastError
            );
          } else {
            console.log("[URA] LCP sent successfully:", response);
          }
        }
      );
    });

    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {
    console.warn("LCP not supported:", e);
  }

  // Core Web Vitals - First Input Delay (FID)
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        webVitals.fid = entry.processingStart - entry.startTime;

        console.log(
          "[URA] FID captured:",
          webVitals.fid,
          "for",
          window.location.href
        );

        browserAPI.runtime.sendMessage(
          {
            action: "webVital",
            metric: "FID",
            value: webVitals.fid,
            rating:
              webVitals.fid < 100
                ? "good"
                : webVitals.fid < 300
                ? "needs-improvement"
                : "poor",
            url: window.location.href,
            timestamp: Date.now(),
          },
          (response) => {
            if (browserAPI.runtime.lastError) {
              console.error(
                "[URA] Failed to send FID:",
                browserAPI.runtime.lastError
              );
            } else {
              console.log("[URA] FID sent successfully:", response);
            }
          }
        );
      });
    });

    fidObserver.observe({ type: "first-input", buffered: true });
  } catch (e) {
    console.warn("FID not supported:", e);
  }

  // Core Web Vitals - Cumulative Layout Shift (CLS)
  try {
    let clsValue = 0;

    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }

      webVitals.cls = clsValue;

      console.log(
        "[URA] CLS captured:",
        webVitals.cls,
        "for",
        window.location.href
      );

      browserAPI.runtime.sendMessage(
        {
          action: "webVital",
          metric: "CLS",
          value: webVitals.cls,
          rating:
            webVitals.cls < 0.1
              ? "good"
              : webVitals.cls < 0.25
              ? "needs-improvement"
              : "poor",
          url: window.location.href,
          timestamp: Date.now(),
        },
        (response) => {
          if (browserAPI.runtime.lastError) {
            console.error(
              "[URA] Failed to send CLS:",
              browserAPI.runtime.lastError
            );
          } else {
            console.log("[URA] CLS sent successfully:", response);
          }
        }
      );
    });

    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch (e) {
    console.warn("CLS not supported:", e);
  }

  // First Contentful Paint (FCP)
  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          webVitals.fcp = entry.startTime;

          console.log(
            "[URA] FCP captured:",
            webVitals.fcp,
            "for",
            window.location.href
          );

          browserAPI.runtime.sendMessage(
            {
              action: "webVital",
              metric: "FCP",
              value: webVitals.fcp,
              rating:
                webVitals.fcp < 1800
                  ? "good"
                  : webVitals.fcp < 3000
                  ? "needs-improvement"
                  : "poor",
              url: window.location.href,
              timestamp: Date.now(),
            },
            (response) => {
              if (browserAPI.runtime.lastError) {
                console.error(
                  "[URA] Failed to send FCP:",
                  browserAPI.runtime.lastError
                );
              } else {
                console.log("[URA] FCP sent successfully:", response);
              }
            }
          );
        }
      }
    });

    paintObserver.observe({ type: "paint", buffered: true });
  } catch (e) {
    console.warn("FCP not supported:", e);
  }
} // End initializeCoreWebVitals

// Initialize Performance Observer
function initializePerformanceObserver() {
  // Create a performance observer to monitor resource timing entries
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();

    // Filter for network requests
    const networkRequests = entries.filter(
      (entry) => entry.entryType === "resource"
    );

    if (networkRequests.length > 0) {
      // Send the performance data to the background script
      browserAPI.runtime.sendMessage({
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
            ssl:
              entry.secureConnectionStart > 0
                ? entry.connectEnd - entry.secureConnectionStart
                : 0,
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
      });
    }
  });

  // Start observing resource timing entries
  observer.observe({ entryTypes: ["resource"] });
} // End initializePerformanceObserver

// Initialize Page Load Monitoring
function initializePageLoadMonitoring() {
  // Security Detection - Mixed Content
  function detectMixedContent() {
    const pageProtocol = window.location.protocol;

    if (pageProtocol !== "https:") {
      return; // Only check for mixed content on HTTPS pages
    }

    // Check all resources loaded on the page
    const resources = performance.getEntriesByType("resource");
    const mixedContentIssues = [];

    resources.forEach((resource) => {
      try {
        const resourceUrl = new URL(resource.name);

        if (resourceUrl.protocol === "http:") {
          mixedContentIssues.push({
            url: resource.name,
            type: resource.initiatorType,
            severity: [
              "script",
              "stylesheet",
              "fetch",
              "xmlhttprequest",
            ].includes(resource.initiatorType)
              ? "high"
              : "medium",
            issue: "mixed-content",
          });
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });

    if (mixedContentIssues.length > 0) {
      browserAPI.runtime.sendMessage({
        action: "securityIssue",
        issues: mixedContentIssues,
        pageUrl: window.location.href,
        timestamp: Date.now(),
      });
    }
  }

  // Third-Party Domain Classification
  function classifyDomains() {
    const pageUrl = new URL(window.location.href);
    const pageDomain = pageUrl.hostname;

    // Get base domain (remove www, etc.)
    const getBaseDomain = (hostname) => {
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        return parts.slice(-2).join(".");
      }
      return hostname;
    };

    const basePageDomain = getBaseDomain(pageDomain);

    const resources = performance.getEntriesByType("resource");
    const thirdPartyDomains = new Map();

    // Common third-party domain classifications
    const knownCategories = {
      analytics: [
        "google-analytics.com",
        "googletagmanager.com",
        "analytics.google.com",
        "segment.com",
        "mixpanel.com",
        "amplitude.com",
      ],
      advertising: [
        "doubleclick.net",
        "googlesyndication.com",
        "adsystem.com",
        "adnxs.com",
        "advertising.com",
      ],
      cdn: [
        "cloudflare.com",
        "fastly.net",
        "akamai.net",
        "cloudfront.net",
        "jsdelivr.net",
        "unpkg.com",
        "cdnjs.com",
      ],
      social: [
        "facebook.com",
        "twitter.com",
        "linkedin.com",
        "instagram.com",
        "youtube.com",
        "tiktok.com",
      ],
      fonts: ["fonts.googleapis.com", "fonts.gstatic.com", "typekit.net"],
    };

    resources.forEach((resource) => {
      try {
        const resourceUrl = new URL(resource.name);
        const resourceDomain = resourceUrl.hostname;
        const baseResourceDomain = getBaseDomain(resourceDomain);

        // Check if third-party
        if (baseResourceDomain !== basePageDomain) {
          // Classify the domain
          let category = "other";
          for (const [cat, domains] of Object.entries(knownCategories)) {
            if (domains.some((d) => resourceDomain.includes(d))) {
              category = cat;
              break;
            }
          }

          if (!thirdPartyDomains.has(baseResourceDomain)) {
            thirdPartyDomains.set(baseResourceDomain, {
              domain: baseResourceDomain,
              category: category,
              requestCount: 0,
              resources: [],
            });
          }

          const domainInfo = thirdPartyDomains.get(baseResourceDomain);
          domainInfo.requestCount++;
          domainInfo.resources.push({
            url: resource.name,
            type: resource.initiatorType,
            size: resource.transferSize || 0,
          });
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });

    if (thirdPartyDomains.size > 0) {
      browserAPI.runtime.sendMessage({
        action: "thirdPartyDomains",
        domains: Array.from(thirdPartyDomains.values()),
        pageUrl: window.location.href,
        timestamp: Date.now(),
      });
    }
  }

  // Listen for page navigation events
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // Page is now visible, send current URL to background
      browserAPI.runtime.sendMessage({
        action: "pageNavigation",
        url: window.location.href,
        title: document.title,
      });
    }
  });

  // Send initial page load information
  window.addEventListener("load", () => {
    // Use the Navigation Timing API for page load metrics
    const navigationTiming = performance.getEntriesByType("navigation")[0];

    if (navigationTiming) {
      // Calculate TTFB
      webVitals.ttfb =
        navigationTiming.responseStart - navigationTiming.requestStart;

      browserAPI.runtime.sendMessage({
        action: "webVital",
        metric: "TTFB",
        value: webVitals.ttfb,
        rating:
          webVitals.ttfb < 800
            ? "good"
            : webVitals.ttfb < 1800
            ? "needs-improvement"
            : "poor",
        url: window.location.href,
        timestamp: Date.now(),
      });

      // Send DOMContentLoaded as a web vital
      const domContentLoaded =
        navigationTiming.domContentLoadedEventEnd - navigationTiming.startTime;
      browserAPI.runtime.sendMessage({
        action: "webVital",
        metric: "DCL",
        value: domContentLoaded,
        rating:
          domContentLoaded < 1500
            ? "good"
            : domContentLoaded < 2500
            ? "needs-improvement"
            : "poor",
        url: window.location.href,
        timestamp: Date.now(),
      });

      // Send Load Event as a web vital
      const loadTime =
        navigationTiming.loadEventEnd - navigationTiming.startTime;
      browserAPI.runtime.sendMessage({
        action: "webVital",
        metric: "Load",
        value: loadTime,
        rating:
          loadTime < 2500
            ? "good"
            : loadTime < 4000
            ? "needs-improvement"
            : "poor",
        url: window.location.href,
        timestamp: Date.now(),
      });

      // Calculate TTI (Time to Interactive) - simplified heuristic
      // TTI is when the page is fully loaded and can respond to user input
      const tti = navigationTiming.domInteractive - navigationTiming.startTime;
      browserAPI.runtime.sendMessage({
        action: "webVital",
        metric: "TTI",
        value: tti,
        rating: tti < 3800 ? "good" : tti < 7300 ? "needs-improvement" : "poor",
        url: window.location.href,
        timestamp: Date.now(),
      });

      browserAPI.runtime.sendMessage({
        action: "pageLoad",
        url: window.location.href,
        title: document.title,
        performance: {
          // Navigation timing metrics
          dnsTime:
            navigationTiming.domainLookupEnd -
            navigationTiming.domainLookupStart,
          tcpTime: navigationTiming.connectEnd - navigationTiming.connectStart,
          sslTime:
            navigationTiming.secureConnectionStart > 0
              ? navigationTiming.connectEnd -
                navigationTiming.secureConnectionStart
              : 0,
          ttfbTime: webVitals.ttfb,
          downloadTime:
            navigationTiming.responseEnd - navigationTiming.responseStart,
          processingTime:
            navigationTiming.domComplete - navigationTiming.responseEnd,
          loadTime: navigationTiming.loadEventEnd - navigationTiming.startTime,

          // Page load metrics
          domInteractive:
            navigationTiming.domInteractive - navigationTiming.startTime,
          domContentLoaded:
            navigationTiming.domContentLoadedEventEnd -
            navigationTiming.startTime,
          domComplete:
            navigationTiming.domComplete - navigationTiming.startTime,

          // Transfer size metrics
          transferSize: navigationTiming.transferSize,
          encodedBodySize: navigationTiming.encodedBodySize,
          decodedBodySize: navigationTiming.decodedBodySize,
        },
      });
    } else {
      // Fallback for browsers that don't support Navigation Timing API v2
      browserAPI.runtime.sendMessage({
        action: "pageLoad",
        url: window.location.href,
        title: document.title,
        performance: {
          loadTime:
            performance.timing.loadEventEnd -
            performance.timing.navigationStart,
          domInteractive:
            performance.timing.domInteractive -
            performance.timing.navigationStart,
          domContentLoaded:
            performance.timing.domContentLoadedEventEnd -
            performance.timing.navigationStart,
          domComplete:
            performance.timing.domComplete - performance.timing.navigationStart,
        },
      });
    }

    // Collect all resources loaded on the page with detailed timing
    const resources = performance.getEntriesByType("resource");

    if (resources.length > 0) {
      // Send detailed resource timing for each resource
      resources.forEach((resource) => {
        const timing = {
          url: resource.name,
          type: resource.initiatorType,

          // Timing breakdown
          dnsTime: resource.domainLookupEnd - resource.domainLookupStart,
          tcpTime: resource.connectEnd - resource.connectStart,
          tlsTime:
            resource.secureConnectionStart > 0
              ? resource.connectEnd - resource.secureConnectionStart
              : 0,
          requestTime: resource.responseStart - resource.requestStart,
          responseTime: resource.responseEnd - resource.responseStart,
          totalTime: resource.duration,

          // Size details
          transferSize: resource.transferSize || 0, // Over network
          encodedSize: resource.encodedBodySize || 0, // Compressed
          decodedSize: resource.decodedBodySize || 0, // Uncompressed

          // Cache info
          fromCache:
            resource.transferSize === 0 && resource.encodedBodySize > 0,

          timestamp: Date.now(),
          pageUrl: window.location.href,
        };

        browserAPI.runtime.sendMessage({
          action: "recordResourceTiming",
          timing,
        });
      });

      // Also send summary for backward compatibility
      browserAPI.runtime.sendMessage({
        action: "pageResources",
        url: window.location.href,
        resources: resources.map((resource) => ({
          name: resource.name,
          type: resource.initiatorType,
          duration: resource.duration,
          size: resource.transferSize || 0,
        })),
      });
    }

    // Run security detections after page load
    setTimeout(() => {
      detectMixedContent();
      classifyDomains();
    }, 1000); // Give resources time to load
  });
} // End initializePageLoadMonitoring

// Initialize Security Detection
function initializeSecurityDetection() {
  // Listen for XHR and fetch requests to capture additional data
  (() => {
    // Intercept XMLHttpRequest
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...args) {
      this._requestMethod = method;
      this._requestUrl = url;
      this._requestStartTime = Date.now();
      return originalXhrOpen.apply(this, [method, url, ...args]);
    };

    XMLHttpRequest.prototype.send = function (body) {
      this._requestBody = body;

      this.addEventListener("load", function () {
        const endTime = Date.now();
        const duration = endTime - this._requestStartTime;

        try {
          // Check if chrome is defined before using it
          if (typeof chrome !== "undefined" && chrome.runtime) {
            browserAPI.runtime.sendMessage({
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
            });
          } else {
            console.warn("chrome.runtime is not available.");
          }
        } catch (e) {
          console.error("Error sending message:", e);
        }
      });

      return originalXhrSend.apply(this, arguments);
    };

    // Intercept fetch
    const originalFetch = window.fetch;

    window.fetch = function (input, init) {
      const startTime = Date.now();
      const method = init && init.method ? init.method : "GET";
      const url = typeof input === "string" ? input : input.url;

      return originalFetch
        .apply(this, arguments)
        .then((response) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          const clonedResponse = response.clone();

          // Get response size
          clonedResponse.text().then((text) => {
            try {
              // Check if chrome is defined before using it
              if (typeof chrome !== "undefined" && chrome.runtime) {
                browserAPI.runtime.sendMessage({
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
                });
              } else {
                console.warn("chrome.runtime is not available.");
              }
            } catch (e) {
              console.error("Error sending message:", e);
            }
          });

          return response;
        })
        .catch((error) => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          try {
            // Check if chrome is defined before using it
            if (typeof chrome !== "undefined" && chrome.runtime) {
              browserAPI.runtime.sendMessage({
                action: "fetchError",
                method: method,
                url: url,
                error: error.message,
                duration: duration,
                startTime: startTime,
                endTime: endTime,
              });
            } else {
              console.warn("chrome.runtime is not available.");
            }
          } catch (e) {
            console.error("Error sending message:", e);
          }

          throw error;
        });
    };
  })();
} // End initializeSecurityDetection

// Note: Actual initialization happens after config is loaded (see top of file)

// Event Tracking System
const eventTracker = {
  sessionId: null,
  throttleTimers: {},
  pageLoadTime: Date.now(),

  init() {
    if (!shouldMonitor) return;

    // Get or create session ID
    this.initializeSession();

    // Click tracking
    document.addEventListener(
      "click",
      (e) => {
        this.recordEvent("click", {
          target: e.target.tagName,
          className: e.target.className,
          id: e.target.id,
          x: e.clientX,
          y: e.clientY,
        });
      },
      { passive: true }
    );

    // Scroll tracking (throttled to 1 per second)
    document.addEventListener(
      "scroll",
      () => {
        this.throttledEvent(
          "scroll",
          () => {
            this.recordEvent("scroll", {
              scrollY: window.scrollY,
              scrollX: window.scrollX,
              scrollHeight: document.documentElement.scrollHeight,
              viewportHeight: window.innerHeight,
            });
          },
          1000
        );
      },
      { passive: true }
    );

    // Form submissions
    document.addEventListener("submit", (e) => {
      this.recordEvent("form_submit", {
        action: e.target.action,
        method: e.target.method,
        formId: e.target.id,
        formClass: e.target.className,
      });
    });

    // Page visibility changes
    document.addEventListener("visibilitychange", () => {
      this.recordEvent("visibility", {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
      });
    });

    // Navigation events
    window.addEventListener("popstate", () => {
      this.recordEvent("navigation", {
        type: "popstate",
        url: window.location.href,
      });
    });

    // Page unload
    window.addEventListener("beforeunload", () => {
      this.recordEvent("page_unload", {
        duration: Date.now() - this.pageLoadTime,
      });
    });
  },

  initializeSession() {
    // Notify background script about page visit for session tracking
    browserAPI.runtime.sendMessage({
      action: "pageVisit",
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      timestamp: Date.now(),
    });
  },

  throttledEvent(eventName, callback, delay) {
    if (!this.throttleTimers[eventName]) {
      callback();
      this.throttleTimers[eventName] = setTimeout(() => {
        delete this.throttleTimers[eventName];
      }, delay);
    }
  },

  recordEvent(type, data) {
    browserAPI.runtime.sendMessage({
      action: "recordEvent",
      event: {
        type,
        data,
        url: window.location.href,
        domain: window.location.hostname,
        timestamp: Date.now(),
      },
    });
  },
};

// Wrapper function for event tracking initialization
function initializeEventTracking() {
  if (!shouldMonitor) return;
  eventTracker.init();
}

// Initialize event tracking when monitoring is enabled
if (shouldMonitor && configLoaded) {
  eventTracker.init();
}
