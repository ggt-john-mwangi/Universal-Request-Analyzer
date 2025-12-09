# User Personas & Browsing Metrics Guide

## Overview
This document expands on the user-centric approach by identifying different user types and the browsing metrics they care about.

---

## User Personas

### 1. 👨‍💻 **Web Developer**
**Primary Goals:**
- Debug API issues during development
- Optimize request performance
- Ensure proper caching strategies

**Key Questions:**
- "Why is my API call failing?"
- "Which endpoint is slowest?"
- "Are my static assets being cached properly?"
- "What's the waterfall view of page load?"

**Relevant Metrics:**
- Request/Response timing breakdown (DNS, TCP, SSL, TTFB, Download)
- HTTP status codes distribution
- API endpoint response times
- Cache hit/miss ratio
- Request payload sizes

**Current Support:** ✅ Fully supported with Domain → Page → Type filtering

---

### 2. 🧪 **QA/Test Engineer**
**Primary Goals:**
- Verify API contracts across environments
- Catch regressions in performance
- Validate error handling
- Test different network conditions

**Key Questions:**
- "Are all error scenarios handled correctly?"
- "Has performance regressed since last release?"
- "Which requests fail on slow networks?"
- "Do we have proper retry logic?"

**Relevant Metrics:**
- Error rates by status code (4xx, 5xx)
- Performance percentiles (P50, P95, P99)
- Failed request patterns
- Retry attempts and success rates
- Time-based performance trends

**Current Support:** ✅ Supported via Analytics filters and percentiles

---

### 3. 📊 **Performance Engineer**
**Primary Goals:**
- Optimize page load performance
- Reduce bandwidth usage
- Improve Core Web Vitals
- Monitor real user metrics

**Key Questions:**
- "What are my Core Web Vitals scores?"
- "Which resources are blocking page render?"
- "What's the total page weight?"
- "How does performance vary by geography/network?"

**Relevant Metrics:**
- **Core Web Vitals:**
  - Largest Contentful Paint (LCP)
  - First Input Delay (FID)
  - Cumulative Layout Shift (CLS)
- **Loading Metrics:**
  - Time to First Byte (TTFB)
  - First Contentful Paint (FCP)
  - Time to Interactive (TTI)
- **Resource Metrics:**
  - Total page weight
  - Resource count by type
  - Blocking vs async resources
  - Critical rendering path

**Current Support:** 🔄 Partial - Request timing available, need page-level Web Vitals

---

### 4. 🔒 **Security Analyst**
**Primary Goals:**
- Identify security vulnerabilities
- Detect data leaks
- Monitor third-party scripts
- Ensure secure connections

**Key Questions:**
- "Are there any mixed content warnings?"
- "Which third-party domains are being contacted?"
- "Are credentials being sent over insecure connections?"
- "Are there any suspicious API calls?"

**Relevant Metrics:**
- Protocol security (HTTP vs HTTPS)
- Third-party domain classification
- Request headers analysis
- Cookie transmission patterns
- CORS policy violations

**Current Support:** ⏳ Not yet implemented - Need security issue detection

---

### 5. 📱 **Product Manager**
**Primary Goals:**
- Monitor user experience metrics
- Track feature usage
- Understand performance impact on users
- Make data-driven decisions

**Key Questions:**
- "How fast is our app for real users?"
- "Which features generate the most requests?"
- "Are users experiencing errors?"
- "How does performance impact engagement?"

**Relevant Metrics:**
- Session duration
- Error rates over time
- Feature usage patterns (via request patterns)
- Performance trends
- User satisfaction proxies

**Current Support:** ✅ Supported via Dashboard and Analytics

---

### 6. 🎨 **Frontend Developer**
**Primary Goals:**
- Optimize asset loading
- Reduce bundle sizes
- Implement efficient caching
- Debug UI performance

**Key Questions:**
- "Which JavaScript bundles are largest?"
- "Are images optimized?"
- "What's the render-blocking resource count?"
- "How can I reduce initial page load?"

