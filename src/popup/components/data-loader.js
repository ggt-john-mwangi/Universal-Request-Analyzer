// Handle data fetching and processing
import { getQueryFilters } from "./filters.js";

export function loadData(filters, renderCharts, setError, setLoading) {
  setLoading(true);
  setError(null);

  try {
    const queryFilters = getQueryFilters(filters);
    // Event-based: generate requestId and set up listener
    const requestId = `popup_stats_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function handler(message) {
      if (message && message.requestId === requestId) {
        if (message && !message.error) {
          renderCharts(message);
        } else {
          setError(message?.error || "Failed to load data");
        }
        setLoading(false);
        chrome.runtime.onMessage.removeListener(handler);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    chrome.runtime.sendMessage({ action: "getFilteredStats", filters: queryFilters, requestId });
  } catch (err) {
    setError("An error occurred while loading data");
    setLoading(false);
    console.error("Error loading data:", err);
  }
}
