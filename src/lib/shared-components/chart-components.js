// Handle chart components and references

// Create canvas elements for each chart type
export const responseTimeChartRef = createChartCanvas("responseTimeChart");
export const statusCodeChartRef = createChartCanvas("statusCodeChart");
export const requestTypeChartRef = createChartCanvas("requestTypeChart");
export const timeDistributionChartRef = createChartCanvas(
  "timeDistributionChart"
);
export const sizeDistributionChartRef = createChartCanvas(
  "sizeDistributionChart"
);

// Store chart instances for cleanup
export const chartInstances = {};

// Helper function to create chart canvas
function createChartCanvas(id) {
  const canvas = document.createElement("canvas");
  canvas.id = id;
  canvas.className = "chart-panel";
  return canvas;
}

// Handle chart cleanup
export function destroyCharts() {
  Object.values(chartInstances).forEach((chart) => {
    if (chart) {
      chart.destroy();
    }
  });

  // Clear instances
  Object.keys(chartInstances).forEach((key) => {
    delete chartInstances[key];
  });
}

// Switch active chart
export function switchChart(chartId) {
  const allCharts = document.querySelectorAll(".chart-panel");
  allCharts.forEach((chart) => {
    chart.classList.remove("active");
  });

  const activeChart = document.getElementById(chartId);
  if (activeChart) {
    activeChart.classList.add("active");
  }
}
