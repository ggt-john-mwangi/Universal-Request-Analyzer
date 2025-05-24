import { sendMessageWithResponse } from "../../background/utils/message-handler.js";
import { getQueryFilters } from "./filters.js";

export async function loadData(filters, renderCharts, setError, setLoading) {
  setLoading(true);
  setError(null);

  try {
    const queryFilters = getQueryFilters(filters);

    // Use the message handler to send and await the response
    const message = await sendMessageWithResponse("getFilteredStats", {
      filters: queryFilters,
    });

    if (!message.error) {
      renderCharts(message);
    } else {
      setError(message.error || "Failed to load data");
    }
  } catch (err) {
    setError("An error occurred while loading data");
    console.error("Error loading data:", err);
  } finally {
    setLoading(false);
  }
}
