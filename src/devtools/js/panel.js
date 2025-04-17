import "../../styles.css"; // Import the global styles.css
import "../css/devtools.css"; // Ensure the CSS file is imported
import "../../lib/chart.min.js";

document.addEventListener("DOMContentLoaded", () => {
  const toggleButton = document.getElementById("toggleNetworkStats");
  const networkStatsPanel = document.getElementById("networkStatsPanel");

  toggleButton.addEventListener("click", () => {
    const isVisible = networkStatsPanel.style.display === "block";
    networkStatsPanel.style.display = isVisible ? "none" : "block";
  });

  // Fetch and display network stats
  chrome.runtime.sendMessage({ action: "getNetworkStats" }, (response) => {
    if (response && response.stats) {
      const ctx = document.getElementById("networkStatsChart").getContext("2d");
      new Chart(ctx, {
        type: "line",
        data: {
          labels: response.stats.timestamps,
          datasets: [
            {
              label: "API Response Times",
              data: response.stats.responseTimes,
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
    }
  });
});
