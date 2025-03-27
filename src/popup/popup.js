// Add this import to the top of your popup.js file
import { DataVisualization } from "./components/data-visualization"

// Add this to your tab navigation code
// Inside the tabs section of your popup.html, add:
// <button class="tab-btn" data-tab="visualization">Visualization</button>

// And add this to your tab content section:
// <div class="tab-content" id="visualization-tab">
//   <div id="visualization-container"></div>
// </div>

// Then in your DOMContentLoaded event handler, add:
document.addEventListener("DOMContentLoaded", () => {
  // ... existing code ...

  // Initialize visualization if tab exists
  const visualizationContainer = document.getElementById("visualization-container")
  if (visualizationContainer) {
    const visualization = new DataVisualization()
    visualizationContainer.appendChild(visualization.render())
  }

  // ... existing code ...
})

