/**
 * Runners Component - Manage and execute saved/temporary runners
 * Part of unified runner architecture (Phase 3)
 */

class RunnersManager {
  constructor() {
    this.runners = [];
    this.selectedRunner = null;
    this.refreshInterval = null;
  }

  async initialize() {
    console.log("[Runners] Initializing runners manager...");

    // Ensure runner tables exist (for databases created before runner feature)
    try {
      const response = await chrome.runtime.sendMessage({
        action: "ensureRunnerTables",
      });
      if (response && response.success) {
        console.log("[Runners] " + response.message);
      }
    } catch (error) {
      console.warn("[Runners] Could not ensure tables:", error);
    }

    // Setup event listeners
    this.setupEventListeners();

    // Load runners
    await this.loadRunners();

    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => this.loadRunners(), 30000);
  }

  setupEventListeners() {
    // Create new runner button
    const btnCreateRunner = document.getElementById("btnCreateRunner");
    if (btnCreateRunner) {
      btnCreateRunner.addEventListener("click", () =>
        this.showCreateRunnerModal()
      );
    }

    // Refresh button
    const btnRefreshRunners = document.getElementById("btnRefreshRunners");
    if (btnRefreshRunners) {
      btnRefreshRunners.addEventListener("click", () => this.loadRunners());
    }

    // Search/filter
    const runnerSearch = document.getElementById("runnerSearch");
    if (runnerSearch) {
      runnerSearch.addEventListener("input", (e) =>
        this.filterRunners(e.target.value)
      );
    }

    const runnerTypeFilter = document.getElementById("runnerTypeFilter");
    if (runnerTypeFilter) {
      runnerTypeFilter.addEventListener("change", () => this.filterRunners());
    }
  }

  async loadRunners() {
    const runnersGrid = document.getElementById("runnersGrid");

    try {
      // Show loading state
      if (runnersGrid) {
        runnersGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--primary-color);"></i>
            <p style="margin-top: 12px; color: var(--text-secondary);">Loading runners...</p>
          </div>
        `;
      }

      const response = await chrome.runtime.sendMessage({
        action: "getAllRunners",
      });

      if (response && response.success) {
        this.runners = response.runners || [];
        this.renderRunners();
      } else {
        // Show error in grid
        if (runnersGrid) {
          runnersGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
              <i class="fas fa-exclamation-triangle" style="font-size: 32px; color: var(--error-color);"></i>
              <p style="margin-top: 12px; color: var(--error-color);">
                Failed to load runners: ${response?.error || "Unknown error"}
              </p>
              <p style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">
                Use the refresh button above to try again
              </p>
            </div>
          `;
        }
        this.showToast(
          "Failed to load runners: " + (response?.error || "Unknown error"),
          "error"
        );
      }
    } catch (error) {
      console.error("[Runners] Error loading runners:", error);

      // Show error in grid
      if (runnersGrid) {
        runnersGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 32px; color: var(--error-color);"></i>
            <p style="margin-top: 12px; color: var(--error-color);">
              Error loading runners: ${error.message}
            </p>
            <p style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">
              Use the refresh button above to try again
            </p>
          </div>
        `;
      }

      this.showToast("Error loading runners: " + error.message, "error");
    }
  }

  renderRunners() {
    const runnersGrid = document.getElementById("runnersGrid");
    if (!runnersGrid) return;

    if (this.runners.length === 0) {
      runnersGrid.innerHTML = `
        <div style="
          grid-column: 1 / -1;
          text-align: center;
          padding: 60px 20px;
          color: var(--text-secondary);
        ">
          <i class="fas fa-play-circle" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
          <h3 style="margin: 0 0 8px 0;">No Runners Yet</h3>
          <p style="margin: 0;">Create your first runner using the "+ New Runner" button above.</p>
        </div>
      `;
      return;
    }

    // Group runners by type
    const permanent = this.runners.filter((r) => !r.is_temporary);
    const temporary = this.runners.filter((r) => r.is_temporary);

    let html = "";

    // Permanent runners section
    if (permanent.length > 0) {
      html += `
        <div style="grid-column: 1 / -1; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; color: var(--text-primary);">
            <i class="fas fa-bookmark"></i> Saved Runners (${permanent.length})
          </h3>
        </div>
      `;
      permanent.forEach((runner) => {
        html += this.renderRunnerCard(runner);
      });
    }

    // Temporary runners section
    if (temporary.length > 0) {
      html += `
        <div style="grid-column: 1 / -1; margin: 24px 0 12px 0;">
          <h3 style="margin: 0; font-size: 16px; color: var(--text-secondary);">
            <i class="fas fa-clock"></i> Recent Quick Runs (${temporary.length})
            <span style="font-size: 12px; font-weight: normal; margin-left: 8px;">Auto-deleted after 7 days</span>
          </h3>
        </div>
      `;
      temporary.forEach((runner) => {
        html += this.renderRunnerCard(runner);
      });
    }

    runnersGrid.innerHTML = html;
  }

  renderRunnerCard(runner) {
    const lastRun = runner.last_run_at
      ? new Date(runner.last_run_at).toLocaleString()
      : "Never";

    const successRate =
      runner.run_count > 0
        ? Math.round(
            (runner.total_success /
              (runner.run_count * runner.total_requests)) *
              100
          )
        : 0;

    const isTemporary = runner.is_temporary;
    const badge = isTemporary
      ? '<span class="runner-badge temporary">Quick Run</span>'
      : '<span class="runner-badge permanent">Saved</span>';

    return `
      <div class="runner-card" data-runner-id="${runner.id}">
        <div class="runner-card-header">
          <div>
            <h4 class="runner-card-title">
              <i class="fas fa-play-circle"></i>
              ${this.escapeHtml(runner.name)}
            </h4>
            ${badge}
          </div>
          <div class="runner-card-actions">
            <button 
              class="icon-btn" 
              title="Run Now"
              onclick="runnersManager.runRunner('${runner.id}')"
            >
              <i class="fas fa-play"></i>
            </button>
            <button 
              class="icon-btn" 
              title="View Details"
              onclick="runnersManager.showRunnerDetails('${runner.id}')"
            >
              <i class="fas fa-eye"></i>
            </button>
            <button 
              class="icon-btn" 
              title="More Actions"
              onclick="runnersManager.showRunnerMenu(event, '${runner.id}')"
            >
              <i class="fas fa-ellipsis-v"></i>
            </button>
          </div>
        </div>
        
        ${
          runner.description
            ? `
          <p class="runner-card-description">${this.escapeHtml(
            runner.description
          )}</p>
        `
            : ""
        }
        
        <div class="runner-card-stats">
          <div class="runner-stat">
            <i class="fas fa-list"></i>
            <span>${runner.total_requests || 0} requests</span>
          </div>
          <div class="runner-stat">
            <i class="fas fa-history"></i>
            <span>${runner.run_count || 0} executions</span>
          </div>
          <div class="runner-stat">
            <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
            <span>${successRate}% success</span>
          </div>
        </div>
        
        <div class="runner-card-footer">
          <span class="runner-last-run">
            <i class="fas fa-clock"></i> Last run: ${lastRun}
          </span>
          ${
            isTemporary
              ? `
            <button 
              class="link-btn" 
              onclick="runnersManager.convertToSaved('${runner.id}')"
              title="Save this runner permanently"
            >
              <i class="fas fa-save"></i> Save
            </button>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  async runRunner(runnerId) {
    try {
      this.showToast("Starting runner...", "info");

      const response = await chrome.runtime.sendMessage({
        action: "runRunner",
        runnerId,
      });

      if (response && response.success) {
        this.showToast("Runner started successfully!", "success");
        // Reload runners to update stats
        setTimeout(() => this.loadRunners(), 2000);
      } else {
        this.showToast(
          "Failed to start runner: " + (response?.error || "Unknown error"),
          "error"
        );
      }
    } catch (error) {
      console.error("[Runners] Error running runner:", error);
      this.showToast("Error starting runner", "error");
    }
  }

  async showRunnerDetails(runnerId) {
    try {
      // Load runner definition and execution history
      const [defResponse, historyResponse] = await Promise.all([
        chrome.runtime.sendMessage({
          action: "getRunnerDefinition",
          runnerId,
        }),
        chrome.runtime.sendMessage({
          action: "getRunnerHistory",
          runnerId,
          limit: 10,
        }),
      ]);

      if (!defResponse?.success || !historyResponse?.success) {
        this.showToast("Failed to load runner details", "error");
        return;
      }

      const runner = defResponse.runner;
      const executions = historyResponse.executions || [];

      // Show details modal
      this.renderRunnerDetailsModal(runner, executions);
      document.getElementById("runnerDetailsModal").style.display = "flex";
    } catch (error) {
      console.error("[Runners] Error loading runner details:", error);
      this.showToast("Error loading details", "error");
    }
  }

  renderRunnerDetailsModal(runner, executions) {
    const modal = document.getElementById("runnerDetailsModal");
    if (!modal) return;

    const executionsHtml =
      executions.length > 0
        ? executions
            .map(
              (exec) => `
          <tr>
            <td>${new Date(exec.start_time).toLocaleString()}</td>
            <td>
              <span class="status-badge status-${exec.status}">${
                exec.status
              }</span>
            </td>
            <td>${
              exec.duration ? (exec.duration / 1000).toFixed(2) + "s" : "N/A"
            }</td>
            <td>${exec.success_count || 0} / ${exec.total_requests || 0}</td>
            <td>
              <button 
                class="link-btn" 
                onclick="runnersManager.showExecutionResults('${exec.id}')"
              >
                <i class="fas fa-list"></i> View Results
              </button>
            </td>
          </tr>
        `
            )
            .join("")
        : '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-secondary);">No executions yet</td></tr>';

    const modalContent = modal.querySelector(".modal-body");
    modalContent.innerHTML = `
      <div class="runner-details">
        <div class="details-section">
          <h3><i class="fas fa-info-circle"></i> Runner Information</h3>
          <table class="details-table">
            <tr>
              <th>Name:</th>
              <td>${this.escapeHtml(runner.name)}</td>
            </tr>
            ${
              runner.description
                ? `
              <tr>
                <th>Description:</th>
                <td>${this.escapeHtml(runner.description)}</td>
              </tr>
            `
                : ""
            }
            <tr>
              <th>Type:</th>
              <td>${
                runner.is_temporary
                  ? '<span class="runner-badge temporary">Quick Run</span>'
                  : '<span class="runner-badge permanent">Saved</span>'
              }</td>
            </tr>
            <tr>
              <th>Execution Mode:</th>
              <td>${runner.execution_mode}</td>
            </tr>
            <tr>
              <th>Total Requests:</th>
              <td>${runner.total_requests || 0}</td>
            </tr>
            <tr>
              <th>Total Runs:</th>
              <td>${runner.run_count || 0}</td>
            </tr>
            <tr>
              <th>Created:</th>
              <td>${new Date(runner.created_at).toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div class="details-section">
          <h3><i class="fas fa-history"></i> Execution History</h3>
          <div style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Success</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${executionsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  async showExecutionResults(executionId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getExecutionResults",
        executionId,
      });

      if (!response?.success) {
        this.showToast("Failed to load execution results", "error");
        return;
      }

      const results = response.results || [];

      // Show results in a new modal or expand section
      alert(
        `Execution Results:\n\n${results.length} results loaded\n\nTODO: Implement results view UI`
      );
    } catch (error) {
      console.error("[Runners] Error loading execution results:", error);
      this.showToast("Error loading results", "error");
    }
  }

  async convertToSaved(runnerId) {
    if (!confirm("Convert this quick run to a permanent saved runner?")) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "convertToSavedRunner",
        runnerId,
      });

      if (response && response.success) {
        this.showToast("Runner saved successfully!", "success");
        await this.loadRunners();
      } else {
        this.showToast(
          "Failed to save runner: " + (response?.error || "Unknown error"),
          "error"
        );
      }
    } catch (error) {
      console.error("[Runners] Error converting runner:", error);
      this.showToast("Error saving runner", "error");
    }
  }

  async deleteRunner(runnerId) {
    if (
      !confirm(
        "Are you sure you want to delete this runner? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      // TODO: Implement deleteRunner message handler
      this.showToast("Delete functionality coming soon", "info");
    } catch (error) {
      console.error("[Runners] Error deleting runner:", error);
      this.showToast("Error deleting runner", "error");
    }
  }

  showRunnerMenu(event, runnerId) {
    event.stopPropagation();
    // TODO: Implement context menu
    alert(
      `Runner menu for: ${runnerId}\n\nActions:\n- Edit\n- Duplicate\n- Delete\n\nTODO: Implement context menu`
    );
  }

  async showCreateRunnerModal() {
    const modal = document.getElementById("runnerWizardModal");
    if (!modal) return;

    // Reset wizard state
    this.wizardState = {
      currentStep: 1,
      selectedDomain: null,
      selectedPage: null,
      selectedType: null,
      selectedRequests: [],
      config: {},
    };

    // Show modal and load domains
    modal.style.display = "block";
    this.updateWizardStep(1);
    await this.loadWizardDomains();

    // Setup event listeners (only once)
    if (!this.wizardListenersSetup) {
      this.setupWizardListeners();
      this.wizardListenersSetup = true;
    }
  }

  setupWizardListeners() {
    // Domain change
    document
      .getElementById("wizardDomainSelect")
      .addEventListener("change", async (e) => {
        this.wizardState.selectedDomain = e.target.value;
        this.wizardState.selectedPage = null;
        this.wizardState.selectedType = null;
        this.wizardState.selectedRequests = [];
        await this.loadWizardPages(e.target.value);
        await this.loadWizardRequests();
      });

    // Page change
    document
      .getElementById("wizardPageSelect")
      .addEventListener("change", async (e) => {
        this.wizardState.selectedPage = e.target.value;
        await this.loadWizardRequests();
      });

    // Type change
    document
      .getElementById("wizardTypeSelect")
      .addEventListener("change", async (e) => {
        this.wizardState.selectedType = e.target.value;
        await this.loadWizardRequests();
      });

    // Mode change (show/hide delay)
    document.getElementById("wizardMode").addEventListener("change", (e) => {
      const delayGroup = document.getElementById("wizardDelayGroup");
      delayGroup.style.display =
        e.target.value === "sequential" ? "block" : "none";
    });

    // Navigation buttons
    document.getElementById("wizardPrevBtn").addEventListener("click", () => {
      this.wizardPreviousStep();
    });

    document.getElementById("wizardNextBtn").addEventListener("click", () => {
      this.wizardNextStep();
    });

    document.getElementById("wizardCreateBtn").addEventListener("click", () => {
      this.createRunnerFromWizard();
    });

    // Cancel/Close
    const closeWizard = () => {
      document.getElementById("runnerWizardModal").style.display = "none";
      this.wizardState = null;
    };
    document
      .getElementById("wizardCancelBtn")
      .addEventListener("click", closeWizard);
    document
      .getElementById("closeRunnerWizard")
      .addEventListener("click", closeWizard);
  }

  async loadWizardDomains() {
    const select = document.getElementById("wizardDomainSelect");
    select.innerHTML = '<option value="">Loading...</option>';

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getDomains",
        timeRange: 604800, // Last 7 days
      });

      if (
        response &&
        response.success &&
        response.domains &&
        response.domains.length > 0
      ) {
        select.innerHTML =
          '<option value="">Select a domain...</option>' +
          response.domains
            .map((domainObj) => {
              const domain = domainObj.domain;
              return `<option value="${domain}">${domain} (${domainObj.requestCount} requests)</option>`;
            })
            .join("");
      } else {
        select.innerHTML = '<option value="">No domains found</option>';
      }
    } catch (error) {
      console.error("[Wizard] Failed to load domains:", error);
      select.innerHTML = '<option value="">Error loading domains</option>';
    }
  }

  async loadWizardPages(domain) {
    const select = document.getElementById("wizardPageSelect");
    const typeSelect = document.getElementById("wizardTypeSelect");

    if (!domain) {
      select.disabled = true;
      typeSelect.disabled = true;
      select.innerHTML = '<option value="">Select domain first</option>';
      return;
    }

    select.innerHTML = '<option value="">Loading...</option>';

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getPagesByDomain",
        domain: domain,
        timeRange: 604800, // Last 7 days
      });

      if (
        response &&
        response.success &&
        response.pages &&
        response.pages.length > 0
      ) {
        select.disabled = false;
        typeSelect.disabled = false;
        select.innerHTML =
          '<option value="">All pages</option>' +
          response.pages
            .map((pageObj) => {
              const pageUrl = pageObj.pageUrl;
              const count = pageObj.requestCount || 0;
              // Extract path from URL for cleaner display
              try {
                const url = new URL(pageUrl);
                const displayPath = url.pathname + url.search || "/";
                return `<option value="${pageUrl}">${displayPath} (${count} req)</option>`;
              } catch (e) {
                return `<option value="${pageUrl}">${pageUrl} (${count} req)</option>`;
              }
            })
            .join("");
      } else {
        select.innerHTML = '<option value="">No pages found</option>';
      }
    } catch (error) {
      console.error("[Wizard] Failed to load pages:", error);
      select.innerHTML = '<option value="">Error loading pages</option>';
    }
  }

  async loadWizardRequests() {
    const container = document.getElementById("wizardRequestList");
    const countEl = document.getElementById("wizardRequestCount");

    if (!this.wizardState.selectedDomain) {
      container.innerHTML =
        '<div style="padding: 20px; text-align: center; color: var(--text-secondary)">Select a domain to view available requests</div>';
      countEl.textContent = "0 requests selected";
      return;
    }

    container.innerHTML =
      '<div style="padding: 20px; text-align: center"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getRequestsByFilters",
        filters: {
          domain: this.wizardState.selectedDomain,
          pageUrl: this.wizardState.selectedPage || null,
          type: this.wizardState.selectedType || null,
        },
      });

      if (response && response.success && response.requests) {
        const requests = response.requests;

        if (requests.length === 0) {
          container.innerHTML =
            '<div style="padding: 20px; text-align: center; color: var(--text-secondary)">No requests found with these filters</div>';
          countEl.textContent = "0 requests available";
          return;
        }

        container.innerHTML = requests
          .map(
            (req, idx) => `
          <div class="request-item">
            <input type="checkbox" id="req-${idx}" data-url="${
              req.url
            }" data-method="${req.method}">
            <div class="request-details">
              <div class="request-url">${req.url}</div>
              <div class="request-meta">
                <span class="request-method">${req.method}</span>
                <span>${req.type || "unknown"}</span>
                <span>${new Date(req.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        `
          )
          .join("");

        // Add change listeners to checkboxes
        container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          cb.addEventListener("change", () => {
            this.updateSelectedRequests();
          });
        });

        countEl.textContent = `0 of ${requests.length} requests selected`;
      } else {
        container.innerHTML =
          '<div style="padding: 20px; text-align: center; color: var(--text-danger)">Error loading requests</div>';
      }
    } catch (error) {
      console.error("[Wizard] Failed to load requests:", error);
      container.innerHTML =
        '<div style="padding: 20px; text-align: center; color: var(--text-danger)">Error loading requests</div>';
    }
  }

  updateSelectedRequests() {
    const checkboxes = document.querySelectorAll(
      '#wizardRequestList input[type="checkbox"]:checked'
    );
    const countEl = document.getElementById("wizardRequestCount");
    const total = document.querySelectorAll(
      '#wizardRequestList input[type="checkbox"]'
    ).length;

    this.wizardState.selectedRequests = Array.from(checkboxes).map((cb) => ({
      url: cb.dataset.url,
      method: cb.dataset.method,
    }));

    countEl.textContent = `${this.wizardState.selectedRequests.length} of ${total} requests selected`;
  }

  updateWizardStep(step) {
    // Update progress indicator
    document.querySelectorAll(".wizard-step").forEach((el) => {
      const stepNum = parseInt(el.dataset.step);
      el.classList.remove("active", "completed");
      if (stepNum === step) {
        el.classList.add("active");
      } else if (stepNum < step) {
        el.classList.add("completed");
      }
    });

    // Show/hide content
    document.querySelectorAll(".wizard-content").forEach((el) => {
      el.classList.remove("active");
      el.style.display = "none";
    });
    const currentContent = document.getElementById(`wizardStep${step}`);
    if (currentContent) {
      currentContent.classList.add("active");
      currentContent.style.display = "block";
    }

    // Update buttons
    const prevBtn = document.getElementById("wizardPrevBtn");
    const nextBtn = document.getElementById("wizardNextBtn");
    const createBtn = document.getElementById("wizardCreateBtn");

    prevBtn.style.display = step > 1 ? "block" : "none";
    nextBtn.style.display = step < 3 ? "block" : "none";
    createBtn.style.display = step === 3 ? "block" : "none";

    this.wizardState.currentStep = step;
  }

  wizardNextStep() {
    const currentStep = this.wizardState.currentStep;

    // Validate current step
    if (currentStep === 1) {
      if (!this.wizardState.selectedDomain) {
        alert("Please select a domain");
        return;
      }
      if (this.wizardState.selectedRequests.length === 0) {
        alert("Please select at least one request");
        return;
      }
    }

    if (currentStep < 3) {
      this.updateWizardStep(currentStep + 1);
    }
  }

  wizardPreviousStep() {
    const currentStep = this.wizardState.currentStep;
    if (currentStep > 1) {
      this.updateWizardStep(currentStep - 1);
    }
  }

  async createRunnerFromWizard() {
    // Validate step 3
    const name = document.getElementById("wizardRunnerName").value.trim();
    if (!name) {
      alert("Please enter a runner name");
      return;
    }

    // Collect all configuration
    const definition = {
      name: name,
      description: document
        .getElementById("wizardRunnerDescription")
        .value.trim(),
      is_temporary: !document.getElementById("wizardSaveAsPermanent").checked,
      execution_mode: document.getElementById("wizardMode").value,
      request_delay:
        parseInt(document.getElementById("wizardDelay").value) || 1000,
      follow_redirects: document.getElementById("wizardFollowRedirects")
        .checked,
      validate_status: document.getElementById("wizardValidateStatus").checked,
      use_variables: document.getElementById("wizardUseVariables").checked,
      created_at: Date.now(),
    };

    const requests = this.wizardState.selectedRequests.map((req, idx) => ({
      url: req.url,
      method: req.method,
      sequence_order: idx + 1,
      domain: this.wizardState.selectedDomain,
      page_url: this.wizardState.selectedPage || null,
    }));

    // Show loading state
    const createBtn = document.getElementById("wizardCreateBtn");
    const originalText = createBtn.innerHTML;
    createBtn.disabled = true;
    createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: "createRunner",
        definition: definition,
        requests: requests,
      });

      if (response && response.success) {
        // Close modal
        document.getElementById("runnerWizardModal").style.display = "none";

        // Show success message
        this.showToast(`✓ Runner "${name}" created successfully!`, "success");

        // Reload runners list
        await this.loadRunners();
      } else {
        throw new Error(response?.error || "Failed to create runner");
      }
    } catch (error) {
      console.error("[Wizard] Failed to create runner:", error);
      alert(`Failed to create runner: ${error.message}`);
      createBtn.disabled = false;
      createBtn.innerHTML = originalText;
    }
  }

  filterRunners(searchTerm = "") {
    const typeFilter =
      document.getElementById("runnerTypeFilter")?.value || "all";
    const search =
      searchTerm.toLowerCase() ||
      document.getElementById("runnerSearch")?.value.toLowerCase() ||
      "";

    const cards = document.querySelectorAll(".runner-card");
    cards.forEach((card) => {
      const runnerId = card.dataset.runnerId;
      const runner = this.runners.find((r) => r.id === runnerId);

      if (!runner) {
        card.style.display = "none";
        return;
      }

      // Type filter
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "saved" && !runner.is_temporary) ||
        (typeFilter === "temporary" && runner.is_temporary);

      // Search filter
      const matchesSearch =
        !search ||
        runner.name.toLowerCase().includes(search) ||
        (runner.description &&
          runner.description.toLowerCase().includes(search));

      card.style.display = matchesType && matchesSearch ? "" : "none";
    });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showToast(message, type = "info") {
    // Reuse dashboard toast if available
    if (window.dashboardManager && window.dashboardManager.showToast) {
      window.dashboardManager.showToast(message, type);
    } else {
      console.log(`[Runners] ${type.toUpperCase()}: ${message}`);
    }
  }

  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Initialize when page loads
let runnersManager = null;

document.addEventListener("DOMContentLoaded", () => {
  // Initialize when runners tab is first shown
  const runnersTab = document.querySelector('[data-tab="runners"]');
  if (runnersTab) {
    runnersTab.addEventListener(
      "click",
      () => {
        if (!runnersManager) {
          runnersManager = new RunnersManager();
          runnersManager.initialize();
        }
      },
      { once: true }
    );
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (runnersManager) {
    runnersManager.cleanup();
  }
});

// Export for use in other modules
window.runnersManager = null;
export default RunnersManager;
