// Popup UI Functions - Handle all UI updates and rendering

import { formatBytes, formatTimeAgo, truncateUrl } from './popup-utils.js';

/**
 * Update page summary display
 * @param {Object} data - Stats data object
 */
export function updatePageSummary(data) {
  const totalRequests = data.totalRequests || 0;
  const avgResponse = data.avgResponse || 0;
  const errorCount = data.errorCount ?? 0;
  const rateNum = totalRequests > 0 ? Math.round(errorCount / totalRequests * 100) : 0;
  const errorRate = totalRequests > 0 ? `${rateNum}%` : '0%';

  document.getElementById('totalRequests').textContent = totalRequests;
  document.getElementById('avgResponse').textContent = `${Math.round(avgResponse)}ms`;

  const errorEl = document.getElementById('errorCount');
  if (errorEl) {
    errorEl.textContent = errorRate;
    errorEl.style.color =
      rateNum === 0  ? '#3fb950' :
      rateNum < 5    ? '#3fb950' :
      rateNum < 20   ? '#e3b341' :
                       '#f85149';
  }

  document.getElementById('dataTransferred').textContent = formatBytes(
    data.dataTransferred || data.totalBytes || 0
  );

  const slowEl = document.getElementById('slowRequests');
  if (slowEl) {
    const slow = data.slowRequests || 0;
    slowEl.textContent = slow > 0 ? `${slow} slow >1s` : '';
    slowEl.style.display = slow > 0 ? '' : 'none';
  }
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
 * Update status code breakdown and bar fills
 * @param {Object} statusCodes - Status codes object
 */
export function updateStatusBreakdown(statusCodes) {
  const sum = (min, max) =>
    Object.entries(statusCodes).reduce((acc, [code, count]) => {
      const n = parseInt(code);
      return n >= min && n < max ? acc + count : acc;
    }, 0);

  const s2 = sum(200, 300);
  const s3 = sum(300, 400);
  const s4 = sum(400, 500);
  const s5 = sum(500, 600);
  const total = s2 + s3 + s4 + s5 || 1;

  document.getElementById('status2xx').textContent = s2;
  document.getElementById('status3xx').textContent = s3;
  document.getElementById('status4xx').textContent = s4;
  document.getElementById('status5xx').textContent = s5;

  const pct = (n) => `${Math.round(n / total * 100)}%`;
  const setBar = (id, n) => { const el = document.getElementById(id); if (el) el.style.width = pct(n); };
  setBar('bar2xx', s2);
  setBar('bar3xx', s3);
  setBar('bar4xx', s4);
  setBar('bar5xx', s5);

  // Update error badge
  const errorCount = s4 + s5;
  const badge = document.getElementById('errorBadge');
  if (badge) {
    badge.textContent = errorCount;
    badge.style.display = errorCount > 0 ? '' : 'none';
  }
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
    container.innerHTML = '<p class="placeholder-text">No requests yet</p>';
    return;
  }

  const total = types.reduce((sum, [, count]) => sum + count, 0);

  container.innerHTML = types.map(([type, count]) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return `
      <div class="type-item">
        <span class="type-name">${type.toUpperCase()}</span>
        <span class="type-bar"><span class="type-bar-fill" style="width:${pct}%"></span></span>
        <span class="type-count">${count}</span>
      </div>`;
  }).join('');
}

/**
 * Update timeline chart
 * @param {Array} timestamps - Array of timestamps
 * @param {Array} responseTimes - Array of response times
 */
let timelineChart = null;

export function updateTimelineChart(timestamps, responseTimes) {
  const canvas = document.getElementById('requestTimelineChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    timelineChart = null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = canvas.offsetWidth || 392;
    canvas.height = 100;

    if (!timestamps || timestamps.length === 0) {
      ctx.fillStyle = '#484f58';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No request data yet', canvas.width / 2, canvas.height / 2);
      return;
    }

    const maxPoints = 50;
    const ts = timestamps.slice(-maxPoints);
    const rt = (responseTimes || []).slice(-maxPoints);
    const len = Math.min(ts.length, rt.length);

    if (typeof Chart !== 'undefined') {
      timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ts.slice(0, len),
          datasets: [{
            data: rt.slice(0, len),
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88,166,255,.08)',
            tension: 0.3, fill: true,
            pointRadius: 2, pointBackgroundColor: '#58a6ff',
          }],
        },
        options: {
          responsive: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#21262d' },
              ticks: { font: { size: 9 }, color: '#484f58', maxTicksLimit: 4 },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 9 }, color: '#484f58', maxRotation: 0, maxTicksLimit: 6 },
            },
          },
        },
      });
    } else {
      drawSimpleChart(ctx, ts.slice(0, len), rt.slice(0, len));
    }
  } catch (e) {
    console.error('Chart error:', e);
  }
}

function drawSimpleChart(ctx, labels, data) {
  const w = ctx.canvas.width, h = ctx.canvas.height, pad = 16;
  const max = data.reduce((m, v) => Math.max(m, v), 100);
  ctx.strokeStyle = '#58a6ff'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - 2 * pad);
    const y = h - pad - (val / max) * (h - 2 * pad);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
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

  if (!errors || errors.length === 0) {
    container.innerHTML = '<p class="placeholder-text">No errors detected</p>';
    return;
  }

  container.innerHTML = errors.slice(0, 5).map((error) => {
    const cls = Math.floor(error.status / 100) === 4 ? 'status-4xx' : 'status-5xx';
    return `
      <div class="error-item">
        <span class="error-status ${cls}">${error.status}</span>
        <span class="error-url" title="${error.url}">${truncateUrl(error.url, 50)}</span>
        <span class="error-time">${formatTimeAgo(error.timestamp)}</span>
      </div>`;
  }).join('');
}

const VITAL_METRICS = ['LCP', 'FCP', 'CLS', 'TTFB'];

/**
 * Update Core Web Vitals display
 * @param {Array} vitals - Array from getWebVitals handler
 */
export function updateWebVitalsDisplay(vitals) {
  const section = document.getElementById('vitalsSection');
  if (!section) return;

  // Deduplicate: keep latest per metric
  const latest = {};
  vitals.forEach(v => {
    if (!latest[v.metricName] || v.timestamp > latest[v.metricName].timestamp) {
      latest[v.metricName] = v;
    }
  });

  const hasData = VITAL_METRICS.some(m => latest[m]);
  section.style.display = hasData ? '' : 'none';

  VITAL_METRICS.forEach(metric => {
    const entry = latest[metric];
    const valEl = document.getElementById(`vital-${metric}-value`);
    const badgeEl = document.getElementById(`vital-${metric}-badge`);
    if (!valEl || !badgeEl) return;

    if (!entry) {
      valEl.textContent = '—';
      badgeEl.textContent = '—';
      badgeEl.className = 'vital-badge';
      return;
    }

    const v = entry.metricValue;
    if (metric === 'CLS') {
      valEl.textContent = v != null ? Number(v).toFixed(3) : '—';
    } else {
      valEl.textContent = v != null ? (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`) : '—';
    }

    const classMap = { good: 'vital-good', 'needs-improvement': 'vital-needs-improvement', poor: 'vital-poor' };
    const labelMap = { good: 'Good', 'needs-improvement': 'OK', poor: 'Poor' };
    const r = entry.rating || '';
    badgeEl.textContent = labelMap[r] || '—';
    badgeEl.className = `vital-badge ${classMap[r] || ''}`;
  });
}

/**
 * Show main app container
 */
export function showApp() {
  const el = document.getElementById('appContainer');
  if (el) el.style.display = 'block';
}
