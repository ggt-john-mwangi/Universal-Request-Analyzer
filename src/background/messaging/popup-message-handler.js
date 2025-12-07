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
  const { action, data, filters } = message;

  switch (action) {
    case 'register':
      return await handleRegister(data);
    
    case 'login':
      return await handleLogin(data);
    
    case 'logout':
      return await handleLogout();
    
    case 'getPageStats':
      return await handleGetPageStats(data);
    
    case 'getFilteredStats':
      return await handleGetFilteredStats(filters);
    
    case 'exportFilteredData':
      return await handleExportFilteredData(filters, message.format);
    
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
      if (dbManager?.db) {
        // Use db.exec directly
        const result = dbManager.db.exec(query, [domain, fiveMinutesAgo]);
        
        if (result && result[0]?.values && result[0].values.length > 0) {
          const [total, avg, errors, bytes] = result[0].values[0];
          stats = {
            totalRequests: total || 0,
            avgResponse: avg || 0,
            errorCount: errors || 0,
            dataTransferred: bytes || 0
          };
        }
      } else if (dbManager?.executeQuery) {
        // Fallback to executeQuery method
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

// Handle get filtered stats for DevTools panel
async function handleGetFilteredStats(filters) {
  try {
    const { pageUrl, timeRange, type, statusPrefix } = filters || {};
    
    // Default to last 5 minutes if not specified
    const timeRangeMs = timeRange ? parseInt(timeRange) * 1000 : 5 * 60 * 1000;
    const startTime = Date.now() - timeRangeMs;
    
    let query = `
      SELECT 
        id, url, method, type, status, duration, size_bytes, timestamp, domain
      FROM bronze_requests
      WHERE timestamp > ?
    `;
    
    const params = [startTime];
    
    // Add page URL filter
    if (pageUrl) {
      const domain = new URL(pageUrl).hostname;
      query += ' AND domain = ?';
      params.push(domain);
    }
    
    // Add type filter
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    // Add status filter
    if (statusPrefix) {
      if (statusPrefix === '3xx') {
        query += ' AND status >= 300 AND status < 400';
      } else if (statusPrefix === '4xx') {
        query += ' AND status >= 400 AND status < 500';
      } else if (statusPrefix === '5xx') {
        query += ' AND status >= 500 AND status < 600';
      } else {
        query += ' AND status = ?';
        params.push(parseInt(statusPrefix));
      }
    }
    
    query += ' ORDER BY timestamp DESC LIMIT 1000';
    
    let requests = [];
    
    try {
      if (dbManager?.db) {
        const result = dbManager.db.exec(query, params);
        if (result && result[0]) {
          requests = mapResultToArray(result[0]);
        }
      } else if (dbManager?.executeQuery) {
        const result = dbManager.executeQuery(query, params);
        if (result && result[0]) {
          requests = mapResultToArray(result[0]);
        }
      }
    } catch (queryError) {
      console.error('Filtered stats query error:', queryError);
    }
    
    // Process data for charts
    const timestamps = [];
    const responseTimes = [];
    const requestTypes = {};
    const statusCodes = {};
    
    requests.forEach(req => {
      // Collect timestamps and response times
      if (req.timestamp && req.duration) {
        timestamps.push(new Date(req.timestamp).toLocaleTimeString());
        responseTimes.push(req.duration);
      }
      
      // Count request types
      if (req.type) {
        requestTypes[req.type] = (requestTypes[req.type] || 0) + 1;
      }
      
      // Count status codes
      if (req.status) {
        const statusGroup = Math.floor(req.status / 100) * 100;
        statusCodes[statusGroup] = (statusCodes[statusGroup] || 0) + 1;
      }
    });
    
    return {
      success: true,
      timestamps: timestamps.slice(-50), // Last 50 data points
      responseTimes: responseTimes.slice(-50),
      requestTypes,
      statusCodes,
      totalRequests: requests.length
    };
  } catch (error) {
    console.error('Get filtered stats error:', error);
    return { success: false, error: error.message };
  }
}

// Handle export filtered data
async function handleExportFilteredData(filters, format) {
  try {
    // Get filtered stats first
    const statsResult = await handleGetFilteredStats(filters);
    
    if (!statsResult.success) {
      return statsResult;
    }
    
    // Format based on requested format
    let exportData;
    if (format === 'json') {
      exportData = JSON.stringify(statsResult, null, 2);
    } else if (format === 'csv') {
      // Simple CSV export
      exportData = 'Timestamp,Response Time,Type,Status\n';
      // Add CSV data from statsResult
    } else {
      exportData = JSON.stringify(statsResult);
    }
    
    // Create download
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    await chrome.downloads.download({
      url: url,
      filename: `request-analyzer-export-${Date.now()}.${format || 'json'}`,
      saveAs: true
    });
    
    return { success: true, message: 'Export initiated' };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to map SQL result to array of objects
function mapResultToArray(result) {
  if (!result || !result.columns || !result.values) {
    return [];
  }

  return result.values.map(row => {
    const obj = {};
    result.columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}
