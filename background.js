const networkRequests = new Map();
const performanceMetrics = [];
const resourceDetails = [];
const networkErrors = [];

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    networkRequests.set(details.requestId, {
      url: details.url,
      method: details.method,
      type: details.type,
      timeStamp: details.timeStamp,
    });
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const request = networkRequests.get(details.requestId);
    if (request) {
      request.status = details.statusCode;
      request.duration = Date.now() - request.timeStamp;
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "getNetworkRequests":
      sendResponse({
        requests: Array.from(networkRequests.values()),
        performanceMetrics: performanceMetrics,
        resourceDetails: resourceDetails,
        networkErrors: networkErrors,
      });
      break;
    case "performanceMetrics":
      performanceMetrics.push(...request.metrics);
      break;
    case "resourceDetails":
      resourceDetails.push(...request.details);
      break;
    case "networkError":
      networkErrors.push(request.error);
      break;
  }
});
