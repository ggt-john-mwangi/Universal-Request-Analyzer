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

// Patch all chart renderers to filter by current domain
function withDomainFilter(renderer) {
  return function(ctx, data) {
    const domain = getCurrentDomain();
    if (!domain) return null;
    const filtered = filterDataByDomain(data, domain);
    if (
      (!filtered.statusCodes || filtered.statusCodes.length === 0) &&
      (!filtered.requestTypes || filtered.requestTypes.length === 0) &&
      (!filtered.responseTimesData || !filtered.responseTimesData.durations || filtered.responseTimesData.durations.length === 0) &&
      (!filtered.timeDistribution || !filtered.timeDistribution.counts || filtered.timeDistribution.counts.length === 0) &&
      (!filtered.sizeDistribution || !filtered.sizeDistribution.counts || filtered.sizeDistribution.counts.length === 0)
    ) {
      return null;
    }
    return renderer(ctx, filtered);
  };
}

window.renderStatusCodeChart = withDomainFilter(function(ctx, data) {
  if (!data || !data.statusCodes) return null;
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.statusCodes.map((c) => c.status),
      datasets: [{
        label: "Status Codes",
        data: data.statusCodes.map((c) => c.count),
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Status Code Distribution" } },
      scales: { y: { beginAtZero: true } },
    },
  });
});

window.renderRequestTypeChart = withDomainFilter(function(ctx, data) {
  if (!data || !data.requestTypes) return null;
  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: data.requestTypes.map((t) => t.type),
      datasets: [{
        label: "Request Types",
        data: data.requestTypes.map((t) => t.count),
        backgroundColor: [
          "#ff9800", "#4caf50", "#2196f3", "#e91e63", "#9c27b0", "#607d8b", "#ffc107"
        ],
      }],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Request Type Distribution" } },
    },
  });
});

window.renderTimeDistributionChart = withDomainFilter(function(ctx, data) {
  if (!data || !data.timeDistribution) return null;
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.timeDistribution.bins || [],
      datasets: [{
        label: "Requests",
        data: data.timeDistribution.counts || [],
        backgroundColor: "#2196f3",
      }],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Time Distribution" } },
      scales: { y: { beginAtZero: true } },
    },
  });
});

window.renderSizeDistributionChart = withDomainFilter(function(ctx, data) {
  if (!data || !data.sizeDistribution) return null;
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.sizeDistribution.bins || [],
      datasets: [{
        label: "Requests",
        data: data.sizeDistribution.counts || [],
        backgroundColor: "#8bc34a",
      }],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Size Distribution" } },
      scales: { y: { beginAtZero: true } },
    },
  });
});

// Patch response time chart as well
export function renderResponseTimeChart(ctx, data) {
  const domain = getCurrentDomain();
  let filtered = data;
  if (domain && data.responseTimesData && Array.isArray(data.responseTimesData.domains)) {
    const idxs = data.responseTimesData.domains.map((d, i) => d === domain ? i : -1).filter(i => i !== -1);
    filtered = {
      ...data,
      responseTimesData: {
        timestamps: idxs.map(i => data.responseTimesData.timestamps[i]),
        durations: idxs.map(i => data.responseTimesData.durations[i])
      }
    };
  }
  const bins = [
    { label: "0-100ms", min: 0, max: 100 },
    { label: "100-300ms", min: 100, max: 300 },
    { label: "300-500ms", min: 300, max: 500 },
    { label: "500ms-1s", min: 500, max: 1000 },
    { label: "1s-3s", min: 1000, max: 3000 },
    { label: "3s+", min: 3000, max: Number.POSITIVE_INFINITY },
  ];
  const responseTimes = filtered.responseTimesData?.durations || [];
  const responseTimeCounts = bins.map((bin) => {
    return responseTimes.filter(
      (time) => time >= bin.min && time < bin.max
    ).length;
  });
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: bins.map((bin) => bin.label),
      datasets: [
        {
          label: "Number of Requests",
          data: responseTimeCounts,
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "Response Time Distribution",
        },
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Number of Requests",
          },
        },
        x: {
          title: {
            display: true,
            text: "Response Time",
          },
        },
      },
    },
  });
}
