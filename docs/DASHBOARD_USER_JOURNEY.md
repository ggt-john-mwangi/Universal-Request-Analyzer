# Dashboard User Journey & Implementation Guide

## Overview

The Dashboard is the **main analytics hub** for historical data analysis across all captured sessions. Unlike the DevTools Panel (real-time), Dashboard provides business intelligence, trend analysis, and performance monitoring over time.

---

## User Journey by Tab

### 1. Overview Tab (Landing Page)

**User Journey:**

```
Select Domain → View high-level metrics → Identify problem areas → Dive into specific tabs
```

**Features:**

- ✅ **Core Web Vitals Cards** (8 metrics)

  - LCP (Largest Contentful Paint) - Target: < 2.5s
  - FID (First Input Delay) - Target: < 100ms
  - CLS (Cumulative Layout Shift) - Target: < 0.1
  - FCP (First Contentful Paint) - Target: < 1.8s
  - TTFB (Time to First Byte) - Target: < 800ms
  - TTI (Time to Interactive) - Target: < 3.8s
  - DCL (DOMContentLoaded) - Target: < 1.5s
  - Load (Page Load Complete) - Target: < 2.5s

- ✅ **Session Metrics Cards** (4 metrics)

  - Avg Session Duration
  - Total Sessions
  - Requests per Session
  - Events per Session

- ✅ **Visual Charts** (4 charts)
  - Request Volume Over Time (line chart)
  - Status Distribution (pie chart)
  - Top Domains (bar chart)
  - Performance Trends (area chart)

**User Value:**

- Quick health check: "Is my site fast? Are there errors?"
- Executive dashboard for non-technical stakeholders
- Navigation hub to specific problem areas

**Example Workflow:**

1. User opens Dashboard → Sees LCP is 4.2s (red)
2. Sees 15% 4xx errors in status pie chart
3. Clicks "Errors" tab to investigate
4. Sees 200 requests to api.example.com → Changes domain filter

---

### 2. Requests Tab

**User Journey:**

```
Browse all requests → Search/filter → View details → Export/Copy cURL
```

**Features:**

- ✅ **Data Table**
  - Columns: Method, URL, Status, Type, Time, Size, Actions
  - Sortable columns
  - Status badges (color-coded)
- ✅ **Search & Filter**
  - Real-time search (URL, method, status)
  - 500ms debounce for performance
- ✅ **Pagination**
  - Options: 10, 25, 50, 100 per page
  - Page navigation with ellipsis
  - Total count display
- ✅ **Actions Per Row**
  - View Details (modal with full request info)
  - Copy as cURL (clipboard export)
  - Error icon (if request failed)
- ✅ **Bulk Export**
  - Export HAR button (all filtered requests)

**User Value:**

- Debug specific requests: "Which API calls are slow?"
- Reproduce issues: Copy cURL to test in Postman/terminal
- Discovery: "What's this unknown request to tracking.com?"
- Share data: Export HAR for backend team

**Example Workflow:**

1. User searches "login" → Finds POST /api/login taking 3.2s
2. Clicks "View Details" → Sees 504 Gateway Timeout
3. Clicks "Copy cURL" → Pastes in terminal to reproduce
4. Clicks "Export HAR" → Shares with backend developer

---

### 3. Performance Tab

**User Journey:**

```
Select endpoint/type → Load history → Identify trends → Optimize slow endpoints
```

**Features:**

- ✅ **Filter Controls**
  - Type Filter (All, Fetch, XHR, Script, Stylesheet, Image, Font, Document, Other)
  - Endpoint Pattern (regex: /api/login, /users/:id)
  - Time Bucket (Hourly, Daily)
  - Load History button
- ✅ **Line Chart**
  - Multiple lines for different endpoints/types
  - Y-axis: Average response time (ms)
  - X-axis: Time buckets (with timestamps)
  - Legend showing endpoint/type names
  - Hover tooltips with exact values

**User Value:**

