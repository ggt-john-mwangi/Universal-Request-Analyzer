// Analytics Component
// Manages advanced analytics features: percentiles, anomaly detection, trends, heatmaps

import Chart from '../../lib/chart.min.js';

class Analytics {
  constructor() {
    this.charts = {};
    this.currentFilters = {
      domain: 'all',
      pageUrl: '',
      timeRange: 86400,
      type: ''
    };
  }

  async initialize() {
    console.log('Initializing Analytics...');
    
    this.setupEventListeners();
    await this.loadInitialData();
    
    console.log('✓ Analytics initialized');
  }

  setupEventListeners() {
    // Trend analysis controls
    const refreshTrendsBtn = document.getElementById('refreshTrendsBtn');
    if (refreshTrendsBtn) {
      refreshTrendsBtn.addEventListener('click', () => this.loadTrendAnalysis());
    }

    const trendCompareType = document.getElementById('trendCompareType');
    if (trendCompareType) {
      trendCompareType.addEventListener('click', () => this.loadTrendAnalysis());
    }

    // Multi-domain comparison
    const compareDomainsBtn = document.getElementById('compareDomainsBtn');
    if (compareDomainsBtn) {
      compareDomainsBtn.addEventListener('click', () => this.compareDomains());
    }

    // Load domains for comparison
    this.loadDomainsForComparison();
  }

  async loadInitialData() {
    await Promise.all([
      this.loadPercentilesAnalysis(),
      this.loadAnomalyDetection(),
      this.loadTrendAnalysis(),
      this.loadHeatmap(),
      this.loadPerformanceInsights()
    ]);
  }

  async loadPercentilesAnalysis() {
    const loadingEl = document.getElementById('percentilesLoading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getPercentilesAnalysis',
        filters: this.currentFilters
      });

