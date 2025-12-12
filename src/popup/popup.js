// Simplified Popup Script - No Auth Required
// Shows page summary immediately on load

let refreshInterval = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  showApp();
  await loadPageSummary();
  setupEventListeners();
});

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});

// Show main app
function showApp() {
  const appContainer = document.getElementById('appContainer');
  if (appContainer) {
    appContainer.classList.add('active');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Mode Toggle
  const simpleModeBtn = document.getElementById('simpleModeBtn');
  const advancedModeBtn = document.getElementById('advancedModeBtn');
  
  if (simpleModeBtn && advancedModeBtn) {
    // Load saved mode preference
    chrome.storage.local.get(['viewMode'], (result) => {
      const mode = result.viewMode || 'simple';
      setViewMode(mode);
    });
    
    simpleModeBtn.addEventListener('click', () => {
      setViewMode('simple');
      chrome.storage.local.set({ viewMode: 'simple' });
    });
    
    advancedModeBtn.addEventListener('click', () => {
      setViewMode('advanced');
      chrome.storage.local.set({ viewMode: 'advanced' });
    });
  }
  
  // Load resource usage
  loadResourceUsage();
  
  // Refresh Settings Button - sync settings from DB to storage
  document.getElementById('refreshSettingsBtn')?.addEventListener('click', async function() {
    const btn = this;
    const icon = btn.querySelector('i');
    
    try {
      // Add syncing animation
      btn.classList.add('syncing');
      btn.disabled = true;
      
      // Call background to sync settings
      const response = await chrome.runtime.sendMessage({
        action: 'syncSettingsToStorage'
      });
      
      if (response && response.success) {
        // Show success feedback
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
  
  // Request Type Filter - reload stats when changed
  document.getElementById('requestTypeFilter')?.addEventListener('change', async () => {
    await loadPageSummary();
  });
  
  // Page Filter - reload stats when changed
  document.getElementById('pageFilter')?.addEventListener('change', async () => {
    await loadPageSummary();
  });
  
  // Load pages for current domain (call after DOM is ready)
  loadPagesForDomain().catch(err => console.error('Failed to load pages:', err));

  // Quick actions
  document.getElementById('openDevtools')?.addEventListener('click', () => {
    // Open options page with devtools tab
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('openDashboard')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('openHelp')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('help/help.html') });
  });

  // Footer links
  document.getElementById('viewPrivacy')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/ModernaCyber/Universal-Request-Analyzer' });
  });

  document.getElementById('reportIssue')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/ModernaCyber/Universal-Request-Analyzer/issues' });
  });

  // QA Quick View - Domain selector (filters popup stats)
  document.getElementById('siteSelect')?.addEventListener('change', async (e) => {
    const selectedDomain = e.target.value;
    const navigateBtn = document.getElementById('navigateToSite');
    const exportBtn = document.getElementById('exportDomainData');
    
    // Enable/disable action buttons based on selection
    if (selectedDomain) {
      navigateBtn?.removeAttribute('disabled');
      exportBtn?.removeAttribute('disabled');
    } else {
      navigateBtn?.setAttribute('disabled', 'true');
      exportBtn?.setAttribute('disabled', 'true');
    }
    
    // Reload stats filtered by selected domain
    await loadPageSummary();
  });

  // QA Quick View - Navigate to selected domain
  document.getElementById('navigateToSite')?.addEventListener('click', async () => {
    const siteSelect = document.getElementById('siteSelect');
    const selectedDomain = siteSelect?.value;
    
    if (selectedDomain) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { url: selectedDomain });
      }
    }
  });

  // QA Quick View - View detailed analytics in Options page
  document.getElementById('viewDetailsBtn')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // QA Quick View - Export domain data
  document.getElementById('exportDomainData')?.addEventListener('click', async () => {
    const siteSelect = document.getElementById('siteSelect');
    const selectedDomain = siteSelect?.value;
    
    if (!selectedDomain) {
      showNotification('Please select a domain first', true);
      return;
    }
    
    try {
      // Extract domain from full URL (e.g., "https://example.com" -> "example.com")
      let domain = selectedDomain;
      try {
        const url = new URL(selectedDomain);
        domain = url.hostname;
      } catch (e) {
        // If not a valid URL, use as-is
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'exportFilteredData',
        filters: { domain: domain },
        format: 'json'
      });
      
      if (response.success && response.data) {
        const exportData = JSON.stringify(response.data, null, 2);
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = response.filename || `${domain}-export-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        showNotification('Export successful!');
      } else {
        showNotification('Export failed: ' + (response.error || 'Unknown error'), true);
      }
    } catch (error) {
      console.error('Export error:', error);
      showNotification('Export failed', true);
    }
  });

  // Legacy button handlers (keeping for backwards compatibility)
  document.getElementById('viewRequests')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('viewAnalytics')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('exportData')?.addEventListener('click', async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab && currentTab.url) {
        const response = await chrome.runtime.sendMessage({
          action: 'exportFilteredData',
          filters: { pageUrl: currentTab.url },
          format: 'json'
        });
        
        if (response.success && response.data) {
          // Create download in popup context where URL.createObjectURL works
          const exportData = JSON.stringify(response.data, null, 2);
          const blob = new Blob([exportData], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = response.filename || `export-${Date.now()}.json`;
          a.click();
          
          URL.revokeObjectURL(url);
          showNotification('Export successful!');
        } else {
          showNotification('Export failed: ' + (response.error || 'Unknown error'), true);
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      showNotification('Export failed', true);
    }
  });

  // Quick filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', function() {
      // Toggle active state
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      
      // Apply filter
      const filterType = this.dataset.filter;
      applyQuickFilter(filterType);
    });
  });

  // HAR Export button
  document.getElementById('exportHARBtn')?.addEventListener('click', async () => {
    await exportAsHAR();
  });

  // Load tracked sites for QA selector
  loadTrackedSites();
}

// Apply quick filter
let currentQuickFilter = 'all';

async function applyQuickFilter(filterType) {
  currentQuickFilter = filterType;
  
  // Update the advanced filter based on quick filter
  const requestTypeFilter = document.getElementById('requestTypeFilter');
  
  if (filterType === 'all') {
    if (requestTypeFilter) requestTypeFilter.value = '';
  } else if (filterType === 'xhr') {
    if (requestTypeFilter) requestTypeFilter.value = 'xmlhttprequest';
  }
  // For status code filters (2xx, 4xx, 5xx), we'll filter in the display
  
  await loadPageSummary();
}

// Export as HAR
async function exportAsHAR() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) {
      showNotification('No active tab found', true);
      return;
    }
    
    // Get current domain
    const domain = new URL(currentTab.url).hostname;
    
    // Request HAR export from background
    const response = await chrome.runtime.sendMessage({
      action: 'exportAsHAR',
      filters: { 
        domain: domain,
        quickFilter: currentQuickFilter
      }
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
    } else {
      showNotification('HAR export failed: ' + (response?.error || 'Unknown error'), true);
    }
  } catch (error) {
    console.error('HAR export error:', error);
    showNotification('HAR export failed', true);
  }
}

// Show notification (simple implementation)
function showNotification(message, isError = false) {
  console.log(isError ? 'Error:' : 'Success:', message);
  // Could add a toast notification here in the future
}

// Start auto-refresh for page summary
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  
  refreshInterval = setInterval(() => {
    if (chrome.runtime?.id) {
      loadPageSummary().catch(error => {
        if (error.message?.includes('Extension context invalidated')) {
          stopAutoRefresh();
        }
      });
    } else {
      stopAutoRefresh();
    }
  }, 5000);
}

// Stop auto-refresh
function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Load page summary
async function loadPageSummary() {
  const summarySection = document.querySelector('.page-summary');
  
  try {
    // Show loading state
    if (summarySection) {
      summarySection.classList.add('loading');
    }
    
    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab || !currentTab.url) {
      console.log('No current tab or URL');
      return;
    }

    console.log('Loading page summary for:', currentTab.url);
    
    // Get selected filters
    const requestTypeFilter = document.getElementById('requestTypeFilter');
    const requestType = requestTypeFilter ? requestTypeFilter.value : '';
    
    const pageFilter = document.getElementById('pageFilter');
    const selectedPage = pageFilter ? pageFilter.value : '';
    
    // Get domain filter from QA Quick View
    const siteSelect = document.getElementById('siteSelect');
    const selectedDomainUrl = siteSelect ? siteSelect.value : '';
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
    const response = await chrome.runtime.sendMessage({
      action: 'getPageStats',
      data: { 
        url: selectedPage || currentTab.url, // Use selected page or current URL
        tabId: currentTab.id,
        requestType: requestType,
        domain: filterDomain // Pass domain for aggregation (from QA Quick View or current tab)
      }
    });

    console.log('Page stats response:', response);

    if (response && response.success && response.stats) {
      updatePageSummary(response.stats);
      updateDetailedViews(response.stats);
      
      // Start auto-refresh only on first successful load
      if (!refreshInterval) {
        startAutoRefresh();
      }
    } else {
      console.warn('No stats available, showing defaults');
      // Show default values
      updatePageSummary({
        totalRequests: 0,
        timestamps: [],
        responseTimes: [],
        requestTypes: {},
        statusCodes: {},
        totalBytes: 0
      });
    }
  } catch (error) {
    // Stop refresh loop on extension context invalidation
    if (error.message?.includes('Extension context invalidated')) {
      console.log('Extension context invalidated, stopping refresh');
      stopAutoRefresh();
      return;
    }
    console.error('Failed to load page summary:', error);
    // Only show notification if function is available
    if (typeof showNotification === 'function') {
      showNotification('Failed to load statistics. Please try refreshing.', true);
    }
  } finally {
    // Hide loading state
    if (summarySection) {
      summarySection.classList.remove('loading');
    }
  }
}

// Update page summary display
function updatePageSummary(data) {
  const totalRequests = data.totalRequests || 0;
  const responseTimes = data.responseTimes || [];
  const avgResponse = responseTimes.length > 0 
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
    : 0;
  
  // Count errors (all 4xx and 5xx status codes)
  const statusCodes = data.statusCodes || {};
  const errorCount = Object.entries(statusCodes).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return (statusCode >= 400 && statusCode < 600) ? sum + count : sum;
  }, 0);
  
  document.getElementById('totalRequests').textContent = totalRequests;
  document.getElementById('avgResponse').textContent = `${Math.round(avgResponse)}ms`;
  document.getElementById('errorCount').textContent = errorCount;
  
  // Calculate actual data transferred
  const totalBytes = data.totalBytes || 0;
  let dataDisplay = '0KB';
  
  if (totalBytes > 0) {
    const kb = totalBytes / 1024;
    const mb = kb / 1024;
    const gb = mb / 1024;
    
    if (gb >= 1) {
      dataDisplay = `${gb.toFixed(2)}GB`;
    } else if (mb >= 1) {
      dataDisplay = `${mb.toFixed(2)}MB`;
    } else {
      dataDisplay = `${kb.toFixed(2)}KB`;
    }
  }
  
  document.getElementById('dataTransferred').textContent = dataDisplay;
}

// Update detailed QA views
let timelineChart = null;

function updateDetailedViews(data) {
  // Update status code breakdown
  updateStatusBreakdown(data.statusCodes || {});
  
  // Update request types
  updateRequestTypes(data.requestTypes || {});
  
  // Update timeline chart
  updateTimelineChart(data.timestamps || [], data.responseTimes || []);
  
  // Update recent errors (we'll need to fetch this separately)
  updateRecentErrors();
}

// Update status code breakdown
function updateStatusBreakdown(statusCodes) {
  // Group status codes by range
  const status2xx = Object.entries(statusCodes).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return (statusCode >= 200 && statusCode < 300) ? sum + count : sum;
  }, 0);
  
  const status3xx = Object.entries(statusCodes).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return (statusCode >= 300 && statusCode < 400) ? sum + count : sum;
  }, 0);
  
  const status4xx = Object.entries(statusCodes).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return (statusCode >= 400 && statusCode < 500) ? sum + count : sum;
  }, 0);
  
  const status5xx = Object.entries(statusCodes).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return (statusCode >= 500 && statusCode < 600) ? sum + count : sum;
  }, 0);
  
  document.getElementById('status2xx').textContent = status2xx;
  document.getElementById('status3xx').textContent = status3xx;
  document.getElementById('status4xx').textContent = status4xx;
  document.getElementById('status5xx').textContent = status5xx;
}

// Update request types visualization
function updateRequestTypes(requestTypes) {
  const container = document.getElementById('requestTypesList');
  if (!container) return;
  
  const types = Object.entries(requestTypes);
  if (types.length === 0) {
    container.innerHTML = '<p class="placeholder">No requests yet</p>';
    return;
  }
  
  const total = types.reduce((sum, [, count]) => sum + count, 0);
  
  let html = '';
  types.forEach(([type, count]) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    html += `
      <div class="type-item">
        <span class="type-name">${type.toUpperCase()}</span>
        <span class="type-bar">
          <span class="type-bar-fill" style="width: ${percentage}%"></span>
        </span>
        <span class="type-count">${count}</span>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Update timeline chart
function updateTimelineChart(timestamps, responseTimes) {
  const canvas = document.getElementById('requestTimelineChart');
  if (!canvas) {
    console.warn('Timeline chart canvas not found');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('Cannot get canvas context');
    return;
  }
  
  try {
    // Get chart instance from Chart.js registry
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }
    timelineChart = null;
    
    // Clear canvas completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset canvas dimensions
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = 200;
    
    // If no data, show empty state
    if (!timestamps || timestamps.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No request data yet', canvas.width / 2, canvas.height / 2);
      return;
    }
    
    // Get theme color
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#667eea';
    
    // Limit data points for performance (last 50 points max)
    const maxPoints = 50;
    const limitedTimestamps = timestamps.slice(-maxPoints);
    const limitedResponseTimes = (responseTimes || []).slice(-maxPoints);
    
    // Ensure both arrays have the same length
    const minLength = Math.min(limitedTimestamps.length, limitedResponseTimes.length);
    const syncedTimestamps = limitedTimestamps.slice(0, minLength);
    const syncedResponseTimes = limitedResponseTimes.slice(0, minLength);
    
    // Create new chart (using simple drawing if Chart.js not available)
    if (typeof Chart !== 'undefined') {
      timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: syncedTimestamps,
          datasets: [{
            label: 'Response Time (ms)',
            data: syncedResponseTimes,
            borderColor: primaryColor,
            backgroundColor: 'transparent',
            tension: 0.3,
            fill: false,
            pointRadius: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                font: {
                  size: 10
                }
              }
            },
            x: {
              ticks: {
                font: {
                  size: 9
                },
                maxRotation: 0
              }
            }
          }
        }
      });
    } else {
      // Fallback: simple canvas drawing
      drawSimpleChart(ctx, limitedTimestamps, limitedResponseTimes);
    }
  } catch (chartError) {
    console.error('Chart creation error:', chartError);
    // Show error state
    ctx.fillStyle = '#e53e3e';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Failed to render chart', canvas.width / 2, canvas.height / 2);
  }
}

