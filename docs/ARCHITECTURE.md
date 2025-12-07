# Universal Request Analyzer - Complete Architecture Overview

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Data Architecture](#data-architecture)
3. [Code Organization](#code-organization)
4. [Component Architecture](#component-architecture)
5. [Analytics & Reporting](#analytics--reporting)
6. [Development Workflow](#development-workflow)

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
├─────────────────────────────────────────────────────────────┤
│  Popup UI  │  Options Page  │  DevTools Panel  │  Content   │
├─────────────────────────────────────────────────────────────┤
│                    Shared Library (/lib)                     │
│  UI Components │ Core Classes │ Managers │ Utilities         │
├─────────────────────────────────────────────────────────────┤
│                   Background Service Worker                   │
│  Request Capture │ Event Bus │ Message Handler               │
├─────────────────────────────────────────────────────────────┤
│                  Database Layer (SQLite)                     │
│  Config Schema │ Bronze │ Silver │ Gold │ Star Schema        │
└─────────────────────────────────────────────────────────────┘
```

## Data Architecture

### Medallion Architecture with Star Schema

```
┌──────────────────────────────────────────────────────────────┐
│ CONFIG SCHEMA - Application Configuration                    │
│ • App Settings  • Feature Flags  • User Preferences          │
│ • Performance Settings  • Storage Settings  • Export Settings│
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ BRONZE SCHEMA - Raw OLTP Data                                │
│ • Requests  • Headers  • Timings  • Events  • Sessions       │
│ • Errors  • Performance Entries                              │
│ Characteristics: Immutable, Complete, Timestamped            │
└──────────────────────────────────────────────────────────────┘
                              ↓
                        Data Processing
                  (Validation & Enrichment)
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ SILVER SCHEMA - Curated Data + STAR SCHEMA                   │
│ Curated Tables:                                              │
│ • Validated Requests  • Metrics  • Domain Stats              │
│ • Resource Stats  • Tags                                     │
│                                                              │
│ Star Schema Dimensions:                                      │
│ • dim_time (Multi-timeframe)                                │
│ • dim_domain (SCD Type 2)                                   │
│ • dim_resource_type                                         │
│ • dim_status_code                                           │
│                                                              │
│ Star Schema Facts:                                           │
│ • fact_requests (Atomic metrics)                            │
│ • fact_ohlc_performance (OHLC aggregates)                   │
│ • fact_performance_trends (Trend tracking)                   │
│ • fact_quality_metrics (Quality scores)                      │
│                                                              │
│ Characteristics: Validated, Enriched, Indexed, Analytical    │
└──────────────────────────────────────────────────────────────┘
                              ↓
                        Aggregation
                  (Daily/Weekly/Monthly)
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ GOLD SCHEMA - Analytics & Insights                           │
│ • Daily Analytics  • Performance Insights                    │
│ • Domain Performance  • Optimization Opportunities           │
│ • Trends  • Anomalies                                        │
│ Characteristics: Aggregated, Historical, Actionable          │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Browser Event → Bronze (Raw) → Silver (Validated + Star Schema) → Gold (Analytics)
                    ↓               ↓                                  ↓
                Immutable      Fact Tables                      Pre-aggregated
                Complete       Dimensions                       Insights
                Audit Trail    OHLC Data                        Trends
```

## Code Organization

### Directory Structure

```
src/
├── lib/                          # Shared Library (NEW)
│   ├── core/                     # Core Classes
│   │   └── DataManager.js        # Base data management
│   ├── ui/                       # UI Components
│   │   ├── BaseComponent.js      # Base component class
│   │   ├── ChartManager.js       # Chart management
│   │   └── NotificationManager.js # Notifications
│   ├── managers/                 # Feature Managers
│   │   └── ExportManager.js      # Export/Import
│   ├── utils/                    # Utilities
│   │   └── helpers.js            # Helper functions
│   └── index.js                  # Main entry point
│
├── background/                   # Background Service Worker
│   ├── database/                 # Database Layer
│   │   ├── medallion-schema.js   # Medallion architecture
│   │   ├── star-schema.js        # Star schema with SCD2
│   │   ├── medallion-manager.js  # Data flow orchestration
│   │   ├── config-schema-manager.js # Config management
│   │   ├── analytics-processor.js # OHLC & analytics
│   │   ├── medallion-migration.js # Data migration
│   │   └── db-manager-medallion.js # Main DB manager
│   ├── capture/                  # Request Capture
│   ├── messaging/                # Event Bus & Handlers
│   ├── api/                      # API Services
│   ├── auth/                     # Authentication
│   ├── security/                 # Security & Encryption
│   └── background.js             # Main entry point
│
├── popup/                        # Popup UI
│   ├── components/               # UI Components
│   └── popup.html                # Popup page
│
├── options/                      # Options Page
│   ├── components/               # UI Components
│   └── options.html              # Options page
│
├── devtools/                     # DevTools Panel
│   └── devtools.html             # DevTools page
│
└── content/                      # Content Scripts
    └── content.js                # Content script
```

### Shared Library Benefits

1. **No Code Duplication**: Single source of truth
2. **Reusable Classes**: BaseComponent, ChartManager, etc.
3. **Consistent Behavior**: Same utilities everywhere
4. **Easy Maintenance**: Update once, apply everywhere
5. **Better Testing**: Test shared code once

## Component Architecture

### Base Component Pattern

All UI components extend `BaseComponent`:

```javascript
import { BaseComponent } from '@/lib/ui/BaseComponent.js';

class RequestList extends BaseComponent {
  async onInit() {
    // Initialization
  }
  
  setupEventListeners() {
    // Event handlers
  }
  
  render() {
    // Rendering logic
  }
  
  onDestroy() {
    // Cleanup
  }
}
```

### Manager Classes

Encapsulate complex functionality:

- **DataManager**: CRUD operations with caching
- **FilterManager**: Multi-filter support
- **SortManager**: Flexible sorting
- **PaginationManager**: Pagination logic
- **ChartManager**: Chart lifecycle
- **NotificationManager**: User feedback
- **ExportManager**: Data export/import

## Analytics & Reporting

### Supported Timeframes

```javascript
const timeframes = [
  '1min',   // 1 minute
  '5min',   // 5 minutes
  '15min',  // 15 minutes
  '1h',     // 1 hour
  '4h',     // 4 hours
  '1d',     // 1 day
  '1w',     // 1 week
  '1m'      // 1 month
];
```

### OHLC Analytics

Similar to Forex candlestick charts:

```javascript
{
  open: 150,      // First request time
  high: 500,      // Slowest request
  low: 50,        // Fastest request
  close: 200,     // Last request time
  volume: 1000,   // Request count
  period: '4h'    // Timeframe
}
```

### Quality Metrics

Comprehensive site quality assessment:

- **Availability Rate**: Success percentage
- **Performance Index**: Weighted score (0-100)
- **Reliability Score**: Consistency measure
- **Security Score**: HTTPS usage
- **Cache Hit Rate**: Cache efficiency

### SCD Type 2 Tracking

Domain attributes tracked over time:

```javascript
// Version 1
{ domain: 'api.example.com', risk: 'low', valid: [t1, t2], current: false }

// Version 2 (after risk increased)
{ domain: 'api.example.com', risk: 'high', valid: [t2, null], current: true }
```

## Development Workflow

### 1. Request Capture

```javascript
// Browser makes request
→ Request Intercepted
→ Insert to Bronze Schema (raw data)
→ Queue for processing
```

### 2. Data Processing

```javascript
// Background processor
→ Read from Bronze
→ Validate & Enrich
→ Insert to Silver (curated + facts)
→ Update dimensions (SCD Type 2)
→ Queue for aggregation
```

### 3. Analytics Generation

```javascript
// Periodic processor
→ Read from Silver/Facts
→ Calculate OHLC for timeframes
→ Generate quality metrics
→ Calculate trends
→ Insert to Gold (analytics)
```

### 4. UI Display

```javascript
// User opens dashboard
→ Query Gold/Silver schemas
→ Load OHLC data for selected timeframe
→ Render charts using ChartManager
→ Display quality metrics
```

## Key Features

### 1. Multi-Timeframe Analysis

View performance at any granularity:
- **Real-time**: 1min, 5min
- **Short-term**: 15min, 1h
- **Mid-term**: 4h, 1d
- **Long-term**: 1w, 1m

### 2. Historical Tracking

Complete audit trail:
- All raw requests in Bronze
- SCD Type 2 domain history
- Trend analysis in Gold

### 3. Performance Insights

- OHLC candlestick charts
- Percentile calculations (P50, P95, P99)
- Performance distribution
- Error rate tracking

### 4. Quality Monitoring

- Availability tracking
- Performance scoring
- Reliability measurement
- Security assessment

### 5. Flexible Querying

Star schema enables:
- Drill-down by domain
- Drill-down by resource type
- Time-series analysis
- Cross-dimensional analysis

## Configuration

### Application Settings

```javascript
// Via ConfigSchemaManager
await configManager.setAppSetting('theme', 'dark', {
  category: 'ui',
  description: 'UI theme preference'
});

const theme = await configManager.getAppSetting('theme');
```

### Feature Flags

```javascript
// Gradual rollout
await configManager.setFeatureFlag('newFeature', true, {
  rolloutPercentage: 25  // 25% of users
});

const isEnabled = await configManager.getFeatureFlag('newFeature');
```

### Performance Settings

```javascript
await configManager.updatePerformanceSettings({
  enabled: true,
  samplingRate: 100,
  captureNavigationTiming: true
});
```

## Best Practices

### 1. Data Layer

✅ **Do:**
- Write to Bronze first
- Let system process to Silver/Gold
- Use Config schema for settings
- Query appropriate layer (Silver for UI, Gold for dashboards)

❌ **Don't:**
- Write directly to Silver/Gold
- Skip Bronze layer
- Store config in Bronze/Silver/Gold

### 2. Components

✅ **Do:**
- Extend BaseComponent
- Use shared utilities from /lib
- Implement proper cleanup
- Emit events for communication

❌ **Don't:**
- Duplicate code between popup/options
- Create new utility functions
- Skip lifecycle methods

### 3. Analytics

✅ **Do:**
- Choose appropriate timeframe
- Use OHLC for performance trends
- Cache aggregated data
- Index fact tables properly

❌ **Don't:**
- Query Bronze for analytics
- Recalculate aggregates on every query
- Skip dimension lookups

## Performance Optimization

### 1. Database

- Indexes on all foreign keys
- Compound indexes on frequently queried columns
- Periodic VACUUM
- Archive old Bronze data

### 2. Caching

- Cache dimension lookups
- Cache configuration
- Pre-calculate OHLC
- Store aggregates in Gold

### 3. Query Optimization

- Use star schema for complex queries
- Leverage pre-aggregated OHLC data
- Filter by dimensions
- Limit result sets with pagination

## Future Enhancements

1. **Machine Learning Layer**
   - Anomaly detection
   - Performance predictions
   - Optimization recommendations

2. **Real-time Streaming**
   - Live OHLC updates
   - WebSocket support
   - Real-time dashboards

3. **Advanced Analytics**
   - Correlation analysis
   - Regression analysis
   - Forecasting

4. **Data Export**
   - External BI tools integration
   - API for analytics
   - Scheduled exports

5. **Partitioning**
   - Time-based partitions
   - Archive old data
   - Improve query performance