**Relevant Metrics:**
- Asset sizes by type (JS, CSS, images, fonts)
- Asset load timing
- Render-blocking resources
- Lazy-loaded resource timing
- CDN performance

**Current Support:** ✅ Supported via Request Type filtering and size metrics

---

## Browsing Metrics Categories

### 1. **Navigation Timing Metrics** ✅ Currently Captured
```javascript
{
  dns: 50,           // DNS lookup time
  tcp: 30,           // TCP connection time
  ssl: 20,           // SSL handshake time
  ttfb: 100,         // Time to First Byte
  download: 200      // Download time
}
```

**Use Cases:**
- Identifying network bottlenecks
- Diagnosing slow server responses
- Optimizing connection reuse

---

### 2. **Resource Timing Metrics** ✅ Currently Captured
```javascript
{
  type: 'script',
  size: 125000,
  duration: 250,
  transferSize: 124000,
  encodedSize: 125000,
  decodedSize: 500000
}
```

**Use Cases:**
- Identifying large resources
- Checking compression effectiveness
- Monitoring CDN performance

---

### 3. **Core Web Vitals** 🔄 Partial Support

#### Largest Contentful Paint (LCP)
- **What:** Time until largest content element is visible
- **Target:** < 2.5 seconds
- **Captured:** ⏳ Not yet - needs browser API integration

#### First Input Delay (FID)
- **What:** Time from first user interaction to browser response
- **Target:** < 100 milliseconds
- **Captured:** ⏳ Not yet - needs event listener

#### Cumulative Layout Shift (CLS)
- **What:** Visual stability score
- **Target:** < 0.1
- **Captured:** ⏳ Not yet - needs layout shift observer

**Implementation Path:**
```javascript
// In content script
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      captureMetric('LCP', entry.startTime);
    }
  }
});
observer.observe({type: 'largest-contentful-paint', buffered: true});
```

---

### 4. **Page Load Metrics** 🔄 Partial Support

#### Time to First Byte (TTFB)
- **Status:** ✅ Captured per request
- **Enhancement:** Aggregate page-level TTFB

#### First Contentful Paint (FCP)
- **Status:** ⏳ Not yet
- **API:** `performance.getEntriesByType('paint')`

#### Time to Interactive (TTI)
- **Status:** ⏳ Not yet
- **Calculation:** Complex - when page is fully interactive

#### DOMContentLoaded
- **Status:** ⏳ Not yet
- **API:** `performance.timing.domContentLoadedEventEnd`

#### Load Event
- **Status:** ⏳ Not yet
- **API:** `performance.timing.loadEventEnd`

---

### 5. **User Experience Metrics** 🔄 Partial Support

#### Session Duration
- **Status:** ✅ Already in schema (`bronze_sessions.duration`)
- **Display:** Need to add to Dashboard

#### Error Frequency
- **Status:** ✅ Captured and displayed
- **Enhancement:** Group by error type

#### Slow Request Threshold Violations
- **Status:** ✅ Captured in Dashboard
- **Enhancement:** Configurable thresholds per domain

---

### 6. **Security Metrics** ⏳ Not Yet Implemented

#### Mixed Content Detection
```javascript
{
  pageProtocol: 'https',
  resourceProtocol: 'http',
  resourceType: 'script',
  securityIssue: 'mixed-content',
  severity: 'high'
}
```

#### Third-Party Domain Tracking
```javascript
{
  domain: 'analytics.google.com',
  classification: 'third-party-analytics',
  requestCount: 15,
  dataTransferred: 50000
}
```

#### Insecure Request Detection
```javascript
{
  url: 'http://api.example.com',
  securityIssue: 'insecure-protocol',
  recommendation: 'Use HTTPS'
}
```

---

## Implementation Roadmap

### Phase 1: Enhanced Performance Metrics ⏳
**Priority:** High
**Timeline:** Next sprint

1. **Core Web Vitals Integration**
   - Add PerformanceObserver for LCP, FID, CLS
   - Store in `bronze_performance_entries` table
   - Display in Dashboard with color-coded targets

