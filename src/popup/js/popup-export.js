// Popup Export Functions - Handle data export operations

import logger from '../../lib/utils/logger.js';
import { runtime, tabs } from '../../background/compat/browser-compat.js';
import { showNotification } from './popup-utils.js';

// Current quick filter state
export let currentQuickFilter = 'all';

/**
 * Set current quick filter
 * @param {string} filterType - Filter type
 */
export function setCurrentQuickFilter(filterType) {
  currentQuickFilter = filterType;
}

/**
 * Export domain data
 * @param {string} domain - Domain to export
 */
export async function exportDomainData(domain) {
  try {
    const response = await runtime.sendMessage({
      action: 'exportFilteredData',
      filters: { domain: domain },
      format: 'json',
    });

    if (response?.success && response?.data) {
      const exportData = JSON.stringify(response.data, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = response.filename || `${domain}-export-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);
      showNotification('Export successful!');
      return true;
    } else {
      showNotification(
        'Export failed: ' + (response?.error || 'Unknown error'),
        true
      );
      return false;
    }
  } catch (error) {
    logger.error('Export error:', error);
    showNotification('Export failed', true);
    return false;
  }
}

/**
 * Export as HAR format
 */
export async function exportAsHAR() {
  try {
    const currentTabs = await tabs.query({ active: true, currentWindow: true });
    const currentTab = currentTabs[0];

    if (!currentTab || !currentTab.url) {
      showNotification('No active tab found', true);
      return false;
    }

    // Get current domain
    const domain = new URL(currentTab.url).hostname;

    // Request HAR export from background
    const response = await runtime.sendMessage({
      action: 'exportAsHAR',
      filters: { domain },
    });

    if (response && response.success && response.har) {
      // Create and download HAR file
      const harData = JSON.stringify(response.har, null, 2);
      const blob = new Blob([harData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `requests-${domain}-${Date.now()}.har`;
      a.click();

      URL.revokeObjectURL(url);
      showNotification('HAR exported successfully!');
      return true;
    } else {
      showNotification(
        'HAR export failed: ' + (response?.error || 'Unknown error'),
        true
      );
      return false;
    }
  } catch (error) {
    logger.error('HAR export error:', error);
    showNotification('HAR export failed', true);
    return false;
  }
}