      if (response?.success && response.percentiles) {
        this.displayPercentiles(response.percentiles);
      }
    } catch (error) {
      console.error('Failed to load percentiles:', error);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  displayPercentiles(percentiles) {
    const elements = {
      p50Value: percentiles.p50,
      p75Value: percentiles.p75,
      p90Value: percentiles.p90,
      p95Value: percentiles.p95,
      p99Value: percentiles.p99,
      maxValue: percentiles.max
    };

    for (const [id, value] of Object.entries(elements)) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value ? `${Math.round(value)}ms` : '-';
        // Color code based on performance
        const cls = value < 500 ? 'good' : value < 1000 ? 'warning' : 'danger';
        el.className = `percentile-value ${cls}`;
      }
    }
  }

  async loadAnomalyDetection() {
    const loadingEl = document.getElementById('anomaliesLoading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getAnomalyDetection',
        filters: this.currentFilters
      });

      if (response?.success) {
        this.displayAnomalies(response.anomalies || []);
      }
    } catch (error) {
      console.error('Failed to load anomaly detection:', error);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  displayAnomalies(anomalies) {
    const listEl = document.getElementById('anomaliesList');
    if (!listEl) return;

    if (anomalies.length === 0) {
      listEl.innerHTML = '<p class="placeholder">No anomalies detected</p>';
      return;
    }

    const html = anomalies.map(anomaly => `
      <div class="anomaly-card severity-${anomaly.severity}">
        <div class="anomaly-header">
          <span class="anomaly-type">${this.getAnomalyTypeLabel(anomaly.type)}</span>
          <span class="anomaly-severity">${anomaly.severity.toUpperCase()}</span>
        </div>
        <div class="anomaly-details">
          <div>Hour: ${anomaly.hour}:00</div>
          <div>Requests: ${anomaly.value}</div>
          <div>Avg Duration: ${anomaly.avgDuration}ms</div>
          <div>Error Rate: ${anomaly.errorRate}%</div>
        </div>
      </div>
    `).join('');

    listEl.innerHTML = html;
  }

  getAnomalyTypeLabel(type) {
    const labels = {
      traffic_spike: 'Traffic Spike',
      slow_response: 'Slow Response',
      high_errors: 'High Error Rate'
    };
    return labels[type] || type;
  }

  async loadTrendAnalysis() {
    const loadingEl = document.getElementById('trendsLoading');
    if (loadingEl) loadingEl.style.display = 'block';

    const compareType = document.getElementById('trendCompareType')?.value || 'week';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getTrendAnalysis',
        filters: this.currentFilters,
        compareType
      });

      if (response?.success && response.trends) {
        this.displayTrends(response.trends);
      }
    } catch (error) {
      console.error('Failed to load trend analysis:', error);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  displayTrends(trends) {
    // Display current values and changes
    this.updateTrendCard('trendRequests', trends.current.totalRequests, trends.requestsChange);
    this.updateTrendCard('trendDuration', `${trends.current.avgDuration}ms`, trends.durationChange);
    this.updateTrendCard('trendErrors', trends.current.errors, trends.errorsChange);
    this.updateTrendCard('trendBytes', this.formatBytes(trends.current.totalBytes), trends.bytesChange);
  }

  updateTrendCard(id, value, change) {
    const valueEl = document.getElementById(id);
    const changeEl = document.getElementById(`${id}Change`);

    if (valueEl) valueEl.textContent = value;
    if (changeEl) {
      const changeNum = parseFloat(change);
      changeEl.textContent = `${changeNum > 0 ? '+' : ''}${change}%`;
      changeEl.className = `trend-change ${changeNum > 0 ? 'positive' : changeNum < 0 ? 'negative' : ''}`;
    }
  }

  async loadHeatmap() {
    const loadingEl = document.getElementById('heatmapLoading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getHeatmapData',
        filters: this.currentFilters
      });

      if (response?.success && response.heatmap) {
        this.renderHeatmap(response.heatmap);
      }
    } catch (error) {
      console.error('Failed to load heatmap:', error);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  renderHeatmap(heatmap) {
    const canvas = document.getElementById('heatmapCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const cellWidth = 30;
    const cellHeight = 20;
    const labelWidth = 80;
    const labelHeight = 30;

    // Set canvas size
    canvas.width = labelWidth + (heatmap.hours.length * cellWidth);
    canvas.height = labelHeight + (heatmap.days.length * cellHeight);

    // Find max value for normalization
    const maxValue = Math.max(...heatmap.data.flat());

    // Draw heatmap cells
    heatmap.data.forEach((dayData, dayIdx) => {
      dayData.forEach((count, hourIdx) => {
        const x = labelWidth + (hourIdx * cellWidth);
        const y = labelHeight + (dayIdx * cellHeight);

        // Color intensity based on count
        const intensity = maxValue > 0 ? count / maxValue : 0;
        const hue = 120 - (intensity * 120); // Green to red
        ctx.fillStyle = `hsl(${hue}, 80%, ${50 + (intensity * 30)}%)`;
        ctx.fillRect(x, y, cellWidth, cellHeight);

        // Draw border
        ctx.strokeStyle = '#ccc';
        ctx.strokeRect(x, y, cellWidth, cellHeight);
      });
    });

    // Draw labels
    ctx.fillStyle = '#333';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    heatmap.days.forEach((day, idx) => {
      ctx.fillText(day.substring(0, 3), labelWidth - 5, labelHeight + (idx * cellHeight) + 14);
    });

    ctx.textAlign = 'center';
    heatmap.hours.forEach((hour, idx) => {
      if (idx % 3 === 0) { // Show every 3rd hour to avoid clutter
        ctx.fillText(hour, labelWidth + (idx * cellWidth) + 15, labelHeight - 5);
      }
    });
  }

  async loadDomainsForComparison() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getDomains',
        timeRange: 604800 // Last week
      });

      if (response?.success && response.domains) {
        const selectors = ['compareDomain1', 'compareDomain2', 'compareDomain3'];
        selectors.forEach(id => {
          const select = document.getElementById(id);
          if (select) {
            select.innerHTML = '<option value="">Select Domain</option>' +
              response.domains.map(d => `<option value="${d.domain}">${d.domain}</option>`).join('');
          }
        });
      }
    } catch (error) {
      console.error('Failed to load domains:', error);
    }
  }

  async compareDomains() {
    const domains = [
      document.getElementById('compareDomain1')?.value,
      document.getElementById('compareDomain2')?.value,
      document.getElementById('compareDomain3')?.value
    ].filter(d => d);

    if (domains.length < 2) {
      alert('Please select at least 2 domains to compare');
      return;
    }

    const loadingEl = document.getElementById('comparisonLoading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getMultiDomainComparison',
        domains,
        filters: { timeRange: this.currentFilters.timeRange }
      });

      if (response?.success && response.comparison) {
        this.renderComparisonChart(response.comparison);
      }
    } catch (error) {
      console.error('Failed to compare domains:', error);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  renderComparisonChart(comparison) {
    const canvas = document.getElementById('comparisonChart');
    if (!canvas) return;

    // Destroy existing chart
    if (this.charts.comparison) {
      this.charts.comparison.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.charts.comparison = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: comparison.map(c => c.domain),
        datasets: [
          {
            label: 'Total Requests',
            data: comparison.map(c => c.totalRequests),
            backgroundColor: 'rgba(76, 175, 80, 0.7)',
            yAxisID: 'y'
          },
          {
            label: 'Avg Duration (ms)',
            data: comparison.map(c => c.avgDuration),
            backgroundColor: 'rgba(33, 150, 243, 0.7)',
            yAxisID: 'y1'
          },
          {
            label: 'Errors',
            data: comparison.map(c => c.errors),
            backgroundColor: 'rgba(244, 67, 54, 0.7)',
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Count' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Duration (ms)' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  async loadPerformanceInsights() {
    const loadingEl = document.getElementById('insightsLoading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getPerformanceInsights',
        filters: this.currentFilters
      });

      if (response?.success) {
        this.displayInsights(response.insights || []);
      }
    } catch (error) {
      console.error('Failed to load performance insights:', error);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  displayInsights(insights) {
    const listEl = document.getElementById('insightsList');
    if (!listEl) return;

    if (insights.length === 0) {
      listEl.innerHTML = '<p class="placeholder">No insights available. Apply filters and refresh to generate recommendations.</p>';
      return;
    }

    const html = insights.map(insight => `
      <div class="insight-card ${insight.type} severity-${insight.severity}">
        <div class="insight-header">
          <div class="insight-icon">
            <i class="fas fa-${this.getInsightIcon(insight.type)}"></i>
          </div>
          <div class="insight-title">
            <span class="insight-category">${insight.category}</span>
            <span class="insight-severity">${insight.severity.toUpperCase()}</span>
          </div>
        </div>
        <div class="insight-message">${insight.message}</div>
        <div class="insight-recommendation">
          <strong>Recommendation:</strong> ${insight.recommendation}
        </div>
      </div>
    `).join('');

    listEl.innerHTML = html;
  }

  getInsightIcon(type) {
    const icons = {
      performance: 'tachometer-alt',
      caching: 'hdd',
      reliability: 'shield-alt',
      optimization: 'cogs'
    };
    return icons[type] || 'lightbulb';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  updateFilters(filters) {
    this.currentFilters = { ...this.currentFilters, ...filters };
    this.loadInitialData();
  }
}

export default Analytics;
