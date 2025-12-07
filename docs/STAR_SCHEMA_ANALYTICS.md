# Star Schema & Analytics Documentation

## Overview

The Universal Request Analyzer implements a **Star Schema** for dimensional analytics with **SCD Type 2** (Slowly Changing Dimensions) support. This enables powerful timeframe-based analysis similar to Forex trading platforms.

## Star Schema Architecture

### Dimension Tables

#### 1. Time Dimension (`dim_time`)
Multi-granularity time tracking with support for 8 timeframes.

**Timeframes Supported:**
- `1min` - 1 minute periods
- `5min` - 5 minute periods
- `15min` - 15 minute periods
- `1h` - 1 hour periods
- `4h` - 4 hour periods
- `1d` - Daily periods
- `1w` - Weekly periods
- `1m` - Monthly periods

**Columns:**
- `time_key` - Primary key
- `timestamp` - Unix timestamp
- `year, quarter, month, week, day, hour, minute` - Date/time components
- `day_of_week, day_of_year` - Calendar metadata
- `is_weekend, is_business_hour` - Contextual flags
- `period_1min ... period_1m` - Period identifiers for each timeframe

**Usage:**
```javascript
const timeKey = getOrCreateTimeDimensionKey(db, timestamp);
```

#### 2. Domain Dimension with SCD Type 2 (`dim_domain`)
Tracks domain attributes with full historical versioning.

**SCD Type 2 Implementation:**
- Maintains complete history of attribute changes
- Each change creates a new version
- `is_current` flag identifies active record
- `valid_from` and `valid_to` define validity period
- `version` tracks change number

**Columns:**
- `domain_key` - Primary key
- `domain` - Domain name
- `is_third_party` - Third-party status
- `is_cdn` - CDN detection
- `category` - Domain category
- `risk_level` - Security risk level
- `valid_from, valid_to` - Validity period
- `is_current` - Current version flag
- `version` - Version number

**Example SCD Type 2 History:**
```
domain_key | domain      | risk_level | valid_from | valid_to   | is_current | version
-----------|-------------|------------|------------|------------|------------|--------
1          | example.com | low        | 1638316800 | 1640908800 | 0          | 1
2          | example.com | medium     | 1640908800 | NULL       | 1          | 2
```

**Usage:**
```javascript
const domainKey = getOrCreateDomainDimensionKey(db, 'example.com', {
  isThirdParty: true,
  category: 'analytics',
  riskLevel: 'medium'
});
// If attributes change, automatically creates new version
```

#### 3. Resource Type Dimension (`dim_resource_type`)
Categorizes request resource types.

**Pre-populated Types:**
- document, stylesheet, script, image, font
- xmlhttprequest, fetch, websocket
- media, other

**Columns:**
- `resource_type_key` - Primary key
- `resource_type` - Type name
- `category` - Type category
- `is_cacheable` - Cacheability flag
- `priority` - Loading priority

#### 4. Status Code Dimension (`dim_status_code`)
HTTP status code metadata.

**Pre-populated Codes:**
- 2xx (Success): 200, 201, 204
- 3xx (Redirect): 301, 302, 304
- 4xx (Client Error): 400, 401, 403, 404
- 5xx (Server Error): 500, 502, 503

**Columns:**
- `status_code_key` - Primary key
- `status_code` - HTTP status code
- `status_category` - Category (2xx, 3xx, 4xx, 5xx)
- `is_success, is_error, is_redirect` - Classification flags

### Fact Tables

#### 1. Request Fact Table (`fact_requests`)
Detailed request metrics linked to dimensions.

**Measures:**
- **Timing Metrics**: duration_ms, dns_time_ms, tcp_time_ms, ssl_time_ms, wait_time_ms, download_time_ms
- **Size Metrics**: size_bytes, header_size_bytes, body_size_bytes
- **Performance Metrics**: performance_score, quality_score
- **Flags**: is_cached, is_compressed, has_error, is_secure

**Dimension References:**
- time_key → dim_time
- domain_key → dim_domain
- resource_type_key → dim_resource_type
- status_code_key → dim_status_code

**Usage:**
```javascript
await analyticsProcessor.processRequestToFact(request);
```

#### 2. OHLC Performance Fact Table (`fact_ohlc_performance`)
Candlestick-style aggregated metrics per timeframe.

**OHLC Metrics:**
- `open_time` - First request duration in period
- `high_time` - Maximum request duration in period
- `low_time` - Minimum request duration in period
- `close_time` - Last request duration in period

**Volume Metrics:**
- `request_count` - Number of requests
- `total_bytes` - Total data transferred

**Aggregate Metrics:**
- `avg_response_time` - Average duration
- `median_response_time` - Median (P50)
- `p95_response_time` - 95th percentile
- `p99_response_time` - 99th percentile

