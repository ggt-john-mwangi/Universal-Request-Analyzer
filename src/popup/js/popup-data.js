// Popup Data Functions - Handle data loading and communication with background

import { runtime, tabs } from "../../background/compat/browser-compat.js";
import {
  updatePageSummary,
  updateDetailedViews,
  updateRecentErrorsDisplay,
} from "./popup-ui.js";
import { showNotification } from "./popup-utils.js";
import { shouldShowEmptyState, showEmptyState, hideEmptyState } from "./popup-empty-state.js";

let refreshInterval = null;

/**
 * Load page summary statistics
 */
export async function loadPageSummary() {
  const summarySection = document.querySelector(".page-summary");

  try {
    // Show loading state
    if (summarySection) {
      summarySection.classList.add("loading");
    }

    // Get current tab
    const currentTabs = await tabs.query({ active: true, currentWindow: true });
    const currentTab = currentTabs[0];

    if (!currentTab || !currentTab.url) {
      console.log("No current tab or URL");
      return;
    }

    console.log("Loading page summary for:", currentTab.url);

    // Get selected filters
    const requestTypeFilter = document.getElementById("requestTypeFilter");
    const requestType = requestTypeFilter ? requestTypeFilter.value : "";

    const pageFilter = document.getElementById("pageFilter");
    const selectedPage = pageFilter ? pageFilter.value : "";

    // Get domain filter from QA Quick View
    const siteSelect = document.getElementById("siteSelect");
    const selectedDomainUrl = siteSelect ? siteSelect.value : "";
    let filterDomain = new URL(currentTab.url).hostname;

    // Override domain if QA Quick View has a selection
    if (selectedDomainUrl) {
      try {
        const url = new URL(selectedDomainUrl);
        filterDomain = url.hostname;
      } catch (e) {
        filterDomain = selectedDomainUrl;
      }
    }

    // Get detailed filtered stats from background
    const response = await runtime.sendMessage({
      action: "getPageStats",
      data: {
        url: selectedPage || currentTab.url,
        tabId: currentTab.id,
        requestType: requestType,
        domain: filterDomain,
      },
    });

    console.log("Page stats response:", response);

    if (response && response.success && response.stats) {
      // Check if we should show empty state
      if (shouldShowEmptyState(response.stats)) {
        showEmptyState();
      } else {
        hideEmptyState();
        updatePageSummary(response.stats);
        updateDetailedViews(response.stats);
      }

      // Start auto-refresh only on first successful load
      if (!refreshInterval) {
        startAutoRefresh();
      }
    } else {
      console.warn("No stats available, showing defaults");
      // Show empty state
      showEmptyState();
    }
  } catch (error) {
    // Stop refresh loop on extension context invalidation
    if (error.message?.includes("Extension context invalidated")) {
      console.log("Extension context invalidated, stopping refresh");
      stopAutoRefresh();
      return;
    }
    console.error("Failed to load page summary:", error);
    showNotification("Failed to load statistics. Please try refreshing.", true);
  } finally {
    // Hide loading state
    if (summarySection) {
      summarySection.classList.remove("loading");
    }
  }
}

/**
 * Load pages for current domain
 */
export async function loadPagesForDomain() {
  try {
    const currentTabs = await tabs.query({ active: true, currentWindow: true });
    const currentTab = currentTabs[0];

    if (!currentTab || !currentTab.url) return;

    const url = new URL(currentTab.url);
    const currentDomain = url.hostname;

    // Update domain display
    const domainDisplay = document.getElementById("currentDomainDisplay");
    if (domainDisplay) {
      domainDisplay.textContent = currentDomain;
    }

    // Get pages for this domain
    const pageSelect = document.getElementById("pageFilter");
    if (!pageSelect) return;

    pageSelect.innerHTML = '<option value="">All Pages in Domain</option>';

    const response = await runtime.sendMessage({
      action: "executeDirectQuery",
      query: `
        SELECT DISTINCT page_url, COUNT(*) as request_count
        FROM bronze_requests
        WHERE domain = '${currentDomain}'
        AND page_url IS NOT NULL
        AND created_at > ${Date.now() - 7 * 24 * 60 * 60 * 1000}
        GROUP BY page_url
        ORDER BY request_count DESC
        LIMIT 20
      `,
    });

    if (
      response &&
      response.success &&
      response.data &&
      response.data.length > 0
    ) {
      response.data.forEach((row) => {
        if (row.page_url) {
          const option = document.createElement("option");
          option.value = row.page_url;

          try {
            const pageUrl = new URL(row.page_url);
            const path = pageUrl.pathname + pageUrl.search;
            const displayText =
              path.length > 40 ? path.substring(0, 37) + "..." : path;
            option.textContent = `${displayText} (${row.request_count})`;
          } catch {
            option.textContent = row.page_url;
          }

          pageSelect.appendChild(option);
        }
      });
    }
  } catch (error) {
    console.error("Failed to load pages for domain:", error);
  }
}

