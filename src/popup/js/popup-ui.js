// Popup UI Functions - Handle all UI updates and rendering

import { formatBytes, formatTimeAgo, truncateUrl } from './popup-utils.js';

/**
 * Update page summary display
 * @param {Object} data - Stats data object
 */
export function updatePageSummary(data) {
  const totalRequests = data.totalRequests || 0;
  const responseTimes = data.responseTimes || [];
  const avgResponse =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  // Count errors (all 4xx and 5xx status codes)
  const statusCodes = data.statusCodes || {};
  const errorCount = Object.entries(statusCodes).reduce(
    (sum, [code, count]) => {
      const statusCode = parseInt(code);
      return statusCode >= 400 && statusCode < 600 ? sum + count : sum;
    },
    0
  );

  document.getElementById('totalRequests').textContent = totalRequests;
  document.getElementById('avgResponse').textContent = `${Math.round(
    avgResponse
  )}ms`;
  document.getElementById('errorCount').textContent = errorCount;
  document.getElementById('dataTransferred').textContent = formatBytes(
    data.totalBytes || 0
  );
}

/**
 * Update detailed QA views
 * @param {Object} data - Stats data object
 */
export function updateDetailedViews(data) {
  updateStatusBreakdown(data.statusCodes || {});
  updateRequestTypes(data.requestTypes || {});
  updateTimelineChart(data.timestamps || [], data.responseTimes || []);
}

/**
 * Update status code breakdown
 * @param {Object} statusCodes - Status codes object
 */
export function updateStatusBreakdown(statusCodes) {
  const status2xx = Object.entries(statusCodes).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return statusCode >= 200 && statusCode < 300 ? sum + count : sum;
  }, 0);

  const status3xx = Object.entries(statusCodes).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return statusCode >= 300 && statusCode < 400 ? sum + count : sum;
  }, 0);

  const status4xx = Object.entries(statusCodes).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return statusCode >= 400 && statusCode < 500 ? sum + count : sum;
  }, 0);

  const status5xx = Object.entries(statusCodes).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return statusCode >= 500 && statusCode < 600 ? sum + count : sum;
  }, 0);

  document.getElementById('status2xx').textContent = status2xx;
  document.getElementById('status3xx').textContent = status3xx;
  document.getElementById('status4xx').textContent = status4xx;
  document.getElementById('status5xx').textContent = status5xx;
}

/**
 * Update request types visualization
 * @param {Object} requestTypes - Request types object
 */
