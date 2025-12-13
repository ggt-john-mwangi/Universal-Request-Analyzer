// Popup Event Handlers - Set up all event listeners

import {
  storage,
  runtime,
  tabs,
} from '../../background/compat/browser-compat.js';
import { setViewMode } from './popup-ui.js';
import {
  loadPageSummary,
  loadPagesForDomain,
  loadTrackedSites,
  loadResourceUsage,
} from './popup-data.js';
import {
  exportDomainData,
  exportPageData,
  exportAsHAR,
  setCurrentQuickFilter,
} from './popup-export.js';
import { showNotification } from './popup-utils.js';

/**
 * Setup all event listeners
 */
export function setupEventListeners() {
  setupModeToggle();
  setupRefreshButton();
  setupFilters();
  setupQuickActions();
  setupFooterLinks();
  setupQAQuickView();
  setupLegacyButtons();
  setupQuickFilterChips();
  setupHARExport();
  loadTrackedSites();
}

/**
 * Setup mode toggle (Simple/Advanced)
 */
function setupModeToggle() {
  const simpleModeBtn = document.getElementById('simpleModeBtn');
  const advancedModeBtn = document.getElementById('advancedModeBtn');

  if (simpleModeBtn && advancedModeBtn) {
    // Load saved mode preference
    storage
      .get(['viewMode'])
      .then((result) => {
        const mode = result.viewMode || 'simple';
        setViewMode(mode);
      })
      .catch((err) => console.error('Failed to load view mode:', err));

    simpleModeBtn.addEventListener('click', () => {
      setViewMode('simple');
      storage.set({ viewMode: 'simple' });
    });

    advancedModeBtn.addEventListener('click', () => {
      setViewMode('advanced');
      storage.set({ viewMode: 'advanced' });
    });
  }

  // Load resource usage
  loadResourceUsage();
}

/**
 * Setup refresh settings button
 */
function setupRefreshButton() {
  document
    .getElementById('refreshSettingsBtn')
    ?.addEventListener('click', async function () {
      const btn = this;
      const icon = btn.querySelector('i');

      try {
        btn.classList.add('syncing');
        btn.disabled = true;

        const response = await runtime.sendMessage({
          action: 'syncSettingsToStorage',
        });

        if (response && response.success) {
          icon.className = 'fas fa-check';
          setTimeout(() => {
            icon.className = 'fas fa-sync-alt';
            btn.classList.remove('syncing');
            btn.disabled = false;
          }, 1500);

          console.log('Settings refreshed:', response.message);
        } else {
          throw new Error(response?.error || 'Failed to refresh settings');
        }
      } catch (error) {
        console.error('Failed to refresh settings:', error);
        icon.className = 'fas fa-times';
        setTimeout(() => {
          icon.className = 'fas fa-sync-alt';
          btn.classList.remove('syncing');
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
    .getElementById('requestTypeFilter')
    ?.addEventListener('change', async () => {
      await loadPageSummary();
    });

  // Page Filter
  document
    .getElementById('pageFilter')
    ?.addEventListener('change', async () => {
      await loadPageSummary();
    });

  // Load pages for current domain
  loadPagesForDomain().catch((err) =>
    console.error('Failed to load pages:', err)
  );
}

/**
 * Setup quick actions (DevTools, Dashboard, Help)
 */
function setupQuickActions() {
  document.getElementById('openDevtools')?.addEventListener('click', () => {
    runtime.openOptionsPage();
  });

  document.getElementById('openDashboard')?.addEventListener('click', () => {
    runtime.openOptionsPage();
  });

  document.getElementById('openHelp')?.addEventListener('click', () => {
    tabs.create({ url: runtime.getURL('help/help.html') });
  });
}

/**
 * Setup footer links (Privacy, Report Issue)
 */
function setupFooterLinks() {
  document.getElementById('viewPrivacy')?.addEventListener('click', (e) => {
    e.preventDefault();
    tabs.create({
      url: 'https://github.com/ModernaCyber/Universal-Request-Analyzer',
    });
  });

  document.getElementById('reportIssue')?.addEventListener('click', (e) => {
    e.preventDefault();
    tabs.create({
      url: 'https://github.com/ModernaCyber/Universal-Request-Analyzer/issues',
    });
  });
}

/**
 * Setup QA Quick View controls
 */
function setupQAQuickView() {
  // Domain selector
  document
    .getElementById('siteSelect')
    ?.addEventListener('change', async (e) => {
      const selectedDomain = e.target.value;
      const navigateBtn = document.getElementById('navigateToSite');
      const exportBtn = document.getElementById('exportDomainData');

      if (selectedDomain) {
        navigateBtn?.removeAttribute('disabled');
        exportBtn?.removeAttribute('disabled');
      } else {
        navigateBtn?.setAttribute('disabled', 'true');
        exportBtn?.setAttribute('disabled', 'true');
      }

      await loadPageSummary();
    });

  // Navigate to selected domain
  document
    .getElementById('navigateToSite')
    ?.addEventListener('click', async () => {
      const siteSelect = document.getElementById('siteSelect');
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

  // View details button
  document.getElementById('viewDetailsBtn')?.addEventListener('click', () => {
    runtime.openOptionsPage();
  });

  // Export domain data
  document
    .getElementById('exportDomainData')
    ?.addEventListener('click', async () => {
      const siteSelect = document.getElementById('siteSelect');
      const selectedDomain = siteSelect?.value;

      if (!selectedDomain) {
        showNotification('Please select a domain first', true);
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
        console.error('Export error:', error);
        showNotification('Export failed', true);
      }
    });
}

/**
 * Setup legacy buttons
 */
function setupLegacyButtons() {
  document.getElementById('viewRequests')?.addEventListener('click', () => {
    runtime.openOptionsPage();
  });

  document.getElementById('viewAnalytics')?.addEventListener('click', () => {
    runtime.openOptionsPage();
  });

  document.getElementById('exportData')?.addEventListener('click', async () => {
    await exportPageData();
  });
}

/**
 * Setup quick filter chips
 */
function setupQuickFilterChips() {
  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', async function () {
      // Toggle active state
      document
        .querySelectorAll('.filter-chip')
        .forEach((c) => c.classList.remove('active'));
      this.classList.add('active');

      // Apply filter
      const filterType = this.dataset.filter;
      await applyQuickFilter(filterType);
    });
  });
}

/**
 * Apply quick filter
 * @param {string} filterType - Filter type
 */
async function applyQuickFilter(filterType) {
  setCurrentQuickFilter(filterType);

  // Update the advanced filter based on quick filter
  const requestTypeFilter = document.getElementById('requestTypeFilter');

  if (filterType === 'all') {
    if (requestTypeFilter) requestTypeFilter.value = '';
  } else if (filterType === 'xhr') {
    if (requestTypeFilter) requestTypeFilter.value = 'xmlhttprequest';
  }

  await loadPageSummary();
}

/**
 * Setup HAR export button
 */
function setupHARExport() {
  document
    .getElementById('exportHARBtn')
    ?.addEventListener('click', async () => {
      await exportAsHAR();
    });
}
