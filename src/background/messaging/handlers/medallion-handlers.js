/**
 * Medallion Handlers
 * Handles medallion architecture operations (Bronze → Silver → Gold processing)
 */

/**
 * Export handler map for medallion operations
 */
export const medallionHandlers = new Map([
  [
    "processToSilver",
    async (message, sender, context) => {
      try {
        const { database } = context;

        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        // Get medallion manager from database API
        const medallion = database.medallion;

        if (!medallion) {
          return { success: false, error: "Medallion manager not available" };
        }

        // Process bronze records to silver
        // This validates, deduplicates, and transforms raw data
        const stats = await medallion.processBronzeToSilver();

        return {
          success: true,
          stats,
          message: "Bronze records processed to Silver layer",
        };
      } catch (error) {
        console.error("processToSilver error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "processToGold",
    async (message, sender, context) => {
      try {
        const { database } = context;

        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        const medallion = database.medallion;

        if (!medallion) {
          return { success: false, error: "Medallion manager not available" };
        }

        // Process silver records to gold (analytics)
        const stats = await medallion.processSilverToGold();

        return {
          success: true,
          stats,
          message: "Silver records processed to Gold layer",
        };
      } catch (error) {
        console.error("processToGold error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getMedallionStats",
    async (message, sender, context) => {
      try {
        const { database } = context;

        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        // Get record counts for each layer
        const bronzeCount =
          database.executeQuery(
            "SELECT COUNT(*) as count FROM bronze_requests"
          )[0]?.values?.[0]?.[0] || 0;
        const silverCount =
          database.executeQuery(
            "SELECT COUNT(*) as count FROM silver_requests"
          )[0]?.values?.[0]?.[0] || 0;
        const goldCount =
          database.executeQuery(
            "SELECT COUNT(*) as count FROM gold_daily_analytics"
          )[0]?.values?.[0]?.[0] || 0;

        return {
          success: true,
          stats: {
            bronze: bronzeCount,
            silver: silverCount,
            gold: goldCount,
          },
        };
      } catch (error) {
        console.error("getMedallionStats error:", error);
        return { success: false, error: error.message };
      }
    },
  ],

  [
    "getProcessingStatus",
    async (message, sender, context) => {
      try {
        const { database } = context;

        if (!database) {
          return { success: false, error: "Database not initialized" };
        }

        // Check for unprocessed records in bronze and silver layers
        const unprocessedBronze =
          database.executeQuery(
            "SELECT COUNT(*) as count FROM bronze_requests WHERE processed = 0"
          )[0]?.values?.[0]?.[0] || 0;

        const unprocessedSilver =
          database.executeQuery(
            "SELECT COUNT(*) as count FROM silver_requests WHERE processed = 0"
          )[0]?.values?.[0]?.[0] || 0;

        return {
          success: true,
          status: {
            bronzeUnprocessed: unprocessedBronze,
            silverUnprocessed: unprocessedSilver,
            needsProcessing: unprocessedBronze > 0 || unprocessedSilver > 0,
          },
        };
      } catch (error) {
        console.error("getProcessingStatus error:", error);
        return { success: false, error: error.message };
      }
    },
  ],
]);
