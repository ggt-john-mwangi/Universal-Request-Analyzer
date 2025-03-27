// Content script - captures performance metrics from the page

// Create a performance observer to monitor resource timing entries
const observer = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  
  // Filter for network requests
  const networkRequests = entries.filter(entry => 
    entry.entryType === 'resource'
  );
  
  if (networkRequests.length > 0) {
    // Send the performance data to the background script
    chrome.runtime.sendMessage({
      action: 'performanceData',
      entries: networkRequests.map(entry => ({
        name: entry.name,
        duration: entry.duration,
        startTime: entry.startTime,
        initiatorType: entry.initiatorType,
        // Include detailed timing information
        timings: {
          dns: entry.domainLookupEnd - entry.domainLookupStart,
          tcp: entry.connectEnd - entry.connectStart,
          ssl: entry.secureConnectionStart > 0

