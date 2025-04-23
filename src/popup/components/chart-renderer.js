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

// Additional chart rendering functions can be added here for other chart types.
