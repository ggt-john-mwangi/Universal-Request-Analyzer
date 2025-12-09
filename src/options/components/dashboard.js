// Dashboard Component
// Manages the dashboard visualization and real-time metrics

import Chart from '../../lib/chart.min.js';

class Dashboard {
  constructor() {
    this.charts = {};
    this.refreshInterval = null;
    this.timeRange = 86400; // Default 24 hours
  }

  async initialize() {
    console.log('Initializing Dashboard...');
    
    // Load domain filter first
    await this.loadDomainFilter();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize charts
    this.initializeCharts();
    
    // Load initial data
    await this.refreshDashboard();
    
    // Start auto-refresh
    this.startAutoRefresh();
    
    console.log('✓ Dashboard initialized');
  }

  setupEventListeners() {
    const domainFilter = document.getElementById('dashboardDomainFilter');
    if (domainFilter) {
      domainFilter.addEventListener('change', () => this.onDomainFilterChange());
    }
    
    const pageFilter = document.getElementById('dashboardPageFilter');
    if (pageFilter) {
      pageFilter.addEventListener('change', () => this.refreshDashboard());
    }
    
    const requestTypeFilter = document.getElementById('dashboardRequestTypeFilter');
    if (requestTypeFilter) {
      requestTypeFilter.addEventListener('change', () => this.refreshDashboard());
    }
    
    const timeRangeSelect = document.getElementById('dashboardTimeRange');
    if (timeRangeSelect) {
      timeRangeSelect.addEventListener('change', (e) => {
        this.timeRange = parseInt(e.target.value);
        this.refreshDashboard();
      });
    }

    const refreshBtn = document.getElementById('dashboardRefresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshDashboard());
    }
  }

  // Helper to get theme colors from CSS variables
  getThemeColor(colorName) {
    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue(colorName).trim();
  }

  // Get chart colors from theme
  getChartColors() {
    return {
      success: this.getThemeColor('--success-color'),
      info: this.getThemeColor('--info-color'),
      warning: this.getThemeColor('--warning-color'),
      error: this.getThemeColor('--error-color'),
      primary: this.getThemeColor('--primary-color'),
    };
  }

