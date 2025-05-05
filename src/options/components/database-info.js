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
    <div class="info-row">
      <label for="exportDbFilename" class="info-label">Export Filename:</label>
      <input type="text" id="exportDbFilename" placeholder="database-export-{date}.sqlite">
    </div>
    <div class="actions">
      <button id="exportDbBtn">Export Database</button>
      <button id="clearDbBtn" class="secondary">Clear Database</button>
      <button id="saveDbSettingsBtn" class="primary-btn">Save Settings</button>
    </div>
    <div class="db-table-grid" style="margin-top:20px;">
      <input type="text" id="tableSearch" placeholder="Search table..." title="Filter tables by name">
      <label for="tableSelect">Table:</label>
      <select id="tableSelect">
        <option value="" disabled selected>No tables found</option>
      </select>
      <button id="viewTableBtn" title="View selected table."><i class="fas fa-eye"></i> View</button>
      <button id="exportTableBtn" title="Export this table as CSV."><i class="fas fa-file-csv"></i> Export</button>
    </div>
    <div id="tableViewContainer"></div>
    <div id="tablePagination" class="table-pagination"></div>
  `;
  return container;
}
