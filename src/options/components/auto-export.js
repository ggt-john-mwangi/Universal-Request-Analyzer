export default function renderAutoExport() {
  const container = document.createElement("div");
  container.innerHTML = `
    <h2>Auto Export</h2>
    <div class="option-row">
      <label>
        <input type="checkbox" id="autoExport">
        Enable Auto Export
      </label>
    </div>
    <div class="option-row">
      <label for="exportFormat">Export Format:</label>
      <select id="exportFormat">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        <option value="sqlite">SQLite</option>
      </select>
    </div>
    <div class="option-row">
      <label for="exportInterval">Export Interval (minutes):</label>
      <input type="number" id="exportInterval" min="5" max="1440" step="5">
    </div>
    <div class="option-row">
      <label for="exportPath">Export Directory (optional):</label>
      <input type="text" id="exportPath" placeholder="Default downloads directory">
    </div>
  `;
  return container;
}