  initializeCharts() {
    const colors = this.getChartColors();
    
    // Volume Chart - Line chart for request volume over time
    const volumeCanvas = document.getElementById('dashboardVolumeChart');
    if (volumeCanvas) {
      const ctx = volumeCanvas.getContext('2d');
      this.charts.volume = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Requests',
            data: [],
            borderColor: colors.success,
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Requests'
              }
            }
          }
        }
      });
    }

    // Status Chart - Doughnut chart for status distribution
    const statusCanvas = document.getElementById('dashboardStatusChart');
    if (statusCanvas) {
      const ctx = statusCanvas.getContext('2d');
      this.charts.status = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['2xx Success', '3xx Redirect', '4xx Client Error', '5xx Server Error'],
          datasets: [{
            data: [],
            backgroundColor: [
              colors.success,
              colors.info,
              colors.warning,
              colors.error,
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
            }
          }
        }
      });
    }

    // Domains Chart - Horizontal bar chart for top domains
    const domainsCanvas = document.getElementById('dashboardDomainsChart');
    if (domainsCanvas) {
      const ctx = domainsCanvas.getContext('2d');
      this.charts.domains = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{
            label: 'Requests',
            data: [],
            backgroundColor: colors.primary,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              beginAtZero: true
            }
          }
        }
      });
    }

    // Performance Chart - Line chart for performance trends
    const perfCanvas = document.getElementById('dashboardPerformanceChart');
    if (perfCanvas) {
      const ctx = perfCanvas.getContext('2d');
      this.charts.performance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Avg Response Time (ms)',
            data: [],
            borderColor: colors.info,
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Response Time (ms)'
              }
            }
          }
        }
      });
    }
  }

  async refreshDashboard() {
    console.log('Refreshing dashboard...');
    
    try {
      // Get aggregated stats from background
      const stats = await this.getAggregatedStats();
      
      // Update metric cards
      this.updateMetricCards(stats);
      
      // Update charts
      this.updateCharts(stats);
      
      // Update medallion layer status
      this.updateLayerStatus(stats);
      
      // Update Core Web Vitals
      await this.updateWebVitals();
      
      // Update Session Metrics
      await this.updateSessionMetrics();
      
      console.log('✓ Dashboard refreshed');
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    }
  }

  async getAggregatedStats() {
    const filters = this.getActiveFilters();
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: 'getFilteredStats',
          filters: {
            ...filters,
            timeRange: this.timeRange
          }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting dashboard stats:', chrome.runtime.lastError);
            resolve(this.getDefaultStats());
            return;
          }
          
          if (response && response.success) {
            // Convert filtered stats to dashboard stats format
            const stats = {
              totalRequests: response.totalRequests || 0,
              avgResponse: 0,
              slowRequests: 0,
              errorCount: 0,
              volumeTimeline: { labels: response.timestamps || [], values: [] },
              statusDistribution: [0, 0, 0, 0],
              topDomains: { labels: [], values: [] },
              performanceTrend: { labels: response.timestamps || [], values: response.responseTimes || [] },
              layerCounts: { bronze: 0, silver: 0, gold: 0 }
            };
            
            // Calculate avgResponse
            if (response.responseTimes && response.responseTimes.length > 0) {
              stats.avgResponse = response.responseTimes.reduce((a, b) => a + b, 0) / response.responseTimes.length;
              stats.slowRequests = response.responseTimes.filter(t => t > 1000).length;
            }
            
            // Map status codes to distribution
            if (response.statusCodes) {
              Object.entries(response.statusCodes).forEach(([code, count]) => {
                const statusCode = parseInt(code);
                if (statusCode >= 200 && statusCode < 300) stats.statusDistribution[0] += count;
                else if (statusCode >= 300 && statusCode < 400) stats.statusDistribution[1] += count;
                else if (statusCode >= 400 && statusCode < 500) {
                  stats.statusDistribution[2] += count;
                  stats.errorCount += count;
                }
                else if (statusCode >= 500) {
                  stats.statusDistribution[3] += count;
                  stats.errorCount += count;
                }
              });
            }
            
            resolve(stats);
          } else {
            resolve(this.getDefaultStats());
          }
        }
      );
    });
  }

  getDefaultStats() {
    return {
      totalRequests: 0,
      avgResponse: 0,
      slowRequests: 0,
      errorRate: 0,
      volumeTimeline: { labels: [], values: [] },
      statusDistribution: [0, 0, 0, 0],
      topDomains: { labels: [], values: [] },
      performanceTrend: { labels: [], values: [] },
      layerCounts: { bronze: 0, silver: 0, gold: 0 }
    };
  }

  updateMetricCards(stats) {
    // Total Requests
    const totalEl = document.getElementById('dashTotalRequests');
    if (totalEl) {
      totalEl.textContent = (stats.totalRequests || 0).toLocaleString();
    }

    // Avg Response Time
    const avgEl = document.getElementById('dashAvgResponse');
    if (avgEl) {
      avgEl.textContent = `${Math.round(stats.avgResponse || 0)}ms`;
    }

    // Slow Requests
    const slowEl = document.getElementById('dashSlowRequests');
    if (slowEl) {
      slowEl.textContent = (stats.slowRequests || 0).toLocaleString();
    }

    // Error Rate
    const errorEl = document.getElementById('dashErrorRate');
    if (errorEl) {
      const rate = stats.totalRequests > 0 
        ? ((stats.errorCount || 0) / stats.totalRequests * 100).toFixed(1)
        : 0;
      errorEl.textContent = `${rate}%`;
    }

    // Update change indicators (simplified - would need historical data for real changes)
    const updateChange = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value >= 0 ? `+${value}%` : `${value}%`;
        el.className = `metric-change ${value >= 0 ? 'positive' : 'negative'}`;
      }
    };

    updateChange('dashTotalChange', 0);
    updateChange('dashAvgChange', 0);
    updateChange('dashSlowChange', 0);
    updateChange('dashErrorChange', 0);
  }

  updateCharts(stats) {
    // Update volume chart
    if (this.charts.volume && stats.volumeTimeline) {
      this.charts.volume.data.labels = stats.volumeTimeline.labels || [];
      this.charts.volume.data.datasets[0].data = stats.volumeTimeline.values || [];
      this.charts.volume.update();
    }

    // Update status chart
    if (this.charts.status && stats.statusDistribution) {
      this.charts.status.data.datasets[0].data = stats.statusDistribution;
      this.charts.status.update();
    }

    // Update domains chart
    if (this.charts.domains && stats.topDomains) {
      this.charts.domains.data.labels = stats.topDomains.labels || [];
      this.charts.domains.data.datasets[0].data = stats.topDomains.values || [];
      this.charts.domains.update();
    }

    // Update performance chart
    if (this.charts.performance && stats.performanceTrend) {
      this.charts.performance.data.labels = stats.performanceTrend.labels || [];
      this.charts.performance.data.datasets[0].data = stats.performanceTrend.values || [];
      this.charts.performance.update();
    }
  }

  updateLayerStatus(stats) {
    const bronzeEl = document.getElementById('bronzeCount');
    const silverEl = document.getElementById('silverCount');
    const goldEl = document.getElementById('goldCount');

    if (bronzeEl && stats.layerCounts) {
      bronzeEl.textContent = (stats.layerCounts.bronze || 0).toLocaleString();
    }

    if (silverEl && stats.layerCounts) {
      silverEl.textContent = (stats.layerCounts.silver || 0).toLocaleString();
    }

    if (goldEl && stats.layerCounts) {
      goldEl.textContent = (stats.layerCounts.gold || 0).toLocaleString();
    }
  }

  startAutoRefresh() {
    // Refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.refreshDashboard();
    }, 30000);
  }

  async loadDomainFilter() {
    try {
      const domainSelect = document.getElementById('dashboardDomainFilter');
      if (!domainSelect) return;
      
      // Reset dropdown
      domainSelect.innerHTML = '<option value="all">All Domains</option>';
      
      // Get all domains
      const response = await chrome.runtime.sendMessage({
        action: 'getDomains',
        timeRange: 604800  // Last 7 days
      });
      
      console.log('Dashboard domain filter response:', response);
      
      if (response && response.success && response.domains && response.domains.length > 0) {
        response.domains.forEach(domainObj => {
          const domain = domainObj.domain;
          if (domain) {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = `${domain} (${domainObj.requestCount} requests)`;
            domainSelect.appendChild(option);
          }
        });
        console.log(`Loaded ${response.domains.length} domains for dashboard`);
      } else {
        console.warn('No domains found for dashboard');
      }
    } catch (error) {
      console.error('Failed to load domain filter:', error);
    }
  }

  async onDomainFilterChange() {
    const domainSelect = document.getElementById('dashboardDomainFilter');
    const selectedDomain = domainSelect.value;
    
    // Load pages for selected domain
    if (selectedDomain && selectedDomain !== 'all') {
      await this.loadPageFilter(selectedDomain);
    } else {
      // Clear page filter for "all domains"
      const pageSelect = document.getElementById('dashboardPageFilter');
      pageSelect.innerHTML = '<option value="">All Pages (Aggregated)</option>';
      pageSelect.disabled = true;
    }
    
    // Refresh dashboard with new filters
    await this.refreshDashboard();
  }

  async loadPageFilter(domain) {
    try {
      const pageSelect = document.getElementById('dashboardPageFilter');
      if (!pageSelect) return;
      
      // Reset page filter
      pageSelect.innerHTML = '<option value="">All Pages (Aggregated)</option>';
      pageSelect.disabled = false;
      
      if (!domain || domain === 'all') {
        pageSelect.disabled = true;
        return;
      }
      
      // Get pages for this domain
      const response = await chrome.runtime.sendMessage({
        action: 'getPagesByDomain',
        domain: domain,
        timeRange: 604800  // Last 7 days
      });
      
      console.log('Pages for domain response:', response);
      
      if (response && response.success && response.pages && response.pages.length > 0) {
        response.pages.forEach(pageObj => {
          const pageUrl = pageObj.pageUrl;
          if (pageUrl) {
            const option = document.createElement('option');
            option.value = pageUrl;
            // Extract path from full URL for display
            try {
              const url = new URL(pageUrl);
              const displayPath = url.pathname + url.search || '/';
              option.textContent = `${displayPath} (${pageObj.requestCount} req)`;
            } catch (e) {
              option.textContent = `${pageUrl} (${pageObj.requestCount} req)`;
            }
            pageSelect.appendChild(option);
          }
        });
        console.log(`Loaded ${response.pages.length} pages for domain ${domain}`);
      } else {
        console.warn(`No pages found for domain ${domain}`);
      }
    } catch (error) {
      console.error('Failed to load page filter:', error);
    }
  }

  getActiveFilters() {
    const domainFilter = document.getElementById('dashboardDomainFilter')?.value;
    const pageFilter = document.getElementById('dashboardPageFilter')?.value;
    const requestTypeFilter = document.getElementById('dashboardRequestTypeFilter')?.value;
    
    const filters = {};
    
    // Add domain filter
    if (domainFilter && domainFilter !== 'all') {
      filters.domain = domainFilter;
    }
    
    // Add page filter (if specific page selected)
    if (pageFilter && pageFilter !== '') {
      filters.pageUrl = pageFilter;
    }
    
    // Add request type filter
    if (requestTypeFilter && requestTypeFilter !== '') {
      filters.type = requestTypeFilter;
    }
    
    return filters;
  }

  async updateWebVitals() {
    try {
      const filters = this.getActiveFilters();
      
      // Get Web Vitals from background
      const response = await chrome.runtime.sendMessage({
        action: 'getWebVitals',
        filters: {
          ...filters,
          timeRange: this.timeRange
        }
      });
      
      if (response && response.success && response.vitals) {
        const vitals = response.vitals;
        
        // Update LCP
        this.updateVitalCard('lcp', vitals.LCP);
        
        // Update FID
        this.updateVitalCard('fid', vitals.FID);
        
        // Update CLS
        this.updateVitalCard('cls', vitals.CLS);
        
        // Update FCP
        this.updateVitalCard('fcp', vitals.FCP);
        
        // Update TTFB
        this.updateVitalCard('ttfb', vitals.TTFB);
        
        // Update TTI
        this.updateVitalCard('tti', vitals.TTI);
        
        // Update DCL
        this.updateVitalCard('dcl', vitals.DCL);
        
        // Update Load
        this.updateVitalCard('load', vitals.Load);
      }
    } catch (error) {
      console.error('Failed to update web vitals:', error);
    }
  }
  
  updateVitalCard(metric, data) {
    if (!data) return;
    
    const valueEl = document.getElementById(`${metric}Value`);
    const ratingEl = document.getElementById(`${metric}Rating`);
    const cardEl = document.getElementById(`${metric}Card`);
    
    if (!valueEl || !ratingEl || !cardEl) return;
    
    // Format value based on metric type
    let displayValue = '-';
    if (data.value !== null && data.value !== undefined) {
      if (metric === 'cls') {
        displayValue = data.value.toFixed(3);
      } else {
        displayValue = `${Math.round(data.value)}ms`;
      }
    }
    
    valueEl.textContent = displayValue;
    
    // Update rating
    if (data.rating) {
      ratingEl.textContent = data.rating.replace('-', ' ');
      ratingEl.className = `vital-rating ${data.rating}`;
      
      // Update card border
      cardEl.classList.remove('good', 'needs-improvement', 'poor');
      cardEl.classList.add(data.rating);
    }
  }

  async updateSessionMetrics() {
    try {
      const filters = this.getActiveFilters();
      
      // Get Session Metrics from background
      const response = await chrome.runtime.sendMessage({
        action: 'getSessionMetrics',
        filters: {
          ...filters,
          timeRange: this.timeRange
        }
      });
      
      if (response && response.success && response.metrics) {
        const metrics = response.metrics;
        
        // Update Avg Session Duration
        const avgDurationEl = document.getElementById('avgSessionDuration');
        if (avgDurationEl && metrics.avgDuration !== null) {
          avgDurationEl.textContent = this.formatDuration(metrics.avgDuration);
        }
        
        // Update Total Sessions
        const totalSessionsEl = document.getElementById('totalSessions');
        if (totalSessionsEl) {
          totalSessionsEl.textContent = metrics.totalSessions || 0;
        }
        
        // Update Avg Requests per Session
        const avgRequestsEl = document.getElementById('avgRequestsPerSession');
        if (avgRequestsEl && metrics.avgRequests !== null) {
          avgRequestsEl.textContent = Math.round(metrics.avgRequests);
        }
        
        // Update Avg Events per Session
        const avgEventsEl = document.getElementById('avgEventsPerSession');
        if (avgEventsEl && metrics.avgEvents !== null) {
          avgEventsEl.textContent = Math.round(metrics.avgEvents);
        }
      }
    } catch (error) {
      console.error('Failed to update session metrics:', error);
    }
  }
  
  formatDuration(ms) {
    if (!ms) return '-';
    
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Destroy all charts
    Object.values(this.charts).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
  }
}

// Export singleton instance
export const dashboard = new Dashboard();

// Initialize when dashboard tab is active
document.addEventListener('DOMContentLoaded', () => {
  const dashboardTab = document.querySelector('[data-tab="dashboard"]');
  if (dashboardTab) {
    dashboardTab.addEventListener('click', async () => {
      // Delay initialization to ensure DOM is ready
      setTimeout(async () => {
        if (!dashboard.charts.volume) {
          await dashboard.initialize();
        }
      }, 100);
    });
    
    // If dashboard tab is active by default, initialize immediately
    if (dashboardTab.classList.contains('active')) {
      setTimeout(async () => {
        await dashboard.initialize();
      }, 500);
    }
  }
});
