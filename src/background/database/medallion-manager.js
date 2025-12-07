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
  }

  /**
   * Insert raw request data into Bronze layer
   */
  async insertBronzeRequest(requestData) {
    try {
      const now = Date.now();
      
      this.db.exec(`
        INSERT INTO bronze_requests (
          id, url, method, type, status, status_text, domain, path,
          query_string, protocol, start_time, end_time, duration,
          size_bytes, timestamp, tab_id, frame_id, page_url,
          initiator, error, from_cache, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        requestData.id,
        requestData.url,
        requestData.method,
        requestData.type,
        requestData.status,
        requestData.statusText,
        requestData.domain,
        requestData.path,
        requestData.queryString,
        requestData.protocol,
        requestData.startTime,
        requestData.endTime,
        requestData.duration,
        requestData.sizeBytes,
        requestData.timestamp || now,
        requestData.tabId,
        requestData.frameId,
        requestData.pageUrl,
        requestData.initiator,
        requestData.error,
        requestData.fromCache ? 1 : 0,
        now
      ]);

      // Queue for silver processing
      this.queueForSilverProcessing(requestData.id);
      
      this.eventBus?.publish('medallion:bronze:inserted', { requestId: requestData.id });
      return requestData.id;
    } catch (error) {
      console.error('Failed to insert bronze request:', error);
      throw new DatabaseError('Failed to insert bronze request', error);
    }
  }

  /**
   * Insert request headers into Bronze layer
   */
  async insertBronzeHeaders(requestId, headers, type = 'request') {
    try {
      const now = Date.now();
      
      for (const [name, value] of Object.entries(headers)) {
        this.db.exec(`
          INSERT INTO bronze_request_headers (request_id, header_type, name, value, created_at)
          VALUES (?, ?, ?, ?, ?)
        `, [requestId, type, name, value, now]);
      }
    } catch (error) {
      console.error('Failed to insert bronze headers:', error);
      throw new DatabaseError('Failed to insert bronze headers', error);
    }
  }

  /**
   * Insert request timings into Bronze layer
   */
  async insertBronzeTimings(requestId, timings) {
    try {
      const now = Date.now();
      
      this.db.exec(`
        INSERT INTO bronze_request_timings (
          request_id, dns_start, dns_end, dns_duration,
          tcp_start, tcp_end, tcp_duration,
          ssl_start, ssl_end, ssl_duration,
          request_start, request_end, request_duration,
          response_start, response_end, response_duration,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        requestId,
        timings.dnsStart, timings.dnsEnd, timings.dnsDuration,
        timings.tcpStart, timings.tcpEnd, timings.tcpDuration,
        timings.sslStart, timings.sslEnd, timings.sslDuration,
        timings.requestStart, timings.requestEnd, timings.requestDuration,
        timings.responseStart, timings.responseEnd, timings.responseDuration,
        now
      ]);
    } catch (error) {
      console.error('Failed to insert bronze timings:', error);
      throw new DatabaseError('Failed to insert bronze timings', error);
    }
  }

  /**
   * Insert event into Bronze layer
   */
  async insertBronzeEvent(eventData) {
    try {
      this.db.exec(`
        INSERT INTO bronze_events (
          event_type, event_name, source, data,
          request_id, user_id, session_id, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        eventData.eventType,
        eventData.eventName,
        eventData.source,
        eventData.data ? JSON.stringify(eventData.data) : null,
        eventData.requestId,
        eventData.userId,
        eventData.sessionId,
        eventData.timestamp || Date.now()
      ]);
    } catch (error) {
      console.error('Failed to insert bronze event:', error);
      throw new DatabaseError('Failed to insert bronze event', error);
    }
  }

  /**
   * Insert error into Bronze layer
   */
  async insertBronzeError(errorData) {
    try {
      this.db.exec(`
        INSERT INTO bronze_errors (
          error_type, message, stack, source,
          request_id, user_id, severity, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        errorData.errorType,
        errorData.message,
        errorData.stack,
        errorData.source,
        errorData.requestId,
        errorData.userId,
        errorData.severity || 'medium',
        errorData.timestamp || Date.now()
      ]);
    } catch (error) {
      console.error('Failed to insert bronze error:', error);
      throw new DatabaseError('Failed to insert bronze error', error);
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
      console.error('Error processing silver queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process Bronze request to Silver layer (data enrichment and validation)
   */
  async processBronzeToSilver(requestId) {
    try {
      // Fetch bronze request
      const bronzeRequest = this.db.exec(`
        SELECT * FROM bronze_requests WHERE id = ?
      `, [requestId]);

      if (!bronzeRequest || bronzeRequest.length === 0) {
        return;
      }

      const request = this.mapResultToObject(bronzeRequest[0]);
      
      // Enrich data
      const enrichedData = this.enrichRequestData(request);
      
      const now = Date.now();
      
      // Insert into Silver
      this.db.exec(`
        INSERT OR REPLACE INTO silver_requests (
          id, url, method, type, status, status_text,
          domain, path, protocol, duration, size_bytes,
          timestamp, tab_id, page_url, is_third_party,
          is_secure, has_error, performance_score,
          quality_score, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        request.id,
        request.url,
        request.method,
        request.type,
        request.status,
        request.status_text,
        request.domain,
        request.path,
        request.protocol,
        request.duration,
        request.size_bytes,
        request.timestamp,
        request.tab_id,
        request.page_url,
        enrichedData.isThirdParty ? 1 : 0,
        enrichedData.isSecure ? 1 : 0,
        enrichedData.hasError ? 1 : 0,
        enrichedData.performanceScore,
        enrichedData.qualityScore,
        now,
        now
      ]);

      // Insert metrics if timings available
      await this.processSilverMetrics(requestId);
      
      // Update domain stats
      await this.updateDomainStats(request.domain);
      
      // Update resource stats
      await this.updateResourceStats(request.type);
      
      this.eventBus?.publish('medallion:silver:processed', { requestId });
      
      // Queue for gold processing
      this.queueForGoldProcessing(requestId);
    } catch (error) {
      console.error('Failed to process bronze to silver:', error);
      throw new DatabaseError('Failed to process bronze to silver', error);
    }
  }

  /**
   * Process Silver metrics from Bronze timings
   */
  async processSilverMetrics(requestId) {
    try {
      const timings = this.db.exec(`
        SELECT * FROM bronze_request_timings WHERE request_id = ?
      `, [requestId]);

      if (!timings || timings.length === 0) {
        return;
      }

      const timing = this.mapResultToObject(timings[0]);
      const now = Date.now();

      this.db.exec(`
        INSERT OR REPLACE INTO silver_request_metrics (
          request_id, total_time, dns_time, tcp_time,
          ssl_time, wait_time, download_time, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        requestId,
        timing.request_duration + timing.response_duration,
        timing.dns_duration,
        timing.tcp_duration,
        timing.ssl_duration,
        timing.request_duration,
        timing.response_duration,
        now
      ]);
    } catch (error) {
      console.error('Failed to process silver metrics:', error);
    }
  }

  /**
   * Update domain statistics in Silver layer
   */
  async updateDomainStats(domain) {
    if (!domain) return;

    try {
      const now = Date.now();
      
      // Get current stats
      const existing = this.db.exec(`
        SELECT * FROM silver_domain_stats WHERE domain = ?
      `, [domain]);

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
        FROM bronze_requests WHERE domain = ?
      `, [domain]);

      if (stats && stats.length > 0) {
        const statData = this.mapResultToObject(stats[0]);
        
        this.db.exec(`
          INSERT OR REPLACE INTO silver_domain_stats (
            domain, total_requests, total_bytes, avg_duration,
            min_duration, max_duration, success_count, error_count,
            last_request_at, first_request_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          domain,
          statData.total_requests || 0,
          statData.total_bytes || 0,
          statData.avg_duration || 0,
          statData.min_duration || 0,
          statData.max_duration || 0,
          statData.success_count || 0,
          statData.error_count || 0,
          statData.last_request_at,
          statData.first_request_at,
          now
        ]);
      }
    } catch (error) {
      console.error('Failed to update domain stats:', error);
    }
  }

  /**
   * Update resource type statistics in Silver layer
   */
  async updateResourceStats(resourceType) {
    if (!resourceType) return;

    try {
      const now = Date.now();
      
      const stats = this.db.exec(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(size_bytes) as total_bytes,
          AVG(duration) as avg_duration,
          AVG(size_bytes) as avg_size
        FROM bronze_requests WHERE type = ?
      `, [resourceType]);

      if (stats && stats.length > 0) {
        const statData = this.mapResultToObject(stats[0]);
        
        this.db.exec(`
          INSERT OR REPLACE INTO silver_resource_stats (
            resource_type, total_requests, total_bytes,
            avg_duration, avg_size, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          resourceType,
          statData.total_requests || 0,
          statData.total_bytes || 0,
          statData.avg_duration || 0,
          statData.avg_size || 0,
          now
        ]);
      }
    } catch (error) {
      console.error('Failed to update resource stats:', error);
    }
  }

  /**
   * Queue for Gold layer processing
   */
  queueForGoldProcessing(requestId) {
    // Gold processing typically happens on schedule, not per request
    this.eventBus?.publish('medallion:silver:ready-for-gold', { requestId });
  }

  /**
   * Process daily analytics to Gold layer
   */
  async processDailyAnalytics(date) {
    try {
      const dateStr = date || new Date().toISOString().split('T')[0];
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
        WHERE timestamp >= ? AND timestamp <= ?
      `, [startOfDay, endOfDay]);

      if (stats && stats.length > 0) {
        const statData = this.mapResultToObject(stats[0]);
        
        // Get percentiles
        const p95 = this.calculatePercentile('bronze_requests', 'duration', 95, startOfDay, endOfDay);
        const p99 = this.calculatePercentile('bronze_requests', 'duration', 99, startOfDay, endOfDay);
        const median = this.calculatePercentile('bronze_requests', 'duration', 50, startOfDay, endOfDay);
        
        // Calculate error rate
        const errorCount = this.db.exec(`
          SELECT COUNT(*) as errors FROM bronze_requests 
          WHERE (status >= 400 OR error IS NOT NULL) AND timestamp >= ? AND timestamp <= ?
        `, [startOfDay, endOfDay]);
        
        const errorRate = statData.total_requests > 0 
          ? (this.mapResultToObject(errorCount[0]).errors / statData.total_requests) * 100 
          : 0;

        // Insert into gold layer
        this.db.exec(`
          INSERT OR REPLACE INTO gold_daily_analytics (
            date, total_requests, total_bytes, avg_response_time,
            median_response_time, p95_response_time, p99_response_time,
            error_rate, unique_domains, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          dateStr,
          statData.total_requests || 0,
          statData.total_bytes || 0,
          statData.avg_response_time || 0,
          median,
          p95,
          p99,
          errorRate,
          statData.unique_domains || 0,
          now,
          now
        ]);

        this.eventBus?.publish('medallion:gold:daily-processed', { date: dateStr });
      }
    } catch (error) {
      console.error('Failed to process daily analytics:', error);
      throw new DatabaseError('Failed to process daily analytics', error);
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
        isSecure: url.protocol === 'https:',
        hasError: !!(request.error || (request.status && request.status >= 400)),
        performanceScore: this.calculatePerformanceScore(request),
        qualityScore: this.calculateQualityScore(request)
      };
    } catch (error) {
      return {
        isThirdParty: false,
        isSecure: false,
        hasError: false,
        performanceScore: 0,
        qualityScore: 0
      };
    }
  }

  /**
   * Check if domain is third-party
   */
  isThirdPartyDomain(hostname) {
    // Simple heuristic - can be enhanced with proper logic
    const commonThirdParty = ['google', 'facebook', 'twitter', 'analytics', 'cdn'];
    return commonThirdParty.some(tp => hostname.includes(tp));
  }

  /**
   * Calculate performance score (0-100)
   */
  calculatePerformanceScore(request) {
    if (!request.duration) return 0;
    
    // Simple scoring: faster is better
    // < 100ms = 100, > 5000ms = 0
    const maxDuration = 5000;
    const score = Math.max(0, Math.min(100, 100 - (request.duration / maxDuration * 100)));
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
        WHERE timestamp >= ? AND timestamp <= ? AND ${column} IS NOT NULL
        ORDER BY ${column}
      `, [startTime, endTime]);

      if (!result || result.length === 0 || !result[0].values.length) {
        return 0;
      }

      const values = result[0].values.map(v => v[0]);
      const index = Math.ceil((percentile / 100) * values.length) - 1;
      return values[index] || 0;
    } catch (error) {
      console.error('Failed to calculate percentile:', error);
      return 0;
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
