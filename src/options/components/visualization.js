export default function renderVisualization() {
  const container = document.createElement("div");
  container.innerHTML = `
    <h2>Visualization</h2>
    <div class="option-row">
      <label>
        <input type="checkbox" id="plotEnabled">
        Enable Plots
      </label>
    </div>
    <div class="option-row">
      <label>Plot Types:</label>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" name="plotType" value="responseTime"> Response Time
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="plotType" value="statusCodes"> Status Codes
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="plotType" value="domains"> Domains
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="plotType" value="requestTypes"> Request Types
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="plotType" value="timeDistribution"> Time Distribution
        </label>
      </div>
    </div>
  `;
  return container;
}
