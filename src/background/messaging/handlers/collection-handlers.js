/**
 * Collection Handlers
 * Handles runner collection and scheduling operations
 * Ported from popup-message-handler.js
 */

import runnerCollections from "../../capture/runner-collections.js";
import requestRunner from "../../capture/request-runner.js";

/**
 * Handle create collection
 */
async function handleCreateCollection(message, sender, context) {
  try {
    const { name, description, config, collection } = message;

    // Support both formats: individual fields or collection object
    const result = collection
      ? await runnerCollections.createCollection(
          collection.name,
          collection.description,
          collection.config
        )
      : await runnerCollections.createCollection(name, description, config);

    return {
      success: true,
      collection: result,
    };
  } catch (error) {
    console.error("Create collection error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get collections
 */
async function handleGetCollections(message, sender, context) {
  try {
    const activeOnly = message?.activeOnly || false;
    const collections = await runnerCollections.getCollections(false); // Force refresh

    return {
      success: true,
      collections,
    };
  } catch (error) {
    console.error("Get collections error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get collection
 */
async function handleGetCollection(message, sender, context) {
  try {
    const collectionId = message.collectionId || message.id;

    const collection = await runnerCollections.getCollection(collectionId);

    if (!collection) {
      return { success: false, error: "Collection not found" };
    }

    return {
      success: true,
      collection,
    };
  } catch (error) {
    console.error("Get collection error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle update collection
 */
async function handleUpdateCollection(message, sender, context) {
  try {
    const collectionId = message.collectionId || message.id;
    const updates = message.updates;

    const result = await runnerCollections.updateCollection(
      collectionId,
      updates
    );

    return {
      success: true,
      collection: result,
    };
  } catch (error) {
    console.error("Update collection error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle delete collection
 */
async function handleDeleteCollection(message, sender, context) {
  try {
    const collectionId = message.collectionId || message.id;

    const result = await runnerCollections.deleteCollection(collectionId);

    return {
      success: result,
    };
  } catch (error) {
    console.error("Delete collection error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle assign runners to collection
 */
async function handleAssignRunnersToCollection(message, sender, context) {
  try {
    const { runnerIds, collectionId } = message;

    const result = await runnerCollections.assignRunnersToCollection(
      runnerIds,
      collectionId
    );

    return result;
  } catch (error) {
    console.error("Assign runners error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle remove runners from collection
 */
async function handleRemoveRunnersFromCollection(message, sender, context) {
  try {
    const runnerIds = message.runnerIds;

    const result = await runnerCollections.removeRunnersFromCollection(
      runnerIds
    );

    return result;
  } catch (error) {
    console.error("Remove runners error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle run collection
 */
async function handleRunCollection(message, sender, context) {
  try {
    const collectionId = message.collectionId || message.id;

    const collection = await runnerCollections.getCollection(collectionId);
    if (!collection) {
      return { success: false, error: "Collection not found" };
    }

    // Add collection ID to config
    const config = {
      ...collection.config,
      collectionId: collection.id,
    };

    // Start the run
    const result = await requestRunner.runRequests(config, (progress) => {
      // Progress updates handled by polling
    });

    return {
      success: true,
      runId: result.id,
      status: result.status,
    };
  } catch (error) {
    console.error("Run collection error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle schedule runner
 */
async function handleScheduleRunner(message, sender, context) {
  try {
    const { collectionId, scheduleConfig } = message;

    const schedule = await runnerCollections.scheduleRun(
      collectionId,
      scheduleConfig
    );

    return {
      success: true,
      schedule,
    };
  } catch (error) {
    console.error("Schedule runner error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get scheduled runs
 */
async function handleGetScheduledRuns(message, sender, context) {
  try {
    const schedules = await runnerCollections.getScheduledRuns();

    return {
      success: true,
      schedules,
    };
  } catch (error) {
    console.error("Get scheduled runs error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle update scheduled run
 */
async function handleUpdateScheduledRun(message, sender, context) {
  try {
    const { scheduleId, updates } = message;

    const schedule = await runnerCollections.updateScheduledRun(
      scheduleId,
      updates
    );

    return {
      success: true,
      schedule,
    };
  } catch (error) {
    console.error("Update scheduled run error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle delete scheduled run
 */
async function handleDeleteScheduledRun(message, sender, context) {
  try {
    const scheduleId = message.scheduleId;

    const deleted = await runnerCollections.deleteScheduledRun(scheduleId);

    return {
      success: deleted,
    };
  } catch (error) {
    console.error("Delete scheduled run error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for collection operations
 */
export const collectionHandlers = new Map([
  ["createCollection", handleCreateCollection],
  ["createRunnerCollection", handleCreateCollection], // Alias
  ["getCollections", handleGetCollections],
  ["getRunnerCollections", handleGetCollections], // Alias
  ["getCollection", handleGetCollection],
  ["getRunnerCollection", handleGetCollection], // Alias
  ["updateCollection", handleUpdateCollection],
  ["updateRunnerCollection", handleUpdateCollection], // Alias
  ["deleteCollection", handleDeleteCollection],
  ["deleteRunnerCollection", handleDeleteCollection], // Alias
  ["assignRunnersToCollection", handleAssignRunnersToCollection],
  ["removeRunnersFromCollection", handleRemoveRunnersFromCollection],
  ["runCollection", handleRunCollection],
  ["scheduleRunner", handleScheduleRunner],
  ["getScheduledRuns", handleGetScheduledRuns],
  ["updateScheduledRun", handleUpdateScheduledRun],
  ["deleteScheduledRun", handleDeleteScheduledRun],
]);
