// Medallion Architecture Manager
// Manages data flow between Bronze -> Silver -> Gold layers

import { DatabaseError } from "../errors/error-types.js";

/**
 * MedallionManager - Orchestrates data processing through medallion layers
 */
export class MedallionManager {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
    this.processingQueue = [];
    this.isProcessing = false;
    this.initialized = false;
  }

  /**
   * Initialize the medallion manager
   */
  async initialize() {
    if (this.initialized) {
      console.warn("MedallionManager already initialized");
      return;
    }

    try {
      // Verify medallion tables exist
      const result = this.db.exec(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name IN ('bronze_requests', 'silver_requests', 'gold_daily_analytics')
      `);

      if (
        !result ||
        !result[0] ||
        !result[0].values[0] ||
        result[0].values[0][0] < 3
      ) {
        console.warn("Some medallion tables not found");
      }

      this.initialized = true;
      console.log("MedallionManager initialized");
    } catch (error) {
      console.error("Failed to initialize MedallionManager:", error);
      throw error;
    }
  }

  /**
   * Insert raw request data into Bronze layer
   */
  async insertBronzeRequest(requestData) {
    try {
      const now = Date.now();

      // Validate critical hierarchy fields
      if (!requestData.url) {
        console.error("❌ Request URL is required but missing");
        throw new Error("Request URL is required");
      }

      // Log data model for verification
      console.log("📝 Storing request with hierarchy:", {
        domain: requestData.domain || "NULL",
        pageUrl: requestData.pageUrl || "NULL",
        requestUrl: requestData.url,
        hierarchy: `${requestData.domain || "unknown"} > ${
          requestData.pageUrl || "unknown"
        } > ${requestData.url}`,
      });

      // Helper function to escape SQL strings
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const escapeNum = (val, defaultVal = 0) => {
        if (val === undefined || val === null) return defaultVal;
        return Number(val);
      };

      this.db.exec(`
        INSERT OR REPLACE INTO bronze_requests (
          id, url, method, type, status, status_text, domain, path,
          query_string, protocol, start_time, end_time, duration,
          size_bytes, timestamp, tab_id, frame_id, page_url,
          initiator, error, from_cache, created_at
        ) VALUES (
          ${escapeStr(requestData.id)},
          ${escapeStr(requestData.url)},
          ${escapeStr(requestData.method || "GET")},
          ${escapeStr(requestData.type || "other")},
          ${escapeNum(requestData.status, "NULL")},
          ${escapeStr(requestData.statusText)},
          ${escapeStr(requestData.domain)},
          ${escapeStr(requestData.path)},
          ${escapeStr(requestData.queryString)},
          ${escapeStr(requestData.protocol)},
          ${escapeNum(requestData.startTime, "NULL")},
          ${escapeNum(requestData.endTime, "NULL")},
          ${escapeNum(requestData.duration, 0)},
          ${escapeNum(requestData.sizeBytes, 0)},
          ${escapeNum(requestData.timestamp, now)},
          ${escapeNum(requestData.tabId, "NULL")},
          ${escapeNum(requestData.frameId, "NULL")},
          ${escapeStr(requestData.pageUrl)},
          ${escapeStr(requestData.initiator)},
          ${escapeStr(requestData.error)},
          ${requestData.fromCache ? 1 : 0},
          ${now}
        )
      `);

      // Queue for silver processing (only if ID exists)
      if (requestData.id) {
        this.queueForSilverProcessing(requestData.id);
        this.eventBus?.publish("medallion:bronze:inserted", {
          requestId: requestData.id,
        });
      } else {
        console.warn(
          "⚠️ Request inserted without ID, skipping silver processing"
        );
      }

      return requestData.id;
    } catch (error) {
      console.error("Failed to insert bronze request:", error);
      throw new DatabaseError("Failed to insert bronze request", error);
    }
  }

  /**
   * Insert request headers into Bronze layer
   */
  async insertBronzeHeaders(requestId, headers, type = "request") {
    try {
      const now = Date.now();

      // Helper function to escape SQL strings
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      for (const [name, value] of Object.entries(headers)) {
        this.db.exec(`
          INSERT INTO bronze_request_headers (request_id, header_type, name, value, created_at)
          VALUES (${escapeStr(requestId)}, ${escapeStr(type)}, ${escapeStr(
          name
        )}, ${escapeStr(value)}, ${now})
        `);
      }
    } catch (error) {
      console.error("Failed to insert bronze headers:", error);
      throw new DatabaseError("Failed to insert bronze headers", error);
    }
  }

  /**
   * Insert request timings into Bronze layer
   */
  async insertBronzeTimings(requestId, timings) {
    try {
      const now = Date.now();

      // Helper function to escape SQL strings
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      // Helper function to convert undefined to null or 0 for numeric values
      const toNumeric = (val) =>
        val === undefined || val === null ? 0 : Number(val);

      this.db.exec(`
        INSERT INTO bronze_request_timings (
          request_id, dns_start, dns_end, dns_duration,
          tcp_start, tcp_end, tcp_duration,
          ssl_start, ssl_end, ssl_duration,
          request_start, request_end, request_duration,
          response_start, response_end, response_duration,
          created_at
        ) VALUES (
          ${escapeStr(requestId)},
          ${toNumeric(timings.dnsStart)}, ${toNumeric(
        timings.dnsEnd
      )}, ${toNumeric(timings.dnsDuration)},
          ${toNumeric(timings.tcpStart)}, ${toNumeric(
        timings.tcpEnd
      )}, ${toNumeric(timings.tcpDuration)},
          ${toNumeric(timings.sslStart)}, ${toNumeric(
        timings.sslEnd
      )}, ${toNumeric(timings.sslDuration)},
          ${toNumeric(timings.requestStart)}, ${toNumeric(
        timings.requestEnd
      )}, ${toNumeric(timings.requestDuration)},
          ${toNumeric(timings.responseStart)}, ${toNumeric(
        timings.responseEnd
      )}, ${toNumeric(timings.responseDuration)},
          ${now}
        )
      `);
    } catch (error) {
      console.error("Failed to insert bronze timings:", error);
      throw new DatabaseError("Failed to insert bronze timings", error);
    }
  }

  /**
   * Insert event into Bronze layer
   */
  async insertBronzeEvent(eventData) {
    try {
      // Helper function to escape SQL strings
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const escapeNum = (val, defaultVal = 0) => {
        if (val === undefined || val === null) return defaultVal;
        return Number(val);
      };

      const dataStr = eventData.data
        ? escapeStr(JSON.stringify(eventData.data))
        : "NULL";

      this.db.exec(`
        INSERT INTO bronze_events (
          event_type, event_name, source, data,
          request_id, user_id, session_id, timestamp
        ) VALUES (
          ${escapeStr(eventData.eventType)},
          ${escapeStr(eventData.eventName)},
          ${escapeStr(eventData.source)},
          ${dataStr},
          ${escapeStr(eventData.requestId)},
          ${escapeStr(eventData.userId)},
          ${escapeStr(eventData.sessionId)},
          ${escapeNum(eventData.timestamp, Date.now())}
        )
      `);
    } catch (error) {
      console.error("Failed to insert bronze event:", error);
      throw new DatabaseError("Failed to insert bronze event", error);
    }
  }

  /**
   * Insert error into Bronze layer
   */
  async insertBronzeError(errorData) {
    try {
      // Helper function to escape SQL strings
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const escapeNum = (val, defaultVal = 0) => {
        if (val === undefined || val === null) return defaultVal;
        return Number(val);
      };

      this.db.exec(`
        INSERT INTO bronze_errors (
          error_type, message, stack, source,
          request_id, user_id, severity, timestamp
        ) VALUES (
          ${escapeStr(errorData.errorType)},
          ${escapeStr(errorData.message)},
          ${escapeStr(errorData.stack)},
          ${escapeStr(errorData.source)},
          ${escapeStr(errorData.requestId)},
          ${escapeStr(errorData.userId)},
          ${escapeStr(errorData.severity || "medium")},
          ${escapeNum(errorData.timestamp, Date.now())}
        )
      `);
    } catch (error) {
      console.error("Failed to insert bronze error:", error);
      throw new DatabaseError("Failed to insert bronze error", error);
    }
  }

  /**
   * Queue request for Silver processing
   */
  queueForSilverProcessing(requestId) {
    this.processingQueue.push(requestId);

    if (!this.isProcessing) {
      this.processSilverQueue();
    }
  }

  /**
   * Process queued requests to Silver layer
   */
  async processSilverQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const requestId = this.processingQueue.shift();
        await this.processBronzeToSilver(requestId);
      }
    } catch (error) {
      console.error("Error processing silver queue:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process Bronze request to Silver layer (data enrichment and validation)
   */
  async processBronzeToSilver(requestId) {
    try {
      // Validate requestId exists
      if (!requestId) {
        console.warn(
          "⚠️ processBronzeToSilver called with undefined/null requestId, skipping"
        );
        return;
      }

      // Helper function to escape SQL strings
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      // Fetch bronze request
      const bronzeRequest = this.db.exec(`
        SELECT * FROM bronze_requests WHERE id = ${escapeStr(requestId)}
      `);

      if (
        !bronzeRequest ||
        bronzeRequest.length === 0 ||
        !bronzeRequest[0]?.values?.length
      ) {
        console.warn(`No bronze request found for ID: ${requestId}`);
        return;
      }

      const request = this.mapResultToObject(bronzeRequest[0]);
      console.log(
        "Processing Bronze→Silver for request:",
        request.id,
        request.method,
        request.url?.substring(0, 50)
      );

      // Enrich data
      const enrichedData = this.enrichRequestData(request);

      const now = Date.now();

      // Helper function to convert undefined/null to default or null
      const toSqlValue = (val, defaultVal = null) => {
        if (val === undefined || val === null) {
          return defaultVal;
        }
        return val;
      };

      // Prepare all values with comprehensive logging
      const values = [
        toSqlValue(request.id),
        toSqlValue(request.url),
        toSqlValue(request.method, "GET"),
        toSqlValue(request.type, "other"),
        toSqlValue(request.status, 0),
        toSqlValue(request.status_text, ""),
        toSqlValue(request.domain),
        toSqlValue(request.path),
        toSqlValue(request.protocol),
        toSqlValue(request.duration, 0),
        toSqlValue(request.size_bytes, 0),
        toSqlValue(request.timestamp, now),
        toSqlValue(request.tab_id),
        toSqlValue(request.page_url),
        toSqlValue(enrichedData.isThirdParty, false) ? 1 : 0,
        toSqlValue(enrichedData.isSecure, false) ? 1 : 0,
        toSqlValue(enrichedData.hasError, false) ? 1 : 0,
        toSqlValue(enrichedData.performanceScore, 0),
        toSqlValue(enrichedData.qualityScore, 0),
        now,
        now,
      ];

      // Validate all values
      const undefinedIndices = values
        .map((v, i) => (v === undefined ? i : null))
        .filter((i) => i !== null);
      if (undefinedIndices.length > 0) {
        console.error("Undefined values at indices:", undefinedIndices);
        console.error("Request data:", JSON.stringify(request, null, 2));
        console.error("Enriched data:", JSON.stringify(enrichedData, null, 2));
        throw new Error(
          `Undefined SQL parameter(s) at index: ${undefinedIndices.join(", ")}`
        );
      }

      // Helper to escape SQL values for INSERT
      const escapeNum = (val) => {
        if (val === undefined || val === null) return "NULL";
        return Number(val);
      };

      const escapeBool = (val) => (val ? 1 : 0);

      // Insert into Silver
      this.db.exec(`
        INSERT OR REPLACE INTO silver_requests (
          id, url, method, type, status, status_text,
          domain, path, protocol, duration, size_bytes,
          timestamp, tab_id, page_url, is_third_party,
          is_secure, has_error, performance_score,
          quality_score, created_at, updated_at
        ) VALUES (
          ${escapeStr(values[0])},
          ${escapeStr(values[1])},
          ${escapeStr(values[2])},
          ${escapeStr(values[3])},
          ${escapeNum(values[4])},
          ${escapeStr(values[5])},
          ${escapeStr(values[6])},
          ${escapeStr(values[7])},
          ${escapeStr(values[8])},
          ${escapeNum(values[9])},
          ${escapeNum(values[10])},
          ${escapeNum(values[11])},
          ${escapeNum(values[12])},
          ${escapeStr(values[13])},
          ${escapeBool(values[14])},
          ${escapeBool(values[15])},
          ${escapeBool(values[16])},
          ${escapeNum(values[17])},
          ${escapeNum(values[18])},
          ${escapeNum(values[19])},
          ${escapeNum(values[20])}
        )
      `);

      // Insert metrics if timings available
      await this.processSilverMetrics(requestId);

      // Update domain stats
      await this.updateDomainStats(request.domain);

      // Update resource stats
      await this.updateResourceStats(request.type);

      this.eventBus?.publish("medallion:silver:processed", { requestId });

      // Queue for gold processing
      this.queueForGoldProcessing(requestId);
    } catch (error) {
      console.error("Failed to process bronze to silver:", error);
      throw new DatabaseError("Failed to process bronze to silver", error);
    }
  }

  /**
   * Process Silver metrics from Bronze timings
   */
  async processSilverMetrics(requestId) {
    try {
      // Helper function to escape SQL strings
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const timings = this.db.exec(`
        SELECT * FROM bronze_request_timings WHERE request_id = ${escapeStr(
          requestId
        )}
      `);

      if (!timings || timings.length === 0) {
        return;
      }

      const timing = this.mapResultToObject(timings[0]);
      const now = Date.now();

      // Helper function to convert undefined to 0 for numeric values
      const toNumeric = (val) => (val === undefined || val === null ? 0 : val);

      this.db.exec(`
        INSERT OR REPLACE INTO silver_request_metrics (
          request_id, total_time, dns_time, tcp_time,
          ssl_time, wait_time, download_time, created_at
        ) VALUES (
          ${escapeStr(requestId)},
          ${
            toNumeric(timing.request_duration) +
            toNumeric(timing.response_duration)
          },
          ${toNumeric(timing.dns_duration)},
          ${toNumeric(timing.tcp_duration)},
          ${toNumeric(timing.ssl_duration)},
          ${toNumeric(timing.request_duration)},
          ${toNumeric(timing.response_duration)},
          ${now}
        )
      `);
    } catch (error) {
      console.error("Failed to process silver metrics:", error);
    }
  }

  /**
   * Update domain statistics in Silver layer
   */
  async updateDomainStats(domain) {
    if (!domain) return;

    try {
      const now = Date.now();

      // Helper to handle undefined/null values
      const toSqlValue = (val, defaultVal = null) => {
        if (val === undefined || val === null) {
          return defaultVal;
        }
        return val;
      };

      // Helper function to escape SQL strings
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      // Get current stats
      const existing = this.db.exec(`
        SELECT * FROM silver_domain_stats WHERE domain = ${escapeStr(domain)}
      `);

      // Get aggregate data from bronze
      const stats = this.db.exec(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(size_bytes) as total_bytes,
          AVG(duration) as avg_duration,
          MIN(duration) as min_duration,
          MAX(duration) as max_duration,
          SUM(CASE WHEN status >= 200 AND status < 400 THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status >= 400 OR error IS NOT NULL THEN 1 ELSE 0 END) as error_count,
          MAX(timestamp) as last_request_at,
          MIN(timestamp) as first_request_at
        FROM bronze_requests WHERE domain = ${escapeStr(domain)}
      `);

      if (stats && stats.length > 0) {
        const statData = this.mapResultToObject(stats[0]);

        this.db.exec(`
          INSERT OR REPLACE INTO silver_domain_stats (
            domain, total_requests, total_bytes, avg_duration,
            min_duration, max_duration, success_count, error_count,
            last_request_at, first_request_at, updated_at
          ) VALUES (
            ${escapeStr(domain)},
            ${toSqlValue(statData.total_requests, 0)},
            ${toSqlValue(statData.total_bytes, 0)},
            ${toSqlValue(statData.avg_duration, 0)},
            ${toSqlValue(statData.min_duration, 0)},
            ${toSqlValue(statData.max_duration, 0)},
            ${toSqlValue(statData.success_count, 0)},
            ${toSqlValue(statData.error_count, 0)},
            ${toSqlValue(statData.last_request_at, now)},
            ${toSqlValue(statData.first_request_at, now)},
            ${now}
          )
        `);
      }
    } catch (error) {
      console.error("Failed to update domain stats:", error);
    }
  }

  /**
   * Update resource type statistics in Silver layer
   */
  async updateResourceStats(resourceType) {
    if (!resourceType) return;

    try {
      const now = Date.now();

      // Helper to handle undefined/null values
      const toSqlValue = (val, defaultVal = 0) => {
        if (val === undefined || val === null) {
          return defaultVal;
        }
        return val;
      };

      // Helper function to escape SQL strings
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const stats = this.db.exec(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(size_bytes) as total_bytes,
          AVG(duration) as avg_duration,
          AVG(size_bytes) as avg_size
        FROM bronze_requests WHERE type = ${escapeStr(resourceType)}
      `);

      if (stats && stats.length > 0) {
        const statData = this.mapResultToObject(stats[0]);

        this.db.exec(`
          INSERT OR REPLACE INTO silver_resource_stats (
            resource_type, total_requests, total_bytes,
            avg_duration, avg_size, updated_at
          ) VALUES (
            ${escapeStr(resourceType)},
            ${toSqlValue(statData.total_requests, 0)},
            ${toSqlValue(statData.total_bytes, 0)},
            ${toSqlValue(statData.avg_duration, 0)},
            ${toSqlValue(statData.avg_size, 0)},
            ${now}
          )
        `);
      }
    } catch (error) {
      console.error("Failed to update resource stats:", error);
    }
  }

  /**
   * Queue for Gold layer processing
   */
  queueForGoldProcessing(requestId) {
    // Gold processing typically happens on schedule, not per request
    this.eventBus?.publish("medallion:silver:ready-for-gold", { requestId });
  }

  /**
   * Process daily analytics to Gold layer
   */
  async processDailyAnalytics(date) {
    try {
      const dateStr = date || new Date().toISOString().split("T")[0];
      const startOfDay = new Date(dateStr).setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr).setHours(23, 59, 59, 999);
      const now = Date.now();

      // Get daily statistics
      const stats = this.db.exec(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(size_bytes) as total_bytes,
          AVG(duration) as avg_response_time,
          COUNT(DISTINCT domain) as unique_domains
        FROM bronze_requests 
        WHERE timestamp >= ${startOfDay} AND timestamp <= ${endOfDay}
      `);

      if (stats && stats.length > 0) {
        const statData = this.mapResultToObject(stats[0]);

        // Get percentiles
        const p95 = this.calculatePercentile(
          "bronze_requests",
          "duration",
          95,
          startOfDay,
          endOfDay
        );
        const p99 = this.calculatePercentile(
          "bronze_requests",
          "duration",
          99,
          startOfDay,
          endOfDay
        );
        const median = this.calculatePercentile(
          "bronze_requests",
          "duration",
          50,
          startOfDay,
          endOfDay
        );

        // Calculate error rate
        const errorCount = this.db.exec(`
          SELECT COUNT(*) as errors FROM bronze_requests 
          WHERE (status >= 400 OR error IS NOT NULL) AND timestamp >= ${startOfDay} AND timestamp <= ${endOfDay}
        `);

        const errorRate =
          statData.total_requests > 0
            ? (this.mapResultToObject(errorCount[0]).errors /
                statData.total_requests) *
              100
            : 0;

        // Helper function to escape SQL strings
        const escapeStr = (val) => {
          if (val === undefined || val === null) return "NULL";
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        // Insert into gold layer
        this.db.exec(`
          INSERT OR REPLACE INTO gold_daily_analytics (
            date, total_requests, total_bytes, avg_response_time,
            median_response_time, p95_response_time, p99_response_time,
            error_rate, unique_domains, created_at, updated_at
          ) VALUES (
            ${escapeStr(dateStr)},
            ${statData.total_requests || 0},
            ${statData.total_bytes || 0},
            ${statData.avg_response_time || 0},
            ${median},
            ${p95},
            ${p99},
            ${errorRate},
            ${statData.unique_domains || 0},
            ${now},
            ${now}
          )
        `);

        this.eventBus?.publish("medallion:gold:daily-processed", {
          date: dateStr,
        });
      }
    } catch (error) {
      console.error("Failed to process daily analytics:", error);
      throw new DatabaseError("Failed to process daily analytics", error);
    }
  }

  /**
   * Enrich request data with additional metadata
   */
  enrichRequestData(request) {
    try {
      const url = new URL(request.url);

      return {
        isThirdParty: this.isThirdPartyDomain(url.hostname),
        isSecure: url.protocol === "https:",
        hasError: !!(
          request.error ||
          (request.status && request.status >= 400)
        ),
        performanceScore: this.calculatePerformanceScore(request),
        qualityScore: this.calculateQualityScore(request),
      };
    } catch (error) {
      return {
        isThirdParty: false,
        isSecure: false,
        hasError: false,
        performanceScore: 0,
        qualityScore: 0,
      };
    }
  }

  /**
   * Check if domain is third-party
   */
  isThirdPartyDomain(hostname) {
    // Simple heuristic - can be enhanced with proper logic
    const commonThirdParty = [
      "google",
      "facebook",
      "twitter",
      "analytics",
      "cdn",
    ];
    return commonThirdParty.some((tp) => hostname.includes(tp));
  }

  /**
   * Calculate performance score (0-100)
   */
  calculatePerformanceScore(request) {
    if (!request.duration) return 0;

    // Simple scoring: faster is better
    // < 100ms = 100, > 5000ms = 0
    const maxDuration = 5000;
    const score = Math.max(
      0,
      Math.min(100, 100 - (request.duration / maxDuration) * 100)
    );
    return Math.round(score);
  }

  /**
   * Calculate quality score (0-100)
   */
  calculateQualityScore(request) {
    let score = 100;

    // Deduct points for errors
    if (request.error) score -= 50;
    if (request.status >= 400) score -= 30;
    if (!request.from_cache && request.size_bytes > 1000000) score -= 10; // Large size

    return Math.max(0, score);
  }

  /**
   * Calculate percentile for a metric
   */
  calculatePercentile(table, column, percentile, startTime, endTime) {
    try {
      const result = this.db.exec(`
        SELECT ${column} FROM ${table}
        WHERE timestamp >= ${startTime} AND timestamp <= ${endTime} AND ${column} IS NOT NULL
        ORDER BY ${column}
      `);

      if (!result || result.length === 0 || !result[0].values.length) {
        return 0;
      }

      const values = result[0].values.map((v) => v[0]);
      const index = Math.ceil((percentile / 100) * values.length) - 1;
      return values[index] || 0;
    } catch (error) {
      console.error("Failed to calculate percentile:", error);
      return 0;
    }
  }

  /**
   * Insert Web Vital metric into Bronze layer
   * @param {Object} metric - Web Vital data
   * @returns {Promise<boolean>}
   */
  async insertWebVital(metric) {
    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const id = `webvital_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const domain = metric.url ? new URL(metric.url).hostname : "unknown";
    const timestamp = metric.timestamp || Date.now();

    try {
      console.log("[Medallion] Inserting web vital:", {
        metric: metric.metric,
        value: metric.value,
        rating: metric.rating,
        domain: domain,
        url: metric.url,
      });

      this.db.exec(`
        INSERT INTO bronze_web_vitals (
          id, page_url, domain, metric_name, value, rating,
          timestamp, viewport_width, viewport_height, created_at
        ) VALUES (
          ${escapeStr(id)},
          ${escapeStr(metric.url)},
          ${escapeStr(domain)},
          ${escapeStr(metric.metric)},
          ${metric.value},
          ${escapeStr(metric.rating)},
          ${timestamp},
          ${metric.viewport_width || "NULL"},
          ${metric.viewport_height || "NULL"},
          ${Date.now()}
        )
      `);

      console.log(
        "[Medallion] ✓ Web vital inserted successfully:",
        metric.metric
      );
      return true;
    } catch (error) {
      console.error("[Medallion] Error inserting web vital:", error);
      return false;
    }
  }

  /**
   * Insert or update session in Bronze layer
   * @param {Object} session - Session data
   * @returns {Promise<boolean>}
   */
  async upsertSession(session) {
    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    try {
      // Check if session exists
      const existing = this.db.exec(`
        SELECT id FROM bronze_sessions WHERE id = ${escapeStr(session.id)}
      `);

      if (existing && existing[0]?.values.length > 0) {
        // Update existing session
        this.db.exec(`
          UPDATE bronze_sessions SET
            domain = ${escapeStr(session.domain)},
            ended_at = ${session.ended_at || "NULL"},
            duration = ${session.duration || "NULL"},
            events_count = ${session.events_count || 0},
            requests_count = ${session.requests_count || 0},
            pages_count = ${session.pages_count || 0},
            pages_visited = ${escapeStr(session.pages_visited)},
            metadata = ${escapeStr(session.metadata)}
          WHERE id = ${escapeStr(session.id)}
        `);
      } else {
        // Insert new session
        this.db.exec(`
          INSERT INTO bronze_sessions (
            id, domain, user_id, started_at, ended_at, duration,
            events_count, requests_count, pages_count, pages_visited,
            user_agent, metadata
          ) VALUES (
            ${escapeStr(session.id)},
            ${escapeStr(session.domain)},
            ${escapeStr(session.user_id)},
            ${session.started_at},
            ${session.ended_at || "NULL"},
            ${session.duration || "NULL"},
            ${session.events_count || 0},
            ${session.requests_count || 0},
            ${session.pages_count || 0},
            ${escapeStr(session.pages_visited)},
            ${escapeStr(session.user_agent)},
            ${escapeStr(session.metadata)}
          )
        `);
      }
      return true;
    } catch (error) {
      console.error("[Medallion] Error upserting session:", error);
      return false;
    }
  }

  /**
   * Insert session into Bronze layer
   * @param {Object} session - Session data
   * @returns {Promise<boolean>}
   */
  async insertSession(session) {
    return this.upsertSession(session);
  }

  /**
   * Insert event into Bronze layer
   * @param {Object} event - Event data
   * @returns {Promise<boolean>}
   */
  async insertEvent(event) {
    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const timestamp = event.timestamp || Date.now();
    const eventData =
      typeof event.data === "object" ? JSON.stringify(event.data) : event.data;

    try {
      this.db.exec(`
        INSERT INTO bronze_events (
          event_type, event_name, source, data, session_id, timestamp
        ) VALUES (
          ${escapeStr(event.type)},
          ${escapeStr(event.type)},
          ${escapeStr("content_script")},
          ${escapeStr(eventData)},
          ${escapeStr(event.session_id)},
          ${timestamp}
        )
      `);
      return true;
    } catch (error) {
      console.error("[Medallion] Error inserting event:", error);
      return false;
    }
  }

  /**
   * Get Web Vitals stats for a domain
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>}
   */
  async getWebVitalsStats(filters = {}) {
    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    let whereClause = "1=1";
    if (filters.domain) {
      whereClause += ` AND domain = ${escapeStr(filters.domain)}`;
    }
    if (filters.timeRange) {
      const since = Date.now() - filters.timeRange * 1000;
      whereClause += ` AND timestamp >= ${since}`;
    }

    try {
      const result = this.db.exec(`
        SELECT 
          metric_name,
          AVG(value) as avg_value,
          MIN(value) as min_value,
          MAX(value) as max_value,
          COUNT(*) as sample_count,
          SUM(CASE WHEN rating = 'good' THEN 1 ELSE 0 END) as good_count,
          SUM(CASE WHEN rating = 'needs-improvement' THEN 1 ELSE 0 END) as needs_improvement_count,
          SUM(CASE WHEN rating = 'poor' THEN 1 ELSE 0 END) as poor_count
        FROM bronze_web_vitals
        WHERE ${whereClause}
        GROUP BY metric_name
      `);

      if (!result || !result[0] || !result[0].values) {
        return { metrics: {} };
      }

      const metrics = {};
      result[0].values.forEach((row) => {
        const metricName = row[0];
        metrics[metricName] = {
          avg: row[1],
          min: row[2],
          max: row[3],
          count: row[4],
          ratings: {
            good: row[5],
            needs_improvement: row[6],
            poor: row[7],
          },
        };
      });

      return { success: true, metrics };
    } catch (error) {
      console.error("[Medallion] Error getting web vitals stats:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get session stats for a domain
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>}
   */
  async getSessionStats(filters = {}) {
    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    let whereClause = "1=1";
    if (filters.domain) {
      whereClause += ` AND domain = ${escapeStr(filters.domain)}`;
    }
    if (filters.timeRange) {
      const since = Date.now() - filters.timeRange * 1000;
      whereClause += ` AND started_at >= ${since}`;
    }

    try {
      const result = this.db.exec(`
        SELECT 
          COUNT(*) as total_sessions,
          AVG(duration) as avg_duration,
          AVG(requests_count) as avg_requests,
          AVG(events_count) as avg_events,
          AVG(pages_count) as avg_pages,
          SUM(requests_count) as total_requests,
          SUM(events_count) as total_events
        FROM bronze_sessions
        WHERE ${whereClause} AND ended_at IS NOT NULL
      `);

      if (!result || !result[0] || !result[0].values || !result[0].values[0]) {
        return { success: true, stats: {} };
      }

      const row = result[0].values[0];
      return {
        success: true,
        stats: {
          totalSessions: row[0] || 0,
          avgDuration: row[1] || 0,
          avgRequests: row[2] || 0,
          avgEvents: row[3] || 0,
          avgPages: row[4] || 0,
          totalRequests: row[5] || 0,
          totalEvents: row[6] || 0,
        },
      };
    } catch (error) {
      console.error("[Medallion] Error getting session stats:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Insert or update resource timing data from Resource Timing API
   * @param {Object} timing - Resource timing data
   * @returns {Promise<boolean>}
   */
  async insertResourceTiming(timing) {
    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    try {
      // Find matching bronze_request by URL to get request_id
      const urlMatch = this.db.exec(`
        SELECT id FROM bronze_requests 
        WHERE url = ${escapeStr(timing.url)} 
        AND page_url = ${escapeStr(timing.pageUrl)}
        ORDER BY timestamp DESC LIMIT 1
      `);

      if (
        !urlMatch ||
        !urlMatch[0] ||
        !urlMatch[0].values ||
        !urlMatch[0].values[0]
      ) {
        // No matching request found, skip
        return false;
      }

      const requestId = urlMatch[0].values[0][0];

      // Insert or replace timing data
      this.db.exec(`
        INSERT OR REPLACE INTO bronze_request_timings (
          request_id,
          dns_duration,
          tcp_duration,
          ssl_duration,
          request_duration,
          response_duration,
          transfer_size,
          encoded_size,
          decoded_size,
          from_cache,
          created_at
        ) VALUES (
          ${escapeStr(requestId)},
          ${timing.dnsTime || 0},
          ${timing.tcpTime || 0},
          ${timing.tlsTime || 0},
          ${timing.requestTime || 0},
          ${timing.responseTime || 0},
          ${timing.transferSize || 0},
          ${timing.encodedSize || 0},
          ${timing.decodedSize || 0},
          ${timing.fromCache ? 1 : 0},
          ${Date.now()}
        )
      `);

      return true;
    } catch (error) {
      console.error("[Medallion] Error inserting resource timing:", error);
      return false;
    }
  }

  /**
   * Get resource compression stats
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>}
   */
  async getResourceCompressionStats(filters = {}) {
    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    let whereClause = "1=1";
    if (filters.domain) {
      whereClause += ` AND r.domain = ${escapeStr(filters.domain)}`;
    }
    if (filters.timeRange) {
      const since = Date.now() - filters.timeRange * 1000;
      whereClause += ` AND r.timestamp >= ${since}`;
    }

    try {
      const result = this.db.exec(`
        SELECT 
          SUM(t.transfer_size) as total_bytes,
          SUM(t.encoded_size) as compressible_bytes,
          SUM(CASE WHEN t.transfer_size < t.encoded_size THEN t.transfer_size ELSE 0 END) as compressed_bytes,
          SUM(t.decoded_size) as decoded_bytes,
          COUNT(*) as resource_count,
          SUM(CASE WHEN t.from_cache THEN 1 ELSE 0 END) as cached_count
        FROM bronze_request_timings t
        INNER JOIN bronze_requests r ON t.request_id = r.id
        WHERE ${whereClause}
      `);

      if (!result || !result[0] || !result[0].values || !result[0].values[0]) {
        return {
          totalBytes: 0,
          compressibleBytes: 0,
          compressedBytes: 0,
          decodedBytes: 0,
          potentialSavings: 0,
          compressionRate: 0,
          resourceCount: 0,
          cachedCount: 0,
        };
      }

      const row = result[0].values[0];
      const totalBytes = row[0] || 0;
      const compressibleBytes = row[1] || 0;
      const compressedBytes = row[2] || 0;
      const decodedBytes = row[3] || 0;
      const resourceCount = row[4] || 0;
      const cachedCount = row[5] || 0;

      const potentialSavings = compressibleBytes - compressedBytes;
      const compressionRate =
        compressibleBytes > 0 ? (compressedBytes / compressibleBytes) * 100 : 0;

      return {
        totalBytes,
        compressibleBytes,
        compressedBytes,
        decodedBytes,
        potentialSavings: Math.max(0, potentialSavings),
        compressionRate: compressionRate.toFixed(1),
        resourceCount,
        cachedCount,
      };
    } catch (error) {
      console.error("[Medallion] Error getting compression stats:", error);
      return {
        totalBytes: 0,
        compressibleBytes: 0,
        compressedBytes: 0,
        decodedBytes: 0,
        potentialSavings: 0,
        compressionRate: 0,
        resourceCount: 0,
        cachedCount: 0,
      };
    }
  }

  /**
   * Helper to map SQL result to object
   */
  mapResultToObject(result) {
    if (!result || !result.columns || !result.values || !result.values[0]) {
      return {};
    }

    const obj = {};
    result.columns.forEach((col, idx) => {
      obj[col] = result.values[0][idx];
    });
    return obj;
  }
}

export function createMedallionManager(db, eventBus) {
  return new MedallionManager(db, eventBus);
}
