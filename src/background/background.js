// Integrated Background Script with Medallion Architecture
// Full implementation connecting all components

import { initDatabase } from './database/db-manager.js';
import { setupLocalAuth } from './auth/local-auth-manager.js';
import { initializePopupMessageHandler } from './messaging/popup-message-handler.js';
import { DatabaseManagerMedallion } from './database/db-manager-medallion.js';
import { MedallionManager } from './database/medallion-manager.js';
import { AnalyticsProcessor } from './database/analytics-processor.js';
import { ConfigSchemaManager } from './database/config-schema-manager.js';
import { RequestCaptureIntegration } from './capture/request-capture-integration.js';
import { migrateLegacyToMedallion } from './database/medallion-migration.js';

class IntegratedExtensionInitializer {
  constructor() {
    this.dbManager = null;
    this.medallionDb = null;
    this.localAuth = null;
    this.configManager = null;
    this.medallionManager = null;
    this.analyticsProcessor = null;
    this.requestCapture = null;
    this.eventBus = this.createEventBus();
    this.scheduledTasks = [];
  }

  createEventBus() {
    const subscribers = new Map();
    return {
      subscribe: (event, callback) => {
        if (!subscribers.has(event)) {
          subscribers.set(event, []);
        }
        subscribers.get(event).push(callback);
      },
      publish: (event, data) => {
        if (subscribers.has(event)) {
          subscribers.get(event).forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error(`Event handler error for ${event}:`, error);
            }
          });
        }
      }
    };
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Universal Request Analyzer with Medallion Architecture...');

      // Step 1: Initialize database with medallion architecture
      await this.initializeDatabase();

      // Step 2: Initialize local authentication
      await this.initializeLocalAuth();

      // Step 3: Initialize configuration manager
      await this.initializeConfigManager();

      // Step 4: Initialize medallion manager
      await this.initializeMedallionManager();

      // Step 5: Initialize analytics processor
      await this.initializeAnalyticsProcessor();

      // Step 6: Initialize request capture
      await this.initializeRequestCapture();

      // Step 7: Initialize message handlers
      this.initializeMessageHandlers();

      // Step 8: Schedule periodic tasks
      this.schedulePeriodicTasks();

      console.log('✅ Extension initialized successfully with medallion architecture!');
      return true;
    } catch (error) {
      console.error('❌ Extension initialization failed:', error);
      return false;
    }
  }

  async initializeDatabase() {
    console.log('→ Initializing Medallion Database...');
    
    try {
      // Initialize legacy database first
      this.dbManager = await initDatabase();
      
      // Initialize medallion database
      this.medallionDb = new DatabaseManagerMedallion();
      await this.medallionDb.initialize();
      
      // Check if migration is needed
      const needsMigration = await this.checkLegacyData();
      if (needsMigration) {
        console.log('→ Migrating legacy data to medallion architecture...');
        await migrateLegacyToMedallion(this.dbManager, this.medallionDb);
        console.log('✓ Legacy data migration complete');
      }
      
      console.log('✓ Medallion Database initialized');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  async checkLegacyData() {
    try {
      const result = await this.dbManager.executeQuery(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name='requests'
      `);
      return result[0]?.values?.[0]?.[0] > 0;
    } catch (error) {
      return false;
    }
  }

  async initializeLocalAuth() {
    console.log('→ Initializing Local Authentication...');
    
    this.localAuth = setupLocalAuth(this.dbManager);
    await this.localAuth.initialize();
    
    console.log('✓ Local Authentication initialized');
  }

  async initializeConfigManager() {
    console.log('→ Initializing Configuration Manager...');
    
    this.configManager = new ConfigSchemaManager(this.medallionDb.db, this.eventBus);
    await this.configManager.initialize();
    
    // Set default configurations
    await this.configManager.setSetting('capture.enabled', true);
    await this.configManager.setSetting('analytics.enabled', true);
    
    console.log('✓ Configuration Manager initialized');
  }

  async initializeMedallionManager() {
    console.log('→ Initializing Medallion Manager...');
    
    this.medallionManager = new MedallionManager(this.medallionDb.db, this.eventBus);
    
    // Subscribe to Bronze layer events for automatic processing
    this.eventBus.subscribe('bronze:new_request', async (data) => {
      try {
        await this.medallionManager.processBronzeToSilver(data.requestId);
      } catch (error) {
        console.error('Failed to process Bronze→Silver:', error);
      }
    });
    
    console.log('✓ Medallion Manager initialized');
  }

  async initializeAnalyticsProcessor() {
    console.log('→ Initializing Analytics Processor...');
    
    this.analyticsProcessor = new AnalyticsProcessor(this.medallionDb.db, this.eventBus);
    
    console.log('✓ Analytics Processor initialized');
  }

  async initializeRequestCapture() {
    console.log('→ Initializing Request Capture...');
    
    const config = {
      filters: {
        includePatterns: ['<all_urls>']
      }
    };
    
    this.requestCapture = new RequestCaptureIntegration(
      this.medallionDb,
      this.eventBus,
      config
    );
    
    this.requestCapture.initialize();
    
    console.log('✓ Request Capture initialized');
  }

  initializeMessageHandlers() {
    console.log('→ Initializing Message Handlers...');
    
    initializePopupMessageHandler(this.localAuth, this.medallionDb);
    
    // Add additional message handlers for medallion features
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMedallionMessages(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });
    
    console.log('✓ Message Handlers initialized');
  }

  async handleMedallionMessages(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'processToSilver':
          const count = await this.medallionManager.processBronzeToSilver();
          sendResponse({ success: true, processed: count });
          break;
          
        case 'getDomainStats':
          const stats = await this.medallionManager.getDomainStatistics(message.domain);
          sendResponse({ success: true, data: stats });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  schedulePeriodicTasks() {
    console.log('→ Scheduling Periodic Tasks...');
    
    // Process Bronze→Silver every 30 seconds (batch processing)
    const bronzeToSilver = setInterval(async () => {
      try {
        const count = await this.medallionManager.processBronzeToSilver();
        if (count > 0) {
          console.log(`Processed ${count} Bronze→Silver records`);
        }
      } catch (error) {
        console.error('Bronze→Silver processing failed:', error);
      }
    }, 30000); // 30 seconds for better performance
    this.scheduledTasks.push(bronzeToSilver);
    
    // Process Silver→Gold daily using chrome.alarms for reliability
    // Create alarm for daily processing at midnight
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.create('dailyGoldProcessing', {
        when: this.getNextMidnight(),
        periodInMinutes: 24 * 60 // Daily
      });
      
      chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'dailyGoldProcessing') {
          try {
            await this.medallionManager.processSilverToGold();
            console.log('Processed Silver→Gold for daily aggregation');
          } catch (error) {
            console.error('Silver→Gold processing failed:', error);
          }
        }
      });
    } else {
      // Fallback to interval-based check
      const dailyGold = setInterval(async () => {
        try {
          const now = new Date();
          const hour = now.getHours();
          const minute = now.getMinutes();
          // Process between midnight and 1am
          if (hour === 0 && minute < 30) {
            await this.medallionManager.processSilverToGold();
            console.log('Processed Silver→Gold for daily aggregation');
          }
        } catch (error) {
          console.error('Silver→Gold processing failed:', error);
        }
      }, 30 * 60 * 1000); // Check every 30 minutes
      this.scheduledTasks.push(dailyGold);
    }
    
    console.log('✓ Periodic Tasks scheduled');
    console.log('  - Bronze→Silver: every 30 seconds');
    console.log('  - Silver→Gold: daily at midnight (chrome.alarms)');
  }

  getNextMidnight() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  async cleanup() {
    console.log('Cleaning up scheduled tasks...');
    this.scheduledTasks.forEach(task => clearInterval(task));
    this.scheduledTasks = [];
    
    // Clear alarms
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clear('dailyGoldProcessing');
    }
    
    // Save database before cleanup
    try {
      console.log('Saving database before cleanup...');
      const { saveDatabase } = await import('./database/db-manager.js');
      await saveDatabase();
      console.log('Database saved successfully.');
    } catch (error) {
      console.error('Failed to save database during cleanup:', error);
    }
  }
}

// Create and initialize extension
const extensionInitializer = new IntegratedExtensionInitializer();

// Initialize on install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  await extensionInitializer.initialize();
});

// Initialize on browser startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started');
  await extensionInitializer.initialize();
});

// Initialize immediately if service worker is already running
(async () => {
  await extensionInitializer.initialize();
})();

// Cleanup on suspension (service worker)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onSuspend.addListener(() => {
    console.log('Service worker suspending, cleaning up...');
    extensionInitializer.cleanup();
  });
}

// Export for testing/debugging
if (typeof globalThis !== 'undefined') {
  globalThis.extensionInitializer = extensionInitializer;
}

export { extensionInitializer };
