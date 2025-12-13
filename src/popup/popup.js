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

  // QA Quick View - Site selector
  document.getElementById('siteSelect')?.addEventListener('change', async (e) => {
    const selectedSite = e.target.value;
    if (selectedSite) {
      // Navigate to selected site
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { url: selectedSite });
      }
    }
  });

  // QA Quick View - Navigation buttons
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

  // JSON Export button
  document.getElementById('exportJSONBtn')?.addEventListener('click', async () => {
    await exportAsJSON();
  });

  // CSV Export button
  document.getElementById('exportCSVBtn')?.addEventListener('click', async () => {
    await exportAsCSV();
  });

  // Clear recent requests
  document.getElementById('clearRecentBtn')?.addEventListener('click', async () => {
    if (confirm('Clear all captured requests?')) {
      await clearRequests();
    }
  });

  // Share report button
  document.getElementById('shareReportBtn')?.addEventListener('click', async () => {
    await generateShareableReport();
  });

  // What's New button
  document.getElementById('whatsNewBtn')?.addEventListener('click', () => {
    showWhatsNew();
  });

  // Help button
  document.getElementById('helpBtn')?.addEventListener('click', () => {
    showQuickHelp();
  });

  // Modal close button
  document.getElementById('closeModal')?.addEventListener('click', () => {
    closeModal();
  });

  // Modal action button
  document.getElementById('modalActionBtn')?.addEventListener('click', () => {
    closeModal();
  });

  // Close modal on backdrop click
  document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
      closeModal();
    }
  });

  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modal');
      if (modal && modal.style.display !== 'none') {
        closeModal();
      }
    }
  });

  // Load tracked sites for QA selector
  loadTrackedSites();

  // Load recent requests
  loadRecentRequests();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Show welcome banner for first-time users
  showWelcomeBannerIfNeeded();

  // Setup search functionality
  setupSearch();
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

    // Get detailed filtered stats from background
    const response = await chrome.runtime.sendMessage({
      action: 'getPageStats',
      data: { 
        url: selectedPage || currentTab.url, // Use selected page or current URL
        tabId: currentTab.id,
        requestType: requestType,
        domain: new URL(currentTab.url).hostname // Pass domain for aggregation
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
  
  // Update trends
  updateTrends(data);
}

// Helper: Calculate average
function calculateAverage(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Helper: Calculate error count from status codes
function calculateErrorCount(statusCodes) {
  return Object.entries(statusCodes || {}).reduce((sum, [code, count]) => {
    const statusCode = parseInt(code);
    return (statusCode >= 400 && statusCode < 600) ? sum + count : sum;
  }, 0);
}

// Update trend indicators
let previousStats = null;

function updateTrends(currentData) {
  if (!previousStats) {
    // First load, store current as previous
    previousStats = {
      totalRequests: currentData.totalRequests || 0,
      avgResponse: calculateAverage(currentData.responseTimes),
      errorCount: calculateErrorCount(currentData.statusCodes),
      totalBytes: currentData.totalBytes || 0
    };
    return;
  }
  
  const currentRequests = currentData.totalRequests || 0;
  const currentAvgResponse = calculateAverage(currentData.responseTimes);
  const currentErrors = calculateErrorCount(currentData.statusCodes);
  const currentBytes = currentData.totalBytes || 0;
  
  // Update requests trend
  updateTrendElement('requestsTrend', currentRequests, previousStats.totalRequests, true);
  
  // Update response time trend (lower is better)
  updateTrendElement('responseTrend', currentAvgResponse, previousStats.avgResponse, false);
  
  // Update error trend (lower is better)
  updateTrendElement('errorTrend', currentErrors, previousStats.errorCount, false);
  
  // Update data trend
  updateTrendElement('dataTrend', currentBytes, previousStats.totalBytes, true);
  
  // Store current as previous
  previousStats = {
    totalRequests: currentRequests,
    avgResponse: currentAvgResponse,
    errorCount: currentErrors,
    totalBytes: currentBytes
  };
}

function updateTrendElement(elementId, current, previous, higherIsBetter) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const diff = current - previous;
  const percentChange = previous !== 0 ? Math.abs((diff / previous) * 100) : 0;
  
  if (Math.abs(diff) < 0.01) {
    element.innerHTML = '<i class="fas fa-minus"></i> No change';
    element.className = 'stat-trend neutral';
  } else if (diff > 0) {
    const isGood = higherIsBetter;
    element.innerHTML = `<i class="fas fa-arrow-up"></i> +${percentChange.toFixed(0)}%`;
    element.className = isGood ? 'stat-trend up' : 'stat-trend down';
  } else {
    const isGood = !higherIsBetter;
    element.innerHTML = `<i class="fas fa-arrow-down"></i> -${percentChange.toFixed(0)}%`;
    element.className = isGood ? 'stat-trend up' : 'stat-trend down';
  }
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
    siteSelect.innerHTML = '<option value="">Current Page</option>';
    
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

// Export as JSON
async function exportAsJSON() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) {
      showNotification('No active tab found', true);
      return;
    }
    
    const domain = new URL(currentTab.url).hostname;
    
    const response = await chrome.runtime.sendMessage({
      action: 'exportFilteredData',
      filters: { 
        domain: domain,
        quickFilter: currentQuickFilter
      },
      format: 'json'
    });
    
    if (response && response.success && response.data) {
      const exportData = JSON.stringify(response.data, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `requests-${domain}-${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      showNotification('JSON exported successfully!');
    } else {
      showNotification('JSON export failed: ' + (response?.error || 'Unknown error'), true);
    }
  } catch (error) {
    console.error('JSON export error:', error);
    showNotification('JSON export failed', true);
  }
}

// Export as CSV
async function exportAsCSV() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) {
      showNotification('No active tab found', true);
      return;
    }
    
    const domain = new URL(currentTab.url).hostname;
    
    const response = await chrome.runtime.sendMessage({
      action: 'exportFilteredData',
      filters: { 
        domain: domain,
        quickFilter: currentQuickFilter
      },
      format: 'csv'
    });
    
    if (response && response.success && response.data) {
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `requests-${domain}-${Date.now()}.csv`;
      a.click();
      
      URL.revokeObjectURL(url);
      showNotification('CSV exported successfully!');
    } else {
      showNotification('CSV export failed: ' + (response?.error || 'Unknown error'), true);
    }
  } catch (error) {
    console.error('CSV export error:', error);
    showNotification('CSV export failed', true);
  }
}

// Clear all requests
async function clearRequests() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'clearAllRequests'
    });
    
    if (response && response.success) {
      showNotification('All requests cleared successfully!');
      await loadPageSummary();
      await loadRecentRequests();
    } else {
      showNotification('Failed to clear requests', true);
    }
  } catch (error) {
    console.error('Clear requests error:', error);
    showNotification('Failed to clear requests', true);
  }
}

// Load recent requests
async function loadRecentRequests() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) return;
    
    const response = await chrome.runtime.sendMessage({
      action: 'getRecentRequests',
      data: { 
        url: currentTab.url,
        limit: 10
      }
    });
    
    const container = document.getElementById('recentRequestsList');
    if (!container) return;
    
    if (response && response.success && response.requests && response.requests.length > 0) {
      let html = '';
      response.requests.forEach(request => {
        const statusClass = request.status >= 200 && request.status < 300 ? 'success' : 'error';
        const timeDisplay = request.duration ? `${Math.round(request.duration)}ms` : 'N/A';
        const urlDisplay = truncateUrl(request.url, 30);
        
        html += `
          <div class="request-item">
            <span class="request-status ${statusClass}">${request.status || '?'}</span>
            <span class="request-method">${request.method || 'GET'}</span>
            <span class="request-url" title="${request.url}">${urlDisplay}</span>
            <span class="request-time">${timeDisplay}</span>
            <div class="request-actions">
              <button class="copy-curl" data-request-id="${request.id}" title="Copy as cURL">
                <i class="fas fa-terminal"></i>
              </button>
              <button class="copy-fetch" data-request-id="${request.id}" title="Copy as Fetch">
                <i class="fas fa-code"></i>
              </button>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
      
      // Add event listeners for copy buttons
      container.querySelectorAll('.copy-curl').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const requestId = e.currentTarget.dataset.requestId;
          const request = response.requests.find(r => String(r.id) === String(requestId));
          if (request) copyAsCurl(request);
        });
      });
      
      container.querySelectorAll('.copy-fetch').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const requestId = e.currentTarget.dataset.requestId;
          const request = response.requests.find(r => String(r.id) === String(requestId));
          if (request) copyAsFetch(request);
        });
      });
    } else {
      container.innerHTML = '<p class="placeholder">No requests captured yet</p>';
    }
    
    // Generate performance insights
    generatePerformanceInsights(response.requests || []);
  } catch (error) {
    console.error('Failed to load recent requests:', error);
  }
}

