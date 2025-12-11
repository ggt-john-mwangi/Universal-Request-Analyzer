// Data Sync Manager
// Handles synchronization between local SQLite and backend server

/**
 * DataSyncManager - Manages data synchronization with backend
 */
export class DataSyncManager {
  constructor(dbManager, backendApi, eventBus, config) {
    this.dbManager = dbManager;
    this.backendApi = backendApi;
    this.eventBus = eventBus;
    this.config = config;
    this.syncInterval = null;
    this.isSyncing = false;
    this.lastSyncTimestamp = null;
    this.syncQueue = [];
  }

  /**
   * Initialize sync manager
   */
  async initialize() {
    // Load last sync timestamp
    await this.loadLastSyncTimestamp();

    // Setup auto-sync if enabled
    if (this.config?.autoSync) {
      this.startAutoSync(this.config.syncIntervalMs || 300000); // 5 minutes default
    }

    // Listen for events that trigger sync
    this.setupEventListeners();

    console.log('Data sync manager initialized');
  }

  /**
   * Load last sync timestamp from config
   */
  async loadLastSyncTimestamp() {
    try {
      if (this.dbManager?.config) {
        const setting = await this.dbManager.config.getAppSetting('lastSyncTimestamp');
        this.lastSyncTimestamp = setting ? parseInt(setting, 10) : null;
      }
    } catch (error) {
      console.error('Failed to load last sync timestamp:', error);
    }
  }

  /**
   * Save last sync timestamp to config
   */
  async saveLastSyncTimestamp(timestamp) {
    try {
      this.lastSyncTimestamp = timestamp;
      
      if (this.dbManager?.config) {
        await this.dbManager.config.setAppSetting('lastSyncTimestamp', timestamp.toString(), {
          category: 'sync',
          description: 'Last successful sync timestamp'
        });
      }
    } catch (error) {
      console.error('Failed to save last sync timestamp:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Sync when new data is added
    this.eventBus?.subscribe('medallion:bronze:inserted', () => {
      this.queueSync('requests');
    });

    // Sync on user action
    this.eventBus?.subscribe('sync:manual', async () => {
      await this.syncAll();
    });

    // Handle backend connection changes
    this.eventBus?.subscribe('auth:login:success', async () => {
      await this.syncAll();
    });
  }

  /**
   * Start auto-sync
   */
  startAutoSync(intervalMs) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (!this.isSyncing && this.backendApi?.isAuthenticated) {
        await this.syncAll();
      }
    }, intervalMs);

