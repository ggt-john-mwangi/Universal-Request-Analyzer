// Content script: captures Core Web Vitals, resource timing, and page load metrics.
// Event tracking (clicks, scrolls, form submits) is OFF by default — enable via settings.

const browserAPI = globalThis.browser || globalThis.chrome;

let shouldMonitor = false;
let eventTrackingEnabled = false;
let monitoringInitialized = false;    // prevent duplicate observers on re-init
let eventTrackingInitialized = false; // prevent duplicate listeners on re-enable
let captureResourceTiming = true;     // mirrors performanceMetrics.captureResourceTiming
let captureNavTiming = true;          // mirrors performanceMetrics.captureNavigationTiming
let captureTypes = null;              // null = all; array = filter by initiatorType

// All IPC goes through safeSend — swallows "Extension context invalidated"
function safeSend(msg) {
  browserAPI.runtime.sendMessage(msg).catch(() => {});
}

// ── Config ───────────────────────────────────────────────────────────────────

// Returns true if this page should be monitored; sets shouldMonitor + eventTrackingEnabled
function applyConfig(config, flags) {
  shouldMonitor = false;
  eventTrackingEnabled = false;

  if (config.capture?.enabled === false) return false;

  const filters = config.capture?.captureFilters || {};
  const excludeDomains = filters.excludeDomains || [
    "chrome://*", "edge://*", "about:*", "chrome-extension://*", "moz-extension://*",
  ];

  const url = window.location.href;
  const host = window.location.hostname;

  for (const p of excludeDomains) {
    if (matchesPattern(url, host, p)) return false;
  }

  const includeDomains = filters.includeDomains || [];
  if (includeDomains.length > 0 && !includeDomains.some((p) => matchesPattern(url, host, p))) {
    return false;
  }

  shouldMonitor = true;

  const perf = config.capture?.performanceMetrics || {};
  const perfEnabled = perf.enabled !== false; // parent switch; sub-flags only apply when parent is on
  captureResourceTiming = perfEnabled && perf.captureResourceTiming !== false;
  captureNavTiming      = perfEnabled && perf.captureNavigationTiming !== false;
  captureTypes = filters.includeTypes?.length > 0 ? filters.includeTypes : null;

  // featureFlags shape: { flags: { eventTracking: bool, ... }, timestamp }
  eventTrackingEnabled =
    config.eventTracking?.enabled === true || flags.flags?.eventTracking === true;
  return true;
}

// Startup: read both storage keys
browserAPI.storage.local.get(["settings", "featureFlags"], (data) => {
  if (!applyConfig(data.settings?.settings || {}, data.featureFlags || {})) return;
  initializeMonitoring();
});

// Runtime config changes — react to either key changing
browserAPI.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || (!changes.settings && !changes.featureFlags)) return;

  const wasMonitoring = shouldMonitor;
  const wasEventTracking = eventTrackingEnabled;

  browserAPI.storage.local.get(["settings", "featureFlags"], (data) => {
    applyConfig(data.settings?.settings || {}, data.featureFlags || {});

    if (!wasMonitoring && shouldMonitor) {
      initializeMonitoring();
    } else if (!wasEventTracking && eventTrackingEnabled && shouldMonitor) {
      initializeEventTracking();
    }
    // Disabling: observers can't be stopped; callbacks check shouldMonitor before sending
  });
});

// ── Pattern matching ─────────────────────────────────────────────────────────

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
      // Test against domain only — anchored regex doesn't match full URLs
      const re = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
      return re.test(domain);
    } catch { return false; }
  }
  return url.includes(pattern) || domain.includes(pattern);
}

// ── Monitoring init ──────────────────────────────────────────────────────────

function initializeMonitoring() {
  if (monitoringInitialized) return;
  monitoringInitialized = true;
  initializeCoreWebVitals();
  initializePageLoadMonitoring();
  if (eventTrackingEnabled) initializeEventTracking();
}

// ── Core Web Vitals ──────────────────────────────────────────────────────────

