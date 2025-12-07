// Star Schema with SCD Type 2 for Analytics
// This implements dimensional modeling for time-series analysis similar to Forex charting

/**
 * Create Star Schema for Analytics (Silver/Gold layers)
 * Implements:
 * - Fact tables for metrics
 * - Dimension tables with SCD Type 2
 * - Time dimensions for various timeframes
 */

/**
 * Create time dimension table
 * Supports multiple timeframes: 1min, 5min, 15min, 30min, 1h, 4h, 1d
 * Note: Removed 1w and 1m as they are not meaningful for real-time web request
 * analytics which focuses on shorter-term patterns and immediate performance insights.
 */
export function createTimeDimension(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dim_time (
      time_key INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL UNIQUE,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      month INTEGER NOT NULL,
      week INTEGER NOT NULL,
      day INTEGER NOT NULL,
      hour INTEGER NOT NULL,
      minute INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      day_of_year INTEGER NOT NULL,
      is_weekend BOOLEAN DEFAULT 0,
      is_business_hour BOOLEAN DEFAULT 0,
      period_1min INTEGER NOT NULL,
      period_5min INTEGER NOT NULL,
      period_15min INTEGER NOT NULL,
      period_30min INTEGER NOT NULL,
      period_1h INTEGER NOT NULL,
      period_4h INTEGER NOT NULL,
      period_1d INTEGER NOT NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_dim_time_timestamp ON dim_time(timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dim_time_period_15min ON dim_time(period_15min)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dim_time_period_1h ON dim_time(period_1h)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dim_time_period_4h ON dim_time(period_4h)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dim_time_period_1d ON dim_time(period_1d)`);
}

/**
 * Create domain dimension with SCD Type 2
 * Tracks domain changes over time
 */
export function createDomainDimension(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dim_domain (
      domain_key INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      is_third_party BOOLEAN DEFAULT 0,
      is_cdn BOOLEAN DEFAULT 0,
      category TEXT,
      risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
      -- SCD Type 2 fields
      valid_from INTEGER NOT NULL,
      valid_to INTEGER,
      is_current BOOLEAN DEFAULT 1,
      version INTEGER DEFAULT 1,
      -- Metadata
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_dim_domain_domain ON dim_domain(domain)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dim_domain_current ON dim_domain(is_current) WHERE is_current = 1`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dim_domain_valid ON dim_domain(valid_from, valid_to)`);
}

/**
 * Create resource type dimension
 */
export function createResourceTypeDimension(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dim_resource_type (
      resource_type_key INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_type TEXT NOT NULL UNIQUE,
      category TEXT,
      is_cacheable BOOLEAN DEFAULT 0,
      priority INTEGER DEFAULT 0,
      description TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Insert standard resource types
  const resourceTypes = [
    { type: 'document', category: 'navigation', cacheable: 1, priority: 1 },
    { type: 'stylesheet', category: 'asset', cacheable: 1, priority: 2 },
    { type: 'script', category: 'asset', cacheable: 1, priority: 2 },
    { type: 'image', category: 'media', cacheable: 1, priority: 3 },
    { type: 'font', category: 'asset', cacheable: 1, priority: 3 },
    { type: 'xmlhttprequest', category: 'api', cacheable: 0, priority: 1 },
    { type: 'fetch', category: 'api', cacheable: 0, priority: 1 },
    { type: 'websocket', category: 'realtime', cacheable: 0, priority: 1 },
    { type: 'media', category: 'media', cacheable: 1, priority: 4 },
    { type: 'other', category: 'other', cacheable: 0, priority: 5 }
  ];

  const now = Date.now();
  resourceTypes.forEach(({ type, category, cacheable, priority }) => {
    db.exec(`
      INSERT OR IGNORE INTO dim_resource_type (resource_type, category, is_cacheable, priority, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [type, category, cacheable, priority, now]);
  });
}

/**
 * Create status code dimension
 */
