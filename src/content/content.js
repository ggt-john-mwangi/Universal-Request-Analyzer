// Content script: captures Core Web Vitals, resource timing, and page load metrics.
// Event tracking (clicks, scrolls, form submits) is OFF by default — enable via settings.

const browserAPI = globalThis.browser || globalThis.chrome;

let shouldMonitor = false;
let eventTrackingEnabled = false;
let configLoaded = false;

// Load configuration once, then decide what to monitor
browserAPI.storage.local.get(["settings"], (data) => {
  const config = data.settings?.settings || {};
  configLoaded = true;

  const captureConfig = config.capture || {};
  if (captureConfig.enabled === false) return;

  const captureFilters = captureConfig.captureFilters || {};
  const excludeDomains = captureFilters.excludeDomains || [
    "chrome://*",
    "edge://*",
    "about:*",
    "chrome-extension://*",
    "moz-extension://*",
  ];

  const currentUrl = window.location.href;
  const currentDomain = window.location.hostname;

  for (const pattern of excludeDomains) {
    if (matchesPattern(currentUrl, currentDomain, pattern)) return;
  }

  const includeDomains = captureFilters.includeDomains || [];
  if (includeDomains.length > 0) {
    const matched = includeDomains.some((p) =>
      matchesPattern(currentUrl, currentDomain, p)
    );
    if (!matched) return;
  }

  shouldMonitor = true;
  // eventTracking defaults to OFF; only enable when explicitly set in settings
  eventTrackingEnabled = config.eventTracking?.enabled === true;
  initializeMonitoring();
});

// Re-evaluate monitoring when settings change — no page reload needed
browserAPI.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.settings) return;

  const config = changes.settings.newValue?.settings || {};
  const captureEnabled = config.capture?.enabled !== false;
  const nowEnabled = captureEnabled;
  const nowEventTracking = config.eventTracking?.enabled === true;

  if (!shouldMonitor && nowEnabled) {
    shouldMonitor = true;
    eventTrackingEnabled = nowEventTracking;
    initializeMonitoring();
  } else if (shouldMonitor && !nowEnabled) {
    shouldMonitor = false;
    // Observers can't be stopped once started, but future events won't be sent
  } else if (shouldMonitor && nowEventTracking !== eventTrackingEnabled) {
    eventTrackingEnabled = nowEventTracking;
    if (eventTrackingEnabled) initializeEventTracking();
  }
});

function matchesPattern(url, domain, pattern) {
  pattern = pattern.trim();
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    try {
      const re = new RegExp(pattern.slice(1, -1));
      return re.test(url) || re.test(domain);
    } catch { return false; }
  }
  if (pattern.includes("*")) {
    try {
      const re = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
      return re.test(url) || re.test(domain);
    } catch { return false; }
  }
  return url.includes(pattern) || domain.includes(pattern) || url.startsWith(pattern);
}

function initializeMonitoring() {
  if (!shouldMonitor) return;
  initializeCoreWebVitals();
  initializePerformanceObserver();
  initializePageLoadMonitoring();
  if (eventTrackingEnabled) initializeEventTracking();
}

// ── Core Web Vitals ──────────────────────────────────────────────────────────

function sendVital(metric, value, rating) {
  browserAPI.runtime.sendMessage({
    action: "webVital",
    metric,
    value,
    rating,
    url: window.location.href,
    timestamp: Date.now(),
  });
}

function initializeCoreWebVitals() {
  try {
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      const v = last.renderTime || last.loadTime;
      sendVital("LCP", v, v < 2500 ? "good" : v < 4000 ? "needs-improvement" : "poor");
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((e) => {
        const v = e.processingStart - e.startTime;
        sendVital("FID", v, v < 100 ? "good" : v < 300 ? "needs-improvement" : "poor");
      });
    }).observe({ type: "first-input", buffered: true });
  } catch {}

  try {
    let clsValue = 0;
    new PerformanceObserver((list) => {
      list.getEntries().forEach((e) => {
        if (!e.hadRecentInput) clsValue += e.value;
      });
      sendVital("CLS", clsValue, clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor");
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((e) => {
        if (e.name === "first-contentful-paint") {
          sendVital("FCP", e.startTime, e.startTime < 1800 ? "good" : e.startTime < 3000 ? "needs-improvement" : "poor");
        }
      });
    }).observe({ type: "paint", buffered: true });
  } catch {}
}

// ── Resource Timing Observer ─────────────────────────────────────────────────
// Batches entries into one message instead of N individual messages.

