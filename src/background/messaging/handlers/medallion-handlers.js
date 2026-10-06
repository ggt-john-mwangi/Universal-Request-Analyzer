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

        const count = await medallion.processAllPendingToSilver();

        return {
          success: true,
          processed: count,
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

        await medallion.processDailyAnalytics();

        return {
          success: true,
          message: "Daily analytics processed to Gold layer",
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

        // Count bronze records not yet promoted to silver (left join)
        const unprocessedBronze =
          database.executeQuery(
            `SELECT COUNT(*) FROM bronze_requests b
             LEFT JOIN silver_requests s ON s.id = b.id
             WHERE s.id IS NULL`
          )?.[0]?.values?.[0]?.[0] || 0;

        return {
          success: true,
          status: {
            bronzeUnprocessed: unprocessedBronze,
            silverUnprocessed: 0,
            needsProcessing: unprocessedBronze > 0,
          },
        };
      } catch (error) {
        console.error("getProcessingStatus error:", error);
        return { success: false, error: error.message };
      }
    },
  ],
]);