**Quality Metrics:**
- `success_count, error_count, error_rate`
- `avg_performance_score, avg_quality_score`

**Dimension References:**
- time_key → dim_time
- period_type → Timeframe (1min, 5min, etc.)
- domain_key → dim_domain (optional, for drill-down)
- resource_type_key → dim_resource_type (optional, for drill-down)

**Usage:**
```javascript
const ohlcData = await analyticsProcessor.generateOHLC(
  '4h',           // timeframe
  startTime,      // period start
  endTime,        // period end
  {
    domainKey: 5  // optional: filter by domain
  }
);
```

#### 3. Performance Trends Fact Table (`fact_performance_trends`)
Tracks metric changes over time.

**Trend Metrics:**
- `metric_value` - Current value
- `previous_value` - Previous period value
- `change_value` - Absolute change
- `change_percent` - Percentage change
- `trend_direction` - up, down, stable

**Moving Averages:**
- `moving_avg_7` - 7-period moving average
- `moving_avg_30` - 30-period moving average
- `volatility` - Metric volatility

**Statistical Measures:**
- `std_deviation` - Standard deviation
- `variance` - Variance

#### 4. Quality Metrics Fact Table (`fact_quality_metrics`)
Comprehensive quality assessment per period.

**Quality Scores:**
- `availability_rate` - Success rate percentage
- `performance_index` - Weighted performance score
- `reliability_score` - Consistency measure (0-100)
- `security_score` - HTTPS usage percentage

**Error Analysis:**
- `total_requests, successful_requests, failed_requests`
- `timeout_count`

**Performance Distribution:**
- `requests_under_100ms` - Ultra-fast requests
- `requests_under_500ms` - Fast requests
- `requests_under_1s` - Acceptable requests
- `requests_under_3s` - Slow requests
- `requests_over_3s` - Very slow requests

**Cache Metrics:**
- `total_data_transferred` - Total bytes
- `cached_data_bytes` - Cached bytes
- `cache_hit_rate` - Cache efficiency percentage

## Analytics Processing Flow

```
Silver Layer Request
        ↓
[Process to Fact Table]
        ↓
fact_requests (atomic data)
        ↓
[Aggregate by Timeframe]
        ↓
fact_ohlc_performance (OHLC data)
        ↓
[Calculate Trends]
        ↓
fact_performance_trends
        ↓
[Generate Quality Metrics]
        ↓
fact_quality_metrics
```

## Querying Examples

### 1. Get OHLC Data for Charting

```sql
-- Get 4-hour OHLC data for the last week
SELECT 
  dt.timestamp,
  fohlc.open_time,
  fohlc.high_time,
  fohlc.low_time,
  fohlc.close_time,
  fohlc.request_count as volume,
  fohlc.avg_response_time,
  fohlc.error_rate
FROM fact_ohlc_performance fohlc
JOIN dim_time dt ON fohlc.time_key = dt.time_key
WHERE fohlc.period_type = '4h'
  AND fohlc.period_start >= ?  -- Last week timestamp
ORDER BY dt.timestamp
```

### 2. Domain Performance Comparison

```sql
-- Compare domains for 1-hour periods
SELECT 
  dd.domain,
  AVG(fohlc.avg_response_time) as avg_time,
  AVG(fohlc.error_rate) as avg_error_rate,
  SUM(fohlc.request_count) as total_requests
FROM fact_ohlc_performance fohlc
JOIN dim_domain dd ON fohlc.domain_key = dd.domain_key
WHERE fohlc.period_type = '1h'
  AND dd.is_current = 1
  AND fohlc.period_start >= ?
GROUP BY dd.domain
ORDER BY avg_time DESC
```

### 3. Quality Metrics Dashboard

```sql
-- Get current quality metrics
SELECT 
  dt.timestamp,
  fqm.availability_rate,
  fqm.performance_index,
  fqm.reliability_score,
  fqm.security_score,
  fqm.cache_hit_rate
FROM fact_quality_metrics fqm
JOIN dim_time dt ON fqm.time_key = dt.time_key
WHERE dt.timestamp >= ?
ORDER BY dt.timestamp DESC
```

### 4. Historical Domain Analysis (SCD Type 2)

```sql
-- Track domain risk level changes over time
SELECT 
  domain,
  risk_level,
  valid_from,
  valid_to,
  version,
  CASE WHEN is_current = 1 THEN 'Current' ELSE 'Historical' END as status
FROM dim_domain
WHERE domain = 'example.com'
ORDER BY version
```

### 5. Performance Distribution