2. **Page-Level Timing Metrics**
   - Capture FCP, TTI, DOMContentLoaded, Load
   - Add to page filter dropdown
   - Show in Performance tab

3. **User Session Metrics**
   - Display session duration in Dashboard
   - Add session-based filtering
   - Track requests per session

### Phase 2: Security Features ⏳
**Priority:** Medium
**Timeline:** Future sprint

1. **Mixed Content Detection**
   - Scan for HTTP resources on HTTPS pages
   - Add security alerts
   - Display in new Security tab

2. **Third-Party Domain Classification**
   - Auto-classify common domains (CDNs, analytics, ads)
   - Add first-party vs third-party filter
   - Show privacy implications

3. **Security Score**
   - Calculate page security score
   - Show security grade (A-F)
   - Provide recommendations

### Phase 3: Advanced Analytics ⏳
**Priority:** Low
**Timeline:** Future

1. **Geographic Performance**
   - Track performance by region (if available)
   - Compare performance across locations

2. **Network Condition Simulation**
   - Show performance on 3G, 4G, WiFi
   - Identify slow network issues

3. **Custom Metrics**
   - Allow users to define custom metrics
   - Track business-specific KPIs

---

## Current Capabilities by User Type

| User Type | Current Support | Missing Features |
|-----------|----------------|------------------|
| Web Developer | ✅ 90% | Custom metric definitions |
| QA/Test Engineer | ✅ 85% | Automated regression detection |
| Performance Engineer | 🔄 60% | Core Web Vitals, TTI, FCP |
| Security Analyst | ⏳ 20% | Mixed content, third-party classification |
| Product Manager | ✅ 75% | Session analytics dashboard |
| Frontend Developer | ✅ 85% | Bundle analyzer integration |

---

## Metrics Already Captured (✅)

The extension already captures these metrics in the database:

1. **Request-Level:**
   - URL, method, status, type
   - Domain, path, query string
   - Timing breakdown (DNS, TCP, SSL, TTFB, download)
   - Size (request/response)
   - Headers (optional)

2. **Session-Level:**
   - Session ID, duration
   - Request count
   - Events count

3. **Performance:**
   - Performance entries (from PerformanceObserver)
   - Resource timing
   - Server timing (if available)

4. **Analytics:**
   - Response time percentiles
   - Anomaly detection
   - Trend analysis
   - Domain statistics

---

## Quick Reference: Answering User Questions

### Web Developer
- "Debug failing API" → Analytics tab, filter by status 4xx/5xx, inspect endpoint
- "Find slowest endpoint" → Performance tab, sort by response time
- "Check caching" → Filter by resource type, check cache headers

### QA Engineer
- "Find regressions" → Trend Analysis with week-over-week comparison
- "Error rate" → Dashboard error card + Analytics anomaly detection
- "Performance baseline" → Analytics percentiles (P95, P99)

### Performance Engineer
- "Page weight" → Filter by page, sum data transferred
- "Blocking resources" → Request table, filter by type, check timing
- "Core Web Vitals" → ⏳ Coming soon in Phase 1

### Security Analyst
- "Mixed content" → ⏳ Coming soon in Phase 2
- "Third-party domains" → Domain filter, manual classification for now
- "Insecure requests" → Filter by protocol (future enhancement)

### Product Manager
- "User experience" → Dashboard with aggregated metrics
- "Error trends" → Dashboard error rate card + trend analysis
- "Feature usage" → Request patterns by page/endpoint

### Frontend Developer
- "Largest bundles" → Filter type: script, sort by size
- "Render-blocking" → Request table, check timing order
- "Asset optimization" → Size metrics by type

---

## Conclusion

The Universal Request Analyzer already supports most use cases for Web Developers, QA Engineers, and Frontend Developers through its comprehensive filtering and analytics features.

**Next priorities to serve all user types:**
1. Add Core Web Vitals (LCP, FID, CLS) for Performance Engineers
2. Implement security detection for Security Analysts
3. Enhance session analytics for Product Managers

All infrastructure (database schema, filtering system, theme-aware UI) is in place to add these features incrementally.