// Parse and clean headers (shared utility)
function parseAndCleanHeaders(headers) {
  const parsed = typeof headers === 'string' ? JSON.parse(headers) : headers;
  const cleaned = {};
  Object.entries(parsed).forEach(([key, value]) => {
    // Skip pseudo-headers (HTTP/2)
    if (!key.toLowerCase().startsWith(':')) {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

// Escape string for shell command (security fix)
function escapeShellArg(arg) {
  if (!arg) return "''";
  const str = String(arg);
  // Reject arguments containing null bytes (security)
  if (str.includes('\0')) {
    throw new Error('Security violation: null byte detected in input');
  }
  // Replace single quotes with '\'' to escape properly in shell
  return `'${str.replace(/'/g, "'\\''")}'`;
}

// Copy request as cURL
function copyAsCurl(request) {
  try {
    const method = request.method || 'GET';
    const url = escapeShellArg(request.url);
    let curl = `curl -X ${method} ${url}`;
    
    // Add headers if available
    if (request.headers) {
      const headers = parseAndCleanHeaders(request.headers);
      Object.entries(headers).forEach(([key, value]) => {
        // Escape for shell and format as "Key: Value" for cURL
        const header = `${key}: ${value}`;
        const escapedHeader = escapeShellArg(header);
        curl += ` \\\n  -H ${escapedHeader}`;
      });
    }
    
    // Add body if available
    if (request.body && method !== 'GET') {
      const escapedBody = escapeShellArg(request.body);
      curl += ` \\\n  --data ${escapedBody}`;
    }
    
    navigator.clipboard.writeText(curl).then(() => {
      showNotification('cURL command copied to clipboard!');
    });
  } catch (error) {
    console.error('Copy as cURL error:', error);
    showNotification('Failed to copy cURL', true);
  }
}

// Copy request as Fetch
function copyAsFetch(request) {
  try {
    const method = request.method || 'GET';
    const url = request.url;
    let fetchCode = `fetch('${url}', {\n  method: '${method}'`;
    
    // Add headers if available
    if (request.headers) {
      const cleanHeaders = parseAndCleanHeaders(request.headers);
      fetchCode += `,\n  headers: ${JSON.stringify(cleanHeaders, null, 2)}`;
    }
    
    // Add body if available
    if (request.body && method !== 'GET') {
      fetchCode += `,\n  body: ${JSON.stringify(request.body)}`;
    }
    
    fetchCode += '\n})';
    
    navigator.clipboard.writeText(fetchCode).then(() => {
      showNotification('Fetch code copied to clipboard!');
    });
  } catch (error) {
    console.error('Copy as Fetch error:', error);
    showNotification('Failed to copy Fetch code', true);
  }
}

// Generate performance insights
function generatePerformanceInsights(requests) {
  const container = document.getElementById('insightsList');
  if (!container || !requests || requests.length === 0) {
    if (container) {
      container.innerHTML = '<p class="placeholder">No insights available yet</p>';
    }
    return;
  }
  
  const insights = [];
  
  // Calculate average response time
  const responseTimes = requests.filter(r => r.duration).map(r => r.duration);
  if (responseTimes.length > 0) {
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    if (avgTime > 1000) {
      insights.push({
        type: 'warning',
        icon: 'fa-exclamation-triangle',
        title: 'Slow average response time',
        description: `Average response time is ${Math.round(avgTime)}ms. Consider optimizing your API calls.`
      });
    } else if (avgTime < 200) {
      insights.push({
        type: 'success',
        icon: 'fa-check-circle',
        title: 'Great performance!',
        description: `Average response time is ${Math.round(avgTime)}ms. Your API is performing well.`
      });
    }
  }
  
  // Check for errors
  const errorCount = requests.filter(r => r.status >= 400).length;
  const errorRate = requests.length > 0 ? (errorCount / requests.length) * 100 : 0;
  
  if (errorRate > 20) {
    insights.push({
      type: 'error',
      icon: 'fa-times-circle',
      title: 'High error rate detected',
      description: `${errorRate.toFixed(1)}% of requests failed. Check your error logs.`
    });
  } else if (errorCount === 0 && requests.length > 5) {
    insights.push({
      type: 'success',
      icon: 'fa-check-circle',
      title: 'No errors detected',
      description: 'All requests completed successfully!'
    });
  }
  
  // Check for large payloads
  const largeRequests = requests.filter(r => r.size && r.size > 1024 * 1024); // > 1MB
  if (largeRequests.length > 0) {
    insights.push({
      type: 'warning',
      icon: 'fa-exclamation-circle',
      title: 'Large payloads detected',
      description: `${largeRequests.length} request(s) exceeded 1MB. Consider pagination or data optimization.`
    });
  }
  
  // Check request volume
  if (requests.length > 50) {
    insights.push({
      type: 'warning',
      icon: 'fa-info-circle',
      title: 'High request volume',
      description: `${requests.length} requests captured recently. Consider implementing request batching.`
    });
  }
  
  // Render insights
  if (insights.length > 0) {
    let html = '';
    insights.slice(0, 3).forEach(insight => {
      html += `
        <div class="insight-item ${insight.type}">
          <i class="fas ${insight.icon} insight-icon"></i>
          <div class="insight-content">
            <div class="insight-title">${insight.title}</div>
            <div class="insight-description">${insight.description}</div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  } else {
    container.innerHTML = '<p class="placeholder">No performance issues detected</p>';
  }
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + E - Export HAR
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      document.getElementById('exportHARBtn')?.click();
    }
    
    // Ctrl/Cmd + R - Refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      loadPageSummary();
      loadRecentRequests();
    }
    
    // Ctrl/Cmd + K - Clear requests
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('clearRecentBtn')?.click();
    }
    
    // ? - Show keyboard shortcuts
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      showKeyboardShortcuts();
    }
  });
}

// Show keyboard shortcuts
function showKeyboardShortcuts() {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalActionBtn = document.getElementById('modalActionBtn');
  
  if (!modalTitle || !modalBody) return;
  
  modalTitle.textContent = '⌨️ Keyboard Shortcuts';
  modalBody.innerHTML = `
    <div style="display: grid; gap: 12px;">
      <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--surface-color); border-radius: 6px;">
        <span><kbd>Ctrl/Cmd + E</kbd></span>
        <span>Export HAR</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--surface-color); border-radius: 6px;">
        <span><kbd>Ctrl/Cmd + R</kbd></span>
        <span>Refresh data</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--surface-color); border-radius: 6px;">
        <span><kbd>Ctrl/Cmd + K</kbd></span>
        <span>Clear requests</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--surface-color); border-radius: 6px;">
        <span><kbd>Ctrl/Cmd + F</kbd></span>
        <span>Focus search</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--surface-color); border-radius: 6px;">
        <span><kbd>ESC</kbd></span>
        <span>Clear search / Close modal</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--surface-color); border-radius: 6px;">
        <span><kbd>?</kbd></span>
        <span>Show shortcuts</span>
      </div>
    </div>
  `;
  
  modalActionBtn.textContent = 'Got it!';
  showModal();
}

// Show welcome banner for first-time users
async function showWelcomeBannerIfNeeded() {
  try {
    const result = await chrome.storage.local.get(['welcomeBannerShown']);
    
    if (!result.welcomeBannerShown) {
      const banner = document.createElement('div');
      banner.className = 'welcome-banner';
      banner.innerHTML = `
        <div class="banner-title">
          <i class="fas fa-star"></i>
          Welcome to Request Analyzer!
        </div>
        <div class="banner-description">
          Track network requests with persistence, analytics, and exports. Your data is automatically saved across browser sessions.
        </div>
        <div class="banner-actions">
          <button id="takeTourBtn">Take a Quick Tour</button>
          <button id="dismissBannerBtn" class="close-banner">Got it</button>
        </div>
      `;
      
      const appContainer = document.getElementById('appContainer');
      if (appContainer) {
        appContainer.insertBefore(banner, appContainer.firstChild);
        
        document.getElementById('dismissBannerBtn')?.addEventListener('click', async () => {
          banner.remove();
          await chrome.storage.local.set({ welcomeBannerShown: true });
        });
        
        document.getElementById('takeTourBtn')?.addEventListener('click', () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('help/help.html') });
        });
      }
    }
  } catch (error) {
    console.error('Error showing welcome banner:', error);
  }
}

// Setup search functionality
let searchTimeout = null;

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  
  if (!searchInput || !clearSearchBtn) return;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Show/hide clear button
    if (query) {
      clearSearchBtn.classList.add('visible');
    } else {
      clearSearchBtn.classList.remove('visible');
    }
    
    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterRequests(query);
    }, 300);
  });
  
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.remove('visible');
    filterRequests('');
  });
  
  // Ctrl/Cmd + F - Focus search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
    
    // Escape - Clear search
    if (e.key === 'Escape' && searchInput === document.activeElement) {
      clearSearchBtn.click();
      searchInput.blur();
    }
  });
}

// Filter requests based on search query
function filterRequests(query) {
  const container = document.getElementById('recentRequestsList');
  if (!container) return;
  
  const requestItems = container.querySelectorAll('.request-item');
  
  if (!query) {
    // Show all requests
    requestItems.forEach(item => {
      item.style.display = '';
    });
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  let visibleCount = 0;
  
  requestItems.forEach(item => {
    const url = item.querySelector('.request-url')?.textContent || '';
    const method = item.querySelector('.request-method')?.textContent || '';
    const status = item.querySelector('.request-status')?.textContent || '';
    
    const matches = 
      url.toLowerCase().includes(lowerQuery) ||
      method.toLowerCase().includes(lowerQuery) ||
      status.toLowerCase().includes(lowerQuery);
    
    if (matches) {
      item.style.display = '';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });
  
  // Show message if no results
  if (visibleCount === 0 && requestItems.length > 0) {
    const existingMsg = container.querySelector('.no-results-message');
    if (!existingMsg) {
      const noResultsMsg = document.createElement('p');
      noResultsMsg.className = 'placeholder no-results-message';
      noResultsMsg.textContent = `No requests matching "${query}"`;
      container.appendChild(noResultsMsg);
    }
  } else {
    // Remove no results message if exists
    const existingMsg = container.querySelector('.no-results-message');
    if (existingMsg) {
      existingMsg.remove();
    }
  }
}

// Generate shareable report
async function generateShareableReport() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab || !currentTab.url) {
      showNotification('No active tab found', true);
      return;
    }
    
    const domain = new URL(currentTab.url).hostname;
    
    // Get current stats
    const totalRequests = document.getElementById('totalRequests')?.textContent || '0';
    const avgResponse = document.getElementById('avgResponse')?.textContent || '0ms';
    const errorCount = document.getElementById('errorCount')?.textContent || '0';
    const dataTransferred = document.getElementById('dataTransferred')?.textContent || '0KB';
    
    // Get status breakdown
    const status2xx = document.getElementById('status2xx')?.textContent || '0';
    const status3xx = document.getElementById('status3xx')?.textContent || '0';
    const status4xx = document.getElementById('status4xx')?.textContent || '0';
    const status5xx = document.getElementById('status5xx')?.textContent || '0';
    
    const timestamp = new Date().toLocaleString();
    
    const report = `
# Network Performance Report
**Domain:** ${domain}  
**Generated:** ${timestamp}  
**Generated by:** Universal Request Analyzer

## Summary Statistics
- **Total Requests:** ${totalRequests}
- **Average Response Time:** ${avgResponse}
- **Errors:** ${errorCount}
- **Data Transferred:** ${dataTransferred}

## Status Code Distribution
- **2xx (Success):** ${status2xx}
- **3xx (Redirect):** ${status3xx}
- **4xx (Client Error):** ${status4xx}
- **5xx (Server Error):** ${status5xx}

## Performance Analysis
${generatePerformanceAnalysisText()}

---
*This report was generated using Universal Request Analyzer browser extension.*
*Install from: https://github.com/ModernaCyber/Universal-Request-Analyzer*
`;
    
    // Copy to clipboard
    await navigator.clipboard.writeText(report);
    showNotification('Report copied to clipboard! 📋');
    
    // Also offer to download
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-report-${domain}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Share report error:', error);
    showNotification('Failed to generate report', true);
  }
}

// Generate performance analysis text for report
function generatePerformanceAnalysisText() {
  const insightsList = document.getElementById('insightsList');
  if (!insightsList) return 'No insights available.';
  
  const insights = insightsList.querySelectorAll('.insight-item');
  if (insights.length === 0) return 'No performance issues detected. 🎉';
  
  let text = '';
  insights.forEach((insight, index) => {
    const title = insight.querySelector('.insight-title')?.textContent || '';
    const description = insight.querySelector('.insight-description')?.textContent || '';
    const type = insight.classList.contains('warning') ? '⚠️' : 
                 insight.classList.contains('error') ? '❌' : 
                 insight.classList.contains('success') ? '✅' : 'ℹ️';
    text += `\n${type} **${title}**\n${description}\n`;
  });
  
  return text;
}

// Show What's New modal
async function showWhatsNew() {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalActionBtn = document.getElementById('modalActionBtn');
  
  if (!modalTitle || !modalBody) return;
  
  modalTitle.textContent = "🎉 What's New in Request Analyzer";
  modalBody.innerHTML = `
    <div class="feature-highlight">
      <i class="fas fa-search feature-icon"></i>
      <div class="feature-content">
        <h4>Smart Search</h4>
        <p>Quickly find requests by URL, method, or status code. Press Ctrl+F to start searching!</p>
      </div>
    </div>
    
    <div class="feature-highlight">
      <i class="fas fa-chart-line feature-icon"></i>
      <div class="feature-content">
        <h4>Trend Indicators</h4>
        <p>See how your metrics are changing with visual trend arrows and percentages.</p>
      </div>
    </div>
    
    <div class="feature-highlight">
      <i class="fas fa-share-alt feature-icon"></i>
      <div class="feature-content">
        <h4>Share Reports</h4>
        <p>Generate and share professional network performance reports with your team.</p>
      </div>
    </div>
    
    <div class="feature-highlight">
      <i class="fas fa-terminal feature-icon"></i>
      <div class="feature-content">
        <h4>Copy as cURL/Fetch</h4>
        <p>Instantly copy any request as a cURL command or Fetch API code for testing.</p>
      </div>
    </div>
    
    <div class="feature-highlight">
      <i class="fas fa-lightbulb feature-icon"></i>
      <div class="feature-content">
        <h4>Performance Insights</h4>
        <p>Get automatic recommendations based on your network performance patterns.</p>
      </div>
    </div>
    
    <h3>🚀 Coming Soon</h3>
    <ul>
      <li>Request comparison across time periods</li>
      <li>Advanced filtering and saved filters</li>
      <li>Custom alerts and notifications</li>
      <li>Team collaboration features</li>
    </ul>
    
    <p style="margin-top: 20px; padding: 12px; background: var(--surface-color); border-radius: 6px; font-size: 13px;">
      <strong>💡 Pro Tip:</strong> Press <kbd>?</kbd> anytime to see all keyboard shortcuts!
    </p>
  `;
  
  modalActionBtn.textContent = 'Awesome!';
  
  showModal();
  
  // Mark as seen
  await chrome.storage.local.set({ whatsNewSeen: true });
  
  // Hide the "New" badge
  const newBadge = document.querySelector('.new-badge');
  if (newBadge) {
    newBadge.style.display = 'none';
  }
}

// Show Quick Help modal
function showQuickHelp() {
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalActionBtn = document.getElementById('modalActionBtn');
  
  if (!modalTitle || !modalBody) return;
  
  modalTitle.textContent = '❓ Quick Help';
  modalBody.innerHTML = `
    <h3>Getting Started</h3>
    <p>Universal Request Analyzer automatically captures all network requests from your active tab. Your data is saved persistently across browser sessions.</p>
    
    <h3>Keyboard Shortcuts</h3>
    <ul>
      <li><kbd>Ctrl/Cmd + F</kbd> - Focus search</li>
      <li><kbd>Ctrl/Cmd + E</kbd> - Export as HAR</li>
      <li><kbd>Ctrl/Cmd + R</kbd> - Refresh data</li>
      <li><kbd>Ctrl/Cmd + K</kbd> - Clear requests</li>
      <li><kbd>?</kbd> - Show all shortcuts</li>
      <li><kbd>ESC</kbd> - Clear search or close modal</li>
    </ul>
    
    <h3>Quick Actions</h3>
    <ul>
      <li><strong>Export:</strong> Download data as HAR, JSON, or CSV</li>
      <li><strong>Share:</strong> Generate a professional report to share</li>
      <li><strong>Copy:</strong> Hover over any request to copy as cURL or Fetch</li>
      <li><strong>Search:</strong> Filter requests in real-time</li>
    </ul>
    
    <h3>View Modes</h3>
    <ul>
      <li><strong>Simple:</strong> Shows key metrics and recent requests</li>
      <li><strong>Advanced:</strong> Includes charts, analytics, and detailed breakdowns</li>
    </ul>
    
    <h3>Need More Help?</h3>
    <p>Visit our <a href="#" id="openFullHelp" style="color: var(--primary-color); text-decoration: none;">comprehensive documentation</a> for detailed guides and tutorials.</p>
  `;
  
  modalActionBtn.textContent = 'Got it!';
  
  showModal();
  
  // Add event listener for full help link
  document.getElementById('openFullHelp')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await chrome.tabs.create({ url: chrome.runtime.getURL('help/help.html') });
      closeModal();
    } catch (error) {
      console.error('Failed to open help page:', error);
      showNotification('Could not open help page', true);
    }
  });
}

// Show modal
function showModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.style.display = 'flex';
    // Focus on modal for accessibility
    modal.setAttribute('aria-hidden', 'false');
    document.querySelector('.close-modal-btn')?.focus();
  }
}

// Close modal
function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
}

// Check if "What's New" should be shown
async function checkWhatsNewBadge() {
  try {
    const result = await chrome.storage.local.get(['whatsNewSeen']);
    const newBadge = document.querySelector('.new-badge');
    
    if (result.whatsNewSeen && newBadge) {
      newBadge.style.display = 'none';
    }
  } catch (error) {
    console.error('Error checking What\'s New status:', error);
  }
}

// Initialize What's New badge check
checkWhatsNewBadge();
