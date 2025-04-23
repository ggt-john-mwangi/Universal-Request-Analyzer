export default function renderCaptureFilters() {
  const container = document.createElement("div");
  container.innerHTML = `
    <h2>Capture Filters</h2>
    <div class="option-row">
      <label>Request Types to Capture:</label>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="xmlhttprequest"> XHR
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="fetch"> Fetch
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="script"> Script
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="stylesheet"> Stylesheet
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="image"> Image
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="font"> Font
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="captureType" value="other"> Other
        </label>
      </div>
    </div>
    <div class="option-row">
      <label for="includeDomains">Include Domains (comma separated):</label>
      <input type="text" id="includeDomains" placeholder="Leave empty to include all">
    </div>
    <div class="option-row">
      <label for="excludeDomains">Exclude Domains (comma separated):</label>
      <input type="text" id="excludeDomains" placeholder="Leave empty to exclude none">
    </div>
  `;
  return container;
}