/**
 * Load tracked sites for QA selector
 */
export async function loadTrackedSites() {
  try {
    const siteSelect = document.getElementById("siteSelect");
    if (!siteSelect) return;

    // Reset dropdown
    siteSelect.innerHTML = '<option value="">All Domains</option>';

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // First check if there's any data at all
    const checkResponse = await runtime.sendMessage({
      action: "executeDirectQuery",
      query: `SELECT COUNT(*) as total FROM bronze_requests`,
    });

    console.log("Total requests in database:", checkResponse);

    // Fetch unique domains from database
    const response = await runtime.sendMessage({
      action: "executeDirectQuery",
      query: `
        SELECT domain, COUNT(*) as request_count
        FROM bronze_requests 
        WHERE domain IS NOT NULL 
          AND domain != '' 
          AND created_at > ${sevenDaysAgo}
        GROUP BY domain
        ORDER BY request_count DESC
        LIMIT 20
      `,
    });

    console.log("Site filter response:", response);

    if (response && response.success) {
      if (response.data && response.data.length > 0) {
        const domains = response.data;
        console.log(`Loaded ${domains.length} domains for site selector`);

        domains.forEach((row) => {
          const domain = row.domain;
          const count = row.request_count;
          if (domain) {
            const option = document.createElement("option");
            option.value = `https://${domain}`;
            option.textContent = `${domain} (${count} requests)`;
            siteSelect.appendChild(option);
          }
        });
      } else {
        console.warn(
          "Query successful but no domains found - database may be empty or domains are NULL"
        );
      }
    } else {
      console.error("Query failed:", response?.error);
    }
  } catch (error) {
    console.error("Failed to load tracked sites:", error);
  }
}

/**
 * Load resource usage statistics
 */
export async function loadResourceUsage() {
  try {
    const response = await runtime.sendMessage({
      action: "getDatabaseSize",
    });

    if (response && response.success) {
      const requestCount = response.records || 0;
      const sizeMB = response.size
        ? (response.size / (1024 * 1024)).toFixed(2)
        : "0";

      const requestCountEl = document.getElementById("requestCount");
      const storageSizeEl = document.getElementById("storageSize");

      if (requestCountEl) {
        requestCountEl.textContent = `${requestCount.toLocaleString()} / 10,000`;
      }
      if (storageSizeEl) {
        storageSizeEl.textContent = `${sizeMB} MB`;
      }
    }
  } catch (error) {
    console.error("Failed to load resource usage:", error);
  }
}

/**
 * Update recent errors from background
 */
export async function updateRecentErrors() {
  try {
    const currentTabs = await tabs.query({ active: true, currentWindow: true });
    const currentTab = currentTabs[0];

    if (!currentTab || !currentTab.url) return;

    // Get recent errors from background
    const response = await runtime.sendMessage({
      action: "getRecentErrors",
      data: {
        url: currentTab.url,
        timeRange: 300000, // Last 5 minutes in milliseconds
      },
    });

    if (
      response &&
      response.success &&
      response.errors &&
      response.errors.length > 0
    ) {
      updateRecentErrorsDisplay(response.errors);
    } else {
      updateRecentErrorsDisplay([]);
    }
  } catch (error) {
    console.error("Failed to load recent errors:", error);
    const container = document.getElementById("recentErrorsList");
    if (container) {
      container.innerHTML =
        '<p class="placeholder error-text">Failed to load errors</p>';
    }
  }
}

/**
 * Start auto-refresh for page summary
 */
export function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);

  refreshInterval = setInterval(() => {
    if (runtime.id) {
      loadPageSummary().catch((error) => {
        if (error.message?.includes("Extension context invalidated")) {
          stopAutoRefresh();
        }
      });
    } else {
      stopAutoRefresh();
    }
  }, 5000);
}

/**
 * Stop auto-refresh
 */
export function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
