// Popup Event Handlers - Set up all event listeners

import {
  runtime,
  tabs,
} from "../../background/compat/browser-compat.js";
import {
  loadPageSummary,
  loadPagesForDomain,
  loadTrackedSites,
  loadResourceUsage,
  rerenderEndpoints,
} from "./popup-data.js";
import {
  exportDomainData,
  exportAsHAR,
  setCurrentQuickFilter,
} from "./popup-export.js";
import { showNotification } from "./popup-utils.js";
import { clearRequestsList } from "./popup-requests.js";

/**
 * Setup all event listeners
 */
export function setupEventListeners() {
  setupModeToggle();
  setupRefreshButton();
  setupCaptureToggle();
  setupFilters();
  setupQuickActions();
  setupFooterLinks();
  setupQAQuickView();
  setupQuickFilterChips();
  setupEndpointSort();
  setupHARExport();
  setupRequestsPanel();
  loadTrackedSites();
}

/**
 * Setup mode toggle / resource usage
 */
function setupModeToggle() {
  loadResourceUsage();

  // Time window selector
  document.getElementById("timeWindowSelect")?.addEventListener("change", () => {
    loadPageSummary().catch(() => {});
  });
}

/**
 * Setup capture toggle button
 */
async function setupCaptureToggle() {
  const btn = document.getElementById("captureToggleBtn");
  if (!btn) return;

  // Load current state
  try {
    const response = await runtime.sendMessage({ action: "getCaptureSettings" });
    const enabled = response?.settings?.enabled !== false;
    btn.classList.toggle("capturing", enabled);
    btn.setAttribute("aria-label", enabled ? "Capturing (click to pause)" : "Capture paused (click to resume)");
  } catch (e) {
    console.error("Failed to load capture state:", e);
  }

  btn.addEventListener("click", async () => {
    const isCapturing = btn.classList.contains("capturing");
    try {
      const response = await runtime.sendMessage({
        action: "updateCaptureSettings",
        settings: { enabled: !isCapturing },
      });
      if (response?.success) {
        btn.classList.toggle("capturing", !isCapturing);
        btn.setAttribute("aria-label", !isCapturing ? "Capturing (click to pause)" : "Capture paused (click to resume)");
        showNotification(!isCapturing ? "Capture resumed" : "Capture paused", false);
      }
    } catch (e) {
      console.error("Failed to toggle capture:", e);
    }
  });
}

/**
 * Setup refresh settings button
 */
function setupRefreshButton() {
  document
    .getElementById("refreshSettingsBtn")
    ?.addEventListener("click", async function () {
      const btn = this;
      const icon = btn.querySelector("i");

      try {
        btn.classList.add("syncing");
        btn.disabled = true;

        const response = await runtime.sendMessage({
          action: "syncSettingsToStorage",
        });

        if (response && response.success) {
          icon.className = "fas fa-check";
          setTimeout(() => {
            icon.className = "fas fa-sync-alt";
            btn.classList.remove("syncing");
            btn.disabled = false;
          }, 1500);

          console.log("Settings refreshed:", response.message);
        } else {
          throw new Error(response?.error || "Failed to refresh settings");
        }
      } catch (error) {
        console.error("Failed to refresh settings:", error);
        icon.className = "fas fa-times";
        setTimeout(() => {
          icon.className = "fas fa-sync-alt";
          btn.classList.remove("syncing");
          btn.disabled = false;
        }, 1500);
      }
    });
}

/**
 * Setup filters (request type, page)
 */
function setupFilters() {
  // Request Type Filter
  document
    .getElementById("requestTypeFilter")
    ?.addEventListener("change", async () => {
      await loadPageSummary();
    });

  // Page Filter
  document
    .getElementById("pageFilter")
    ?.addEventListener("change", async () => {
      await loadPageSummary();
    });

  // Load pages for current domain
  loadPagesForDomain().catch((err) =>
    console.error("Failed to load pages:", err)
  );
}

/**
 * Setup quick actions (DevTools, Dashboard, Help)
 */
function setupQuickActions() {
  document.getElementById("openDevtools")?.addEventListener("click", () => {
    runtime.openOptionsPage();
  });

  document.getElementById("openDashboard")?.addEventListener("click", () => {
    runtime.openOptionsPage();
  });

  document.getElementById("openHelp")?.addEventListener("click", () => {
    tabs.create({ url: runtime.getURL("help/help.html") });
  });
}

/**
 * Setup footer links (Privacy, Report Issue)
 */