- Trend analysis: "Is /api/users getting slower over time?"
- Type comparison: "Are images slower than scripts?"
- Spike investigation: "Why was there a 5s spike at 2pm?"
- Optimization tracking: Verify CDN improves load times

**Example Workflow:**

1. User selects "Fetch" type → Clicks "Load History"
2. Sees /api/dashboard averaging 800ms
3. Changes to Daily bucket → Sees it was 200ms yesterday
4. Enters endpoint pattern `/api/dashboard` → Confirms degradation
5. Reports to backend: "Dashboard API degraded 4x in 24h"

---

### 4. Resources Tab

**User Journey:**

```
View size breakdown → Identify largest resources → Check compression → Optimize
```

**Features:**

- ✅ **Pie Chart** (Size Distribution)
  - Resource types: Script, Image, Stylesheet, Font, Document, XHR, Other
  - Percentages and absolute sizes
  - Color-coded slices
- ✅ **Compression Analysis Panel**
  - Total bytes
  - Compressible bytes
  - Compressed bytes
  - Potential savings
  - Compression rate percentage
- ✅ **Resource Table**
  - Columns: Type, Count, Total Size, Avg Size, Max Size, % of Total
  - Sorted by total size descending
  - Formatted bytes (KB, MB)

**User Value:**

- Optimization: "What's making my page heavy?"
- Compression audit: "Are images compressed?"
- Resource planning: "Should we lazy-load images?"
- Bundle analysis: "Is our JavaScript bundle too big?"

**Example Workflow:**

1. User opens Resources tab → Sees "Images: 5.2MB (60%)"
2. Compression shows: "3.8MB compressible, 0% compressed"
3. Table shows max image: 2.1MB
4. Action: Enable image compression on CDN
5. After deploy → Verifies Images drop to 1.5MB

---

### 5. Errors Tab

**User Journey:**

```
View error categories → Browse error list → Click View Details → Copy cURL to reproduce
```

**Features:**

- ✅ **Error Category Cards** (2 cards)
  - 4xx Client Errors (orange border, count)
  - 5xx Server Errors (red border, count)
- ✅ **Error List**
  - Grouped by type (4xx section, 5xx section)
  - Each error: Method, URL, Status, Domain, Page, Error message
  - Actions: View Details, Copy cURL
  - Scrollable (max-height: 400px)
- ✅ **Bar Chart** (Error Distribution)
  - Status codes (404, 500, 503, etc.)
  - Count per status code
  - Color-coded by severity

**User Value:**

- Error monitoring: "How many errors happened today?"
- Root cause: "Why is /api/checkout failing?"
- Reproduction: Copy cURL to test failing requests
- Prioritization: "30x 404s vs 2x 500s - fix 500s first"

**Example Workflow:**

1. Overview shows 25 errors → User clicks "Errors" tab
2. Sees 20x 404s to /old-api/users, 5x 503s to /api/checkout
3. Clicks 404 View Details → Sees page: /product/123
4. Realizes old API path still referenced → Fixes code
5. Clicks 503 → Copy cURL → Tests in terminal
6. Forwards to backend: "Checkout API returns 503 under load"

---

### 6. Analytics Tab

**User Journey:**

```
Advanced analysis → Percentiles → Anomaly detection → Domain comparison
```

**Features:**

- ⚠️ **Percentile Analysis** (PARTIALLY IMPLEMENTED)
  - P50, P75, P90, P95, P99 response times
  - Table showing percentile values
  - Comparison vs targets
- ⚠️ **Anomaly Detection** (NOT IMPLEMENTED)
  - Requests exceeding thresholds
  - Outlier identification
  - Alert triggers
- ⚠️ **Trend Analysis** (NOT IMPLEMENTED)
  - Performance over days/weeks
  - Moving averages
  - Regression detection
- ⚠️ **Domain Comparison** (NOT IMPLEMENTED)
  - Side-by-side metrics
  - Multi-domain charts
  - Performance deltas

**User Value:**

