// Popup Data Functions - Handle data loading and communication with background

import logger from "../../lib/utils/logger.js";
import { runtime, tabs } from "../../background/compat/browser-compat.js";
import { currentQuickFilter } from "./popup-export.js";
import {
  updatePageSummary,
  updateDetailedViews,
  updateRecentErrorsDisplay,
  updateWebVitalsDisplay,
  updatePercentilesDisplay,
  updateEndpointsDisplay,
} from "./popup-ui.js";
import { showNotification } from "./popup-utils.js";
import {
  shouldShowEmptyState,
  showEmptyState,
  hideEmptyState,
} from "./popup-empty-state.js";

let refreshInterval = null;
let _lastEndpoints = [];
let _baselineStats = null;

export function rerenderEndpoints(sort) {
  updateEndpointsDisplay(_lastEndpoints, sort);
}

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
      return;
    }

    // Get time window selection
    const timeWindow = parseInt(document.getElementById("timeWindowSelect")?.value || 30);

    // Get selected filters — "api" means XHR+Fetch; pass "" to backend and filter in UI
    const requestTypeFilter = document.getElementById("requestTypeFilter");
    const rawType = requestTypeFilter ? requestTypeFilter.value : "api";
    const requestType = rawType === "api" ? "" : rawType;

    const pageFilter = document.getElementById("pageFilter");
    const selectedPage = pageFilter ? pageFilter.value : "";

    // Get status filter from quick filter chips
    const statusFilter = ["2xx", "4xx", "5xx"].includes(currentQuickFilter)
      ? currentQuickFilter
      : "";

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
        statusFilter: statusFilter,
        timeWindow,
      },
    });

    if (response && response.success && response.stats) {
      // Check if we should show empty state
      if (shouldShowEmptyState(response.stats)) {
        showEmptyState();
      } else {
        hideEmptyState();
        const s = response.stats;
        let delta = null;
        if (_baselineStats) {
          const prevErr = _baselineStats.totalRequests > 0 ? (_baselineStats.errorCount || 0) / _baselineStats.totalRequests * 100 : 0;
          const currErr = s.totalRequests > 0 ? (s.errorCount || 0) / s.totalRequests * 100 : 0;
          delta = {
            requests: _baselineStats.totalRequests > 0 ? ((s.totalRequests - _baselineStats.totalRequests) / _baselineStats.totalRequests * 100) : 0,
            response: _baselineStats.avgResponse > 0 ? (((s.avgResponse||0) - _baselineStats.avgResponse) / _baselineStats.avgResponse * 100) : 0,
            errors:   prevErr > 0 ? ((currErr - prevErr) / prevErr * 100) : 0,
          };
        } else {
          _baselineStats = { totalRequests: s.totalRequests || 0, avgResponse: s.avgResponse || 0, errorCount: s.errorCount || 0 };
        }
        updatePageSummary(s, delta);
        updateDetailedViews(s);
        loadWebVitals(filterDomain, timeWindow).catch(() => {});
        loadPercentilesAndEndpoints(filterDomain, timeWindow).catch(() => {});
      }

      // Start auto-refresh only on first successful load
      if (!refreshInterval) {
        startAutoRefresh();
      }
    } else {
      logger.warn("No stats available, showing defaults");
      // Show empty state
      showEmptyState();
    }
  } catch (error) {
    // Stop refresh loop on extension context invalidation
    if (error.message?.includes("Extension context invalidated")) {
      logger.debug("Extension context invalidated, stopping refresh");
      stopAutoRefresh();
      return;
    }
    logger.error("Failed to load page summary:", error);
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

    const safeDomain = currentDomain.replace(/'/g, "''");
    const response = await runtime.sendMessage({
      action: "executeDirectQuery",
      query: `
        SELECT DISTINCT page_url, COUNT(*) as request_count
        FROM bronze_requests
        WHERE domain = '${safeDomain}'
        AND page_url IS NOT NULL
        AND timestamp > ${Date.now() - 7 * 24 * 60 * 60 * 1000}
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
    logger.error("Failed to load pages for domain:", error);
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

    // Fetch unique domains from database
    const response = await runtime.sendMessage({
      action: "executeDirectQuery",
      query: `
        SELECT domain, COUNT(*) as request_count
        FROM bronze_requests 
        WHERE domain IS NOT NULL 
          AND domain != '' 
          AND timestamp > ${sevenDaysAgo}
        GROUP BY domain
        ORDER BY request_count DESC
        LIMIT 20
      `,
    });

    if (response && response.success) {
      if (response.data && response.data.length > 0) {
        response.data.forEach((row) => {
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
        logger.warn(
          "Query successful but no domains found - database may be empty or domains are NULL"
        );
      }
    } else {
      logger.error("Query failed:", response?.error);
    }
  } catch (error) {
    logger.error("Failed to load tracked sites:", error);
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
    logger.error("Failed to load resource usage:", error);
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

    // Get recent errors — use same time window as the main stats selector
    const timeWindow = parseInt(document.getElementById("timeWindowSelect")?.value || 30);
    const response = await runtime.sendMessage({
      action: "getRecentErrors",
      data: {
        url: currentTab.url,
        timeRange: timeWindow * 60 * 1000,
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
    logger.error("Failed to load recent errors:", error);
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
    try {
      if (!runtime.id) { stopAutoRefresh(); return; }
    } catch { stopAutoRefresh(); return; }
    loadPageSummary().catch((error) => {
      if (error.message?.includes("Extension context invalidated")) stopAutoRefresh();
    });
    updateRecentErrors().catch(() => {});
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

/**
 * Load percentiles and endpoint drilldown for the Advanced section
 */
export async function loadPercentilesAndEndpoints(domain, timeWindow) {
  const timeRange = parseInt(timeWindow || 30) * 60;
  const [pctRes, epRes] = await Promise.allSettled([
    runtime.sendMessage({ action: 'getPercentilesAnalysis', filters: { domain, timeRange } }),
    runtime.sendMessage({ action: 'getEndpointAnalysis', filters: { domain, timeRange } }),
  ]);

  if (pctRes.status === 'fulfilled' && pctRes.value?.success) {
    updatePercentilesDisplay(pctRes.value.percentiles);
  }

  if (epRes.status === 'fulfilled' && epRes.value?.success) {
    const endpoints = epRes.value.endpoints || [];
    _lastEndpoints = endpoints;
    const activeSort = document.getElementById('epSortError')?.classList.contains('active') ? 'error' : 'slow';
    updateEndpointsDisplay(endpoints, activeSort);
  }
}

/**
 * Load and display Core Web Vitals for the current domain
 */
export async function loadWebVitals(domain, timeWindow) {
  try {
    const timeRange = parseInt(timeWindow || 30) * 60; // seconds
    const response = await runtime.sendMessage({
      action: 'getWebVitals',
      filters: { domain, timeRange },
    });
    if (response?.success && response.vitals) {
      updateWebVitalsDisplay(response.vitals);
    }
  } catch {}
}

