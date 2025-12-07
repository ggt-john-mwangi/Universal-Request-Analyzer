// Simplified Background Script with Local Auth
// Initializes database, local auth, and message handlers

import { initDatabase } from "./database/db-manager.js";
import { setupLocalAuth } from "./auth/local-auth-manager.js";
import { initializePopupMessageHandler } from "./messaging/popup-message-handler.js";

class SimpleExtensionInitializer {
  constructor() {
    this.dbManager = null;
    this.localAuth = null;
  }

  async initialize() {
    try {
      console.log('Initializing Universal Request Analyzer...');

      // Step 1: Initialize database
      await this.initializeDatabase();

      // Step 2: Initialize local authentication
      await this.initializeLocalAuth();

      // Step 3: Initialize message handlers
      this.initializeMessageHandlers();

      console.log('✓ Extension initialized successfully!');
      return true;
    } catch (error) {
      console.error('❌ Extension initialization failed:', error);
      return false;
    }
  }

  async initializeDatabase() {
    console.log('→ Initializing Database...');
    
    try {
      this.dbManager = await initDatabase();
      console.log('✓ Database initialized');
    } catch (error) {
      console.error('Database initialization failed:', error);
      // Create a mock dbManager for testing
      this.dbManager = {
        executeQuery: () => [[{ columns: [], values: [] }]]
      };
    }
  }

  async initializeLocalAuth() {
    console.log('→ Initializing Local Authentication...');
    
    this.localAuth = setupLocalAuth(this.dbManager);
    await this.localAuth.initialize();
    
    console.log('✓ Local Authentication initialized');
  }

  initializeMessageHandlers() {
    console.log('→ Initializing Message Handlers...');
    
    initializePopupMessageHandler(this.localAuth, this.dbManager);
    
    console.log('✓ Message Handlers initialized');
  }
}

// Create and initialize extension
const extensionInitializer = new SimpleExtensionInitializer();

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  await extensionInitializer.initialize();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started');
  await extensionInitializer.initialize();
});

// Initialize immediately if service worker is already running
(async () => {
  await extensionInitializer.initialize();
})();

// Export for testing/debugging
if (typeof globalThis !== 'undefined') {
  globalThis.extensionInitializer = extensionInitializer;
}

export { extensionInitializer };