- SLA monitoring: "Are we hitting P95 < 200ms?"
- Outlier detection: "Which requests are in P99?"
- Long-term trends: "Performance degrading over weeks?"
- A/B testing: Compare staging vs production

**Example Workflow:**

1. User views percentiles → P95 is 450ms (SLA: 300ms)
2. Checks anomalies → 12 requests >1s identified
3. Compares domains: Prod P95=450ms, Staging P95=180ms
4. Conclusion: Production has performance regression

---

## Cross-Tab Workflows

### Typical Investigation Flows

**1. High LCP Investigation:**

```
Overview (LCP 4.5s red)
  → Performance tab
  → See /api/products slow (800ms avg)
  → Copy cURL
  → Report to backend
```

**2. Error Spike:**

```
Overview (30% 4xx in status chart)
  → Errors tab
  → See 404s to /images/logo.png
  → Fix broken path in code
```

**3. Large Page Size:**

```
Overview (50 req/session)
  → Resources tab
  → Images 8MB (60%)
  → Enable CDN compression
  → Resources tab shows 2MB (20%)
```

**4. Domain Comparison:**

```
1. Domain filter: example.com → Overview shows metrics
2. Change to api.example.com → Compare metrics
3. Switch to Performance tab → API endpoints slower
4. Action: Optimize API caching
```

---

## Data Requirements & Capture Methods

### Currently Captured (✅)

#### 1. Request Data (Bronze/Silver Tables)

**Source:** `chrome.webRequest` API in background script
**Capture:** Real-time via `request-capture.js`
**Tables:** `bronze_requests`, `silver_requests`

**Fields:**

- id, url, method, domain, page_url
- status, status_text, type
- timestamp, duration, size_bytes
- from_cache, error

**Capture Flow:**

```javascript
webRequest.onBeforeRequest → Store start time
webRequest.onCompleted → Calculate duration, store request
webRequest.onErrorOccurred → Store with error field
```

#### 2. Aggregated Stats (Gold Tables)

**Source:** Automated aggregation from Silver layer
**Trigger:** After each Silver insert
**Tables:** `gold_domain_stats`, `gold_page_stats`

**Metrics:**

- total_requests, unique_pages, avg_duration
- total_bytes, cache_hit_rate
- error_4xx_count, error_5xx_count
- response time percentiles (P50, P90, P95)

---

### Missing Data (❌ - Needs Implementation)

#### 1. Core Web Vitals

**Status:** ❌ NOT CAPTURED
**Required for:** Overview tab metrics cards

**What's needed:**

- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
- FCP (First Contentful Paint)
- TTFB (Time to First Byte)
- TTI (Time to Interactive)
- DCL (DOMContentLoaded event timing)
- Load (window.onload timing)

**Capture Method:**

```javascript
// In content script (content.js)
// Use PerformanceObserver API

// 1. LCP
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  reportMetric("LCP", lastEntry.renderTime || lastEntry.loadTime);
}).observe({ type: "largest-contentful-paint", buffered: true });

// 2. FID
new PerformanceObserver((list) => {
  const firstInput = list.getEntries()[0];
  reportMetric("FID", firstInput.processingStart - firstInput.startTime);
}).observe({ type: "first-input", buffered: true });

// 3. CLS
let clsValue = 0;
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      clsValue += entry.value;
    }
  }
  reportMetric("CLS", clsValue);
}).observe({ type: "layout-shift", buffered: true });

// 4. Navigation Timing (TTFB, DCL, Load)
window.addEventListener("load", () => {
  const navTiming = performance.getEntriesByType("navigation")[0];
  reportMetric("TTFB", navTiming.responseStart - navTiming.requestStart);
  reportMetric(
    "DCL",
    navTiming.domContentLoadedEventEnd - navTiming.navigationStart
  );
  reportMetric("Load", navTiming.loadEventEnd - navTiming.navigationStart);
  reportMetric("FCP", navTiming.firstContentfulPaint);
  reportMetric("TTI", calculateTTI(navTiming)); // Needs custom calculation
});

function reportMetric(name, value) {
  chrome.runtime.sendMessage({
    action: "recordWebVital",
    metric: { name, value, url: window.location.href, timestamp: Date.now() },
  });
}
```

