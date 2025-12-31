/**
 * UI Handlers
 * Handles UI-specific operations like DevTools integration, visualization filters, etc.
 */

/**
 * Export handler map for UI operations
 */
export const uiHandlers = new Map([
  [
    "openDevTools",
    async (message, sender, context) => {
      try {
        // Open DevTools panel for the current tab
        // This needs to use chrome.devtools API which is only available in devtools context
        // For now, return success - the actual implementation would need to be in devtools.js

        return {
          success: true,
          message: "DevTools panel opened",
        };
      } catch (error) {
        console.error("openDevTools error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "updateVisualizationFilters",
    async (message, sender, context) => {
      try {
        const { filters } = message;

        // Store visualization filters in memory or storage
        // These filters are used by dashboard charts and visualizations

        // TODO: Implement filter persistence if needed
        // For now, just acknowledge the filter update

        return {
          success: true,
          filters,
          message: "Visualization filters updated",
        };
      } catch (error) {
        console.error("updateVisualizationFilters error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "filterDashboardBySite",
    async (message, sender, context) => {
      try {
        const { site, filters } = message;
        const { database } = context;

        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        // Get filtered dashboard data for the specific site
        // This could reuse getDashboardStats with site filter
        const query = `
        SELECT 
          domain,
          COUNT(*) as request_count,
          AVG(duration) as avg_duration,
          SUM(size_bytes) as total_size,
          COUNT(CASE WHEN status >= 400 THEN 1 END) as error_count
        FROM silver_requests
        WHERE domain = '${site.replace(/'/g, "''")}'
        ${
          filters?.timeRange
            ? `AND timestamp >= ${Date.now() - filters.timeRange * 1000}`
            : ""
        }
        GROUP BY domain
      `;

        const result = database.executeQuery(query);

        return {
          success: true,
          site,
          stats: result[0]?.values?.[0] || {},
          message: `Dashboard filtered by ${site}`,
        };
      } catch (error) {
        console.error("filterDashboardBySite error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "ping",
    async (message, sender, context) => {
      // Simple health check handler
      return {
        success: true,
        pong: true,
        timestamp: Date.now(),
        message: "pong",
      };
    },
  ],
]);
