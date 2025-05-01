// Handle data fetching and processing
import { getQueryFilters } from "./filters.js";

export function loadData(filters, renderCharts, setError, setLoading) {
  setLoading(true);
  setError(null);

  try {
    const queryFilters = getQueryFilters(filters);

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        { action: "getFilteredStats", filters: queryFilters },
        (response) => {
          if (response && !response.error) {
            renderCharts(response);
          } else {
            setError(response?.error || "Failed to load data");
          }
          setLoading(false);
        }
      );
    } else {
      setError("Chrome runtime is not available.");
      setLoading(false);
    }
  } catch (err) {
    setError("An error occurred while loading data");
    setLoading(false);
    console.error("Error loading data:", err);
  }
}

// Handle data clearing and exporting
export function clearData(setLoading, setError) {
  setLoading(true);
  setError(null);

  try {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "clearRequests" }, (response) => {
        if (response && !response.error) {
          setLoading(false);
        } else {
          setError(response?.error || "Failed to clear data");
          setLoading(false);
        }
      });
    } else {
      setError("Chrome runtime is not available.");
      setLoading(false);
    }
  } catch (err) {
    setError("An error occurred while clearing data");
    setLoading(false);
    console.error("Error clearing data:", err);
  }
}
// loadRequests function is not defined in this snippet, but it should be defined in the main script to reload the data after clearing.
// This function should be called after clearing data to refresh the displayed data in the UI.
export function loadRequests() {
  // Implementation of loading requests goes here
  // This function should fetch the latest requests from the background script and update the UI accordingly
  console.log("Loading requests...");
  // Example: Fetch requests from background script and update the UI

  // Note: Uncomment and implement the above code to fetch requests from the background script
  // and update the UI accordingly.
}