**Database Schema:**

```sql
CREATE TABLE IF NOT EXISTS bronze_web_vitals (
  id TEXT PRIMARY KEY,
  page_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  metric_name TEXT NOT NULL, -- 'LCP', 'FID', 'CLS', etc.
  value REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  user_agent TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER
);

CREATE INDEX idx_web_vitals_domain ON bronze_web_vitals(domain);
CREATE INDEX idx_web_vitals_page ON bronze_web_vitals(page_url);
CREATE INDEX idx_web_vitals_timestamp ON bronze_web_vitals(timestamp);
```

---

#### 2. Session Data

**Status:** ❌ NOT CAPTURED
**Required for:** Overview tab session metrics

**What's needed:**

- Session ID (unique per browser session)
- Session start/end timestamp
- Session duration (calculated)
- Requests per session (count)
- Events per session (user interactions)
- Pages visited per session

**Capture Method:**

```javascript
// In background script (background-medallion.js)
// Track sessions with unique ID and timing

class SessionManager {
  constructor() {
    this.currentSession = null;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.lastActivityTime = null;
  }

  async startSession() {
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      domain: null, // Set when first request captured
      requestCount: 0,
      eventCount: 0,
      pagesVisited: new Set(),
    };

    await this.saveSession();
  }

  async recordActivity(type, data) {
    if (!this.currentSession || this.isSessionExpired()) {
      await this.startSession();
    }

    this.lastActivityTime = Date.now();

    if (type === "request") {
      this.currentSession.requestCount++;
      if (data.domain) this.currentSession.domain = data.domain;
    } else if (type === "event") {
      this.currentSession.eventCount++;
    } else if (type === "pageVisit") {
      this.currentSession.pagesVisited.add(data.url);
    }

    await this.saveSession();
  }

  async endSession() {
    if (!this.currentSession) return;

    const session = {
      ...this.currentSession,
      endTime: Date.now(),
      duration: Date.now() - this.currentSession.startTime,
      pagesCount: this.currentSession.pagesVisited.size,
    };

    await dbManager.insertSession(session);
    this.currentSession = null;
  }

  isSessionExpired() {
    return (
      this.lastActivityTime &&
      Date.now() - this.lastActivityTime > this.sessionTimeout
    );
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

**Database Schema:**

```sql
CREATE TABLE IF NOT EXISTS bronze_sessions (
  id TEXT PRIMARY KEY,
  domain TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration INTEGER, -- milliseconds
  request_count INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  pages_count INTEGER DEFAULT 0,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_domain ON bronze_sessions(domain);
CREATE INDEX idx_sessions_start ON bronze_sessions(start_time);
```

---

#### 3. User Events

**Status:** ❌ NOT CAPTURED
**Required for:** Session metrics (events per session)

**What's needed:**

- Click events
- Scroll events
- Form submissions
- Navigation events
- Custom events (from app code)

**Capture Method:**

```javascript
// In content script (content.js)
// Track user interactions

const eventTracker = {
  sessionId: null,

  init() {
    // Click tracking
    document.addEventListener(
      "click",
      (e) => {
        this.recordEvent("click", {
          target: e.target.tagName,
          className: e.target.className,
          x: e.clientX,
          y: e.clientY,
        });
      },
      { passive: true }
    );

    // Scroll tracking (throttled)
    let scrollTimeout;
    document.addEventListener(
      "scroll",
      () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.recordEvent("scroll", {
            scrollY: window.scrollY,
            scrollX: window.scrollX,
          });
        }, 1000);
      },
      { passive: true }
    );

    // Form submissions
    document.addEventListener("submit", (e) => {
      this.recordEvent("form_submit", {
        action: e.target.action,
        method: e.target.method,
      });
    });

    // Page visibility
    document.addEventListener("visibilitychange", () => {
      this.recordEvent("visibility", {
        hidden: document.hidden,
      });
    });
  },

  recordEvent(type, data) {
    chrome.runtime.sendMessage({
      action: "recordEvent",
      event: {
        type,
        data,
        url: window.location.href,
        timestamp: Date.now(),
      },
    });
  },
};

