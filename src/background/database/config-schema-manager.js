// Config Schema Manager
// Manages all application configuration using the medallion Config schema

import { DatabaseError } from "../errors/error-types.js";

/**
 * ConfigSchemaManager - Manages configuration stored in the Config schema
 */
export class ConfigSchemaManager {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.initialized = false;
  }

  /**
   * Initialize the configuration manager
   */
  async initialize() {
    if (this.initialized) {
      console.warn('ConfigSchemaManager already initialized');
      return;
    }

    try {
      // Verify config tables exist
      const result = this.db.exec(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name='config_app_settings'
      `);
      
      if (!result || !result[0] || !result[0].values[0] || result[0].values[0][0] === 0) {
        console.warn('Config tables not found');
      }
      
      this.initialized = true;
      console.log('ConfigSchemaManager initialized');
    } catch (error) {
      console.error('Failed to initialize ConfigSchemaManager:', error);
      throw error;
    }
  }

  /**
   * Get application setting
   */
  async getAppSetting(key) {
    try {
      // Check cache first
      const cached = this.cache.get(`app:${key}`);
      if (cached && cached.expires > Date.now()) {
        return this.parseValue(cached.value, cached.dataType);
      }

      const result = this.db.exec(`
        SELECT value, data_type FROM config_app_settings WHERE key = ?
      `, [key]);

      if (result && result.length > 0 && result[0].values.length > 0) {
        const [value, dataType] = result[0].values[0];
        
        // Cache the result
        this.cache.set(`app:${key}`, {
          value,
          dataType,
          expires: Date.now() + this.cacheTimeout
        });

        return this.parseValue(value, dataType);
      }

      return null;
    } catch (error) {
      console.error('Failed to get app setting:', error);
      throw new DatabaseError('Failed to get app setting', error);
    }
  }

  /**
   * Set application setting
   */
  async setAppSetting(key, value, options = {}) {
    try {
      const {
        category = 'general',
        description = '',
        isEncrypted = false
      } = options;

      const dataType = this.getDataType(value);
      const serializedValue = this.serializeValue(value, dataType);
      const now = Date.now();

      this.db.exec(`
        INSERT OR REPLACE INTO config_app_settings (
          key, value, data_type, category, description, is_encrypted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM config_app_settings WHERE key = ?), ?), ?)
      `, [key, serializedValue, dataType, category, description, isEncrypted ? 1 : 0, key, now, now]);

      // Update cache
      this.cache.set(`app:${key}`, {
        value: serializedValue,
        dataType,
        expires: Date.now() + this.cacheTimeout
      });

      this.eventBus?.publish('config:setting:changed', { key, value, category });
      return true;
    } catch (error) {
      console.error('Failed to set app setting:', error);
      throw new DatabaseError('Failed to set app setting', error);
    }
  }

  /**
   * Get all settings for a category
   */
  async getSettingsByCategory(category) {
    try {
      const result = this.db.exec(`
        SELECT key, value, data_type FROM config_app_settings WHERE category = ?
      `, [category]);

      if (!result || result.length === 0) {
        return {};
      }

      const settings = {};
      result[0].values.forEach(([key, value, dataType]) => {
        settings[key] = this.parseValue(value, dataType);
      });

      return settings;
    } catch (error) {
      console.error('Failed to get settings by category:', error);
      throw new DatabaseError('Failed to get settings by category', error);
    }
  }

  /**
   * Get feature flag status
   */
  async getFeatureFlag(featureKey) {
    try {
      const result = this.db.exec(`
        SELECT enabled, rollout_percentage FROM config_feature_flags WHERE feature_key = ?
      `, [featureKey]);

      if (result && result.length > 0 && result[0].values.length > 0) {
        const [enabled, rolloutPercentage] = result[0].values[0];
        
        // Check rollout percentage
        if (enabled && rolloutPercentage < 100) {
          // Simple random rollout
          const random = Math.random() * 100;
          return random <= rolloutPercentage;
        }

        return !!enabled;
      }

      return false;
    } catch (error) {
      console.error('Failed to get feature flag:', error);
      return false;
    }
  }

  /**
   * Set feature flag
   */
  async setFeatureFlag(featureKey, enabled, options = {}) {
    try {
      const {
        rolloutPercentage = 100,
        description = '',
        targetUsers = null,
        conditions = null
      } = options;

      const now = Date.now();

      this.db.exec(`
        INSERT OR REPLACE INTO config_feature_flags (
          feature_key, enabled, rollout_percentage, target_users,
          conditions, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM config_feature_flags WHERE feature_key = ?), ?), ?)
      `, [
        featureKey,
        enabled ? 1 : 0,
        rolloutPercentage,
        targetUsers,
        conditions,
        description,
        featureKey,
        now,
        now
      ]);

      this.eventBus?.publish('config:feature-flag:changed', { featureKey, enabled });
      return true;
    } catch (error) {
      console.error('Failed to set feature flag:', error);
      throw new DatabaseError('Failed to set feature flag', error);
    }
  }

  /**
   * Get user preference
   */
  async getUserPreference(userId, preferenceKey) {
    try {
      const result = this.db.exec(`
        SELECT preference_value FROM config_user_preferences 
        WHERE user_id = ? AND preference_key = ?
      `, [userId, preferenceKey]);

      if (result && result.length > 0 && result[0].values.length > 0) {
        const value = result[0].values[0][0];
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get user preference:', error);
      throw new DatabaseError('Failed to get user preference', error);
    }
  }

  /**
   * Set user preference
   */
  async setUserPreference(userId, preferenceKey, preferenceValue) {
    try {
      const now = Date.now();
      const serializedValue = typeof preferenceValue === 'object' 
        ? JSON.stringify(preferenceValue) 
        : String(preferenceValue);

      this.db.exec(`
        INSERT OR REPLACE INTO config_user_preferences (
          user_id, preference_key, preference_value, created_at, updated_at
        ) VALUES (?, ?, ?, COALESCE((SELECT created_at FROM config_user_preferences WHERE user_id = ? AND preference_key = ?), ?), ?)
      `, [userId, preferenceKey, serializedValue, userId, preferenceKey, now, now]);

      this.eventBus?.publish('config:user-preference:changed', { userId, preferenceKey });
      return true;
    } catch (error) {
      console.error('Failed to set user preference:', error);
      throw new DatabaseError('Failed to set user preference', error);
    }
  }

  /**
   * Get performance settings
   */
  async getPerformanceSettings() {
    try {
      const result = this.db.exec(`
        SELECT * FROM config_performance WHERE id = 1
      `);

      if (result && result.length > 0 && result[0].values.length > 0) {
        const columns = result[0].columns;
        const values = result[0].values[0];
        const settings = {};
        
        columns.forEach((col, idx) => {
          settings[col] = values[idx];
        });

        return settings;
      }

      return null;
    } catch (error) {
      console.error('Failed to get performance settings:', error);
      throw new DatabaseError('Failed to get performance settings', error);
    }
  }

  /**
   * Update performance settings
   */
  async updatePerformanceSettings(settings) {
    try {
      const now = Date.now();
      const {
        enabled = false,
        samplingRate = 100,
        captureNavigationTiming = true,
        captureResourceTiming = true,
        captureServerTiming = true,
        captureCustomMetrics = false,
        retentionPeriodMs = 604800000,
        maxMetricsStored = 10000
      } = settings;

      this.db.exec(`
        INSERT OR REPLACE INTO config_performance (
          id, enabled, sampling_rate, capture_navigation_timing,
          capture_resource_timing, capture_server_timing,
          capture_custom_metrics, retention_period_ms,
          max_metrics_stored, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        enabled ? 1 : 0,
        samplingRate,
        captureNavigationTiming ? 1 : 0,
        captureResourceTiming ? 1 : 0,
        captureServerTiming ? 1 : 0,
        captureCustomMetrics ? 1 : 0,
        retentionPeriodMs,
        maxMetricsStored,
        now
      ]);

      this.eventBus?.publish('config:performance:updated', settings);
      return true;
    } catch (error) {
      console.error('Failed to update performance settings:', error);
      throw new DatabaseError('Failed to update performance settings', error);
    }
  }

  /**
   * Get storage settings
   */
  async getStorageSettings() {
    try {
      const result = this.db.exec(`
        SELECT * FROM config_storage WHERE id = 1
      `);

      if (result && result.length > 0 && result[0].values.length > 0) {
        const columns = result[0].columns;
        const values = result[0].values[0];
        const settings = {};
        
        columns.forEach((col, idx) => {
          settings[col] = values[idx];
        });

        return settings;
      }

      return null;
    } catch (error) {
      console.error('Failed to get storage settings:', error);
      throw new DatabaseError('Failed to get storage settings', error);
    }
  }

  /**
   * Update storage settings
   */
  async updateStorageSettings(settings) {
    try {
      const now = Date.now();
      const {
        maxRequests = 10000,
        maxSizeMb = 100,
        autoCleanupEnabled = true,
        cleanupIntervalMs = 3600000,
        retentionDays = 30,
        compressionEnabled = true
      } = settings;

      this.db.exec(`
        INSERT OR REPLACE INTO config_storage (
          id, max_requests, max_size_mb, auto_cleanup_enabled,
          cleanup_interval_ms, retention_days, compression_enabled, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      `, [
        maxRequests,
        maxSizeMb,
        autoCleanupEnabled ? 1 : 0,
        cleanupIntervalMs,
        retentionDays,
        compressionEnabled ? 1 : 0,
        now
      ]);

      this.eventBus?.publish('config:storage:updated', settings);
      return true;
    } catch (error) {
      console.error('Failed to update storage settings:', error);
      throw new DatabaseError('Failed to update storage settings', error);
    }
  }

  /**
   * Get export settings
   */
  async getExportSettings() {
    try {
      const result = this.db.exec(`
        SELECT * FROM config_export WHERE id = 1
      `);

      if (result && result.length > 0 && result[0].values.length > 0) {
        const columns = result[0].columns;
        const values = result[0].values[0];
        const settings = {};
        
        columns.forEach((col, idx) => {
          settings[col] = values[idx];
        });

        return settings;
      }

      return null;
    } catch (error) {
      console.error('Failed to get export settings:', error);
      throw new DatabaseError('Failed to get export settings', error);
    }
  }

  /**
   * Update export settings
   */
  async updateExportSettings(settings) {
    try {
      const now = Date.now();
      const {
        defaultFormat = 'json',
        compressionEnabled = true,
        maxExportSizeMb = 100,
        includeHeaders = true,
        includeTimings = true,
        includeBody = false
      } = settings;

      this.db.exec(`
        INSERT OR REPLACE INTO config_export (
          id, default_format, compression_enabled, max_export_size_mb,
          include_headers, include_timings, include_body, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      `, [
        defaultFormat,
        compressionEnabled ? 1 : 0,
        maxExportSizeMb,
        includeHeaders ? 1 : 0,
        includeTimings ? 1 : 0,
        includeBody ? 1 : 0,
        now
      ]);

      this.eventBus?.publish('config:export:updated', settings);
      return true;
    } catch (error) {
      console.error('Failed to update export settings:', error);
      throw new DatabaseError('Failed to update export settings', error);
    }
  }

  /**
   * Get extension configuration
   */
  async getExtensionConfig() {
    try {
      const result = this.db.exec(`
        SELECT * FROM config_extension WHERE id = 1
      `);

      if (result && result.length > 0 && result[0].values.length > 0) {
        const columns = result[0].columns;
        const values = result[0].values[0];
        const config = {};
        
        columns.forEach((col, idx) => {
          config[col] = values[idx];
        });

        return config;
      }

      return null;
    } catch (error) {
      console.error('Failed to get extension config:', error);
      throw new DatabaseError('Failed to get extension config', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.eventBus?.publish('config:cache:cleared', {});
  }

  /**
   * Determine data type of a value
   */
  getDataType(value) {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'object') return 'json';
    return 'string';
  }

  /**
   * Serialize value for storage
   */
  serializeValue(value, dataType) {
    if (dataType === 'json') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Parse value from storage
   */
  parseValue(value, dataType) {
    if (!value) return null;

    try {
      switch (dataType) {
        case 'boolean':
          return value === 'true' || value === '1' || value === 1;
        case 'number':
          return Number(value);
        case 'json':
          return JSON.parse(value);
        default:
          return value;
      }
    } catch (error) {
      console.error('Failed to parse value:', error);
      return value;
    }
  }
}

export function createConfigSchemaManager(db, eventBus) {
  return new ConfigSchemaManager(db, eventBus);
}
