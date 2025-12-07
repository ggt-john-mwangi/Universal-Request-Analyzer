// Analytics Processor - Generates OHLC and Star Schema data
// Processes data from Silver layer into Star Schema fact tables

import { DatabaseError } from "../errors/error-types.js";
import { 
  getOrCreateTimeDimensionKey, 
  getOrCreateDomainDimensionKey 
} from "./star-schema.js";

export class AnalyticsProcessor {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
    this.supportedTimeframes = ['1min', '5min', '15min', '1h', '4h', '1d', '1w', '1m'];
  }

  /**
   * Process request into fact table
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
      
      // Insert into fact table
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
   * Generate OHLC data for a specific timeframe
   */
  async generateOHLC(timeframe, startTime, endTime, options = {}) {
    try {
      const {
        domainKey = null,
        resourceTypeKey = null
      } = options;
      
      // Get period column name based on timeframe
      const periodColumn = this.getPeriodColumn(timeframe);
      
      // Get unique periods in the time range
      const periodsResult = this.db.exec(`
        SELECT DISTINCT dt.${periodColumn} as period, dt.time_key
        FROM dim_time dt
        WHERE dt.timestamp >= ? AND dt.timestamp <= ?
        ORDER BY period
      `, [startTime, endTime]);
      
      if (!periodsResult || !periodsResult[0]?.values.length) {
        return [];
      }
      
      const periods = periodsResult[0].values;
      const ohlcData = [];
      
      for (const [period, timeKey] of periods) {
        const ohlc = await this.calculateOHLCForPeriod(
          timeframe,
          period,
          timeKey,
          domainKey,
          resourceTypeKey
        );
        
        if (ohlc) {
          ohlcData.push(ohlc);
        }
      }
      
      return ohlcData;
    } catch (error) {
      console.error(`Failed to generate OHLC for ${timeframe}:`, error);
      throw new DatabaseError(`Failed to generate OHLC for ${timeframe}`, error);
    }
  }

  /**
   * Calculate OHLC for a specific period
   */
  async calculateOHLCForPeriod(timeframe, period, timeKey, domainKey, resourceTypeKey) {
    try {
      const periodColumn = this.getPeriodColumn(timeframe);
      const now = Date.now();
      
      // Build query with optional filters
      let whereClause = `dt.${periodColumn} = ?`;
      const params = [period];
      
      if (domainKey) {
        whereClause += ` AND fr.domain_key = ?`;
        params.push(domainKey);
      }
      
      if (resourceTypeKey) {
        whereClause += ` AND fr.resource_type_key = ?`;
        params.push(resourceTypeKey);
      }
      
      // Get OHLC metrics
      const metricsResult = this.db.exec(`
        SELECT 
          MIN(fr.created_at) as first_time,
          MAX(fr.created_at) as last_time,
          COUNT(*) as request_count,
          SUM(fr.size_bytes) as total_bytes,
          AVG(fr.duration_ms) as avg_response_time,
          SUM(CASE WHEN sc.is_success = 1 THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN sc.is_error = 1 THEN 1 ELSE 0 END) as error_count,
          AVG(fr.performance_score) as avg_performance_score,
          AVG(fr.quality_score) as avg_quality_score
        FROM fact_requests fr
        JOIN dim_time dt ON fr.time_key = dt.time_key
        LEFT JOIN dim_status_code sc ON fr.status_code_key = sc.status_code_key
        WHERE ${whereClause}
      `, params);
      
      if (!metricsResult || !metricsResult[0]?.values.length) {
        return null;
      }
      
      const [firstTime, lastTime, requestCount, totalBytes, avgResponseTime, 
             successCount, errorCount, avgPerfScore, avgQualityScore] = metricsResult[0].values[0];
      
      if (!requestCount) {
        return null;
      }
      
      // Get OHLC for duration
      const ohlcResult = this.db.exec(`
        WITH ordered_durations AS (
          SELECT 
            fr.duration_ms,
            ROW_NUMBER() OVER (ORDER BY fr.created_at) as first_rank,
            ROW_NUMBER() OVER (ORDER BY fr.created_at DESC) as last_rank
          FROM fact_requests fr
          JOIN dim_time dt ON fr.time_key = dt.time_key
          WHERE ${whereClause}
        )
        SELECT 
          (SELECT duration_ms FROM ordered_durations WHERE first_rank = 1) as open,
          MAX(duration_ms) as high,
          MIN(duration_ms) as low,
          (SELECT duration_ms FROM ordered_durations WHERE last_rank = 1) as close
        FROM ordered_durations
      `, params);
      
      const [openTime, highTime, lowTime, closeTime] = ohlcResult[0]?.values[0] || [0, 0, 0, 0];
      
      // Calculate percentiles
      const percentiles = this.calculatePercentiles(whereClause, params);
      
      // Calculate period boundaries
      const periodStart = this.getPeriodStart(timeframe, period);
      const periodEnd = this.getPeriodEnd(timeframe, period);
      
      const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
      
      // Insert or update OHLC fact
      this.db.exec(`
        INSERT OR REPLACE INTO fact_ohlc_performance (
          time_key, period_type, domain_key, resource_type_key,
          open_time, high_time, low_time, close_time,
          request_count, total_bytes,
          avg_response_time, median_response_time, p95_response_time, p99_response_time,
          success_count, error_count, error_rate,
          avg_performance_score, avg_quality_score,
          period_start, period_end, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        timeKey,
        timeframe,
        domainKey,
        resourceTypeKey,
        openTime || 0,
        highTime || 0,
        lowTime || 0,
        closeTime || 0,
        requestCount || 0,
        totalBytes || 0,
        avgResponseTime || 0,
        percentiles.median || 0,
        percentiles.p95 || 0,
        percentiles.p99 || 0,
        successCount || 0,
        errorCount || 0,
        errorRate,
        avgPerfScore || 0,
        avgQualityScore || 0,
        periodStart,
        periodEnd,
        now
      ]);
      
      return {
        timeKey,
        period,
        periodType: timeframe,
        open: openTime,
        high: highTime,
        low: lowTime,
        close: closeTime,
        volume: requestCount,
        avgResponseTime,
        periodStart,
        periodEnd
      };
    } catch (error) {
      console.error('Failed to calculate OHLC for period:', error);
      return null;
    }
  }

  /**
   * Calculate percentiles for metrics
   */
  calculatePercentiles(whereClause, params) {
    try {
      const result = this.db.exec(`
        WITH ordered_durations AS (
          SELECT 
            fr.duration_ms,
            ROW_NUMBER() OVER (ORDER BY fr.duration_ms) as row_num,
            COUNT(*) OVER () as total_count
          FROM fact_requests fr
          JOIN dim_time dt ON fr.time_key = dt.time_key
          WHERE ${whereClause}
        )
        SELECT 
          MAX(CASE WHEN row_num = CAST(total_count * 0.50 AS INTEGER) THEN duration_ms END) as median,
          MAX(CASE WHEN row_num = CAST(total_count * 0.95 AS INTEGER) THEN duration_ms END) as p95,
          MAX(CASE WHEN row_num = CAST(total_count * 0.99 AS INTEGER) THEN duration_ms END) as p99
        FROM ordered_durations
      `, params);
      
      if (result && result[0]?.values.length > 0) {
        const [median, p95, p99] = result[0].values[0];
        return { median, p95, p99 };
      }
      
      return { median: 0, p95: 0, p99: 0 };
    } catch (error) {
      console.error('Failed to calculate percentiles:', error);
      return { median: 0, p95: 0, p99: 0 };
    }
  }

  /**
   * Generate quality metrics
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
      
    } catch (error) {
      console.error('Failed to generate quality metrics:', error);
    }
  }

  /**
   * Calculate reliability score based on variance
   */
  calculateReliabilityScore(timeKey, domainKey) {
    try {
      const result = this.db.exec(`
        SELECT 
          AVG(duration_ms) as avg_duration,
          AVG((duration_ms - (SELECT AVG(duration_ms) FROM fact_requests WHERE time_key = ?)) 
              * (duration_ms - (SELECT AVG(duration_ms) FROM fact_requests WHERE time_key = ?))) as variance
        FROM fact_requests
        WHERE time_key = ? ${domainKey ? 'AND domain_key = ?' : ''}
      `, domainKey ? [timeKey, timeKey, timeKey, domainKey] : [timeKey, timeKey, timeKey]);
      
      if (result && result[0]?.values.length > 0) {
        const [avgDuration, variance] = result[0].values[0];
        const stdDev = Math.sqrt(variance || 0);
        const coefficientOfVariation = avgDuration > 0 ? (stdDev / avgDuration) * 100 : 0;
        
        // Lower coefficient of variation = higher reliability
        // Score from 0-100 (inverted coefficient, capped at 100)
        return Math.max(0, 100 - coefficientOfVariation);
      }
      
      return 50; // Default middle score
    } catch (error) {
      console.error('Failed to calculate reliability score:', error);
      return 50;
    }
  }

  /**
   * Get period column name for timeframe
   */
  getPeriodColumn(timeframe) {
    const mapping = {
      '1min': 'period_1min',
      '5min': 'period_5min',
      '15min': 'period_15min',
      '1h': 'period_1h',
      '4h': 'period_4h',
      '1d': 'period_1d',
      '1w': 'period_1w',
      '1m': 'period_1m'
    };
    
    return mapping[timeframe] || 'period_1h';
  }

  /**
   * Get period start timestamp
   */
  getPeriodStart(timeframe, period) {
    const durations = {
      '1min': 60000,
      '5min': 300000,
      '15min': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
      '1w': 604800000,
      '1m': 2592000000 // Approximate
    };
    
    return period * (durations[timeframe] || 3600000);
  }

  /**
   * Get period end timestamp
   */
  getPeriodEnd(timeframe, period) {
    const durations = {
      '1min': 60000,
      '5min': 300000,
      '15min': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
      '1w': 604800000,
      '1m': 2592000000
    };
    
    return (period + 1) * (durations[timeframe] || 3600000) - 1;
  }
}

export function createAnalyticsProcessor(db, eventBus) {
  return new AnalyticsProcessor(db, eventBus);
}