eventTracker.init();
```

**Database Schema:**

```sql
CREATE TABLE IF NOT EXISTS bronze_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  page_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'click', 'scroll', 'form_submit', etc.
  event_data TEXT, -- JSON string with event details
  timestamp INTEGER NOT NULL
);

CREATE INDEX idx_events_session ON bronze_events(session_id);
CREATE INDEX idx_events_domain ON bronze_events(domain);
CREATE INDEX idx_events_timestamp ON bronze_events(timestamp);
```

---

#### 4. Resource Timing Details

**Status:** ⚠️ PARTIALLY CAPTURED
**Current:** Basic size_bytes from webRequest
**Missing:** Detailed timing breakdown

**What's needed:**

- DNS lookup time
- TCP connection time
- TLS negotiation time
- Request time
- Response time
- Content download time
- Transfer size vs decoded size
- Compression info

**Capture Method:**

```javascript
// In content script (content.js)
// Use Resource Timing API

window.addEventListener("load", () => {
  const resources = performance.getEntriesByType("resource");

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
      transferSize: resource.transferSize, // Over network
      encodedSize: resource.encodedBodySize, // Compressed
      decodedSize: resource.decodedBodySize, // Uncompressed

      // Cache info
      fromCache: resource.transferSize === 0 && resource.encodedBodySize > 0,

      timestamp: resource.startTime + performance.timeOrigin,
    };

    chrome.runtime.sendMessage({
      action: "recordResourceTiming",
      timing,
    });
  });
});
```

**Database Schema Enhancement:**

```sql
-- Add columns to bronze_requests or create separate table
ALTER TABLE bronze_requests ADD COLUMN dns_time INTEGER;
ALTER TABLE bronze_requests ADD COLUMN tcp_time INTEGER;
ALTER TABLE bronze_requests ADD COLUMN tls_time INTEGER;
ALTER TABLE bronze_requests ADD COLUMN request_time INTEGER;
ALTER TABLE bronze_requests ADD COLUMN response_time INTEGER;
ALTER TABLE bronze_requests ADD COLUMN transfer_size INTEGER;
ALTER TABLE bronze_requests ADD COLUMN encoded_size INTEGER;
ALTER TABLE bronze_requests ADD COLUMN decoded_size INTEGER;
```

---

## Implementation Checklist

### Phase 1: Core Functionality (✅ COMPLETE)

- [x] Tab structure and navigation
- [x] Domain filter integration
- [x] Time range filter
- [x] Overview tab UI
- [x] Requests tab with table
- [x] Performance tab with chart
- [x] Resources tab with pie chart
- [x] Errors tab with error list
- [x] Analytics tab structure
- [x] View Details modal
- [x] Copy as cURL functionality
- [x] Export HAR feature
- [x] Search and pagination
- [x] Responsive layouts
- [x] Theme support (dark/light)

### Phase 2: Data Capture (❌ MISSING)

- [ ] **Core Web Vitals Capture**

  - [ ] Implement PerformanceObserver in content script
  - [ ] Create bronze_web_vitals table
  - [ ] Add message handler in background
  - [ ] Aggregate to Gold layer
  - [ ] Wire to Overview tab cards

- [ ] **Session Management**

  - [ ] Create SessionManager class
  - [ ] Track session lifecycle
  - [ ] Store session data in DB
  - [ ] Calculate session metrics
  - [ ] Wire to Overview tab session cards

- [ ] **Event Tracking**

  - [ ] Implement event listeners in content script
  - [ ] Create bronze_events table
  - [ ] Link events to sessions
  - [ ] Aggregate event counts
  - [ ] Wire to session metrics

- [ ] **Resource Timing**
  - [ ] Capture Resource Timing API data
  - [ ] Enhance bronze_requests schema
  - [ ] Store detailed timing breakdown
  - [ ] Calculate compression savings
  - [ ] Wire to Resources tab compression panel

### Phase 3: Analytics Features (⚠️ PARTIAL)

- [ ] **Percentile Analysis**

  - [x] Basic percentile calculation in Gold layer
  - [ ] Percentile table UI in Analytics tab
  - [ ] Percentile trend charts
  - [ ] SLA threshold indicators

- [ ] **Anomaly Detection**

  - [ ] Define anomaly rules (> 3σ, > P99, etc.)
  - [ ] Real-time anomaly detection
  - [ ] Anomaly list UI
  - [ ] Alert notifications

- [ ] **Trend Analysis**

  - [ ] Moving average calculations
  - [ ] Week-over-week comparisons
  - [ ] Regression detection algorithm
  - [ ] Trend chart UI

- [ ] **Domain Comparison**
  - [ ] Multi-domain query API
  - [ ] Comparison table UI
  - [ ] Side-by-side charts
  - [ ] Delta calculations

### Phase 4: Enhancements

- [ ] **Real-time Updates**

  - [ ] WebSocket or polling for live data
  - [ ] Auto-refresh charts
  - [ ] Live request count
  - [ ] Notification badges

- [ ] **Export & Reporting**

  - [ ] PDF report generation
  - [ ] CSV export for all tables
  - [ ] Scheduled reports
  - [ ] Email integration

- [ ] **Custom Dashboards**

  - [ ] Save custom filter sets
  - [ ] Create custom charts
  - [ ] Widget library
  - [ ] Dashboard templates

- [ ] **Advanced Filtering**
  - [ ] Filter builder UI
  - [ ] Save filter presets
  - [ ] Boolean operators (AND/OR)
  - [ ] Regex support for all fields

---

## Database Schema Summary

### Existing Tables (✅)

```sql
-- Current captured data
bronze_requests (id, url, method, domain, page_url, status, type, timestamp, duration, size_bytes, from_cache, error)
silver_requests (cleaned & validated version of bronze)
gold_domain_stats (aggregated by domain)
gold_page_stats (aggregated by page)
```

### New Tables Needed (❌)

```sql
-- Web Vitals
bronze_web_vitals (id, page_url, domain, metric_name, value, timestamp, viewport_*)

