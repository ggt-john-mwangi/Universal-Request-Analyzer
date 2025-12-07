/**
 * ChartManager - Shared chart management class
 * Consolidates duplicate chart functionality from popup and options components
 */
import { BaseComponent } from './BaseComponent.js';

export class ChartManager extends BaseComponent {
  constructor(containerId, options = {}) {
    super(containerId, options);
    this.charts = new Map();
    this.chartConfigs = new Map();
    this.activeChart = null;
  }

  async onInit() {
    // Initialize chart library if not already loaded
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded');
      return;
    }

    // Set default chart options
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
  }

  /**
   * Create a new chart
   */
  createChart(chartId, type, config = {}) {
    // Check if chart already exists
    if (this.charts.has(chartId)) {
      console.warn(`Chart ${chartId} already exists`);
      return this.charts.get(chartId);
    }

    // Create canvas element
    const canvas = this.createElement('canvas', 'chart-canvas', {
      id: chartId,
      'aria-label': config.ariaLabel || `${type} chart`
    });

    // Add to container
    if (this.element) {
      this.element.appendChild(canvas);
    }

    // Get 2D context
    const ctx = canvas.getContext('2d');

    // Create chart instance
    const chartConfig = {
      type,
      data: config.data || this.getDefaultData(type),
      options: this.mergeOptions(config.options || {}, type)
    };

    const chart = new Chart(ctx, chartConfig);

    // Store chart and config
    this.charts.set(chartId, chart);
    this.chartConfigs.set(chartId, chartConfig);

    return chart;
  }

  /**
   * Get chart instance
   */
  getChart(chartId) {
    return this.charts.get(chartId);
  }

  /**
   * Update chart data
   */
  updateChart(chartId, data, options = {}) {
    const chart = this.charts.get(chartId);
    
    if (!chart) {
      console.warn(`Chart ${chartId} not found`);
      return false;
    }

    try {
      // Update data
      if (data.labels) {
        chart.data.labels = data.labels;
      }

      if (data.datasets) {
        chart.data.datasets = data.datasets;
      }

      // Update options if provided
      if (options && Object.keys(options).length > 0) {
        chart.options = this.mergeOptions(options, chart.config.type);
      }

      // Animate update
      chart.update(options.animate !== false ? 'active' : 'none');

      return true;
    } catch (error) {
      console.error(`Failed to update chart ${chartId}:`, error);
      return false;
    }
  }

  /**
   * Destroy a specific chart
   */
  destroyChart(chartId) {
    const chart = this.charts.get(chartId);
    
    if (chart) {
      chart.destroy();
      this.charts.delete(chartId);
      this.chartConfigs.delete(chartId);
      
      // Remove canvas element
      const canvas = document.getElementById(chartId);
      if (canvas) {
        canvas.remove();
      }

      if (this.activeChart === chartId) {
        this.activeChart = null;
      }

      return true;
    }

    return false;
  }

  /**
   * Destroy all charts
   */
  destroyAllCharts() {
    this.charts.forEach((chart, chartId) => {
      chart.destroy();
    });

    this.charts.clear();
    this.chartConfigs.clear();
    this.activeChart = null;

    // Remove all canvas elements
    if (this.element) {
      this.element.querySelectorAll('.chart-canvas').forEach(canvas => {
        canvas.remove();
      });
    }
  }

  /**
   * Switch active chart
   */
  switchChart(chartId) {
    // Hide all charts
    this.charts.forEach((chart, id) => {
      const canvas = document.getElementById(id);
      if (canvas) {
        canvas.classList.remove('active');
        canvas.style.display = 'none';
      }
    });

    // Show selected chart
    const chart = this.charts.get(chartId);
    if (chart) {
      const canvas = document.getElementById(chartId);
      if (canvas) {
        canvas.classList.add('active');
        canvas.style.display = 'block';
        this.activeChart = chartId;
        
        // Trigger resize to ensure proper rendering
        chart.resize();
        
        this.emit('chart:switched', { chartId });
      }
    }
  }

  /**
   * Export chart as image
   */
  exportChart(chartId, format = 'png') {
    const chart = this.charts.get(chartId);
    
    if (!chart) {
      console.warn(`Chart ${chartId} not found`);
      return null;
    }

    try {
      const canvas = document.getElementById(chartId);
      if (!canvas) return null;

      const dataUrl = canvas.toDataURL(`image/${format}`);
      return dataUrl;
    } catch (error) {
      console.error(`Failed to export chart ${chartId}:`, error);
      return null;
    }
  }

  /**
   * Download chart as image
   */
  downloadChart(chartId, filename) {
    const dataUrl = this.exportChart(chartId);
    
    if (!dataUrl) {
      console.warn('Failed to export chart');
      return;
    }

    const link = document.createElement('a');
    link.download = filename || `${chartId}.png`;
    link.href = dataUrl;
    link.click();
  }

  /**
   * Get default data structure for chart type
   */
  getDefaultData(type) {
    switch (type) {
      case 'line':
      case 'bar':
        return {
          labels: [],
          datasets: [{
            label: 'Data',
            data: [],
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }]
        };
      
      case 'pie':
      case 'doughnut':
        return {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: this.generateColors(5)
          }]
        };
      
      default:
        return { labels: [], datasets: [] };
    }
  }

  /**
   * Merge chart options with defaults
   */
  mergeOptions(customOptions, type) {
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false
        }
      }
    };

    // Type-specific defaults
    switch (type) {
      case 'line':
        defaultOptions.scales = {
          y: {
            beginAtZero: true
          }
        };
        break;
      
      case 'bar':
        defaultOptions.scales = {
          y: {
            beginAtZero: true
          }
        };
        break;
    }

    // Deep merge
    return this.deepMerge(defaultOptions, customOptions);
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const output = { ...target };
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    
    return output;
  }

  /**
   * Check if value is object
   */
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Generate color palette
   */
  generateColors(count) {
    const colors = [
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(75, 192, 192, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)',
      'rgba(199, 199, 199, 0.6)',
      'rgba(83, 102, 255, 0.6)',
      'rgba(255, 99, 255, 0.6)',
      'rgba(99, 255, 132, 0.6)'
    ];

    if (count <= colors.length) {
      return colors.slice(0, count);
    }

    // Generate more colors if needed
    const extraColors = [];
    for (let i = colors.length; i < count; i++) {
      const hue = (i * 137.508) % 360; // Golden angle
      extraColors.push(`hsla(${hue}, 70%, 60%, 0.6)`);
    }

    return [...colors, ...extraColors];
  }

  /**
   * Cleanup on destroy
   */
  onDestroy() {
    this.destroyAllCharts();
  }
}

/**
 * Factory function to create chart manager
 */
export function createChartManager(containerId, options) {
  const manager = new ChartManager(containerId, options);
  return manager;
}