function initializePerformanceObserver() {
  let pendingEntries = [];
  let flushTimer = null;

  function flush() {
    flushTimer = null;
    if (pendingEntries.length === 0) return;
    const batch = pendingEntries.splice(0);
    browserAPI.runtime.sendMessage({
      action: "performanceData",
      entries: batch.map((e) => ({
        name: e.name,
        duration: e.duration,
        startTime: e.startTime,
        initiatorType: e.initiatorType,
        timings: {
          dns: e.domainLookupEnd - e.domainLookupStart,
          tcp: e.connectEnd - e.connectStart,
          ssl: e.secureConnectionStart > 0 ? e.connectEnd - e.secureConnectionStart : 0,
          ttfb: e.responseStart - e.requestStart,
          download: e.responseEnd - e.responseStart,
          total: e.responseEnd - e.startTime,
        },
        size: e.transferSize || 0,
        encodedBodySize: e.encodedBodySize || 0,
        decodedBodySize: e.decodedBodySize || 0,
      })),
    });
  }

  try {
    new PerformanceObserver((list) => {
      pendingEntries.push(...list.getEntries().filter((e) => e.entryType === "resource"));
      if (!flushTimer) flushTimer = setTimeout(flush, 500); // batch within 500ms
    }).observe({ entryTypes: ["resource"] });
  } catch {}
}

// ── Page Load Monitoring ─────────────────────────────────────────────────────

function initializePageLoadMonitoring() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      browserAPI.runtime.sendMessage({
        action: "pageNavigation",
        url: window.location.href,
        title: document.title,
      });
    }
  });

  window.addEventListener("load", () => {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) {
      const ttfb = nav.responseStart - nav.requestStart;
      const dcl = nav.domContentLoadedEventEnd - nav.startTime;
      const loadTime = nav.loadEventEnd - nav.startTime;
      const tti = nav.domInteractive - nav.startTime;

      sendVital("TTFB", ttfb, ttfb < 800 ? "good" : ttfb < 1800 ? "needs-improvement" : "poor");
      sendVital("DCL", dcl, dcl < 1500 ? "good" : dcl < 2500 ? "needs-improvement" : "poor");
      sendVital("Load", loadTime, loadTime < 2500 ? "good" : loadTime < 4000 ? "needs-improvement" : "poor");
      sendVital("TTI", tti, tti < 3800 ? "good" : tti < 7300 ? "needs-improvement" : "poor");

      browserAPI.runtime.sendMessage({
        action: "pageLoad",
        url: window.location.href,
        title: document.title,
        performance: {
          dnsTime: nav.domainLookupEnd - nav.domainLookupStart,
          tcpTime: nav.connectEnd - nav.connectStart,
          sslTime: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
          ttfbTime: ttfb,
          downloadTime: nav.responseEnd - nav.responseStart,
          processingTime: nav.domComplete - nav.responseEnd,
          loadTime,
          domInteractive: nav.domInteractive - nav.startTime,
          domContentLoaded: dcl,
          domComplete: nav.domComplete - nav.startTime,
          transferSize: nav.transferSize,
          encodedBodySize: nav.encodedBodySize,
          decodedBodySize: nav.decodedBodySize,
        },
      });
    }

    // Send all resources as a single batched message
    const resources = performance.getEntriesByType("resource");
    if (resources.length > 0) {
      browserAPI.runtime.sendMessage({
        action: "batchResourceTiming",
        timings: resources.map((r) => ({
          url: r.name,
          type: r.initiatorType,
          dnsTime: r.domainLookupEnd - r.domainLookupStart,
          tcpTime: r.connectEnd - r.connectStart,
          tlsTime: r.secureConnectionStart > 0 ? r.connectEnd - r.secureConnectionStart : 0,
          requestTime: r.responseStart - r.requestStart,
          responseTime: r.responseEnd - r.responseStart,
          totalTime: r.duration,
          transferSize: r.transferSize || 0,
          encodedSize: r.encodedBodySize || 0,
          decodedSize: r.decodedBodySize || 0,
          fromCache: r.transferSize === 0 && r.encodedBodySize > 0,
          timestamp: Date.now(),
          pageUrl: window.location.href,
        })),
      });

      // Summary for backward compatibility (single message, not N)
      browserAPI.runtime.sendMessage({
        action: "pageResources",
        url: window.location.href,
        resources: resources.map((r) => ({
          name: r.name,
          type: r.initiatorType,
          duration: r.duration,
          size: r.transferSize || 0,
        })),
      });
    }

    setTimeout(() => {
      detectMixedContent();
      classifyThirdPartyDomains();
    }, 1000);
  });
}

function detectMixedContent() {
  if (window.location.protocol !== "https:") return;
  const issues = performance.getEntriesByType("resource")
    .filter((r) => { try { return new URL(r.name).protocol === "http:"; } catch { return false; } })
    .map((r) => ({
      url: r.name,
      type: r.initiatorType,
      severity: ["script", "stylesheet", "fetch", "xmlhttprequest"].includes(r.initiatorType) ? "high" : "medium",
      issue: "mixed-content",
    }));
  if (issues.length > 0) {
    browserAPI.runtime.sendMessage({ action: "securityIssue", issues, pageUrl: window.location.href, timestamp: Date.now() });
  }
}

