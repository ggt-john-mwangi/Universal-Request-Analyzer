// Message Handler for Popup Auth and Stats
// Handles registration, login, logout, and page stats requests

let localAuthManager = null;
let dbManager = null;

// Initialize message handler
export function initializePopupMessageHandler(auth, database) {
  localAuthManager = auth;
  dbManager = database;

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep channel open for async response
  });

  console.log('Popup message handler initialized');
}

// Handle incoming messages
async function handleMessage(message, sender) {
  const { action, data } = message;

  switch (action) {
    case 'register':
      return await handleRegister(data);
    
    case 'login':
      return await handleLogin(data);
    
    case 'logout':
      return await handleLogout();
    
    case 'getPageStats':
      return await handleGetPageStats(data);
    
    default:
      return { success: false, error: 'Unknown action' };
  }
}

// Handle registration
async function handleRegister(data) {
  try {
    if (!localAuthManager) {
      return { success: false, error: 'Auth manager not initialized' };
    }

    const { email, password, name } = data;
    const result = await localAuthManager.register(email, password, name);
    
    return result;
  } catch (error) {
    console.error('Registration handler error:', error);
    return { success: false, error: error.message };
  }
}

// Handle login
async function handleLogin(data) {
  try {
    if (!localAuthManager) {
      return { success: false, error: 'Auth manager not initialized' };
    }

    const { email, password } = data;
    const result = await localAuthManager.login(email, password);
    
    return result;
  } catch (error) {
    console.error('Login handler error:', error);
    return { success: false, error: error.message };
  }
}

// Handle logout
async function handleLogout() {
  try {
    if (!localAuthManager) {
      return { success: false, error: 'Auth manager not initialized' };
    }

    const result = await localAuthManager.logout();
    return result;
  } catch (error) {
    console.error('Logout handler error:', error);
    return { success: false, error: error.message };
  }
}

// Handle get page stats
async function handleGetPageStats(data) {
  try {
    const { tabId, url } = data;
    
    if (!url) {
      return { success: false, error: 'URL required' };
    }

    // Extract domain from URL
    const domain = new URL(url).hostname;

    // Query requests for this domain in the last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    const query = `
      SELECT 
        COUNT(*) as totalRequests,
        AVG(duration) as avgResponse,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errorCount,
        SUM(size_bytes) as dataTransferred
      FROM bronze_requests
      WHERE domain = ? AND timestamp > ?
    `;

    let stats = {
      totalRequests: 0,
      avgResponse: 0,
      errorCount: 0,
      dataTransferred: 0
    };

    try {
      if (dbManager?.executeQuery) {
        // Note: executeQuery may be synchronous depending on implementation
        const result = dbManager.executeQuery(query, [domain, fiveMinutesAgo]);
        
        if (result && result[0]?.values && result[0].values.length > 0) {
          const [total, avg, errors, bytes] = result[0].values[0];
          stats = {
            totalRequests: total || 0,
            avgResponse: avg || 0,
            errorCount: errors || 0,
            dataTransferred: bytes || 0
          };
        }
      }
    } catch (queryError) {
      console.error('Query error:', queryError);
      // Return default stats if query fails
    }

    return { success: true, stats };
  } catch (error) {
    console.error('Get page stats error:', error);
    return { success: false, error: error.message };
  }
}
