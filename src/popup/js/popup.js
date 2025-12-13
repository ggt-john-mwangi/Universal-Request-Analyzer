// Main Popup Entry Point
// Simplified Popup Script - No Auth Required
// Shows page summary immediately on load

import { showApp } from "./popup-ui.js";
import { loadPageSummary, stopAutoRefresh } from "./popup-data.js";
import { setupEventListeners } from "./popup-events.js";
import { checkAndShowWelcome, showTipsBanner, cleanupTips } from "./popup-welcome.js";
import { loadRecentRequests, clearRequestsList } from "./popup-requests.js";

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  showApp();
  
  // Check if first time user and show welcome
  await checkAndShowWelcome();
  
  // Show tips banner
  showTipsBanner();
  
  // Load data
  await loadPageSummary();
  await loadRecentRequests();
  
  // Setup event listeners
  setupEventListeners();
  setupNewFeatureListeners();
});

// Setup event listeners for new features
function setupNewFeatureListeners() {
  // Clear requests list button
  const clearRequestsBtn = document.getElementById("clearRequestsBtn");
  if (clearRequestsBtn) {
    clearRequestsBtn.onclick = clearRequestsList;
  }
  
  // View all requests button
  const viewAllRequestsBtn = document.getElementById("viewAllRequestsBtn");
  if (viewAllRequestsBtn) {
    viewAllRequestsBtn.onclick = () => {
      // Open DevTools panel
      const openDevtools = document.getElementById("openDevtools");
      if (openDevtools) {
        openDevtools.click();
      }
    };
  }
}

// Cleanup on popup close
window.addEventListener("beforeunload", () => {
  stopAutoRefresh();
  cleanupTips();
});
