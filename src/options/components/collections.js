/**
 * Collections Component - Organize runners into collections
 * Replaces chrome.storage with database storage
 */

const browserAPI = globalThis.browser || globalThis.chrome;

class CollectionsManager {
  constructor() {
    this.collections = [];
    this.selectedCollection = null;
    this.availableRunners = [];
  }

  async initialize() {
    this.setupEventListeners();
    await this.loadCollections();
  }

  setupEventListeners() {
    // Create collection button
    const btnCreateCollection = document.getElementById("btnCreateCollection");
    if (btnCreateCollection) {
      btnCreateCollection.addEventListener("click", () =>
        this.showCreateCollectionModal()
      );
    }

    // Refresh button
    const btnRefreshCollections = document.getElementById(
      "btnRefreshCollections"
    );
    if (btnRefreshCollections) {
      btnRefreshCollections.addEventListener("click", () =>
        this.loadCollections()
      );
    }

    // Modal close buttons
    const collectionModalClose = document.getElementById(
      "collectionModalClose"
    );
    if (collectionModalClose) {
      collectionModalClose.addEventListener("click", () =>
        this.hideCollectionModal()
      );
    }

    const btnCancelCollection = document.getElementById("btnCancelCollection");
    if (btnCancelCollection) {
      btnCancelCollection.addEventListener("click", () =>
        this.hideCollectionModal()
      );
    }

    // Save collection button
    const btnSaveCollection = document.getElementById("btnSaveCollection");
    if (btnSaveCollection) {
      btnSaveCollection.addEventListener("click", () => this.saveCollection());
    }

    // Event delegation for collection actions
    const collectionsGrid = document.getElementById("collectionsGrid");
    if (collectionsGrid) {
      collectionsGrid.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const action = btn.dataset.action;
        const collectionId = btn.dataset.collectionId;

        if (!action || !collectionId) return;

        switch (action) {
          case "run":
            this.runCollection(collectionId);
            break;
          case "view":
            this.viewCollection(collectionId);
            break;
          case "edit":
            this.editCollection(collectionId);
            break;
          case "delete":
            this.deleteCollection(collectionId);
            break;
        }
      });
    }
  }

  async loadCollections() {
    try {
      console.log("[Collections] Requesting collections from background...");
      const response = await browserAPI.runtime.sendMessage({
        action: "getCollections",
      });

      console.log("[Collections] Response received:", response);

      if (response && response.success) {
        this.collections = response.collections || [];
        console.log(
          `[Collections] Loaded ${this.collections.length} collections`
        );
        this.renderCollections();
      } else {
        console.error("[Collections] Response not successful:", response);
        throw new Error(response?.error || "Failed to load collections");
      }
    } catch (error) {
      console.error("[Collections] Failed to load:", error);
      this.showNotification("Failed to load collections", "error");
      this.collections = [];
      this.renderCollections();
    }
  }

  renderCollections() {
    console.log(
      "[Collections] Rendering collections, count:",
      this.collections.length
    );
    const grid = document.getElementById("collectionsGrid");
    if (!grid) {
      console.error("[Collections] collectionsGrid element not found!");
      return;
    }

    if (this.collections.length === 0) {
      console.log("[Collections] Showing empty state");
      grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <h3>No Collections Yet</h3>
          <p><strong>Why use Collections?</strong></p>
          <p style="text-align: left; max-width: 600px; margin: 12px auto;">
            • <strong>Organize runners</strong> into logical groups (e.g., "API Tests", "Auth Flow", "E2E Suite")<br>
            • <strong>Run multiple runners</strong> sequentially with one click<br>
            • <strong>Manage related tests</strong> together as a test suite<br>
            • <strong>Track progress</strong> and results across grouped runners
          </p>
          <button class="btn btn-primary" id="btnCreateFirstCollection">
            <i class="fas fa-plus"></i> Create Your First Collection
          </button>
        </div>
      `;

      const btnCreate = grid.querySelector("#btnCreateFirstCollection");
      if (btnCreate) {
        btnCreate.addEventListener("click", () =>
          this.showCreateCollectionModal()
        );
      }

      return;
    }

    grid.innerHTML = this.collections
      .map(
        (collection) => `
      <div class="collection-card" data-collection-id="${collection.id}">
        <div class="collection-header" style="border-left: 4px solid ${
          collection.color || "#007bff"
        }">
          <div class="collection-icon">
            <i class="fas ${collection.icon || "fa-folder"}"></i>
          </div>
          <div class="collection-info">
            <h4>${this.escapeHtml(collection.name)}</h4>
            <p class="collection-description">${
              this.escapeHtml(collection.description) || "No description"
            }</p>
          </div>
          <div class="collection-badge">
            <span class="badge">${collection.runner_count || 0} runners</span>
          </div>
        </div>
        <div class="collection-actions">
          ${
            collection.runner_count > 0
              ? `
            <button 
              class="btn btn-sm btn-success" 
              data-action="run" 
              data-collection-id="${collection.id}"
              title="Run all runners in this collection">
              <i class="fas fa-play"></i> Run All
            </button>
          `
              : ""
          }
          <button 
            class="btn btn-sm btn-secondary" 
            data-action="view" 
            data-collection-id="${collection.id}"
            title="View collection">
            <i class="fas fa-eye"></i> View
          </button>
          <button 
            class="btn btn-sm btn-primary" 
            data-action="edit" 
            data-collection-id="${collection.id}"
            title="Edit collection">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button 
            class="btn btn-sm btn-danger" 
            data-action="delete" 
            data-collection-id="${collection.id}"
            title="Delete collection">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `
      )
      .join("");
  }

  async showCreateCollectionModal() {
    this.selectedCollection = null;

    // Load available runners
    await this.loadAvailableRunners();

    // Reset form
    document.getElementById("collectionId").value = "";
    document.getElementById("collectionName").value = "";
    document.getElementById("collectionDescription").value = "";
    document.getElementById("collectionColor").value = "#007bff";
    document.getElementById("collectionIcon").value = "fa-folder";

    // Update modal title
    document.getElementById("collectionModalTitle").textContent =
      "Create Collection";

    this.showCollectionModal();
  }

  async editCollection(collectionId) {
    try {
      const response = await browserAPI.runtime.sendMessage({
        action: "getCollection",
        collectionId: collectionId,
      });

      if (response && response.success && response.collection) {
        this.selectedCollection = response.collection;

        // Load available runners
        await this.loadAvailableRunners();

        // Populate form
        document.getElementById("collectionId").value =
          this.selectedCollection.id;
        document.getElementById("collectionName").value =
          this.selectedCollection.name;
        document.getElementById("collectionDescription").value =
          this.selectedCollection.description || "";
        document.getElementById("collectionColor").value =
          this.selectedCollection.color || "#007bff";
        document.getElementById("collectionIcon").value =
          this.selectedCollection.icon || "fa-folder";

        // Update modal title
        document.getElementById("collectionModalTitle").textContent =
          "Edit Collection";

        this.showCollectionModal();
      } else {
        throw new Error(response?.error || "Collection not found");
      }
    } catch (error) {
      console.error("[Collections] Failed to load collection:", error);
      this.showNotification("Failed to load collection", "error");
    }
  }

  async viewCollection(collectionId) {
    try {
      const response = await browserAPI.runtime.sendMessage({
        action: "getCollection",
        collectionId: collectionId,
      });

      if (response && response.success && response.collection) {
        const collection = response.collection;
        const runners = collection.runners || [];

        const modal = document.getElementById("collectionViewModal");
        if (!modal) return;

        const modalContent = modal.querySelector(".modal-content");
        if (!modalContent) {
          console.error("[Collections] Modal content wrapper not found");
          return;
        }

        const content = `
          <div class="modal-header">
            <h3>
              <i class="fas ${collection.icon || "fa-folder"}" style="color: ${
          collection.color || "#007bff"
        }"></i>
              ${this.escapeHtml(collection.name)}
            </h3>
            <button class="modal-close" id="closeViewModal">×</button>
          </div>
          <div class="modal-body">
            <p class="text-muted">${
              this.escapeHtml(collection.description) || "No description"
            }</p>
            
            <h4 class="mt-3">Runners (${runners.length})</h4>
            ${
              runners.length === 0
                ? '<p class="text-muted">No runners in this collection</p>'
                : `
              <div class="runners-list">
                ${runners
                  .map(
                    (runner) => `
                  <div class="runner-item">
                    <div class="runner-info">
                      <strong>${this.escapeHtml(runner.name)}</strong>
                      <span class="text-muted">${
                        runner.total_requests || 0
                      } requests</span>
                    </div>
                    <div class="runner-stats">
                      <span class="badge ${
                        runner.is_active ? "badge-success" : "badge-secondary"
                      }">
                        ${runner.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            `
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="closeViewModalBtn">Close</button>
          </div>
        `;

        modalContent.innerHTML = content;
        modal.style.display = "flex";

        // Close handlers
        document
          .getElementById("closeViewModal")
          .addEventListener("click", () => {
            modal.style.display = "none";
          });
        document
          .getElementById("closeViewModalBtn")
          .addEventListener("click", () => {
            modal.style.display = "none";
          });
      } else {
        throw new Error(response?.error || "Collection not found");
      }
    } catch (error) {
      console.error("[Collections] Failed to view collection:", error);
      this.showNotification("Failed to load collection details", "error");
    }
  }

  async runCollection(collectionId) {
    try {
      console.log("[Collections] Running collection with ID:", collectionId);

      // Get collection details with runners
      const response = await browserAPI.runtime.sendMessage({
        action: "getCollection",
        collectionId: collectionId,
      });

      if (!response || !response.success || !response.collection) {
        throw new Error(response?.error || "Collection not found");
      }

      const collection = response.collection;
      const runners = collection.runners || [];

      if (runners.length === 0) {
        this.showNotification("This collection has no runners", "warning");
        return;
      }

      // Show progress modal
      const modal = document.getElementById("collectionViewModal");
      if (!modal) return;

      const modalContent = modal.querySelector(".modal-content");
      if (!modalContent) {
        console.error("[Collections] Modal content wrapper not found");
        return;
      }

      const content = `
        <div class="modal-header">
          <h3>
            <i class="fas fa-play" style="color: ${
              collection.color || "#007bff"
            }"></i>
            Running: ${this.escapeHtml(collection.name)}
          </h3>
          <button class="modal-close" id="closeRunModal">×</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <strong>Progress: <span id="runProgressText">0/${
              runners.length
            }</span></strong>
            <div style="background: var(--border-color); height: 8px; border-radius: 4px; margin-top: 8px; overflow: hidden;">
              <div id="runProgressBar" style="width: 0%; height: 100%; background: var(--primary-color); transition: width 0.3s ease;"></div>
            </div>
          </div>
          <div id="runProgress" class="run-progress" style="max-height: 400px; overflow-y: auto;">
            ${runners
              .map(
                (runner, index) => `
              <div class="run-item" data-runner-index="${index}">
                <span class="run-status">⏳</span>
                <span class="run-name">${this.escapeHtml(runner.name)}</span>
                <span class="run-result"></span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="closeRunModalBtn">Close</button>
        </div>
      `;

      modalContent.innerHTML = content;
      modal.style.display = "flex";

      // Close handler
      const closeModal = () => {
        modal.style.display = "none";
      };
      document
        .getElementById("closeRunModal")
        .addEventListener("click", closeModal);
      document
        .getElementById("closeRunModalBtn")
        .addEventListener("click", closeModal);

      // Execute runners sequentially
      let successCount = 0;
      let errorCount = 0;
      const progressBar = document.getElementById("runProgressBar");
      const progressText = document.getElementById("runProgressText");

      for (let i = 0; i < runners.length; i++) {
        const runner = runners[i];
        const runItem = document.querySelector(`[data-runner-index="${i}"]`);
        const statusIcon = runItem.querySelector(".run-status");
        const resultSpan = runItem.querySelector(".run-result");

        // Update status to running
        statusIcon.textContent = "▶️";
        runItem.style.background = "#fff3cd";
        runItem.scrollIntoView({ behavior: "smooth", block: "nearest" });

        try {
          console.log(
            `[Collections] Running runner ${i + 1}/${runners.length}:`,
            runner.name
          );

          // Execute the runner
          const runResponse = await browserAPI.runtime.sendMessage({
            action: "runRunner",
            runnerId: runner.id,
          });

          if (runResponse && runResponse.success) {
            successCount++;
            statusIcon.textContent = "✅";
            runItem.style.background = "#d4edda";

            const result = runResponse.result || {};
            resultSpan.textContent = `${result.status || "N/A"} - ${
              result.duration || 0
            }ms`;
            resultSpan.style.color = "#28a745";
          } else {
            throw new Error(runResponse?.error || "Runner execution failed");
          }
        } catch (error) {
          errorCount++;
          statusIcon.textContent = "❌";
          runItem.style.background = "#f8d7da";
          resultSpan.textContent = error.message;
          resultSpan.style.color = "#dc3545";
          console.error(`[Collections] Failed to run runner:`, error);
        }

        // Update progress
        const completed = i + 1;
        const percentage = (completed / runners.length) * 100;
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressText)
          progressText.textContent = `${completed}/${runners.length}`;

        // Small delay between runners
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Show summary (clear any existing summary first)
      const runProgressDiv = document.getElementById("runProgress");
      const existingSummary = runProgressDiv.querySelector(".run-summary");
      if (existingSummary) {
        existingSummary.remove();
      }

      const summary = document.createElement("div");
      summary.className = "run-summary";
      summary.innerHTML = `
        <hr>
        <p><strong>Execution Complete</strong></p>
        <p>✅ Successful: ${successCount} | ❌ Failed: ${errorCount}</p>
      `;
      runProgressDiv.appendChild(summary);

      this.showNotification(
        `Collection executed: ${successCount} succeeded, ${errorCount} failed`,
        errorCount > 0 ? "warning" : "success"
      );
    } catch (error) {
      console.error("[Collections] Failed to run collection:", error);
      this.showNotification(
        "Failed to run collection: " + error.message,
        "error"
      );
    }
  }

  async deleteCollection(collectionId) {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) return;

    const runnerCount = collection.runner_count || 0;
    const confirmMsg =
      runnerCount > 0
        ? `Delete collection "${collection.name}"?\n\n${runnerCount} runner(s) will be unlinked (but not deleted).`
        : `Delete collection "${collection.name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      const response = await browserAPI.runtime.sendMessage({
        action: "deleteCollection",
        collectionId: collectionId,
      });

      if (response && response.success) {
        this.showNotification("Collection deleted successfully", "success");
        await this.loadCollections();
      } else {
        throw new Error(response?.error || "Failed to delete collection");
      }
    } catch (error) {
      console.error("[Collections] Failed to delete:", error);
      this.showNotification("Failed to delete collection", "error");
    }
  }

  async saveCollection() {
    const collectionId = document.getElementById("collectionId").value;
    const name = document.getElementById("collectionName").value.trim();
    const description = document
      .getElementById("collectionDescription")
      .value.trim();
    const color = document.getElementById("collectionColor").value;
    const icon = document.getElementById("collectionIcon").value;

    // Get selected runners
    const selectedRunners = Array.from(
      document.querySelectorAll(
        '#collectionRunnersList input[type="checkbox"]:checked'
      )
    ).map((checkbox) => checkbox.value);

    if (!name) {
      this.showNotification("Collection name is required", "error");
      return;
    }

    try {
      let response;

      if (collectionId) {
        // Update existing collection
        response = await browserAPI.runtime.sendMessage({
          action: "updateCollection",
          collectionId: collectionId,
          updates: { name, description, color, icon },
        });

        // Update runner assignments - first get existing runners to unassign them
        if (response && response.success) {
          // Get current runners from selectedCollection (loaded during edit)
          const currentRunnerIds =
            this.selectedCollection?.runners?.map((r) => r.id) || [];

          // Remove runners that are no longer selected
          const runnersToRemove = currentRunnerIds.filter(
            (id) => !selectedRunners.includes(id)
          );
          if (runnersToRemove.length > 0) {
            await browserAPI.runtime.sendMessage({
              action: "removeRunnersFromCollection",
              runnerIds: runnersToRemove,
            });
          }

          // Assign newly selected runners
          if (selectedRunners.length > 0) {
            await browserAPI.runtime.sendMessage({
              action: "assignRunnersToCollection",
              runnerIds: selectedRunners,
              collectionId: collectionId,
            });
          }
        }
      } else {
        // Create new collection
        response = await browserAPI.runtime.sendMessage({
          action: "createCollection",
          name: name,
          description: description,
          config: { color, icon },
        });

        // Assign runners to new collection
        if (response && response.success && response.collection) {
          await browserAPI.runtime.sendMessage({
            action: "assignRunnersToCollection",
            runnerIds: selectedRunners,
            collectionId: response.collection.id,
          });
        }
      }

      if (response && response.success) {
        this.showNotification(
          collectionId
            ? "Collection updated successfully"
            : "Collection created successfully",
          "success"
        );
        this.hideCollectionModal();
        await this.loadCollections();
      } else {
        throw new Error(response?.error || "Failed to save collection");
      }
    } catch (error) {
      console.error("[Collections] Failed to save:", error);
      this.showNotification("Failed to save collection", "error");
    }
  }

  async loadAvailableRunners() {
    try {
      const response = await browserAPI.runtime.sendMessage({
        action: "getAllRunners",
        filters: {},
      });

      if (response && response.success) {
        this.availableRunners = response.runners || [];
      }
    } catch (error) {
      console.error("[Collections] Failed to load runners:", error);
      this.availableRunners = [];
    }
  }

  showCollectionModal() {
    const modal = document.getElementById("collectionModal");
    if (modal) {
      modal.style.display = "block";
      // Render runner checkboxes
      this.renderRunnerCheckboxes();
    }
  }

  renderRunnerCheckboxes() {
    const container = document.getElementById("collectionRunnersList");
    if (!container) return;

    if (this.availableRunners.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; padding: 20px; color: var(--text-secondary);"><i class="fas fa-info-circle"></i><p>No runners available. Create runners first.</p></div>';
      return;
    }

    // Get currently selected runners (if editing)
    const selectedRunnerIds =
      this.selectedCollection?.runners?.map((r) => r.id) || [];

    container.innerHTML = this.availableRunners
      .map(
        (runner) => `
      <div class="runner-checkbox-item">
        <input type="checkbox" 
               id="runner-${runner.id}" 
               value="${runner.id}"
               ${selectedRunnerIds.includes(runner.id) ? "checked" : ""}>
        <label class="runner-checkbox-label" for="runner-${runner.id}">
          <div class="runner-checkbox-name">${this.escapeHtml(
            runner.name
          )}</div>
          <div class="runner-checkbox-meta">
            ${runner.method || "GET"} - ${runner.total_requests || 0} requests
          </div>
        </label>
      </div>
    `
      )
      .join("");
  }

  hideCollectionModal() {
    const modal = document.getElementById("collectionModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  showNotification(message, type = "info") {
    // Reuse the global notification system if available
    if (
      typeof window.showNotification === "function" &&
      window.showNotification !== this.showNotification
    ) {
      window.showNotification(message, type);
    } else {
      // Fallback to simple alert
      alert(`${type.toUpperCase()}: ${message}`);
    }
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  cleanup() {
    // Cleanup if needed
  }
}

// Initialize when Collections sub-tab is first shown (lazy initialization like Runners)
let collectionsManager = null;

document.addEventListener("DOMContentLoaded", () => {
  // Wait for the Collections sub-tab button to be clicked
  const collectionsSubTab = document.querySelector(
    '[data-subtab="collections-list"]'
  );
  if (collectionsSubTab) {
    console.log(
      "[Collections] Found collections sub-tab button, adding listener"
    );
    collectionsSubTab.addEventListener(
      "click",
      () => {
        console.log("[Collections] Sub-tab clicked, initializing...");
        if (!collectionsManager) {
          collectionsManager = new CollectionsManager();
          window.collectionsManager = collectionsManager; // Expose globally
          collectionsManager.initialize();
        }
      },
      { once: true }
    );
  } else {
    console.error("[Collections] Could not find collections sub-tab button!");
  }
});

// Export for use in other modules
window.collectionsManager = null;
export default CollectionsManager;
