// Message Handler for Popup Auth and Stats
// Handles registration, login, logout, and page stats requests

let localAuthManager = null;
let dbManager = null;

// Initialize message handler
export function initializePopupMessageHandler(auth, database) {
  localAuthManager = auth;
  dbManager = database;
  console.log('Popup message handler initialized');
  
  // Return the handler function to be used by central listener
  return handleMessage;
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
    
    case 'getDashboardStats':
      return await handleGetDashboardStats(message.timeRange);
    
    case 'getMetrics':
      return await handleGetMetrics(message.timeRange);
    
    case 'query':
      return await handleQuery(message.query, message.params);
    
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
    
    let stats = {
      totalRequests: 0,
      avgResponse: 0,
      errorCount: 0,
      dataTransferred: 0,
      requestTypes: {},
      statusCodes: {},
      timestamps: [],
      responseTimes: []
    };

    try {
      if (dbManager && dbManager.db) {
        // Query aggregate stats
        const aggregateQuery = `
          SELECT 
            COUNT(*) as totalRequests,
            AVG(duration) as avgResponse,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errorCount,
            SUM(size_bytes) as dataTransferred
          FROM bronze_requests
          WHERE domain = ? AND created_at > ?
        `;
        
        const aggregateResult = dbManager.db.exec(aggregateQuery, [domain, fiveMinutesAgo]);
        
        if (aggregateResult && aggregateResult[0]?.values && aggregateResult[0].values.length > 0) {
          const [total, avg, errors, bytes] = aggregateResult[0].values[0];
          stats.totalRequests = total || 0;
          stats.avgResponse = Math.round(avg || 0);
          stats.errorCount = errors || 0;
          stats.dataTransferred = bytes || 0;
        }

        // Query detailed request data for charts
        const detailQuery = `
          SELECT type, status, duration, created_at
          FROM bronze_requests
          WHERE domain = ? AND created_at > ?
          ORDER BY created_at DESC
          LIMIT 100
        `;
        
        const detailResult = dbManager.db.exec(detailQuery, [domain, fiveMinutesAgo]);
        
        if (detailResult && detailResult[0]?.values) {
          detailResult[0].values.forEach(row => {
            const [type, status, duration, timestamp] = row;
            
            // Aggregate by type
            if (type) {
              stats.requestTypes[type] = (stats.requestTypes[type] || 0) + 1;
            }
            
            // Aggregate by status code
            if (status) {
              stats.statusCodes[status] = (stats.statusCodes[status] || 0) + 1;
            }
            
            // Collect timestamps and response times
            if (timestamp) stats.timestamps.push(timestamp);
            if (duration) stats.responseTimes.push(duration);
          });
        }

        console.log(`Page stats for ${domain}: ${stats.totalRequests} requests`);
      } else {
        console.warn('Database manager not available');
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
      if (dbManager?.executeQuery) {
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

// Handle get dashboard stats
async function handleGetDashboardStats(timeRange = 86400) {
  try {
    const timeRangeMs = parseInt(timeRange) * 1000;
    const startTime = Date.now() - timeRangeMs;
    
    let stats = {
      totalRequests: 0,
      avgResponse: 0,
      slowRequests: 0,
      errorCount: 0,
      volumeTimeline: { labels: [], values: [] },
      statusDistribution: [0, 0, 0, 0], // 2xx, 3xx, 4xx, 5xx
      topDomains: { labels: [], values: [] },
      performanceTrend: { labels: [], values: [] },
      layerCounts: { bronze: 0, silver: 0, gold: 0 }
    };

    try {
      if (dbManager?.executeQuery) {
        // Get overall stats
        const overallQuery = `
          SELECT 
            COUNT(*) as totalRequests,
            AVG(duration) as avgResponse,
            SUM(CASE WHEN duration > 1000 THEN 1 ELSE 0 END) as slowRequests,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errorCount
          FROM bronze_requests
          WHERE timestamp > ?
        `;
        const overallResult = dbManager.executeQuery(overallQuery, [startTime]);
        
        if (overallResult && overallResult[0]?.values && overallResult[0].values.length > 0) {
          const [total, avg, slow, errors] = overallResult[0].values[0];
          stats.totalRequests = total || 0;
          stats.avgResponse = avg || 0;
          stats.slowRequests = slow || 0;
          stats.errorCount = errors || 0;
        }

        // Get status distribution
        const statusQuery = `
          SELECT 
            CASE 
              WHEN status >= 200 AND status < 300 THEN '2xx'
              WHEN status >= 300 AND status < 400 THEN '3xx'
              WHEN status >= 400 AND status < 500 THEN '4xx'
              WHEN status >= 500 THEN '5xx'
            END as statusGroup,
            COUNT(*) as count
          FROM bronze_requests
          WHERE timestamp > ? AND status IS NOT NULL
          GROUP BY statusGroup
        `;
        const statusResult = dbManager.executeQuery(statusQuery, [startTime]);
        
        if (statusResult && statusResult[0]?.values) {
          const statusMap = { '2xx': 0, '3xx': 1, '4xx': 2, '5xx': 3 };
          statusResult[0].values.forEach(([group, count]) => {
            if (group && statusMap[group] !== undefined) {
              stats.statusDistribution[statusMap[group]] = count;
            }
          });
        }

        // Get top domains
        const domainsQuery = `
          SELECT domain, COUNT(*) as count
          FROM bronze_requests
          WHERE timestamp > ? AND domain IS NOT NULL
          GROUP BY domain
          ORDER BY count DESC
          LIMIT 10
        `;
        const domainsResult = dbManager.executeQuery(domainsQuery, [startTime]);
        
        if (domainsResult && domainsResult[0]?.values) {
          stats.topDomains.labels = domainsResult[0].values.map(r => r[0]);
          stats.topDomains.values = domainsResult[0].values.map(r => r[1]);
        }

        // Get volume timeline (hourly aggregation)
        const hoursToShow = Math.min(Math.ceil(timeRangeMs / (3600 * 1000)), 24);
        const hourlyQuery = `
          SELECT 
            strftime('%H:00', datetime(timestamp/1000, 'unixepoch')) as hour,
            COUNT(*) as count
          FROM bronze_requests
          WHERE timestamp > ?
          GROUP BY hour
          ORDER BY timestamp ASC
          LIMIT ?
        `;
        const volumeResult = dbManager.executeQuery(hourlyQuery, [startTime, hoursToShow]);
        
        if (volumeResult && volumeResult[0]?.values) {
          stats.volumeTimeline.labels = volumeResult[0].values.map(r => r[0]);
          stats.volumeTimeline.values = volumeResult[0].values.map(r => r[1]);
        }

        // Get performance trend (hourly average)
        const perfQuery = `
          SELECT 
            strftime('%H:00', datetime(timestamp/1000, 'unixepoch')) as hour,
            AVG(duration) as avgDuration
          FROM bronze_requests
          WHERE timestamp > ? AND duration IS NOT NULL
          GROUP BY hour
          ORDER BY timestamp ASC
          LIMIT ?
        `;
        const perfResult = dbManager.executeQuery(perfQuery, [startTime, hoursToShow]);
        
        if (perfResult && perfResult[0]?.values) {
          stats.performanceTrend.labels = perfResult[0].values.map(r => r[0]);
          stats.performanceTrend.values = perfResult[0].values.map(r => Math.round(r[1]));
        }

        // Get layer counts
        const layerQueries = {
          bronze: 'SELECT COUNT(*) FROM bronze_requests',
          silver: 'SELECT COUNT(*) FROM silver_requests',
          gold: 'SELECT COUNT(*) FROM gold_daily_analytics'
        };

        for (const [layer, query] of Object.entries(layerQueries)) {
          try {
            const result = dbManager.executeQuery(query);
            if (result && result[0]?.values && result[0].values.length > 0) {
              stats.layerCounts[layer] = result[0].values[0][0] || 0;
            }
          } catch (layerError) {
            console.warn(`Failed to get ${layer} count:`, layerError);
          }
        }
      }
    } catch (queryError) {
      console.error('Dashboard stats query error:', queryError);
    }

    return { success: true, stats };
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return { success: false, error: error.message };
  }
}

// Handle get metrics
async function handleGetMetrics(timeRange = 86400) {
  try {
    // Reuse dashboard stats logic for metrics
    const result = await handleGetDashboardStats(timeRange);
    return result;
  } catch (error) {
    console.error('Get metrics error:', error);
    return { success: false, error: error.message };
  }
}

// Handle database query
async function handleQuery(query, params = []) {
  try {
    if (!dbManager || !dbManager.db) {
      return { success: false, error: 'Database not initialized' };
    }

    // Execute query
    const result = dbManager.db.exec(query, params);
    
    if (!result || result.length === 0) {
      return { success: true, data: [] };
    }

    // Convert SQL.js result format to array of objects
    const columns = result[0].columns;
    const values = result[0].values;
    
    const data = values.map(row => {
      const obj = {};
      columns.forEach((col, index) => {
        obj[col] = row[index];
      });
      return obj;
    });

    return { success: true, data };
  } catch (error) {
    console.error('Query handler error:', error);
    return { success: false, error: error.message };
  }
}
