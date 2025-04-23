export default function renderDatabaseInfo() {
  const container = document.createElement("div");
  container.innerHTML = `
    <h3>Database Information</h3>
    <div class="info-row">
      <span class="info-label">Total Requests:</span>
      <span id="dbTotalRequests">0</span>
    </div>
    <div class="info-row">
      <span class="info-label">Database Size:</span>
      <span id="dbSize">0 KB</span>
    </div>
    <div class="info-row">
      <span class="info-label">Last Export:</span>
      <span id="lastExport">Never</span>
    </div>
    <div class="info-row">
      <span class="info-label">Enable SQLite Export:</span>
      <input type="checkbox" id="enableSqliteExport" />
    </div>
    <div class="actions">
      <button id="exportDbBtn">Export Database</button>
      <button id="clearDbBtn" class="secondary">Clear Database</button>
    </div>
  `;
  return container;
}