export function updateRequestTypes(requestTypes) {
  const container = document.getElementById('requestTypesList');
  if (!container) return;

  const types = Object.entries(requestTypes);
  if (types.length === 0) {
    container.innerHTML = '<p class="placeholder">No requests yet</p>';
    return;
  }

  const total = types.reduce((sum, [, count]) => sum + count, 0);

  let html = '';
  types.forEach(([type, count]) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    html += `
      <div class="type-item">
        <span class="type-name">${type.toUpperCase()}</span>
        <span class="type-bar">
          <span class="type-bar-fill" style="width: ${percentage}%"></span>
        </span>
        <span class="type-count">${count}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Update timeline chart
 * @param {Array} timestamps - Array of timestamps
 * @param {Array} responseTimes - Array of response times
 */
let timelineChart = null;

export function updateTimelineChart(timestamps, responseTimes) {
  const canvas = document.getElementById('requestTimelineChart');
  if (!canvas) {
    console.warn('Timeline chart canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('Cannot get canvas context');
    return;
  }

  try {
    // Get chart instance from Chart.js registry
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }
    timelineChart = null;

    // Clear canvas completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reset canvas dimensions
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = 200;

    // If no data, show empty state
    if (!timestamps || timestamps.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No request data yet', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Get theme color
    const primaryColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-color')
        .trim() || '#667eea';

    // Limit data points for performance (last 50 points max)
    const maxPoints = 50;
    const limitedTimestamps = timestamps.slice(-maxPoints);
    const limitedResponseTimes = (responseTimes || []).slice(-maxPoints);

    // Ensure both arrays have the same length
    const minLength = Math.min(
      limitedTimestamps.length,
      limitedResponseTimes.length
    );
    const syncedTimestamps = limitedTimestamps.slice(0, minLength);
    const syncedResponseTimes = limitedResponseTimes.slice(0, minLength);

    // Create new chart (using simple drawing if Chart.js not available)
    if (typeof Chart !== 'undefined') {
      timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: syncedTimestamps,
          datasets: [
            {
              label: 'Response Time (ms)',
              data: syncedResponseTimes,
              borderColor: primaryColor,
              backgroundColor: 'transparent',
              tension: 0.3,
              fill: false,
              pointRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                font: {
                  size: 10,
                },
              },
            },
            x: {
              ticks: {
                font: {
                  size: 9,
                },
                maxRotation: 0,
              },
            },
          },
        },
      });
    } else {
      // Fallback: simple canvas drawing
      drawSimpleChart(ctx, limitedTimestamps, limitedResponseTimes);
    }
  } catch (chartError) {
    console.error('Chart creation error:', chartError);
    // Show error state
    ctx.fillStyle = '#e53e3e';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Failed to render chart', canvas.width / 2, canvas.height / 2);
  }
}

/**
 * Simple chart fallback
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} labels - Labels array
 * @param {Array} data - Data array
 */
function drawSimpleChart(ctx, labels, data) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const maxValue =
    data.length > 0 ? data.reduce((max, val) => Math.max(max, val), 100) : 100;
  const padding = 20;

  const primaryColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--primary-color')
      .trim() || '#667eea';

  ctx.clearRect(0, 0, width, height);

  // Draw line
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  ctx.beginPath();

  data.forEach((value, index) => {
    const x =
      padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - (value / maxValue) * (height - 2 * padding);

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

/**
 * Update recent errors display
 * @param {Array} errors - Array of error objects
 */
export function updateRecentErrorsDisplay(errors) {
  const container = document.getElementById('recentErrorsList');
  if (!container) return;

  if (errors && errors.length > 0) {
    let html = '';
    // Show up to 5 most recent errors
    errors.slice(0, 5).forEach((error) => {
      const timeAgo = formatTimeAgo(error.timestamp);
      const truncatedUrl = truncateUrl(error.url, 50);

      html += `
        <div class="error-item">
          <span class="error-status status-${Math.floor(
    error.status / 100
  )}xx">${error.status}</span>
          <span class="error-url" title="${error.url}">${truncatedUrl}</span>
          <span class="error-time">${timeAgo}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  } else {
    container.innerHTML =
      '<p class="placeholder">No errors in the last 5 minutes</p>';
  }
}

/**
 * Set view mode (simple or advanced)
 * @param {string} mode - View mode ('simple' or 'advanced')
 */
export function setViewMode(mode) {
  const simpleModeBtn = document.getElementById('simpleModeBtn');
  const advancedModeBtn = document.getElementById('advancedModeBtn');
  const advancedElements = document.querySelectorAll(
    '.timeline-chart, .request-types, .qa-quick-view, .filters-section'
  );
  const resourceUsage = document.getElementById('resourceUsage');

  if (mode === 'simple') {
    simpleModeBtn?.classList.add('active');
    advancedModeBtn?.classList.remove('active');
    // Hide advanced features
    advancedElements.forEach((el) => (el.style.display = 'none'));
    // Show resource usage in simple mode
    if (resourceUsage) resourceUsage.style.display = 'flex';
  } else {
    simpleModeBtn?.classList.remove('active');
    advancedModeBtn?.classList.add('active');
    // Show advanced features
    advancedElements.forEach((el) => (el.style.display = ''));
    // Hide resource usage in advanced mode
    if (resourceUsage) resourceUsage.style.display = 'none';
  }
}

/**
 * Show main app container
 */
export function showApp() {
  const appContainer = document.getElementById('appContainer');
  if (appContainer) {
    appContainer.classList.add('active');
  }
}
