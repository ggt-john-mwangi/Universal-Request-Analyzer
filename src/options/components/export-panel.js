// Export panel component
import { notificationSystem } from "./notifications.js";

export default class ExportPanel {
  constructor(options = {}) {
    this.container = null;
    this.panel = null;
    this.activeFilters = {};
    this.options = {
      defaultFormat: "json",
      ...options,
    };
  }

  initialize(container) {
    if (!container) {
      console.error("Container element is required for ExportPanel.");
    }
    if (this.container) {
      console.error("ExportPanel is already initialized.");
    }
    if (!(container instanceof HTMLElement)) {
      console.error("Container must be a valid HTML element.");
    }
    this.container = container;
    this.createUI();
    this.setupEventListeners();
  }

  createUI() {
    this.container.innerHTML = `
      <div class="export-panel panel">
        <h3>Export Data</h3>
        <div class="export-form">
          <div class="form-row">
            <label for="exportFormat">Format:</label>
            <select id="exportFormat">
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="har">HAR (HTTP Archive)</option>
              <option value="sqlite">SQLite</option>
            </select>
          </div>
          <div class="form-row">
            <label for="exportFilename">Filename:</label>
            <input type="text" id="exportFilename" placeholder="Enter filename">
          </div>
          <div class="export-actions">
            <button id="doExportBtn" class="primary-btn">Export</button>
            <button id="cancelExportBtn" class="secondary-btn">Cancel</button>
          </div>
        </div>
      </div>
    `;

    this.panel = this.container.querySelector(".export-panel");

    // Set default filename
    const defaultFilename = `request-analyzer-export-${new Date()
      .toISOString()
      .slice(0, 10)}`;
    this.container.querySelector("#exportFilename").value = defaultFilename;

    // Set default format
    this.container.querySelector("#exportFormat").value =
      this.options.defaultFormat;
  }

  setupEventListeners() {
    const doExportBtn = this.container.querySelector("#doExportBtn");
    const cancelExportBtn = this.container.querySelector("#cancelExportBtn");

    doExportBtn.addEventListener("click", () => this.exportData());
    cancelExportBtn.addEventListener("click", () => this.hide());
  }

  show() {
    console.log("Showing export panel");

    if (!this.panel) {
      console.error("Export panel not initialized. Call initialize() first.");
      return;
    }
    this.panel.classList.add("visible");
  }

  hide() {
    if (!this.panel) {
      console.error("Export panel not initialized. Call initialize() first.");
      return;
    }
    this.panel.classList.remove("visible");
  }

  setFilters(filters) {
    if (!this.panel) {
      console.error("Export panel not initialized. Call initialize() first.");
      return;
    }
    if (typeof filters !== "object") {
      console.error("Filters must be an object.");
      return;
    }
    this.activeFilters = { ...filters };
  }

  async exportData() {
    try {
      const format = this.container.querySelector("#exportFormat").value;
      const filename =
        this.container.querySelector("#exportFilename").value ||
        `request-analyzer-export-${new Date().toISOString().slice(0, 10)}`;

      await chrome.runtime.sendMessage({
        action: "exportData",
        format,
        filename,
        filters: this.activeFilters,
      });

      notificationSystem.showSuccess("Data exported successfully");
      this.hide();
    } catch (error) {
      console.error("Export error:", error);
      notificationSystem.showError("Failed to export data");
    }
  }
}

// Export singleton instance
export const exportPanel = new ExportPanel();