    console.log(`Auto-sync started with interval: ${intervalMs}ms`);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
  }

  /**
   * Queue item for sync
   */
  queueSync(dataType) {
    if (!this.syncQueue.includes(dataType)) {
      this.syncQueue.push(dataType);
    }
  }

  /**
   * Sync all data types
   */
  async syncAll() {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return { success: false, error: 'Sync in progress' };
    }

    if (!this.backendApi?.isAuthenticated) {
      console.log('Not authenticated, skipping sync');
      return { success: false, error: 'Not authenticated' };
    }

    this.isSyncing = true;
    this.eventBus?.publish('sync:started', { timestamp: Date.now() });

    try {
      const results = {
        uploaded: {},
        downloaded: {},
        errors: []
      };

      // Sync requests
      const requestsResult = await this.syncRequests();
      results.uploaded.requests = requestsResult.uploaded;
      results.downloaded.requests = requestsResult.downloaded;
      if (requestsResult.error) {
        results.errors.push({ type: 'requests', error: requestsResult.error });
      }

      // Sync analytics (Gold layer data)
      const analyticsResult = await this.syncAnalytics();
      results.uploaded.analytics = analyticsResult.uploaded;
      results.downloaded.analytics = analyticsResult.downloaded;
      if (analyticsResult.error) {
        results.errors.push({ type: 'analytics', error: analyticsResult.error });
      }

      // Sync configuration
      const configResult = await this.syncConfiguration();
      results.uploaded.config = configResult.uploaded;
      results.downloaded.config = configResult.downloaded;
      if (configResult.error) {
        results.errors.push({ type: 'config', error: configResult.error });
      }

      // Update last sync timestamp
      await this.saveLastSyncTimestamp(Date.now());

      // Clear sync queue
      this.syncQueue = [];

      this.eventBus?.publish('sync:completed', {
        timestamp: Date.now(),
        results
      });

      return {
        success: true,
        results
      };
    } catch (error) {
      console.error('Sync failed:', error);
      this.eventBus?.publish('sync:failed', { error: error.message });
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync requests data
   */
  async syncRequests() {
    try {
      // Get requests from Silver layer since last sync
      const query = `
        SELECT * FROM silver_requests
        WHERE created_at > ?
        ORDER BY created_at
        LIMIT 1000
      `;
      
      const result = this.dbManager.executeQuery(query, [this.lastSyncTimestamp || 0]);
      const requests = this.mapResultToArray(result);

      let uploaded = 0;
      let downloaded = 0;

      // Upload to backend
      if (requests.length > 0) {
        const uploadResult = await this.backendApi.syncData('requests', requests, {
          lastSyncTimestamp: this.lastSyncTimestamp
        });

        if (uploadResult.success) {
          uploaded = requests.length;
        }
      }

      // Download from backend
      const downloadResult = await this.backendApi.downloadData('requests', {
        since: this.lastSyncTimestamp,
        limit: 1000
      });

      if (downloadResult.success && downloadResult.data?.length > 0) {
        // Merge downloaded data into Silver layer
        await this.mergeDownloadedRequests(downloadResult.data);
        downloaded = downloadResult.data.length;
      }

      return { uploaded, downloaded };
    } catch (error) {
      console.error('Failed to sync requests:', error);
      return { uploaded: 0, downloaded: 0, error: error.message };
    }
  }

  /**
   * Sync analytics data
   */
  async syncAnalytics() {
    try {
      // Get daily analytics from Gold layer since last sync
      const query = `
        SELECT * FROM gold_daily_analytics
        WHERE created_at > ?
        ORDER BY date
        LIMIT 100
      `;
      
      const result = this.dbManager.executeQuery(query, [this.lastSyncTimestamp || 0]);
      const analytics = this.mapResultToArray(result);

      let uploaded = 0;
      let downloaded = 0;

      // Upload to backend
      if (analytics.length > 0) {
        const uploadResult = await this.backendApi.syncData('analytics', analytics, {
          lastSyncTimestamp: this.lastSyncTimestamp
        });

        if (uploadResult.success) {
          uploaded = analytics.length;
        }
      }

      // Download from backend
      const downloadResult = await this.backendApi.downloadData('analytics', {
        since: this.lastSyncTimestamp,
        limit: 100
      });

      if (downloadResult.success && downloadResult.data?.length > 0) {
        // Merge downloaded analytics into Gold layer
        await this.mergeDownloadedAnalytics(downloadResult.data);
        downloaded = downloadResult.data.length;
      }

      return { uploaded, downloaded };
    } catch (error) {
      console.error('Failed to sync analytics:', error);
      return { uploaded: 0, downloaded: 0, error: error.message };
    }
  }

  /**
   * Sync configuration
   */
  async syncConfiguration() {
    try {
      let uploaded = 0;
      let downloaded = 0;

      // Get user preferences
      if (this.dbManager?.config && this.backendApi?.userId) {
        const userId = this.backendApi.userId;
        
        // This would be implemented to get user preferences from config schema
        // For now, placeholder
        const preferences = {}; // await this.dbManager.config.getUserPreferences(userId);

        // Upload preferences
        if (Object.keys(preferences).length > 0) {
          const uploadResult = await this.backendApi.syncData('preferences', preferences);
          if (uploadResult.success) {
            uploaded = 1;
          }
        }

        // Download preferences
        const downloadResult = await this.backendApi.downloadData('preferences');
        if (downloadResult.success && downloadResult.data) {
          // Merge downloaded preferences
          // await this.mergeDownloadedPreferences(downloadResult.data);
          downloaded = 1;
        }
      }

      return { uploaded, downloaded };
    } catch (error) {
      console.error('Failed to sync configuration:', error);
      return { uploaded: 0, downloaded: 0, error: error.message };
    }
  }

  /**
   * Merge downloaded requests into database
   */
  async mergeDownloadedRequests(requests) {
    try {
      for (const request of requests) {
        // Insert into Silver layer if not exists
        const existsQuery = `SELECT COUNT(*) as count FROM silver_requests WHERE id = ?`;
        const existsResult = this.dbManager.executeQuery(existsQuery, [request.id]);
        const exists = existsResult[0]?.values[0]?.[0] > 0;

        if (!exists) {
          // Insert request
          const insertQuery = `
            INSERT INTO silver_requests (
              id, url, method, type, status, domain, timestamp, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          
          this.dbManager.executeQuery(insertQuery, [
            request.id,
            request.url,
            request.method,
            request.type,
            request.status,
            request.domain,
            request.timestamp,
            request.created_at || Date.now(),
            request.updated_at || Date.now()
          ]);
        }
      }

      console.log(`Merged ${requests.length} requests from backend`);
    } catch (error) {
      console.error('Failed to merge downloaded requests:', error);
      throw error;
    }
  }

  /**
   * Merge downloaded analytics into database
   */
  async mergeDownloadedAnalytics(analytics) {
    try {
      for (const analytic of analytics) {
        // Insert into Gold layer if not exists or update if different
        const insertQuery = `
          INSERT OR REPLACE INTO gold_daily_analytics (
            date, total_requests, total_bytes, avg_response_time,
            error_rate, unique_domains, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        this.dbManager.executeQuery(insertQuery, [
          analytic.date,
          analytic.total_requests || 0,
          analytic.total_bytes || 0,
          analytic.avg_response_time || 0,
          analytic.error_rate || 0,
          analytic.unique_domains || 0,
          analytic.created_at || Date.now(),
          Date.now()
        ]);
      }

      console.log(`Merged ${analytics.length} analytics from backend`);
    } catch (error) {
      console.error('Failed to merge downloaded analytics:', error);
      throw error;
    }
  }

  /**
   * Map SQL result to array
   */
  mapResultToArray(result) {
    if (!result || !result[0] || !result[0].columns || !result[0].values) {
      return [];
    }

    return result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTimestamp: this.lastSyncTimestamp,
      autoSyncEnabled: !!this.syncInterval,
      queuedItems: this.syncQueue.length,
      isAuthenticated: this.backendApi?.isAuthenticated || false
    };
  }

  /**
   * Force sync now
   */
  async forceSyncNow() {
    return await this.syncAll();
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopAutoSync();
    this.syncQueue = [];
  }
}

/**
 * Factory function to create data sync manager
 */
export function setupDataSyncManager(dbManager, backendApi, eventBus, config) {
  const manager = new DataSyncManager(dbManager, backendApi, eventBus, config);
  return manager;
}