// Simple chart fallback
function drawSimpleChart(ctx, labels, data) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const maxValue = data.length > 0 ? data.reduce((max, val) => Math.max(max, val), 100) : 100;
  const padding = 20;
  
  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#667eea';
  
  ctx.clearRect(0, 0, width, height);
  
  // Draw line
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  data.forEach((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - (value / maxValue) * (height - 2 * padding);
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
}

// Update recent errors
async function updateRecentErrors() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) return;
    
    // Get recent errors from background
    const response = await chrome.runtime.sendMessage({
      action: 'getRecentErrors',
      data: { 
        url: currentTab.url,
        timeRange: 300000 // Last 5 minutes in milliseconds
      }
    });
    
    const container = document.getElementById('recentErrorsList');
    if (!container) return;
    
    if (response && response.success && response.errors && response.errors.length > 0) {
      let html = '';
      // Show up to 5 most recent errors
      response.errors.slice(0, 5).forEach(error => {
        const timeAgo = formatTimeAgo(error.timestamp);
        const truncatedUrl = truncateUrl(error.url, 50);
        
        html += `
          <div class="error-item">
            <span class="error-status status-${Math.floor(error.status / 100)}xx">${error.status}</span>
            <span class="error-url" title="${error.url}">${truncatedUrl}</span>
            <span class="error-time">${timeAgo}</span>
          </div>
        `;
      });
      container.innerHTML = html;
    } else {
      container.innerHTML = '<p class="placeholder">No errors in the last 5 minutes</p>';
    }
  } catch (error) {
    console.error('Failed to load recent errors:', error);
    const container = document.getElementById('recentErrorsList');
    if (container) {
      container.innerHTML = '<p class="placeholder error-text">Failed to load errors</p>';
    }
  }
}

