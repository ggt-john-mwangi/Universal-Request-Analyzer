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

  initializeCharts() {
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
            borderColor: 'rgb(76, 175, 80)',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            tension: 0.4,
            fill: true,
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
              'rgba(76, 175, 80, 0.8)',
              'rgba(33, 150, 243, 0.8)',
              'rgba(255, 152, 0, 0.8)',
              'rgba(244, 67, 54, 0.8)',
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
            backgroundColor: 'rgba(33, 150, 243, 0.8)',
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
            borderColor: 'rgb(33, 150, 243)',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.4,
            fill: true,
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
      
      console.log('✓ Dashboard refreshed');
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    }
  }

  async getAggregatedStats() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: 'getDashboardStats',
          timeRange: this.timeRange
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting dashboard stats:', chrome.runtime.lastError);
            resolve(this.getDefaultStats());
            return;
          }
          
          if (response && response.success) {
            resolve(response.stats);
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
