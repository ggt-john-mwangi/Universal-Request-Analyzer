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
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    clearMessages();
  });

  document.getElementById('showRegister')?.addEventListener('click', () => {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
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
        
        if (response.success) {
          showNotification('Export initiated successfully!');
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
      return;
    }

    // Get page stats from background
    const response = await chrome.runtime.sendMessage({
      action: 'getPageStats',
      data: { tabId: currentTab.id, url: currentTab.url }
    });

    if (response.success && response.stats) {
      updatePageSummary(response.stats);
    } else {
      // Show default values
      updatePageSummary({
        totalRequests: 0,
        avgResponse: 0,
        errorCount: 0,
        dataTransferred: 0
      });
    }

    // Refresh every 5 seconds
    setTimeout(() => loadPageSummary(), 5000);
  } catch (error) {
    console.error('Failed to load page summary:', error);
  }
}

// Update page summary display
function updatePageSummary(stats) {
  document.getElementById('totalRequests').textContent = stats.totalRequests || 0;
  document.getElementById('avgResponse').textContent = `${Math.round(stats.avgResponse || 0)}ms`;
  document.getElementById('errorCount').textContent = stats.errorCount || 0;
  
  // Format data transferred
  const bytes = stats.dataTransferred || 0;
  let formatted;
  if (bytes < 1024) {
    formatted = bytes + 'B';
  } else if (bytes < 1024 * 1024) {
    formatted = Math.round(bytes / 1024) + 'KB';
  } else {
    formatted = (bytes / (1024 * 1024)).toFixed(2) + 'MB';
  }
  document.getElementById('dataTransferred').textContent = formatted;
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

    // Get tracking sites from storage/settings
    const result = await chrome.storage.local.get('trackingSites');
    const sites = result.trackingSites || [];

    // Parse sites and add to selector
    if (sites.length > 0) {
      sites.forEach(site => {
        const option = document.createElement('option');
        option.value = site;
        option.textContent = site;
        siteSelect.appendChild(option);
      });
    }

    // Also load from medallion DB - get top domains
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getDashboardStats',
        timeRange: 604800 // Last 7 days
      });

      if (response.success && response.stats && response.stats.topDomains) {
        const domains = response.stats.topDomains.labels || [];
        domains.forEach(domain => {
          // Don't add duplicates
          const exists = Array.from(siteSelect.options).some(opt => opt.value.includes(domain));
          if (!exists && domain) {
            const option = document.createElement('option');
            option.value = `https://${domain}`;
            option.textContent = domain;
            siteSelect.appendChild(option);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load domains from DB:', error);
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
