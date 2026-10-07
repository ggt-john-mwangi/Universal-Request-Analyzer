// Main Popup Entry Point

import { showApp } from "./popup-ui.js";
import { loadPageSummary, stopAutoRefresh, updateRecentErrors } from "./popup-data.js";
import { setupEventListeners } from "./popup-events.js";
import { checkAndShowWelcome } from "./popup-welcome.js";
import { loadRecentRequests } from "./popup-requests.js";

document.addEventListener("DOMContentLoaded", async () => {
  showApp();
  await checkAndShowWelcome();
  await loadPageSummary();
  await loadRecentRequests();
  updateRecentErrors().catch(() => {});
  setupEventListeners();
});

window.addEventListener("beforeunload", () => {
  stopAutoRefresh();
});