function classifyThirdPartyDomains() {
  const pageBase = getBaseDomain(window.location.hostname);
  const knownCategories = {
    analytics: ["google-analytics.com", "googletagmanager.com", "segment.com", "mixpanel.com", "amplitude.com"],
    advertising: ["doubleclick.net", "googlesyndication.com", "adnxs.com"],
    cdn: ["cloudflare.com", "fastly.net", "cloudfront.net", "jsdelivr.net", "unpkg.com", "cdnjs.com"],
    social: ["facebook.com", "twitter.com", "linkedin.com", "youtube.com"],
    fonts: ["fonts.googleapis.com", "fonts.gstatic.com", "typekit.net"],
  };

  const domains = new Map();
  performance.getEntriesByType("resource").forEach((r) => {
    try {
      const h = new URL(r.name).hostname;
      const base = getBaseDomain(h);
      if (base === pageBase) return;
      if (!domains.has(base)) {
        let category = "other";
        for (const [cat, list] of Object.entries(knownCategories)) {
          if (list.some((d) => h.includes(d))) { category = cat; break; }
        }
        domains.set(base, { domain: base, category, requestCount: 0, resources: [] });
      }
      const d = domains.get(base);
      d.requestCount++;
      d.resources.push({ url: r.name, type: r.initiatorType, size: r.transferSize || 0 });
    } catch {}
  });

  if (domains.size > 0) {
    browserAPI.runtime.sendMessage({
      action: "thirdPartyDomains",
      domains: Array.from(domains.values()),
      pageUrl: window.location.href,
      timestamp: Date.now(),
    });
  }
}

function getBaseDomain(hostname) {
  const parts = hostname.split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
}

// ── XHR / Fetch Interception ─────────────────────────────────────────────────
// Size comes from Content-Length header only — no response body reads.

(function interceptRequests() {
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this._uraMethod = method;
    this._uraUrl = url;
    this._uraStart = Date.now();
    return origOpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener("load", function () {
      if (!shouldMonitor) return;
      try {
        const contentLength = parseInt(this.getResponseHeader("content-length") || "0", 10);
        browserAPI.runtime.sendMessage({
          action: "xhrCompleted",
          method: this._uraMethod,
          url: this._uraUrl,
          status: this.status,
          statusText: this.statusText,
          duration: Date.now() - this._uraStart,
          responseSize: contentLength,
          requestSize: body ? String(body).length : 0,
          startTime: this._uraStart,
          endTime: Date.now(),
        });
      } catch {}
    });
    return origSend.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    if (!shouldMonitor) return origFetch.apply(this, arguments);
    const start = Date.now();
    const method = init?.method || "GET";
    const url = typeof input === "string" ? input : input.url;

    return origFetch.apply(this, arguments).then((response) => {
      try {
        const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
        browserAPI.runtime.sendMessage({
          action: "fetchCompleted",
          method,
          url,
          status: response.status,
          statusText: response.statusText,
          duration: Date.now() - start,
          responseSize: contentLength, // header only — no body read
          requestSize: init?.body ? String(init.body).length : 0,
          startTime: start,
          endTime: Date.now(),
        });
      } catch {}
      return response;
    }).catch((error) => {
      try {
        browserAPI.runtime.sendMessage({
          action: "fetchError",
          method,
          url,
          error: error.message,
          duration: Date.now() - start,
          startTime: start,
          endTime: Date.now(),
        });
      } catch {}
      throw error;
    });
  };
})();

// ── Event Tracking (OFF by default) ─────────────────────────────────────────

function initializeEventTracking() {
  if (!shouldMonitor || !eventTrackingEnabled) return;

  browserAPI.runtime.sendMessage({
    action: "pageVisit",
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    timestamp: Date.now(),
  });

  document.addEventListener("click", (e) => {
    if (!eventTrackingEnabled) return;
    browserAPI.runtime.sendMessage({
      action: "userEvent",
      eventType: "click",
      eventData: { target: e.target.tagName, id: e.target.id, x: e.clientX, y: e.clientY },
      url: window.location.href,
      timestamp: Date.now(),
    });
  }, { passive: true });

  let scrollTimer = null;
  document.addEventListener("scroll", () => {
    if (!eventTrackingEnabled || scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      browserAPI.runtime.sendMessage({
        action: "userEvent",
        eventType: "scroll",
        eventData: { scrollY: window.scrollY, scrollHeight: document.documentElement.scrollHeight },
        url: window.location.href,
        timestamp: Date.now(),
      });
    }, 1000);
  }, { passive: true });

  document.addEventListener("submit", (e) => {
    if (!eventTrackingEnabled) return;
    browserAPI.runtime.sendMessage({
      action: "userEvent",
      eventType: "form_submit",
      eventData: { action: e.target.action, method: e.target.method },
      url: window.location.href,
      timestamp: Date.now(),
    });
  });

  window.addEventListener("beforeunload", () => {
    browserAPI.runtime.sendMessage({
      action: "userEvent",
      eventType: "page_unload",
      eventData: { duration: Date.now() - performance.timeOrigin },
      url: window.location.href,
      timestamp: Date.now(),
    });
  });
}