function sendVital(metric, value, rating) {
  if (!shouldMonitor) return;
  safeSend({
    action: "webVital", metric, value, rating,
    url: window.location.href, timestamp: Date.now(),
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

  // CLS: accumulate all shifts, send once when page hides — not on every shift
  try {
    let clsValue = 0;
    new PerformanceObserver((list) => {
      list.getEntries().forEach((e) => { if (!e.hadRecentInput) clsValue += e.value; });
    }).observe({ type: "layout-shift", buffered: true });

    const flushCLS = () =>
      sendVital("CLS", clsValue, clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor");
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushCLS();
    });
    document.addEventListener("pagehide", flushCLS, { once: true });
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

// ── Page Load Monitoring ─────────────────────────────────────────────────────

function initializePageLoadMonitoring() {
  window.addEventListener("load", () => {
    if (!shouldMonitor) return;

    const nav = performance.getEntriesByType("navigation")[0];
    if (nav && captureNavTiming) {
      const ttfb = nav.responseStart - nav.requestStart;
      const dcl  = nav.domContentLoadedEventEnd - nav.startTime;
      const load = nav.loadEventEnd - nav.startTime;
      const tti  = nav.domInteractive - nav.startTime;

      sendVital("TTFB", ttfb, ttfb < 800  ? "good" : ttfb < 1800 ? "needs-improvement" : "poor");
      sendVital("DCL",  dcl,  dcl  < 1500 ? "good" : dcl  < 2500 ? "needs-improvement" : "poor");
      sendVital("Load", load, load < 2500 ? "good" : load < 4000 ? "needs-improvement" : "poor");
      sendVital("TTI",  tti,  tti  < 3800 ? "good" : tti  < 7300 ? "needs-improvement" : "poor");

      safeSend({
        action: "pageLoad",
        url: window.location.href,
        title: document.title,
        performance: {
          dnsTime:        nav.domainLookupEnd - nav.domainLookupStart,
          tcpTime:        nav.connectEnd - nav.connectStart,
          sslTime:        nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
          ttfbTime:       ttfb,
          downloadTime:   nav.responseEnd - nav.responseStart,
          processingTime: nav.domComplete - nav.responseEnd,
          loadTime:       load,
          domInteractive: tti,
          domContentLoaded: dcl,
          domComplete:    nav.domComplete - nav.startTime,
          transferSize:   nav.transferSize,
          encodedBodySize: nav.encodedBodySize,
          decodedBodySize: nav.decodedBodySize,
        },
      });
    }

    // One batched resource timing message per page load (per CLAUDE.md spec)
    // Filter by user's includeTypes setting; skip entirely if captureResourceTiming is off
    if (captureResourceTiming) {
      const allResources = performance.getEntriesByType("resource");
      const resources = captureTypes
        ? allResources.filter((r) => captureTypes.includes(r.initiatorType))
        : allResources;
      if (resources.length > 0) {
        safeSend({
          action: "batchResourceTiming",
          timings: resources.map((r) => ({
            url:          r.name,
            type:         r.initiatorType,
            dnsTime:      r.domainLookupEnd - r.domainLookupStart,
            tcpTime:      r.connectEnd - r.connectStart,
            tlsTime:      r.secureConnectionStart > 0 ? r.connectEnd - r.secureConnectionStart : 0,
            requestTime:  r.responseStart - r.requestStart,
            responseTime: r.responseEnd - r.responseStart,
            totalTime:    r.duration,
            transferSize: r.transferSize || 0,
            encodedSize:  r.encodedBodySize || 0,
            decodedSize:  r.decodedBodySize || 0,
            fromCache:    r.transferSize === 0 && r.encodedBodySize > 0,
            timestamp:    Date.now(),
            pageUrl:      window.location.href,
          })),
        });
      }
    }
  });
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
      if (captureTypes && !captureTypes.includes("xmlhttprequest")) return;
      try {
        const contentLength = parseInt(this.getResponseHeader("content-length") || "0", 10);
        safeSend({
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
    if (captureTypes && !captureTypes.includes("fetch")) return origFetch.apply(this, arguments);
    const start = Date.now();
    const method = init?.method || "GET";
    const url = typeof input === "string" ? input : input.url;

    return origFetch.apply(this, arguments).then((response) => {
      try {
        const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
        safeSend({
          action: "fetchCompleted",
          method, url,
          status: response.status,
          statusText: response.statusText,
          duration: Date.now() - start,
          responseSize: contentLength,
          requestSize: init?.body ? String(init.body).length : 0,
          startTime: start,
          endTime: Date.now(),
        });
      } catch {}
      return response;
    }).catch((error) => {
      safeSend({
        action: "fetchError",
        method, url,
        error: error.message,
        duration: Date.now() - start,
        startTime: start,
        endTime: Date.now(),
      });
      throw error;
    });
  };
})();

// ── Event Tracking (OFF by default) ─────────────────────────────────────────

function initializeEventTracking() {
  if (!shouldMonitor || !eventTrackingEnabled || eventTrackingInitialized) return;
  eventTrackingInitialized = true;

  safeSend({
    action: "pageVisit",
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    timestamp: Date.now(),
  });

  document.addEventListener("click", (e) => {
    if (!eventTrackingEnabled) return;
    safeSend({
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
      safeSend({
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
    safeSend({
      action: "userEvent",
      eventType: "form_submit",
      eventData: { action: e.target.action, method: e.target.method },
      url: window.location.href,
      timestamp: Date.now(),
    });
  });

  window.addEventListener("beforeunload", () => {
    safeSend({
      action: "userEvent",
      eventType: "page_unload",
      eventData: { duration: Date.now() - performance.timeOrigin },
      url: window.location.href,
      timestamp: Date.now(),
    });
  });
}
