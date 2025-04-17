import "../../styles.css"; // Import the global styles.css
import "../css/devtools.css"; // Ensure the CSS file is imported
import "../../lib/chart.min.js";
// Add a script to handle DevTools functionality
const app = document.getElementById("app");

// Create a toggle for performance stats
const performanceToggle = document.createElement("input");
performanceToggle.type = "checkbox";
performanceToggle.id = "performanceToggle";
const performanceLabel = document.createElement("label");
performanceLabel.htmlFor = "performanceToggle";
performanceLabel.textContent = "Enable Performance Stats";

// Append toggle to the app
app.appendChild(performanceLabel);
app.appendChild(performanceToggle);

// Create a canvas for charts
const chartCanvas = document.createElement("canvas");
chartCanvas.id = "performanceChart";
chartCanvas.width = 800;
chartCanvas.height = 400;
app.appendChild(chartCanvas);

// Initialize Chart.js
const ctx = chartCanvas.getContext("2d");
let performanceChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "API Response Times",
        data: [],
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 2,
        fill: false,
      },
    ],
  },
  options: {
    responsive: true,
    scales: {
      x: {
        title: {
          display: true,
          text: "Time",
        },
      },
      y: {
        title: {
          display: true,
          text: "Response Time (ms)",
        },
      },
    },
  },
});

// Listen for toggle changes
performanceToggle.addEventListener("change", (event) => {
  if (event.target.checked) {
    // Fetch and display performance stats
    chrome.runtime.sendMessage(
      { action: "getPerformanceStats" },
      (response) => {
        if (response && response.stats) {
          const { timestamps, responseTimes } = response.stats;
          performanceChart.data.labels = timestamps;
          performanceChart.data.datasets[0].data = responseTimes;
          performanceChart.update();
        }
      }
    );
  } else {
    // Clear chart data
    performanceChart.data.labels = [];
    performanceChart.data.datasets[0].data = [];
    performanceChart.update();
  }
});