// Helper: Format timestamp as "X ago"
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Helper: Truncate URL to max length
function truncateUrl(url, maxLength) {
  if (!url) return '';
  if (url.length <= maxLength) return url;
  
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    
    if (path.length > maxLength - 10) {
      return path.substring(0, maxLength - 13) + '...';
    }
    
    return path;
  } catch {
    // If URL parsing fails, just truncate
    return url.substring(0, maxLength - 3) + '...';
  }
}



// Load pages for current domain
async function loadPagesForDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) return;
    
    const url = new URL(currentTab.url);
    const currentDomain = url.hostname;
    
    // Update domain display
    const domainDisplay = document.getElementById('currentDomainDisplay');
    if (domainDisplay) {
      domainDisplay.textContent = currentDomain;
    }
    
    // Get pages for this domain
    const pageSelect = document.getElementById('pageFilter');
    if (!pageSelect) return;
    
    pageSelect.innerHTML = '<option value="">All Pages in Domain</option>';
    
    const response = await chrome.runtime.sendMessage({
      action: 'executeDirectQuery',
      query: `
        SELECT DISTINCT page_url, COUNT(*) as request_count
        FROM bronze_requests
        WHERE domain = '${currentDomain}'
        AND page_url IS NOT NULL
        AND created_at > ${Date.now() - (7 * 24 * 60 * 60 * 1000)}
        GROUP BY page_url
        ORDER BY request_count DESC
        LIMIT 20
      `
    });
    
    if (response && response.success && response.data && response.data.length > 0) {
      response.data.forEach(row => {
        if (row.page_url) {
          const option = document.createElement('option');
          option.value = row.page_url;
          
          try {
            const pageUrl = new URL(row.page_url);
            const path = pageUrl.pathname + pageUrl.search;
            const displayText = path.length > 40 ? path.substring(0, 37) + '...' : path;
            option.textContent = `${displayText} (${row.request_count})`;
          } catch {
            option.textContent = row.page_url;
          }
          
          pageSelect.appendChild(option);
        }
      });
    }
  } catch (error) {
    console.error('Failed to load pages for domain:', error);
  }
}

