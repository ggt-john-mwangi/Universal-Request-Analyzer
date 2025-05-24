import { sendMessageWithResponse } from "../../background/utils/message-handler";

export default function renderCaptureFilters() {
  const container = document.createElement("div");
  container.innerHTML = `
    <h2>Capture Filters</h2>

    <div class="option-row">
      <label>Request Types to Capture:</label>
      <div class="checkbox-group">
        <label><input type="checkbox" name="captureType" value="xmlhttprequest"> XHR</label>
        <label><input type="checkbox" name="captureType" value="fetch"> Fetch</label>
        <label><input type="checkbox" name="captureType" value="script"> Script</label>
        <label><input type="checkbox" name="captureType" value="stylesheet"> Stylesheet</label>
        <label><input type="checkbox" name="captureType" value="image"> Image</label>
        <label><input type="checkbox" name="captureType" value="font"> Font</label>
        <label><input type="checkbox" name="captureType" value="other"> Other</label>
      </div>
    </div>

    <div class="option-row">
      <label for="includeDomains">Include Domains:</label>
      <input type="text" id="includeDomains" placeholder="Leave empty to include all">
    </div>

    <div class="option-row">
      <label for="excludeDomains">Exclude Domains:</label>
      <input type="text" id="excludeDomains" placeholder="Leave empty to exclude none">
    </div>
  `;

  const createStatusElement = () => {
    let status = container.querySelector("#captureFiltersStatus");
    if (!status) {
      status = document.createElement("div");
      status.id = "captureFiltersStatus";
      status.className = "status-message";
      container.appendChild(status);
    }
    return status;
  };

  const showStatus = (message, success = true) => {
    const status = createStatusElement();
    status.textContent = message;
    status.style.display = "block";
    status.style.color = success ? "green" : "red";
    setTimeout(() => (status.style.display = "none"), 3000);
  };

  const saveCaptureFilters = async () => {
    const selectedTypes = Array.from(
      container.querySelectorAll('input[name="captureType"]:checked')
    ).map((input) => input.value);

    const includeDomains = container.querySelector("#includeDomains").value;
    const excludeDomains = container.querySelector("#excludeDomains").value;

    const filters = {
      includeTypes: selectedTypes,
      includeDomains: includeDomains
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      excludeDomains: excludeDomains
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      console.log("CaptureFilters:" + filters);
      const response = await sendMessageWithResponse("updateConfig", {
        captureFilters: filters,
      });
      showStatus(
        response.success
          ? "Capture filters saved."
          : "Error saving filters: " + (response.error || "Unknown error"),
        response.success
      );
    } catch (error) {
      showStatus("Unexpected error: " + error.message, false);
    }
  };

  const loadCaptureFilters = async () => {
    try {
      const response = await sendMessageWithResponse("getConfig");
      const filters = response.config?.captureFilters || {};

      // Set checkboxes for capture types
      (filters.includeTypes || []).forEach((type) => {
        const checkbox = container.querySelector(
          `input[name="captureType"][value="${type}"]`
        );
        if (checkbox) checkbox.checked = true;
      });

      // Set domain filters
      container.querySelector("#includeDomains").value = (
        filters.includeDomains || []
      ).join(", ");
      container.querySelector("#excludeDomains").value = (
        filters.excludeDomains || []
      ).join(", ");
    } catch (error) {
      showStatus("Failed to load filters: " + error.message, false);
    }
  };

  // Actions UI
  const actions = document.createElement("div");
  actions.className = "settings-actions";
  actions.innerHTML = `
    <button id="saveCaptureFilters" class="primary-btn">Save Filters</button>
    <button id="resetCaptureFilters" class="secondary-btn">Reset Filters</button>
  `;
  container.appendChild(actions);

  // Event listeners
  actions
    .querySelector("#saveCaptureFilters")
    .addEventListener("click", saveCaptureFilters);

  actions
    .querySelector("#resetCaptureFilters")
    .addEventListener("click", async () => {
      await loadCaptureFilters();
      showStatus("Filters reset to last saved.");
    });

  // Initial load
  loadCaptureFilters();

  return container;
}
