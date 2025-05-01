// Create a panel named "Universal Analyzer"
chrome.devtools.panels.create(
  "Universal Analyzer", // Title
  "assets/icons/icon16.png", // Icon path (adjust if needed)
  "devtools/panel.html", // Page path
  (panel) => {
    // Panel creation callback
    console.log("Universal Analyzer panel created");

    let panelWindow = null;
    let currentUrl = "";

    // Function to send URL to the panel
    const sendUrlToPanel = (url) => {
      if (panelWindow && url) {
        panelWindow.postMessage({ type: "URL_UPDATE", url: url }, "*");
      }
    };

    // Listen for when the panel is shown
    panel.onShown.addListener((window) => {
      panelWindow = window;
      // Send the current URL immediately if available
      if (currentUrl) {
        sendUrlToPanel(currentUrl);
      }
    });

    // Listen for when the panel is hidden
    panel.onHidden.addListener(() => {
      // Optional: Clean up listeners or state if needed
      // panelWindow = null; // Consider if resetting is necessary
    });

    // Get the initial URL
    chrome.devtools.inspectedWindow.eval(
      "location.href",
      (result, isException) => {
        if (!isException && result) {
          currentUrl = result;
          sendUrlToPanel(currentUrl);
        }
      }
    );

    // Listen for navigation events in the inspected window
    chrome.devtools.network.onNavigated.addListener((url) => {
      currentUrl = url;
      sendUrlToPanel(currentUrl);
    });
  }
);
