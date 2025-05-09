// Handle chart rendering logic
import Chart from "../../lib/chart.min.js";

// Utility: get current domain from location
function getCurrentDomain() {
  try {
    return window.location.hostname;
  } catch {
    return null;
  }
}

// Helper: filter data by domain if present
function filterDataByDomain(data, domain) {
  if (!domain) return data;
  const filtered = { ...data };
  if (Array.isArray(data.statusCodes))
    filtered.statusCodes = data.statusCodes.filter(x => !x.domain || x.domain === domain);
  if (Array.isArray(data.requestTypes))
    filtered.requestTypes = data.requestTypes.filter(x => !x.domain || x.domain === domain);
  if (data.responseTimesData && Array.isArray(data.responseTimesData.timestamps) && Array.isArray(data.responseTimesData.domains)) {
    const idxs = data.responseTimesData.domains.map((d, i) => d === domain ? i : -1).filter(i => i !== -1);
    filtered.responseTimesData = {
      timestamps: idxs.map(i => data.responseTimesData.timestamps[i]),
      durations: idxs.map(i => data.responseTimesData.durations[i])
    };
  }
  if (data.timeDistribution && Array.isArray(data.timeDistribution.domains)) {
    const idxs = data.timeDistribution.domains.map((d, i) => d === domain ? i : -1).filter(i => i !== -1);
    filtered.timeDistribution = {
      bins: idxs.map(i => data.timeDistribution.bins[i]),
      counts: idxs.map(i => data.timeDistribution.counts[i])
    };
  }
  if (data.sizeDistribution && Array.isArray(data.sizeDistribution.domains)) {
    const idxs = data.sizeDistribution.domains.map((d, i) => d === domain ? i : -1).filter(i => i !== -1);
    filtered.sizeDistribution = {
      bins: idxs.map(i => data.sizeDistribution.bins[i]),
      counts: idxs.map(i => data.sizeDistribution.counts[i])
    };
  }
  return filtered;
}

// Helper: get color for status code
function getStatusColor(status) {
  if (status >= 200 && status < 300) return '#4caf50'; // green
  if (status >= 400 && status < 500) return '#ff9800'; // orange
  if (status >= 500) return '#f44336'; // red
  if (status >= 300 && status < 400) return '#2196f3'; // blue
  return '#9e9e9e'; // gray
}

// Response Time Plot (Line chart: time vs avg response time)
export function renderResponseTimeChart(ctx, stats) {
  // Expect stats.timeSeries: [{time, avgDuration, count}]
  const data = stats.timeSeries || [];
  const labels = data.map(d => new Date(d.time).toLocaleTimeString());
  const values = data.map(d => d.avgDuration || 0);
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Avg Response Time (ms)',
        data: values,
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25,118,210,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      }]
    },
    options: {
      plugins: {
        tooltip: { enabled: true },
        legend: { display: true },
      },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        y: { title: { display: true, text: 'ms' } },
        x: { title: { display: true, text: 'Time' } }
      },
      onClick: (evt, elements) => {
        // Could filter by time window if desired
      }
    }
  });
}

// Status Code Plot (Bar chart: status code breakdown)
export function renderStatusCodeChart(ctx, stats) {
  // Expect stats.statusCodes: [{status, count}]
  const codes = stats.statusCodes || [];
  const labels = codes.map(s => s.status);
  const values = codes.map(s => s.count);
  const colors = codes.map(s => getStatusColor(s.status));
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Requests',
        data: values,
        backgroundColor: colors,
      }]
    },
    options: {
      plugins: {
        tooltip: { enabled: true },
        legend: { display: false },
      },
      onClick: (evt, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const status = labels[idx];
          window.postMessage({ type: 'filterRequestsTab', filter: { statusCode: status } }, '*');
        }
      },
      scales: {
        y: { title: { display: true, text: 'Count' } },
        x: { title: { display: true, text: 'Status Code' } }
      }
    }
  });
}

// Request Type Plot (Pie chart: request type breakdown)
export function renderRequestTypeChart(ctx, stats) {
  // Expect stats.requestTypes: [{type, count}]
  const types = stats.requestTypes || [];
  const labels = types.map(t => t.type);
  const values = types.map(t => t.count);
  const palette = ['#1976d2','#43a047','#fbc02d','#e53935','#8e24aa','#00838f','#f57c00'];
  return new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        label: 'Requests',
        data: values,
        backgroundColor: labels.map((_,i) => palette[i%palette.length]),
      }]
    },
    options: {
      plugins: {
        tooltip: { enabled: true },
        legend: { display: true, position: 'bottom' },
      },
      onClick: (evt, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const type = labels[idx];
          window.postMessage({ type: 'filterRequestsTab', filter: { type } }, '*');
        }
      }
    }
  });
}

// Time Distribution Plot (Histogram: request duration distribution)
export function renderTimeDistributionChart(ctx, stats) {
  // Expect stats.timeDistribution: { bins: [ms], counts: [n] }
  const dist = stats.timeDistribution || { bins: [], counts: [] };
  const labels = dist.bins.map((b,i) => {
    const next = dist.bins[i+1];
    return next ? `${b}-${next}ms` : `${b}+ms`;
  });
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Requests',
        data: dist.counts,
        backgroundColor: '#1976d2',
      }]
    },
    options: {
      plugins: {
        tooltip: { enabled: true },
        legend: { display: false },
      },
      onClick: (evt, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          // Could filter by duration range if desired
        }
      },
      scales: {
        y: { title: { display: true, text: 'Count' } },
        x: { title: { display: true, text: 'Duration (ms)' } }
      }
    }
  });
}

// Size Distribution Plot (Histogram: response size distribution)
export function renderSizeDistributionChart(ctx, stats) {
  // Expect stats.sizeDistribution: { bins: [bytes], counts: [n] }
  const dist = stats.sizeDistribution || { bins: [], counts: [] };
  const labels = dist.bins.map((b,i) => {
    const next = dist.bins[i+1];
    return next ? `${formatBytes(b)}-${formatBytes(next)}` : `${formatBytes(b)}+`;
  });
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Requests',
        data: dist.counts,
        backgroundColor: '#43a047',
      }]
    },
    options: {
      plugins: {
        tooltip: { enabled: true },
        legend: { display: false },
      },
      onClick: (evt, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          // Could filter by size range if desired
        }
      },
      scales: {
        y: { title: { display: true, text: 'Count' } },
        x: { title: { display: true, text: 'Size' } }
      }
    }
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = 1;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

window.renderResponseTimeChart = renderResponseTimeChart;
window.renderStatusCodeChart = renderStatusCodeChart;
window.renderRequestTypeChart = renderRequestTypeChart;
window.renderTimeDistributionChart = renderTimeDistributionChart;
window.renderSizeDistributionChart = renderSizeDistributionChart;
