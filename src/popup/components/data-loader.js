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