-- Sessions
bronze_sessions (id, domain, start_time, end_time, duration, request_count, event_count, pages_count)

-- Events
bronze_events (id, session_id, page_url, domain, event_type, event_data, timestamp)

-- Gold aggregations
gold_web_vitals_stats (domain, metric_name, p50, p75, p90, p95, p99, avg, min, max, sample_count)
gold_session_stats (domain, avg_duration, avg_requests, avg_events, total_sessions)
```

---

## Message Handlers Needed

### In background/messaging/message-handler.js

```javascript
// Add these handlers:
case 'recordWebVital':
  return await dbManager.medallion.insertWebVital(request.metric);

case 'recordEvent':
  return await sessionManager.recordEvent(request.event);

case 'recordResourceTiming':
  return await dbManager.medallion.updateResourceTiming(request.timing);

case 'getWebVitalsStats':
  return await dbManager.medallion.getWebVitalsStats(request.filters);

case 'getSessionStats':
  return await dbManager.medallion.getSessionStats(request.filters);
```

---

## Testing Checklist

### Manual Testing

- [ ] **Overview Tab**

  - [ ] All 8 Core Web Vitals cards display
  - [ ] Color coding (green/orange/red) correct
  - [ ] All 4 session metrics display
  - [ ] All 4 charts render
  - [ ] Charts update when domain filter changes
  - [ ] Charts update when time range changes

- [ ] **Requests Tab**

  - [ ] Table loads with data
  - [ ] Search filters results (500ms debounce)
  - [ ] Pagination works (prev/next/direct)
  - [ ] Per-page selector updates table
  - [ ] View Details modal opens
  - [ ] Modal shows all request fields
  - [ ] Copy cURL copies to clipboard
  - [ ] Export HAR downloads file
  - [ ] Status badges color-coded

- [ ] **Performance Tab**

  - [ ] Type filter works
  - [ ] Endpoint pattern filter works
  - [ ] Time bucket selector works
  - [ ] Load History button fetches data
  - [ ] Chart displays multiple lines
  - [ ] Legend shows endpoint/type names
  - [ ] Hover tooltip shows values

- [ ] **Resources Tab**

  - [ ] Pie chart displays
  - [ ] All resource types shown
  - [ ] Compression panel shows stats
  - [ ] Table lists all resource types
  - [ ] Sizes formatted correctly (KB/MB)
  - [ ] Percentages add up to 100%

- [ ] **Errors Tab**

  - [ ] Error category cards display
  - [ ] 4xx and 5xx counts correct
  - [ ] Error list grouped by type
  - [ ] View Details works for errors
  - [ ] Copy cURL works for errors
  - [ ] Error distribution chart displays
  - [ ] Chart shows all status codes

- [ ] **Analytics Tab**
  - [ ] Percentile table displays
  - [ ] All percentiles calculated
  - [ ] Anomaly detection works (when implemented)
  - [ ] Trend charts display (when implemented)
  - [ ] Domain comparison works (when implemented)

### Cross-Tab Testing

- [ ] Domain filter updates all tabs
- [ ] Time range filter updates all tabs
- [ ] Tab switching preserves filters
- [ ] Charts don't flicker on tab switch
- [ ] Data consistency across tabs

### Performance Testing

- [ ] Large datasets (10k+ requests) load without lag
- [ ] Search is responsive (< 100ms delay)
- [ ] Charts render in < 500ms
- [ ] Pagination is instant
- [ ] No memory leaks after extended use

### Browser Compatibility

- [ ] Chrome (MV3)
- [ ] Firefox (MV3)
- [ ] Edge (Chromium)
- [ ] Dark theme works in all browsers
- [ ] Light theme works in all browsers

---

## Priority Implementation Order

### P0 (Critical - Needed for MVP)

1. ✅ Tab structure and navigation
2. ✅ Requests tab with table/search/pagination
3. ✅ View Details modal
4. ✅ Copy cURL and Export HAR

### P1 (High - Core Analytics)

1. ❌ Core Web Vitals capture & display
2. ❌ Session management & metrics
3. ✅ Performance tab with history chart
4. ✅ Resources tab with breakdown
5. ✅ Errors tab with error list

### P2 (Medium - Enhanced Analytics)

1. ❌ Event tracking
2. ❌ Resource timing details
3. ⚠️ Percentile analysis (partial)
4. ❌ Anomaly detection
5. ❌ Trend analysis

### P3 (Low - Advanced Features)

1. ❌ Domain comparison
2. ❌ Real-time updates
3. ❌ PDF/CSV export
4. ❌ Custom dashboards
5. ❌ Advanced filtering

---

## Summary

**Current Status:**

- ✅ UI structure: 100% complete
- ✅ Request data: 100% captured
- ❌ Web Vitals: 0% captured
- ❌ Sessions: 0% captured
- ❌ Events: 0% captured
- ⚠️ Resource timing: 30% captured
- ⚠️ Analytics: 40% complete

**Next Steps:**

1. Implement Core Web Vitals capture (PerformanceObserver)
2. Implement Session management (SessionManager class)
3. Wire Web Vitals data to Overview tab
4. Wire Session data to Overview tab
5. Complete Analytics tab features

**Estimated Effort:**

- Core Web Vitals: 2-3 days
- Session Management: 2-3 days
- Event Tracking: 1-2 days
- Resource Timing: 1 day
- Analytics Features: 3-5 days
- **Total: ~2 weeks**