```sql
-- Analyze response time distribution
SELECT 
  dt.hour,
  fqm.requests_under_100ms,
  fqm.requests_under_500ms,
  fqm.requests_under_1s,
  fqm.requests_under_3s,
  fqm.requests_over_3s
FROM fact_quality_metrics fqm
JOIN dim_time dt ON fqm.time_key = dt.time_key
WHERE dt.day = ?
ORDER BY dt.hour
```

## Charting Integration

### Candlestick Chart (OHLC)

```javascript
import { ChartManager } from '@/lib/ui/ChartManager.js';

const chartManager = new ChartManager('chart-container');
await chartManager.initialize();

// Fetch OHLC data
const ohlcData = await analyticsProcessor.generateOHLC('4h', startTime, endTime);

// Transform to candlestick format
const chartData = {
  labels: ohlcData.map(d => new Date(d.periodStart)),
  datasets: [{
    label: 'Response Time',
    data: ohlcData.map(d => ({
      x: d.periodStart,
      o: d.open,
      h: d.high,
      l: d.low,
      c: d.close
    }))
  }]
};

chartManager.createChart('candlestick', 'candlestick', {
  data: chartData,
  options: {
    plugins: {
      title: { text: '4-Hour Performance Chart' }
    }
  }
});
```

### Volume Chart

```javascript
const volumeData = {
  labels: ohlcData.map(d => new Date(d.periodStart)),
  datasets: [{
    label: 'Request Volume',
    data: ohlcData.map(d => d.volume),
    backgroundColor: 'rgba(54, 162, 235, 0.5)'
  }]
};

chartManager.createChart('volume', 'bar', {
  data: volumeData
});
```

### Quality Metrics Line Chart

```javascript
const qualityData = {
  labels: timestamps,
  datasets: [
    {
      label: 'Availability',
      data: availability,
      borderColor: 'rgb(75, 192, 192)'
    },
    {
      label: 'Performance',
      data: performance,
      borderColor: 'rgb(255, 99, 132)'
    },
    {
      label: 'Reliability',
      data: reliability,
      borderColor: 'rgb(255, 205, 86)'
    }
  ]
};

chartManager.createChart('quality', 'line', {
  data: qualityData
});
```

## Best Practices

### 1. Timeframe Selection

Choose appropriate timeframes based on analysis needs:
- **Real-time monitoring**: 1min, 5min
- **Hourly analysis**: 15min, 1h
- **Daily reports**: 4h, 1d
- **Trend analysis**: 1w, 1m

### 2. Dimension Filtering

Use dimension filters for focused analysis:
```javascript
// Analyze specific domain
const domainOHLC = await analyticsProcessor.generateOHLC('1h', start, end, {
  domainKey: specificDomainKey
});

// Analyze specific resource type
const resourceOHLC = await analyticsProcessor.generateOHLC('1h', start, end, {
  resourceTypeKey: scriptTypeKey
});
```

### 3. SCD Type 2 Queries

Always filter by `is_current = 1` for current data:
```sql
SELECT * FROM dim_domain WHERE domain = ? AND is_current = 1
```

For historical analysis, use validity period:
```sql
SELECT * FROM dim_domain 
WHERE domain = ? 
  AND valid_from <= ? 
  AND (valid_to IS NULL OR valid_to >= ?)
```

### 4. Performance Optimization

- Pre-aggregate OHLC data for frequently accessed timeframes
- Use indexes on time_key and period columns
- Partition fact tables by time for large datasets
- Archive old data to keep active dataset manageable

### 5. Data Freshness

Update analytics on a schedule:
- Real-time fact inserts (on each request)
- OHLC generation: every period completion
- Quality metrics: hourly or daily
- Trend calculations: daily

## Maintenance

### Daily Tasks
```javascript
// Generate OHLC for yesterday
await analyticsProcessor.generateOHLC('1d', yesterdayStart, yesterdayEnd);

// Calculate quality metrics
await analyticsProcessor.generateQualityMetrics(timeKey, null, dayStart, dayEnd);
```

### Weekly Tasks
```javascript
// Generate weekly OHLC
await analyticsProcessor.generateOHLC('1w', weekStart, weekEnd);

// Close old SCD Type 2 records if needed
```

### Monthly Tasks
```javascript
// Generate monthly OHLC
await analyticsProcessor.generateOHLC('1m', monthStart, monthEnd);

// Archive old fact data
// Vacuum database
```

## Benefits

1. **Flexible Time Analysis**: View data at any timeframe from 1 minute to 1 month
2. **Historical Tracking**: SCD Type 2 preserves complete change history
3. **Performance Insights**: OHLC data reveals performance patterns
4. **Quality Monitoring**: Comprehensive quality metrics for site reliability
5. **Efficient Queries**: Star schema optimized for analytical queries
6. **Scalable**: Pre-aggregated data reduces query complexity
