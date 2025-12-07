// Handle chart rendering logic
import Chart from "../../lib/chart.min.js";

export function renderResponseTimeChart(ctx, data) {
  const bins = [
    { label: "0-100ms", min: 0, max: 100 },
    { label: "100-300ms", min: 100, max: 300 },
    { label: "300-500ms", min: 300, max: 500 },
    { label: "500ms-1s", min: 500, max: 1000 },
    { label: "1s-3s", min: 1000, max: 3000 },
    { label: "3s+", min: 3000, max: Number.POSITIVE_INFINITY },
  ];

  const responseTimeCounts = bins.map((bin) => {
    return data.responseTimes.filter(
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

export function renderStatusCodeChart(ctx, data) {
  const statusGroups = {
    "2xx": { count: 0, color: "rgba(75, 192, 192, 0.5)" }, // Green
    "3xx": { count: 0, color: "rgba(54, 162, 235, 0.5)" }, // Blue
    "4xx": { count: 0, color: "rgba(255, 206, 86, 0.5)" }, // Yellow
    "5xx": { count: 0, color: "rgba(255, 99, 132, 0.5)" }, // Red
  };

  // Group status codes
  data.statusCodes.forEach((code) => {
    const group = `${Math.floor(code / 100)}xx`;
    if (statusGroups[group]) {
      statusGroups[group].count++;
    }
  });

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(statusGroups),
      datasets: [
        {
          data: Object.values(statusGroups).map((g) => g.count),
          backgroundColor: Object.values(statusGroups).map((g) => g.color),
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
          text: "Status Code Distribution",
        },
        legend: {
          position: "right",
        },
      },
    },
  });
}

export function renderRequestTypeChart(ctx, data) {
  const types = {};
  data.requestTypes.forEach((type) => {
    types[type] = (types[type] || 0) + 1;
  });

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(types),
      datasets: [
        {
          label: "Number of Requests",
          data: Object.values(types),
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
          text: "Request Types Distribution",
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
      },
    },
  });
}

export function renderTimeDistributionChart(ctx, data) {
  // Group requests by hour of day
  const hourCounts = new Array(24).fill(0);
  data.timestamps.forEach((timestamp) => {
    const hour = new Date(timestamp).getHours();
    hourCounts[hour]++;
  });

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [
        {
          label: "Requests",
          data: hourCounts,
          borderColor: "rgba(75, 192, 192, 1)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "Request Time Distribution (24h)",
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
            text: "Hour of Day",
          },
        },
      },
    },
  });
}

export function renderSizeDistributionChart(ctx, data) {
  const bins = [
    { label: "0-10KB", min: 0, max: 10 * 1024 },
    { label: "10-50KB", min: 10 * 1024, max: 50 * 1024 },
    { label: "50-100KB", min: 50 * 1024, max: 100 * 1024 },
    { label: "100-500KB", min: 100 * 1024, max: 500 * 1024 },
    { label: "500KB-1MB", min: 500 * 1024, max: 1024 * 1024 },
    { label: "1MB+", min: 1024 * 1024, max: Number.POSITIVE_INFINITY },
  ];

  const sizeCounts = bins.map((bin) => {
    return data.sizes.filter((size) => size >= bin.min && size < bin.max)
      .length;
  });

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: bins.map((bin) => bin.label),
      datasets: [
        {
          label: "Number of Requests",
          data: sizeCounts,
          backgroundColor: "rgba(153, 102, 255, 0.5)",
          borderColor: "rgba(153, 102, 255, 1)",
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
          text: "Response Size Distribution",
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
            text: "Response Size",
          },
        },
      },
    },
  });
}
