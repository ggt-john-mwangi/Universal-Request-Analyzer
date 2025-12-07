// DevTools Panel Initializer
// Handles the initialization and management of the DevTools panel

// Create the DevTools panel
chrome.devtools.panels.create(
  'URA', // Panel title
  '../assets/icons/icon48.png', // Icon path
  'panel.html', // Panel HTML page
  (panel) => {
    console.log('✓ Universal Request Analyzer DevTools panel created');
    
    // Panel shown/hidden events
    panel.onShown.addListener((panelWindow) => {
      console.log('URA panel shown');
    });
    
    panel.onHidden.addListener(() => {
      console.log('URA panel hidden');
    });
  }
);
