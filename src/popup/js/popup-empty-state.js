// Empty State Functions
// Handle empty state display and sample data

import { showNotification } from './popup-utils.js';
import { updatePageSummary, updateDetailedViews } from './popup-ui.js';
import { tabs } from '../../background/compat/browser-compat.js';

/**
 * Show empty state when no requests are available
 */
export function showEmptyState() {
  const emptyState = document.getElementById('emptyState');
  const pageSummary = document.querySelector('.page-summary');
  const qaQuickView = document.querySelector('.qa-quick-view');
  const quickActions = document.querySelector('.quick-actions');
  
  if (emptyState) {
    emptyState.style.display = 'block';
  }
  
  // Hide other sections
  if (pageSummary) {
    pageSummary.style.display = 'none';
  }
  if (qaQuickView) {
    qaQuickView.style.display = 'none';
  }
  
  // Keep quick actions visible
  if (quickActions) {
    quickActions.style.display = 'flex';
  }
  
  // Setup event listeners
  setupEmptyStateListeners();
}

/**
 * Hide empty state and show normal content
 */
export function hideEmptyState() {
  const emptyState = document.getElementById('emptyState');
  const pageSummary = document.querySelector('.page-summary');
  const qaQuickView = document.querySelector('.qa-quick-view');
  
  if (emptyState) {
    emptyState.style.display = 'none';
  }
  
  if (pageSummary) {
    pageSummary.style.display = 'block';
  }
  
  if (qaQuickView) {
    qaQuickView.style.display = 'block';
  }
}

/**
 * Setup event listeners for empty state buttons
 */
function setupEmptyStateListeners() {
  const viewSampleBtn = document.getElementById('viewSampleBtn');
  const openHelpBtn = document.getElementById('openHelpBtn');
  
  if (viewSampleBtn) {
    viewSampleBtn.onclick = showSampleData;
  }
  
  if (openHelpBtn) {
    openHelpBtn.onclick = openHelpPage;
  }
}

/**
 * Show sample data to demonstrate what the extension does
 */
function showSampleData() {
  // Hide empty state
  hideEmptyState();
  
  // Generate sample data
  const sampleData = generateSampleData();
  
  // Update UI with sample data
  updatePageSummary(sampleData);
  updateDetailedViews(sampleData);
  
  // Show banner indicating this is sample data
  showSampleBanner();
  
  showNotification('Showing sample data for demonstration', false);
}

/**
 * Generate realistic sample data
 * @returns {Object} Sample data object
 */
function generateSampleData() {
  const now = Date.now();
  
  return {
    totalRequests: 42,
    responseTimes: [120, 85, 200, 150, 95, 180, 110, 250, 90, 175],
    statusCodes: {
      '200': 35,
      '201': 3,
      '404': 2,
      '500': 2
    },
    requestTypes: {
      'xmlhttprequest': 15,
      'fetch': 8,
      'script': 10,
      'stylesheet': 5,
      'image': 3,
      'font': 1
    },
    totalBytes: 2547890,
    timestamps: [
      now - 300000, // 5 min ago
      now - 240000, // 4 min ago
      now - 180000, // 3 min ago
      now - 120000, // 2 min ago
      now - 60000   // 1 min ago
    ],
    domain: 'example.com',
    errors: [
      {
        url: 'https://api.example.com/data',
        status: 404,
        timestamp: now - 180000,
        method: 'GET'
      },
      {
        url: 'https://api.example.com/users',
        status: 500,
        timestamp: now - 120000,
        method: 'POST'
      }
    ]
  };
}

/**
 * Show banner indicating sample data is displayed
 */
function showSampleBanner() {
  const banner = document.createElement('div');
  banner.className = 'sample-banner';
  banner.innerHTML = `
    <i class="fas fa-info-circle"></i>
    <span>This is sample data for demonstration. Real data will appear when you browse websites.</span>
    <button id="clearSampleBtn" class="clear-sample-btn">
      <i class="fas fa-times"></i> Got it
    </button>
  `;
  
  // Insert banner at top of app container
  const appContainer = document.getElementById('appContainer');
  if (appContainer) {
    appContainer.insertBefore(banner, appContainer.firstChild);
    
    // Setup close button
    const clearBtn = document.getElementById('clearSampleBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        banner.remove();
        // Reload actual data
        location.reload();
      };
    }
  }
}

/**
 * Open help page in new tab
 */
function openHelpPage() {
  tabs.create({
    url: 'help/help.html'
  });
}

/**
 * Check if we should show empty state based on data
 * @param {Object} data - Stats data
 * @returns {boolean} True if should show empty state
 */
export function shouldShowEmptyState(data) {
  return !data || 
         !data.totalRequests || 
         data.totalRequests === 0 ||
         (data.responseTimes && data.responseTimes.length === 0);
}