export function createStatusCodeDimension(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dim_status_code (
      status_code_key INTEGER PRIMARY KEY AUTOINCREMENT,
      status_code INTEGER NOT NULL UNIQUE,
      status_category TEXT NOT NULL,
      status_text TEXT,
      is_success BOOLEAN DEFAULT 0,
      is_error BOOLEAN DEFAULT 0,
      is_redirect BOOLEAN DEFAULT 0,
      description TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Insert standard HTTP status codes
  const statusCodes = [
    // 2xx Success
    { code: 200, category: '2xx', text: 'OK', success: 1, error: 0, redirect: 0 },
    { code: 201, category: '2xx', text: 'Created', success: 1, error: 0, redirect: 0 },
    { code: 204, category: '2xx', text: 'No Content', success: 1, error: 0, redirect: 0 },
    // 3xx Redirect
    { code: 301, category: '3xx', text: 'Moved Permanently', success: 0, error: 0, redirect: 1 },
    { code: 302, category: '3xx', text: 'Found', success: 0, error: 0, redirect: 1 },
    { code: 304, category: '3xx', text: 'Not Modified', success: 0, error: 0, redirect: 1 },
    // 4xx Client Error
    { code: 400, category: '4xx', text: 'Bad Request', success: 0, error: 1, redirect: 0 },
    { code: 401, category: '4xx', text: 'Unauthorized', success: 0, error: 1, redirect: 0 },
    { code: 403, category: '4xx', text: 'Forbidden', success: 0, error: 1, redirect: 0 },
    { code: 404, category: '4xx', text: 'Not Found', success: 0, error: 1, redirect: 0 },
    // 5xx Server Error
    { code: 500, category: '5xx', text: 'Internal Server Error', success: 0, error: 1, redirect: 0 },
    { code: 502, category: '5xx', text: 'Bad Gateway', success: 0, error: 1, redirect: 0 },
    { code: 503, category: '5xx', text: 'Service Unavailable', success: 0, error: 1, redirect: 0 }
  ];

  const now = Date.now();
  statusCodes.forEach(({ code, category, text, success, error, redirect }) => {
    db.exec(`
      INSERT OR IGNORE INTO dim_status_code (status_code, status_category, status_text, is_success, is_error, is_redirect, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [code, category, text, success, error, redirect, now]);
  });
}

/**
 * Create request fact table
 * Core fact table for request metrics
 */
export function createRequestFactTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fact_requests (
      request_fact_key INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      
      -- Dimension keys
      time_key INTEGER NOT NULL,
      domain_key INTEGER NOT NULL,
      resource_type_key INTEGER NOT NULL,
      status_code_key INTEGER,
      
      -- Measures (metrics)
      duration_ms INTEGER,
      dns_time_ms INTEGER,
      tcp_time_ms INTEGER,
      ssl_time_ms INTEGER,
      wait_time_ms INTEGER,
      download_time_ms INTEGER,
      size_bytes INTEGER,
      header_size_bytes INTEGER,
      body_size_bytes INTEGER,
      
      -- Performance indicators
      is_cached BOOLEAN DEFAULT 0,
      is_compressed BOOLEAN DEFAULT 0,
      compression_ratio REAL,
      
      -- Quality metrics
      performance_score REAL,
      quality_score REAL,
      
      -- Flags
      has_error BOOLEAN DEFAULT 0,
      is_secure BOOLEAN DEFAULT 0,
      
      -- Timestamp
      created_at INTEGER NOT NULL,
      
      -- Foreign keys
      FOREIGN KEY(time_key) REFERENCES dim_time(time_key),
      FOREIGN KEY(domain_key) REFERENCES dim_domain(domain_key),
      FOREIGN KEY(resource_type_key) REFERENCES dim_resource_type(resource_type_key),
      FOREIGN KEY(status_code_key) REFERENCES dim_status_code(status_code_key)
    )
  `);

  // Indexes for fast querying
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_requests_time ON fact_requests(time_key)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_requests_domain ON fact_requests(domain_key)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_requests_resource ON fact_requests(resource_type_key)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_requests_status ON fact_requests(status_code_key)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_requests_created ON fact_requests(created_at)`);
}

/**
 * Create OHLC (Open-High-Low-Close) aggregate fact table
 * Similar to Forex candlestick data
 */
export function createOHLCFactTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fact_ohlc_performance (
      ohlc_fact_key INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Time dimension
      time_key INTEGER NOT NULL,
      period_type TEXT NOT NULL CHECK(period_type IN ('1min', '5min', '15min', '30min', '1h', '4h', '1d')),
      
      -- Optional dimensions for drill-down
      domain_key INTEGER,
      resource_type_key INTEGER,
      
      -- OHLC metrics for response time
      open_time INTEGER,      -- First request time in period
      high_time INTEGER,      -- Maximum request time in period
      low_time INTEGER,       -- Minimum request time in period
      close_time INTEGER,     -- Last request time in period
      
      -- Volume metrics
      request_count INTEGER DEFAULT 0,
      total_bytes INTEGER DEFAULT 0,
      
      -- Aggregate metrics
      avg_response_time INTEGER,
      median_response_time INTEGER,
      p95_response_time INTEGER,
      p99_response_time INTEGER,
      
      -- Quality metrics
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      error_rate REAL,
      
      -- Performance metrics
      avg_performance_score REAL,
      avg_quality_score REAL,
      
      -- Timestamps
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      
      FOREIGN KEY(time_key) REFERENCES dim_time(time_key),
      FOREIGN KEY(domain_key) REFERENCES dim_domain(domain_key),
      FOREIGN KEY(resource_type_key) REFERENCES dim_resource_type(resource_type_key)
    )
  `);

  // Indexes for fast aggregation queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_ohlc_time_period ON fact_ohlc_performance(time_key, period_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_ohlc_domain_period ON fact_ohlc_performance(domain_key, period_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_ohlc_period_start ON fact_ohlc_performance(period_start)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_ohlc_unique ON fact_ohlc_performance(period_type, period_start, COALESCE(domain_key, 0), COALESCE(resource_type_key, 0))`);
}

/**
 * Create performance trend fact table
 * Tracks performance changes over time
 */
export function createPerformanceTrendFactTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fact_performance_trends (
      trend_fact_key INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Time dimension
      time_key INTEGER NOT NULL,
      period_type TEXT NOT NULL,
      
      -- Metric tracking
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      previous_value REAL,
      change_value REAL,
      change_percent REAL,
      
      -- Trend indicators
      trend_direction TEXT CHECK(trend_direction IN ('up', 'down', 'stable')),
      moving_avg_7 REAL,
      moving_avg_30 REAL,
      volatility REAL,
      
      -- Statistical measures
      std_deviation REAL,
      variance REAL,
      
      -- Optional dimensions
      domain_key INTEGER,
      
      -- Timestamps
      created_at INTEGER NOT NULL,
      
      FOREIGN KEY(time_key) REFERENCES dim_time(time_key),
      FOREIGN KEY(domain_key) REFERENCES dim_domain(domain_key)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_trends_time_metric ON fact_performance_trends(time_key, metric_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_trends_domain ON fact_performance_trends(domain_key, metric_name)`);
}

/**
 * Create quality metrics fact table
 */
export function createQualityMetricsFactTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fact_quality_metrics (
      quality_fact_key INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Time dimension
      time_key INTEGER NOT NULL,
      
      -- Dimensions
      domain_key INTEGER,
      
      -- Quality metrics
      availability_rate REAL,           -- % of successful requests
      performance_index REAL,           -- Weighted performance score
      reliability_score REAL,           -- Consistency of response times
      security_score REAL,              -- HTTPS usage, security headers
      
      -- Error analysis
      total_requests INTEGER DEFAULT 0,
      successful_requests INTEGER DEFAULT 0,
      failed_requests INTEGER DEFAULT 0,
      timeout_count INTEGER DEFAULT 0,
      
      -- Performance distribution
      requests_under_100ms INTEGER DEFAULT 0,
      requests_under_500ms INTEGER DEFAULT 0,
      requests_under_1s INTEGER DEFAULT 0,
      requests_under_3s INTEGER DEFAULT 0,
      requests_over_3s INTEGER DEFAULT 0,
      
      -- Size analysis
      total_data_transferred INTEGER DEFAULT 0,
      cached_data_bytes INTEGER DEFAULT 0,
      cache_hit_rate REAL,
      
      -- Timestamps
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      
      FOREIGN KEY(time_key) REFERENCES dim_time(time_key),
      FOREIGN KEY(domain_key) REFERENCES dim_domain(domain_key)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_quality_time ON fact_quality_metrics(time_key)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fact_quality_domain ON fact_quality_metrics(domain_key)`);
}

/**
 * Create all star schema tables
 */
export function createStarSchema(db) {
  console.log("Creating star schema for analytics...");
  
  // Dimensions
  createTimeDimension(db);
  createDomainDimension(db);
  createResourceTypeDimension(db);
  createStatusCodeDimension(db);
  
  // Facts
  createRequestFactTable(db);
  createOHLCFactTable(db);
  createPerformanceTrendFactTable(db);
  createQualityMetricsFactTable(db);
  
  console.log("Star schema created successfully");
}

/**
 * Helper function to get or create time dimension entry
 */
export function getOrCreateTimeDimensionKey(db, timestamp) {
  const date = new Date(timestamp);
  
  // Check if entry exists
  const existing = db.exec(`
    SELECT time_key FROM dim_time WHERE timestamp = ?
  `, [timestamp]);
  
  if (existing && existing.length > 0 && existing[0].values.length > 0) {
    return existing[0].values[0][0];
  }
  
  // Calculate all time periods
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  
  const period1min = Math.floor(timestamp / 60000); // 1 minute
  const period5min = Math.floor(timestamp / 300000); // 5 minutes
  const period15min = Math.floor(timestamp / 900000); // 15 minutes
  const period30min = Math.floor(timestamp / 1800000); // 30 minutes
  const period1h = Math.floor(timestamp / 3600000); // 1 hour
  const period4h = Math.floor(timestamp / 14400000); // 4 hours
  const period1d = Math.floor(timestamp / 86400000); // 1 day
  
  const dayOfWeek = date.getDay();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / 86400000) + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isBusinessHour = hour >= 9 && hour < 17 && !isWeekend;
  
  // Insert new entry
  db.exec(`
    INSERT INTO dim_time (
      timestamp, year, quarter, month, week, day, hour, minute,
      day_of_week, day_of_year, is_weekend, is_business_hour,
      period_1min, period_5min, period_15min, period_30min, period_1h, period_4h,
      period_1d
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    timestamp, year, quarter, month, Math.floor(dayOfYear / 7), day, hour, minute,
    dayOfWeek, dayOfYear, isWeekend ? 1 : 0, isBusinessHour ? 1 : 0,
    period1min, period5min, period15min, period30min, period1h, period4h,
    period1d
  ]);
  
  // Get the inserted key
  const result = db.exec(`SELECT last_insert_rowid()`);
  return result[0].values[0][0];
}

/**
 * Helper function to get or create domain dimension key (SCD Type 2)
 */
export function getOrCreateDomainDimensionKey(db, domain, attributes = {}) {
  const now = Date.now();
  
  // Check for current active record
  const existing = db.exec(`
    SELECT domain_key, is_third_party, category, risk_level
    FROM dim_domain
    WHERE domain = ? AND is_current = 1
  `, [domain]);
  
  if (existing && existing.length > 0 && existing[0].values.length > 0) {
    const [key, isThirdParty, category, riskLevel] = existing[0].values[0];
    
    // Check if attributes changed (SCD Type 2)
    const changed = 
      (attributes.isThirdParty !== undefined && attributes.isThirdParty !== !!isThirdParty) ||
      (attributes.category !== undefined && attributes.category !== category) ||
      (attributes.riskLevel !== undefined && attributes.riskLevel !== riskLevel);
    
    if (changed) {
      // Close current record
      db.exec(`
        UPDATE dim_domain
        SET is_current = 0, valid_to = ?
        WHERE domain_key = ?
      `, [now, key]);
      
      // Create new version
      const version = db.exec(`
        SELECT MAX(version) FROM dim_domain WHERE domain = ?
      `, [domain])[0].values[0][0] || 0;
      
      db.exec(`
        INSERT INTO dim_domain (
          domain, is_third_party, is_cdn, category, risk_level,
          valid_from, valid_to, is_current, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?)
      `, [
        domain,
        attributes.isThirdParty ? 1 : 0,
        attributes.isCdn ? 1 : 0,
        attributes.category,
        attributes.riskLevel,
        now,
        version + 1,
        now,
        now
      ]);
      
      const result = db.exec(`SELECT last_insert_rowid()`);
      return result[0].values[0][0];
    }
    
    return key;
  }
  
  // Create new record
  db.exec(`
    INSERT INTO dim_domain (
      domain, is_third_party, is_cdn, category, risk_level,
      valid_from, valid_to, is_current, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 1, ?, ?)
  `, [
    domain,
    attributes.isThirdParty ? 1 : 0,
    attributes.isCdn ? 1 : 0,
    attributes.category || 'unknown',
    attributes.riskLevel || 'low',
    now,
    now,
    now
  ]);
  
  const result = db.exec(`SELECT last_insert_rowid()`);
  return result[0].values[0][0];
}
