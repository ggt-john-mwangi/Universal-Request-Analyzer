// Simplified Popup Script with Auth
// Shows register/login first, then page summary

let currentUser = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthState();
  setupEventListeners();
});

// Check if user is logged in
async function checkAuthState() {
  try {
    const result = await chrome.storage.local.get('currentUser');
    if (result.currentUser) {
      currentUser = result.currentUser;
      showApp();
      await loadPageSummary();
    } else {
      showAuth();
    }
  } catch (error) {
    console.error('Failed to check auth state:', error);
    showAuth();
  }
}

// Show auth screen
function showAuth() {
  document.getElementById('authContainer').classList.remove('hidden');
  document.getElementById('appContainer').classList.remove('active');
}

// Show main app
function showApp() {
  document.getElementById('authContainer').classList.add('hidden');
  document.getElementById('appContainer').classList.add('active');
  
  // Update user name
  if (currentUser) {
    document.getElementById('userName').textContent = currentUser.name || currentUser.email;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Auth form toggles
  document.getElementById('showLogin')?.addEventListener('click', () => {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    clearMessages();
  });

  document.getElementById('showRegister')?.addEventListener('click', () => {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    clearMessages();
  });

  // Register form
  document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleRegister();
  });

  // Login form
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleLogin();
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await handleLogout();
  });
  
  // Request Type Filter - reload stats when changed
  document.getElementById('requestTypeFilter')?.addEventListener('change', async () => {
    await loadPageSummary();
  });

  // Quick actions
  document.getElementById('openDevtools')?.addEventListener('click', () => {
    // Open options page with devtools tab
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('openDashboard')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('openHelp')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
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

  // Load tracked sites for QA selector
  loadTrackedSites();
}

// Handle registration
async function handleRegister() {
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  clearMessages();

  if (!email || !password) {
    showError('registerError', 'Email and password are required');
    return;
  }

  if (password.length < 6) {
    showError('registerError', 'Password must be at least 6 characters');
    return;
  }

  try {
    // Call background script to register
    const response = await chrome.runtime.sendMessage({
      action: 'register',
      data: { email, password, name }
    });

    if (response.success) {
      currentUser = response.user;
      showSuccess('registerSuccess', 'Registration successful! Redirecting...');
      
      setTimeout(() => {
        showApp();
        loadPageSummary();
      }, 1000);
    } else {
      showError('registerError', response.error || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showError('registerError', 'Registration failed. Please try again.');
  }
}

// Handle login
async function handleLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  clearMessages();

  if (!email || !password) {
    showError('loginError', 'Email and password are required');
    return;
  }

  try {
    // Call background script to login
    const response = await chrome.runtime.sendMessage({
      action: 'login',
      data: { email, password }
    });

    if (response.success) {
      currentUser = response.user;
      showApp();
      await loadPageSummary();
    } else {
      showError('loginError', response.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('loginError', 'Login failed. Please try again.');
  }
}

// Handle logout
async function handleLogout() {
  try {
    await chrome.runtime.sendMessage({ action: 'logout' });
    currentUser = null;
    showAuth();
    
    // Clear forms
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerName').value = '';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Load page summary
async function loadPageSummary() {
  try {
    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab || !currentTab.url) {
      console.log('No current tab or URL');
      return;
    }

    console.log('Loading page summary for:', currentTab.url);
    
    // Get selected request type filter
    const requestTypeFilter = document.getElementById('requestTypeFilter');
    const requestType = requestTypeFilter ? requestTypeFilter.value : '';

    // Get detailed filtered stats from background
    // This now aggregates across all pages for the current domain
    const response = await chrome.runtime.sendMessage({
      action: 'getPageStats',
      data: { 
        url: currentTab.url,
        tabId: currentTab.id,
        requestType: requestType  // Pass request type filter
      }
    });

    console.log('Page stats response:', response);

    if (response && response.success && response.stats) {
      updatePageSummary(response.stats);
      updateDetailedViews(response.stats);
    } else {
      console.warn('No stats available, showing defaults');
      // Show default values
      updatePageSummary({
        totalRequests: 0,
        timestamps: [],
        responseTimes: [],
        requestTypes: {},
        statusCodes: {}
      });
    }

    // Refresh every 5 seconds (but stop if extension context invalidated)
    setTimeout(() => {
      if (chrome.runtime?.id) {
        loadPageSummary();
      }
    }, 5000);
  } catch (error) {
    // Stop refresh loop on extension context invalidation
    if (error.message?.includes('Extension context invalidated')) {
      console.log('Extension context invalidated, stopping refresh');
      return;
    }
    console.error('Failed to load page summary:', error);
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
  
  // Use actual data from response or show 0
  document.getElementById('dataTransferred').textContent = '0KB';
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
  if (!canvas) return;
  
  // Get chart instance from Chart.js registry
  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    existingChart.destroy();
  }
  timelineChart = null;
  
  const ctx = canvas.getContext('2d');
  
  // Clear canvas completely
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Reset canvas dimensions
  canvas.width = canvas.offsetWidth || 400;
  canvas.height = 200;
  
  // Create new chart (using simple drawing if Chart.js not available)
  if (typeof Chart !== 'undefined') {
    try {
      timelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timestamps.slice(-20), // Last 20 data points
        datasets: [{
          label: 'Response Time (ms)',
          data: responseTimes.slice(-20),
          borderColor: 'rgb(102, 126, 234)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.3,
          fill: true,
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
    } catch (chartError) {
      console.error('Chart creation error:', chartError);
      // Fallback to simple chart
      drawSimpleChart(ctx, timestamps.slice(-20), responseTimes.slice(-20));
    }
  } else {
    // Fallback: simple canvas drawing
    drawSimpleChart(ctx, timestamps.slice(-20), responseTimes.slice(-20));
  }
}

// Simple chart fallback
function drawSimpleChart(ctx, labels, data) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const maxValue = data.length > 0 ? data.reduce((max, val) => Math.max(max, val), 100) : 100;
  const padding = 20;
  
  ctx.clearRect(0, 0, width, height);
  
  // Draw line
  ctx.strokeStyle = 'rgb(102, 126, 234)';
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
    
    // Get filtered stats with error filter
    const response = await chrome.runtime.sendMessage({
      action: 'getFilteredStats',
      filters: { 
        pageUrl: currentTab.url, 
        timeRange: 300,
        statusPrefix: '4xx'
      }
    });
    
    const container = document.getElementById('recentErrorsList');
    if (!container) return;
    
    // For now, show placeholder until we implement full error details
    if (!response.success || response.totalRequests === 0) {
      container.innerHTML = '<p class="placeholder">No errors in the last 5 minutes</p>';
      return;
    }
    
    // We'll show a summary for now
    container.innerHTML = `
      <div class="error-item">
        <span class="error-url">${response.totalRequests} failed requests detected</span>
        <span class="error-details">Check Analytics for details</span>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load recent errors:', error);
  }
}

// Show error message
function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
  }
}

// Show success message
function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
  }
}

// Clear all messages
function clearMessages() {
  ['registerError', 'registerSuccess', 'loginError'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = '';
    }
  });
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

// Show notification (simple toast-like notification)
function showNotification(message, isError = false) {
  // Create notification element if it doesn't exist
  let notification = document.getElementById('popupNotification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'popupNotification';
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 12px 20px;
      background: ${isError ? '#f56565' : '#48bb78'};
      color: white;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
  }

  notification.textContent = message;
  notification.style.background = isError ? '#f56565' : '#48bb78';
  notification.style.display = 'block';

  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}
