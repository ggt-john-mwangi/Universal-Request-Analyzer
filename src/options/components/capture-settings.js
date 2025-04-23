export default function renderCaptureSettings() {
  const container = document.createElement("div");
  container.innerHTML = `
    <h2>Capture Settings</h2>
    <div class="option-row">
      <label>
        <input type="checkbox" id="captureEnabled">
        Enable Request Capture
      </label>
    </div>
    <div class="option-row">
      <label for="maxStoredRequests">Maximum Stored Requests:</label>
      <input type="number" id="maxStoredRequests" min="100" max="100000" step="100">
    </div>
  `;
  return container;
}