// Load tracked sites for QA selector
async function loadTrackedSites() {
  try {
    const siteSelect = document.getElementById('siteSelect');
    if (!siteSelect) return;

    // Reset dropdown
    siteSelect.innerHTML = '<option value="">All Domains</option>';
    
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // First check if there's any data at all
    const checkResponse = await chrome.runtime.sendMessage({
      action: 'executeDirectQuery',
      query: `SELECT COUNT(*) as total FROM bronze_requests`
    });
    
    console.log('Total requests in database:', checkResponse);

    // Fetch unique domains from database
    const response = await chrome.runtime.sendMessage({
      action: 'executeDirectQuery',
      query: `
        SELECT domain, COUNT(*) as request_count
        FROM bronze_requests 
        WHERE domain IS NOT NULL 
          AND domain != '' 
          AND created_at > ${sevenDaysAgo}
        GROUP BY domain
        ORDER BY request_count DESC
        LIMIT 20
      `
    });

    console.log('Site filter response:', response);

    if (response && response.success) {
      if (response.data && response.data.length > 0) {
        const domains = response.data;
        console.log(`Loaded ${domains.length} domains for site selector`);

        domains.forEach(row => {
          const domain = row.domain;
          const count = row.request_count;
          if (domain) {
            const option = document.createElement('option');
            option.value = `https://${domain}`;
            option.textContent = `${domain} (${count} requests)`;
            siteSelect.appendChild(option);
          }
        });
      } else {
        console.warn('Query successful but no domains found - database may be empty or domains are NULL');
      }
    } else {
      console.error('Query failed:', response?.error);
    }
  } catch (error) {
    console.error('Failed to load tracked sites:', error);
  }
}