function setupFooterLinks() {
  document.getElementById("viewPrivacy")?.addEventListener("click", (e) => {
    e.preventDefault();
    tabs.create({
      url: "https://github.com/ModernaCyber/Universal-Request-Analyzer",
    });
  });

  document.getElementById("reportIssue")?.addEventListener("click", (e) => {
    e.preventDefault();
    tabs.create({
      url: "https://github.com/ModernaCyber/Universal-Request-Analyzer/issues",
    });
  });
}

/**
 * Setup QA Quick View controls
 */
function setupQAQuickView() {
  // Domain selector
  document
    .getElementById("siteSelect")
    ?.addEventListener("change", async (e) => {
      const selectedDomain = e.target.value;
      const navigateBtn = document.getElementById("navigateToSite");
      const exportBtn = document.getElementById("exportDomainData");

      if (selectedDomain) {
        navigateBtn?.removeAttribute("disabled");
        exportBtn?.removeAttribute("disabled");
      } else {
        navigateBtn?.setAttribute("disabled", "true");
        exportBtn?.setAttribute("disabled", "true");
      }

      await loadPageSummary();
    });

  // Navigate to selected domain
  document
    .getElementById("navigateToSite")
    ?.addEventListener("click", async () => {
      const siteSelect = document.getElementById("siteSelect");
      const selectedDomain = siteSelect?.value;

      if (selectedDomain) {
        const currentTabs = await tabs.query({
          active: true,
          currentWindow: true,
        });
        if (currentTabs[0]) {
          tabs.update(currentTabs[0].id, { url: selectedDomain });
        }
      }
    });

  // Export domain data
  document
    .getElementById("exportDomainData")
    ?.addEventListener("click", async () => {
      const siteSelect = document.getElementById("siteSelect");
      const selectedDomain = siteSelect?.value;

      if (!selectedDomain) {
        showNotification("Please select a domain first", true);
        return;
      }

      try {
        let domain = selectedDomain;
        try {
          const url = new URL(selectedDomain);
          domain = url.hostname;
        } catch (e) {
          // Use as-is if not a valid URL
        }

        await exportDomainData(domain);
      } catch (error) {
        console.error("Export error:", error);
        showNotification("Export failed", true);
      }
    });
}

/**
 * Setup quick filter chips
 */
function setupQuickFilterChips() {
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", async function () {
      // Toggle active within same filter group (status or type)
      const filterType = this.dataset.filterType;
      document.querySelectorAll(`.chip[data-filter-type="${filterType}"]`)
        .forEach((c) => c.classList.remove("active"));
      this.classList.add("active");

      await applyQuickFilter(this.dataset.filter);
    });
  });
}

/**
 * Apply quick filter
 * @param {string} filterType - Filter type (all, 2xx, 4xx, 5xx, xhr, fetch, js, css, img)
 */
async function applyQuickFilter(filterType) {
  setCurrentQuickFilter(filterType);

  // Update the advanced filter based on quick filter
  const requestTypeFilter = document.getElementById("requestTypeFilter");

  if (filterType === "all") {
    if (requestTypeFilter) requestTypeFilter.value = "";
  } else if (filterType === "xhr") {
    if (requestTypeFilter) requestTypeFilter.value = "xmlhttprequest";
  } else if (filterType === "fetch") {
    if (requestTypeFilter) requestTypeFilter.value = "fetch";
  } else if (filterType === "js") {
    if (requestTypeFilter) requestTypeFilter.value = "script";
  } else if (filterType === "css") {
    if (requestTypeFilter) requestTypeFilter.value = "stylesheet";
  } else if (filterType === "img") {
    if (requestTypeFilter) requestTypeFilter.value = "image";
  }
  // For status filters (2xx, 4xx, 5xx), we keep the type filter as-is
  // The backend will handle status filtering via currentQuickFilter

  await loadPageSummary();
}

/**
 * Setup endpoint sort toggle (Slowest / Top Errors)
 */
function setupEndpointSort() {
  ['epSortSlow', 'epSortError'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', function () {
      document.querySelectorAll('[data-ep-sort]').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      rerenderEndpoints(this.dataset.epSort);
    });
  });
}

/**
 * Wire clear + view-all buttons in the Recent Requests panel
 */
function setupRequestsPanel() {
  document.getElementById("clearRequestsBtn")?.addEventListener("click", clearRequestsList);
  document.getElementById("viewAllRequestsBtn")?.addEventListener("click", () => runtime.openOptionsPage());
}

/**
 * Setup HAR export button
 */
function setupHARExport() {
  document
    .getElementById("exportHARBtn")
    ?.addEventListener("click", async () => {
      await exportAsHAR();
    });
}
