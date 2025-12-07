// DevTools Panel Initializer
// Handles the initialization and management of the DevTools panel

console.log('🔧 DevTools script loaded');

// Verify chrome.devtools is available
if (typeof chrome === 'undefined' || !chrome.devtools) {
  console.error('❌ chrome.devtools API not available!');
} else {
  console.log('✓ chrome.devtools API available');
  
  // Create the DevTools panel
  chrome.devtools.panels.create(
    'Request Analyzer', // Panel title
    'assets/icons/icon48.png', // Icon path (relative to extension root)
    'panel.html', // Panel HTML page (relative to extension root)
    (panel) => {
      console.log('✅ Universal Request Analyzer DevTools panel created');
      
      // Panel shown/hidden events
      panel.onShown.addListener((panelWindow) => {
        console.log('📊 URA panel shown');
        // Initialize panel when shown
        if (panelWindow && panelWindow.initializePanel) {
          panelWindow.initializePanel();
        }
      });
      
      panel.onHidden.addListener(() => {
        console.log('👁️ URA panel hidden');
      });
    }
  );
}