// Set view mode (simple or advanced)
function setViewMode(mode) {
  const simpleModeBtn = document.getElementById('simpleModeBtn');
  const advancedModeBtn = document.getElementById('advancedModeBtn');
  const advancedElements = document.querySelectorAll('.timeline-chart, .request-types, .qa-quick-view, .filters-section');
  const resourceUsage = document.getElementById('resourceUsage');
  
  if (mode === 'simple') {
    simpleModeBtn?.classList.add('active');
    advancedModeBtn?.classList.remove('active');
    // Hide advanced features
    advancedElements.forEach(el => el.style.display = 'none');
    // Show resource usage in simple mode
    if (resourceUsage) resourceUsage.style.display = 'flex';
  } else {
    simpleModeBtn?.classList.remove('active');
    advancedModeBtn?.classList.add('active');
    // Show advanced features
    advancedElements.forEach(el => el.style.display = '');
    // Hide resource usage in advanced mode
    if (resourceUsage) resourceUsage.style.display = 'none';
  }
}

// Load resource usage
async function loadResourceUsage() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getDatabaseSize'
    });
    
    if (response && response.success) {
      const requestCount = response.records || 0;
      const sizeMB = response.size ? (response.size / (1024 * 1024)).toFixed(2) : '0';
      
      const requestCountEl = document.getElementById('requestCount');
      const storageSizeEl = document.getElementById('storageSize');
      
      if (requestCountEl) {
        requestCountEl.textContent = `${requestCount.toLocaleString()} / 10,000`;
      }
      if (storageSizeEl) {
        storageSizeEl.textContent = `${sizeMB} MB`;
      }
    }
  } catch (error) {
    console.error('Failed to load resource usage:', error);
  }
}
