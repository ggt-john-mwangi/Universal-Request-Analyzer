// Data purging component for options page

export default function renderDataPurge() {
  const container = document.createElement("div");
  container.className = "data-purge-section";
  container.innerHTML = `
    <h2>Data Retention & Cleanup</h2>
    
    <div class="settings-group">
      <h3>Retention Settings</h3>
      <div class="setting-row">
        <label for="retentionPeriod">Keep data for:</label>
        <select id="retentionPeriod">
          <option value="86400000">1 day</option>
          <option value="604800000">7 days</option>
          <option value="2592000000">30 days</option>
          <option value="7776000000">90 days</option>
          <option value="31536000000">1 year</option>
          <option value="0">Forever</option>
        </select>
      </div>
      <div class="setting-row">
        <label for="maxDatabaseSize">Maximum database size:</label>
        <input type="number" id="maxDatabaseSize" min="1" step="1" placeholder="Size in MB">
        <span>MB</span>
      </div>
    </div>

    <div class="settings-group">
      <h3>Manual Cleanup</h3>
      <div class="cleanup-actions">
        <div class="action-row">
          <button id="purgeOldData" class="warning">
            Clean Old Data
          </button>
          <span class="description">Remove data older than retention period</span>
        </div>
        <div class="action-row">
          <button id="purgeByDomain" class="warning">
            Clean by Domain
          </button>
          <input type="text" id="domainFilter" placeholder="Enter domain">
        </div>
        <div class="action-row">
          <button id="purgeByStatus" class="warning">
            Clean by Status
          </button>
          <select id="statusFilter">
            <option value="4xx">4xx Client Errors</option>
            <option value="5xx">5xx Server Errors</option>
            <option value="failed">Failed Requests</option>
          </select>
        </div>
        <div class="action-row">
          <button id="purgeAll" class="danger">
            Clear All Data
          </button>
          <span class="description">Remove all collected data (cannot be undone)</span>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <h3>Auto-Cleanup</h3>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="enableAutoCleanup">
          Enable automatic cleanup
        </label>
      </div>
      <div class="setting-row">
        <label for="cleanupSchedule">Run cleanup every:</label>
        <select id="cleanupSchedule">
          <option value="86400000">Day</option>
          <option value="604800000">Week</option>
          <option value="2592000000">Month</option>
        </select>
      </div>
    </div>

    <div id="purgeStatus" class="status-message" style="display: none;"></div>
  `;

  // Add event listeners
  function attachEventListeners() {
    // Retention settings
    const retentionPeriod = container.querySelector("#retentionPeriod");
    const maxDatabaseSize = container.querySelector("#maxDatabaseSize");

    retentionPeriod.addEventListener("change", async () => {
      await updateRetentionSettings({
        retentionPeriod: parseInt(retentionPeriod.value),
      });
    });

    maxDatabaseSize.addEventListener("change", async () => {
      await updateRetentionSettings({
        maxDatabaseSize: parseInt(maxDatabaseSize.value) * 1024 * 1024, // Convert MB to bytes
      });
    });

    // Manual cleanup actions
    container
      .querySelector("#purgeOldData")
      .addEventListener("click", async () => {
        if (confirm("Are you sure you want to remove old data?")) {
          const status = await purgeOldData();
          showStatus(status);
        }
      });

    container
      .querySelector("#purgeByDomain")
      .addEventListener("click", async () => {
        const domain = container.querySelector("#domainFilter").value;
        if (!domain) {
          showStatus({ success: false, message: "Please enter a domain" });
          return;
        }

        if (
          confirm(
            `Are you sure you want to remove all data for domain: ${domain}?`
          )
        ) {
          const status = await purgeByCustomFilter({ domain });
          showStatus(status);
        }
      });

    container
      .querySelector("#purgeByStatus")
      .addEventListener("click", async () => {
        const status = container.querySelector("#statusFilter").value;
        if (
          confirm(`Are you sure you want to remove all ${status} requests?`)
        ) {
          const status = await purgeByCustomFilter({ status });
          showStatus(status);
        }
      });

    container.querySelector("#purgeAll").addEventListener("click", async () => {
      if (
        confirm(
          "WARNING: This will delete all collected data. This action cannot be undone. Are you sure?"
        )
      ) {
        const status = await purgeAllData();
        showStatus(status);
      }
    });

    // Auto-cleanup settings
    const autoCleanup = container.querySelector("#enableAutoCleanup");
    const cleanupSchedule = container.querySelector("#cleanupSchedule");

    autoCleanup.addEventListener("change", async () => {
      await updateAutoCleanupSettings({
        enabled: autoCleanup.checked,
        interval: parseInt(cleanupSchedule.value),
      });
    });

    cleanupSchedule.addEventListener("change", async () => {
      if (autoCleanup.checked) {
        await updateAutoCleanupSettings({
          enabled: true,
          interval: parseInt(cleanupSchedule.value),
        });
      }
    });
  }

  // Helper function to show status messages
  function showStatus({ success, message }) {
    const statusEl = container.querySelector("#purgeStatus");
    statusEl.textContent = message;
    statusEl.className = `status-message ${success ? "success" : "error"}`;
    statusEl.style.display = "block";

    setTimeout(() => {
      statusEl.style.display = "none";
    }, 3000);
  }

  // Load current settings
  async function loadSettings() {
    try {
      // Get current settings from background
      const response = await chrome.runtime.sendMessage({
        action: "getRetentionSettings",
      });

      if (response && response.success) {
        const settings = response.settings;

        // Update UI with current settings
        container.querySelector("#retentionPeriod").value =
          settings.retentionPeriod.toString();

        container.querySelector("#maxDatabaseSize").value = Math.floor(
          settings.maxDatabaseSize / (1024 * 1024)
        ); // Convert bytes to MB

        container.querySelector("#enableAutoCleanup").checked =
          settings.autoCleanup?.enabled || false;

        if (settings.autoCleanup?.interval) {
          container.querySelector("#cleanupSchedule").value =
            settings.autoCleanup.interval.toString();
        }
      }
    } catch (error) {
      console.error("Failed to load retention settings:", error);
      showStatus({
        success: false,
        message: "Failed to load settings",
      });
    }
  }

  // Update retention settings
  async function updateRetentionSettings(settings) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "updateRetentionSettings",
        settings,
      });

      if (response && response.success) {
        showStatus({
          success: true,
          message: "Settings updated successfully",
        });
      } else {
        throw new Error(response?.error || "Failed to update settings");
      }
    } catch (error) {
      console.error("Failed to update retention settings:", error);
      showStatus({
        success: false,
        message: "Failed to update settings",
      });
    }
  }

  // Update auto-cleanup settings
  async function updateAutoCleanupSettings(settings) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "updateAutoCleanupSettings",
        settings,
      });

      if (response && response.success) {
        showStatus({
          success: true,
          message: "Auto-cleanup settings updated",
        });
      } else {
        throw new Error(
          response?.error || "Failed to update auto-cleanup settings"
        );
      }
    } catch (error) {
      console.error("Failed to update auto-cleanup settings:", error);
      showStatus({
        success: false,
        message: "Failed to update auto-cleanup settings",
      });
    }
  }

  // Purge functions
  async function purgeOldData() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "purgeOldData",
      });

      return {
        success: response && response.success,
        message: response?.success
          ? "Old data removed successfully"
          : response?.error || "Failed to remove old data",
      };
    } catch (error) {
      console.error("Failed to purge old data:", error);
      return {
        success: false,
        message: "Failed to remove old data",
      };
    }
  }

  async function purgeByCustomFilter(filter) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "purgeByCustomFilter",
        filter,
      });

      return {
        success: response && response.success,
        message: response?.success
          ? "Data removed successfully"
          : response?.error || "Failed to remove data",
      };
    } catch (error) {
      console.error("Failed to purge by filter:", error);
      return {
        success: false,
        message: "Failed to remove data",
      };
    }
  }

  async function purgeAllData() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "purgeAllData",
      });

      return {
        success: response && response.success,
        message: response?.success
          ? "All data cleared successfully"
          : response?.error || "Failed to clear data",
      };
    } catch (error) {
      console.error("Failed to purge all data:", error);
      return {
        success: false,
        message: "Failed to clear data",
      };
    }
  }

  // Initialize component
  attachEventListeners();
  loadSettings();

  return container;
}
