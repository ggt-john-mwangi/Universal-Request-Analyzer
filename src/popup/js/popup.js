// Main Popup Entry Point
// Simplified Popup Script - No Auth Required
// Shows page summary immediately on load

import { showApp } from "./popup-ui.js";
import { loadPageSummary, stopAutoRefresh } from "./popup-data.js";
import { setupEventListeners } from "./popup-events.js";

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  showApp();
  await loadPageSummary();
  setupEventListeners();
});

// Cleanup on popup close
window.addEventListener("beforeunload", () => {
  stopAutoRefresh();
});
