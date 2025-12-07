// DevTools Panel Initializer
// Handles the initialization and management of the DevTools panel

import { DevToolsPanel } from './panel.js';

// Initialize panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing DevTools Panel...');
  
  const panel = new DevToolsPanel();
  
  // Listen for tab URL changes
  chrome.devtools.network.onNavigated.addListener((url) => {
    panel.handleUrlChange(url);
  });
  
  // Get current URL
  chrome.devtools.inspectedWindow.eval(
    'window.location.href',
    (result, isException) => {
      if (!isException && result) {
        panel.handleUrlChange(result);
      }
    }
  );
  
  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    panel.destroy();
  });
  
  console.log('✓ DevTools Panel initialized');
});
