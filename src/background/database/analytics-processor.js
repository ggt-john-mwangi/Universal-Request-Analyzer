// Analytics Processor - Processes data from Silver layer into Star Schema fact tables
// Simplified version focusing on performance tracking over time (requests, response times, errors)

import { DatabaseError } from "../errors/error-types.js";
import { 
  getOrCreateTimeDimensionKey, 
  getOrCreateDomainDimensionKey 
} from "./star-schema.js";

export class AnalyticsProcessor {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  /**
   * Process request into fact table for performance tracking
   */
  async processRequestToFact(request) {
    try {
      const now = Date.now();
      
      // Get dimension keys
      const timeKey = getOrCreateTimeDimensionKey(this.db, request.timestamp);
      const domainKey = getOrCreateDomainDimensionKey(this.db, request.domain, {
        isThirdParty: request.is_third_party,
        category: request.category,
        riskLevel: request.risk_level
      });
      
      // Get resource type key
      const resourceTypeResult = this.db.exec(`
        SELECT resource_type_key FROM dim_resource_type WHERE resource_type = ?
      `, [request.type || 'other']);
      const resourceTypeKey = resourceTypeResult[0]?.values[0]?.[0] || 1;
      
      // Get status code key
      let statusCodeKey = null;
      if (request.status) {
        const statusCodeResult = this.db.exec(`
          SELECT status_code_key FROM dim_status_code WHERE status_code = ?
        `, [request.status]);
        statusCodeKey = statusCodeResult[0]?.values[0]?.[0];
      }
      
      // Get timings from silver_request_metrics if available
      const metricsResult = this.db.exec(`
        SELECT dns_time, tcp_time, ssl_time, wait_time, download_time
        FROM silver_request_metrics WHERE request_id = ?
      `, [request.id]);
      
      let dnsTime = 0, tcpTime = 0, sslTime = 0, waitTime = 0, downloadTime = 0;
      if (metricsResult && metricsResult[0]?.values.length > 0) {
        [dnsTime, tcpTime, sslTime, waitTime, downloadTime] = metricsResult[0].values[0];
      }
      
      // Insert into fact table for time-series performance analysis
      this.db.exec(`
        INSERT INTO fact_requests (
          request_id, time_key, domain_key, resource_type_key, status_code_key,
          duration_ms, dns_time_ms, tcp_time_ms, ssl_time_ms, wait_time_ms, download_time_ms,
          size_bytes, is_cached, is_compressed, performance_score, quality_score,
          has_error, is_secure, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        request.id,
        timeKey,
        domainKey,
        resourceTypeKey,
        statusCodeKey,
        request.duration || 0,
        dnsTime || 0,
        tcpTime || 0,
        sslTime || 0,
        waitTime || 0,
        downloadTime || 0,
        request.size_bytes || 0,
        request.from_cache ? 1 : 0,
        0, // is_compressed - TODO: detect from headers
        request.performance_score || 0,
        request.quality_score || 0,
        request.has_error ? 1 : 0,
        request.is_secure ? 1 : 0,
        now
      ]);
      
      return true;
    } catch (error) {
      console.error('Failed to process request to fact table:', error);
      throw new DatabaseError('Failed to process request to fact table', error);
    }
  }

  /**
   * Get performance metrics over time for charts
   * Returns time-series data for tracking requests and performance
   */
  async getPerformanceOverTime(startTime, endTime, groupBy = '1h', filters = {}) {
    try {
      const {
        domainKey = null,
        resourceTypeKey = null,
        statusFilter = null
      } = filters;
      
      // Build WHERE clause
      let whereClause = 'dt.timestamp >= ? AND dt.timestamp <= ?';
      const params = [startTime, endTime];
      
      if (domainKey) {
        whereClause += ' AND fr.domain_key = ?';
        params.push(domainKey);
      }
      
      if (resourceTypeKey) {
        whereClause += ' AND fr.resource_type_key = ?';
        params.push(resourceTypeKey);
      }
      
      if (statusFilter) {
        whereClause += ' AND sc.is_' + statusFilter + ' = 1';
      }
      
      // Get aggregated metrics grouped by time period
      const periodColumn = this.getPeriodColumn(groupBy);
      const result = this.db.exec(`
        SELECT 
          dt.${periodColumn} as period,
          dt.timestamp as period_timestamp,
          COUNT(*) as request_count,
          AVG(fr.duration_ms) as avg_response_time,
          MIN(fr.duration_ms) as min_response_time,
          MAX(fr.duration_ms) as max_response_time,
          SUM(fr.size_bytes) as total_bytes,
          SUM(CASE WHEN sc.is_success = 1 THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN sc.is_error = 1 THEN 1 ELSE 0 END) as error_count,
          AVG(fr.performance_score) as avg_performance_score
        FROM fact_requests fr
        JOIN dim_time dt ON fr.time_key = dt.time_key
        LEFT JOIN dim_status_code sc ON fr.status_code_key = sc.status_code_key
        WHERE ${whereClause}
        GROUP BY dt.${periodColumn}
        ORDER BY dt.timestamp
      `, params);
      
      if (!result || !result[0]?.values.length) {
        return [];
      }
      
      return result[0].values.map(row => ({
        period: row[0],
        timestamp: row[1],
        requestCount: row[2],
        avgResponseTime: row[3],
        minResponseTime: row[4],
        maxResponseTime: row[5],
        totalBytes: row[6],
        successCount: row[7],
        errorCount: row[8],
        avgPerformanceScore: row[9],
        errorRate: row[2] > 0 ? (row[8] / row[2]) * 100 : 0
      }));
    } catch (error) {
      console.error('Failed to get performance over time:', error);
      throw new DatabaseError('Failed to get performance over time', error);
    }
  }

  /**
   * Get period column name based on grouping
   */
  getPeriodColumn(groupBy) {
    const mapping = {
      '1min': 'period_1min',
      '5min': 'period_5min',
      '15min': 'period_15min',
      '30min': 'period_30min',
      '1h': 'period_1h',
      '4h': 'period_4h',
      '1d': 'period_1d',
      '1w': 'period_1w',
      '1m': 'period_1m'
    };
    return mapping[groupBy] || 'period_1h';
  }

  /**
   * Generate quality metrics for monitoring
   */
  async generateQualityMetrics(timeKey, domainKey, periodStart, periodEnd) {
    try {
      const now = Date.now();
      
      // Get quality metrics
      const metricsResult = this.db.exec(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN sc.is_success = 1 THEN 1 ELSE 0 END) as successful_requests,
          SUM(CASE WHEN sc.is_error = 1 THEN 1 ELSE 0 END) as failed_requests,
          SUM(fr.size_bytes) as total_bytes,
          SUM(CASE WHEN fr.is_cached = 1 THEN fr.size_bytes ELSE 0 END) as cached_bytes,
          SUM(CASE WHEN fr.duration_ms < 100 THEN 1 ELSE 0 END) as under_100ms,
          SUM(CASE WHEN fr.duration_ms >= 100 AND fr.duration_ms < 500 THEN 1 ELSE 0 END) as under_500ms,
          SUM(CASE WHEN fr.duration_ms >= 500 AND fr.duration_ms < 1000 THEN 1 ELSE 0 END) as under_1s,
          SUM(CASE WHEN fr.duration_ms >= 1000 AND fr.duration_ms < 3000 THEN 1 ELSE 0 END) as under_3s,
          SUM(CASE WHEN fr.duration_ms >= 3000 THEN 1 ELSE 0 END) as over_3s,
          AVG(fr.performance_score) as avg_perf_score,
          SUM(CASE WHEN fr.is_secure = 1 THEN 1 ELSE 0 END) as secure_requests
        FROM fact_requests fr
        LEFT JOIN dim_status_code sc ON fr.status_code_key = sc.status_code_key
        WHERE fr.time_key = ? ${domainKey ? 'AND fr.domain_key = ?' : ''}
      `, domainKey ? [timeKey, domainKey] : [timeKey]);
      
      if (!metricsResult || !metricsResult[0]?.values.length) {
        return;
      }
      
      const [totalReq, successReq, failedReq, totalBytes, cachedBytes,
             under100, under500, under1s, under3s, over3s, avgPerfScore, secureReq] 
             = metricsResult[0].values[0];
      
      const availabilityRate = totalReq > 0 ? (successReq / totalReq) * 100 : 0;
      const cacheHitRate = totalBytes > 0 ? (cachedBytes / totalBytes) * 100 : 0;
      const securityScore = totalReq > 0 ? (secureReq / totalReq) * 100 : 0;
      
      // Calculate reliability score based on consistency
      const reliabilityScore = this.calculateReliabilityScore(timeKey, domainKey);
      
      // Insert quality metrics
      this.db.exec(`
        INSERT OR REPLACE INTO fact_quality_metrics (
          time_key, domain_key,
          availability_rate, performance_index, reliability_score, security_score,
          total_requests, successful_requests, failed_requests,
          requests_under_100ms, requests_under_500ms, requests_under_1s,
          requests_under_3s, requests_over_3s,
          total_data_transferred, cached_data_bytes, cache_hit_rate,
          period_start, period_end, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        timeKey,
        domainKey,
        availabilityRate,
        avgPerfScore || 0,
        reliabilityScore,
        securityScore,
        totalReq || 0,
        successReq || 0,
        failedReq || 0,
        under100 || 0,
        under500 || 0,
        under1s || 0,
        under3s || 0,
        over3s || 0,
        totalBytes || 0,
        cachedBytes || 0,
        cacheHitRate,
        periodStart,
        periodEnd,
        now
      ]);
      
      return true;
    } catch (error) {
      console.error('Failed to generate quality metrics:', error);
      return false;
    }
  }

  /**
   * Calculate reliability score based on response time variance
   */
  calculateReliabilityScore(timeKey, domainKey) {
    try {
      const result = this.db.exec(`
        SELECT 
          AVG(duration_ms) as avg_duration,
          STDEV(duration_ms) as std_duration,
          COUNT(*) as request_count
        FROM fact_requests
        WHERE time_key = ? ${domainKey ? 'AND domain_key = ?' : ''}
      `, domainKey ? [timeKey, domainKey] : [timeKey]);
      
      if (!result || !result[0]?.values.length) {
        return 0;
      }
      
      const [avgDuration, stdDuration, count] = result[0].values[0];
      
      if (!count || count === 0 || !avgDuration) {
        return 0;
      }
      
      // Calculate coefficient of variation (lower is more reliable)
      const coefficientOfVariation = (stdDuration / avgDuration) * 100;
      
      // Convert to score (0-100, higher is better)
      const reliabilityScore = Math.max(0, 100 - coefficientOfVariation);
      
      return reliabilityScore;
    } catch (error) {
      console.error('Failed to calculate reliability score:', error);
      return 0;
    }
  }
}
