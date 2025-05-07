// Create a panel named "Universal Analyzer"
chrome.devtools.panels.create(
  "Universal Analyzer", // Title
  "assets/icons/icon16.png", // Icon path (adjust if needed)
  "panel.html", // Page path
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

    // Add debug logging for all outgoing messages from DevTools
    function debugSendMessage(message, callback) {
      console.log('[DevTools] Sending message to background:', message);
      chrome.runtime.sendMessage(message, (response) => {
        console.log('[DevTools] Got response from background:', response);
        if (callback) callback(response);
      });
    }

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

    // Listen for network requests in DevTools and forward to background
    chrome.devtools.network.onRequestFinished.addListener((request) => {
      // Extract timing info if available
      const timing = request.timings || {};
      const req = {
        url: request.request.url,
        method: request.request.method,
        status: request.response.status,
        statusText: request.response.statusText,
        type: request._resourceType || request.request.initiator?.type || "other",
        startTime: request.startedDateTime ? new Date(request.startedDateTime).getTime() : Date.now(),
        endTime: request.time ? (new Date(request.startedDateTime).getTime() + request.time) : undefined,
        duration: request.time,
        timings: {
          dns: timing.dns,
          tcp: timing.connect,
          ssl: timing.ssl,
          ttfb: timing.send,
          download: timing.receive,
        },
        size: request.response.bodySize,
        encodedBodySize: request.response.encodedDataLength,
        decodedBodySize: request.response.bodySize,
      };
      // Send to background for unified storage
      debugSendMessage({
        action: "devtoolsRequestCaptured",
        request: req,
      });
    });
  }
);
