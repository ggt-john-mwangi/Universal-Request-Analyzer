// Capture and send performance metrics to the background script
function capturePerformanceMetrics() {
  const performance = window.performance;
  const entries = performance.getEntriesByType("resource");

  const metrics = entries.map((entry) => ({
    name: entry.name,
    initiatorType: entry.initiatorType,
    transferSize: entry.transferSize,
    duration: entry.duration,
    startTime: entry.startTime,
    responseEnd: entry.responseEnd,
  }));

  chrome.runtime.sendMessage({
    action: "performanceMetrics",
    metrics: metrics,
  });
}

// Capture detailed resource timing
function extractResourceDetails() {
  const resourceDetails = performance
    .getEntriesByType("resource")
    .map((entry) => ({
      url: entry.name,
      type: entry.initiatorType,
      duration: entry.duration,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      timings: {
        redirectStart: entry.redirectStart,
        redirectEnd: entry.redirectEnd,
        fetchStart: entry.fetchStart,
        domainLookupStart: entry.domainLookupStart,
        domainLookupEnd: entry.domainLookupEnd,
        connectStart: entry.connectStart,
        connectEnd: entry.connectEnd,
        requestStart: entry.requestStart,
        responseStart: entry.responseStart,
        responseEnd: entry.responseEnd,
      },
    }));

  chrome.runtime.sendMessage({
    action: "resourceDetails",
    details: resourceDetails,
  });
}

// Capture network errors
window.addEventListener("error", (event) => {
  chrome.runtime.sendMessage({
    action: "networkError",
    error: {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      errorObject: event.error ? event.error.toString() : null,
    },
  });
});

// Run performance capture on page load and after a short delay
window.addEventListener("load", () => {
  setTimeout(() => {
    capturePerformanceMetrics();
    extractResourceDetails();
  }, 1000); // Delay to ensure most resources are loaded
});
