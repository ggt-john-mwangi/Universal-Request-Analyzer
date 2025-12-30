/**
 * Runner Handlers
 * Handles request runner operations
 * Ported from popup-message-handler.js
 */

import requestRunner from "../../capture/request-runner.js";

/**
 * Handle run requests
 */
async function handleRunRequests(message, sender, context) {
  try {
    const { config, requests } = message;

    if (!requests || requests.length === 0) {
      return { success: false, error: "No requests provided" };
    }

    const runConfig = {
      ...config,
      requests: requests,
    };

    const result = await requestRunner.runRequests(runConfig, (progress) => {
      // Progress updates available via getRunnerProgress
    });

    return {
      success: true,
      runId: result.id,
      status: result.status,
    };
  } catch (error) {
    console.error("Run requests error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get runner progress
 */
async function handleGetRunnerProgress(message, sender, context) {
  try {
    const progress = requestRunner.getProgress();
    return {
      success: true,
      progress,
    };
  } catch (error) {
    console.error("Get runner progress error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle cancel run
 */
async function handleCancelRun(message, sender, context) {
  try {
    const cancelled = requestRunner.cancelRun();
    return {
      success: true,
      cancelled,
    };
  } catch (error) {
    console.error("Cancel run error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get run history
 */
async function handleGetRunHistory(message, sender, context) {
  try {
    const limit = message.limit || 10;
    const history = requestRunner.getHistory(limit);
    return {
      success: true,
      history,
    };
  } catch (error) {
    console.error("Get run history error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get run results
 */
async function handleGetRunResults(message, sender, context) {
  try {
    const runId = message.runId;
    const results = requestRunner.getRunResults(runId);
    if (!results) {
      return { success: false, error: "Run not found" };
    }

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error("Get run results error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle create runner
 */
async function handleCreateRunner(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    const { definition, requests } = message;
    const runnerId = await database.runner.createRunner(definition, requests);

    return {
      success: true,
      runnerId,
    };
  } catch (error) {
    console.error("Create runner error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get runner definition
 */
async function handleGetRunnerDefinition(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    const runnerId = message.runnerId;
    const runner = await database.runner.getRunnerDefinition(runnerId);

    if (!runner) {
      return { success: false, error: "Runner not found" };
    }

    const requests = await database.runner.getRunnerRequests(runnerId);

    return {
      success: true,
      runner,
      requests: requests || [],
    };
  } catch (error) {
    console.error("Get runner definition error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get all runners
 */
async function handleGetAllRunners(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    const options = {
      offset: message?.offset || 0,
      limit: message?.limit || 50,
      searchQuery: message?.searchQuery || null,
    };

    const result = await database.runner.getAllRunners(options);

    return {
      success: true,
      runners: result.runners || [],
      totalCount: result.totalCount || 0,
    };
  } catch (error) {
    console.error("Get all runners error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle ensure runner tables
 */
async function handleEnsureRunnerTables(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.executeQuery) {
      return { success: false, error: "Database not initialized" };
    }

    // Try to query runner tables to see if they exist
    try {
      database.executeQuery("SELECT COUNT(*) FROM config_runner_definitions");
      return { success: true, message: "Runner tables already exist" };
    } catch (e) {
      // Tables don't exist, create them

      const createQueries = [
        `CREATE TABLE IF NOT EXISTS config_runner_definitions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          collection_id TEXT,
          execution_mode TEXT NOT NULL CHECK(execution_mode IN ('sequential', 'parallel')),
          delay_ms INTEGER DEFAULT 0,
          follow_redirects BOOLEAN DEFAULT 1,
          validate_status BOOLEAN DEFAULT 0,
          use_variables BOOLEAN DEFAULT 1,
          header_overrides TEXT,
          is_active BOOLEAN DEFAULT 1,
          run_count INTEGER DEFAULT 0,
          last_run_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_runner_definitions_collection ON config_runner_definitions(collection_id, created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_runner_definitions_active ON config_runner_definitions(is_active, created_at)`,
        `CREATE TABLE IF NOT EXISTS config_runner_requests (
          id TEXT PRIMARY KEY,
          runner_id TEXT NOT NULL,
          sequence_order INTEGER NOT NULL,
          url TEXT NOT NULL,
          method TEXT NOT NULL DEFAULT 'GET',
          headers TEXT,
          body TEXT,
          domain TEXT NOT NULL,
          page_url TEXT NOT NULL,
          captured_request_id TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY(runner_id) REFERENCES config_runner_definitions(id) ON DELETE CASCADE,
          UNIQUE(runner_id, sequence_order)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_runner_requests_runner ON config_runner_requests(runner_id, sequence_order)`,
        `CREATE TABLE IF NOT EXISTS bronze_runner_executions (
          id TEXT PRIMARY KEY,
          runner_id TEXT NOT NULL,
          runner_name TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
          execution_mode TEXT NOT NULL,
          start_time INTEGER NOT NULL,
          end_time INTEGER,
          duration INTEGER,
          total_requests INTEGER NOT NULL,
          completed_requests INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          failure_count INTEGER DEFAULT 0,
          error_message TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY(runner_id) REFERENCES config_runner_definitions(id) ON DELETE CASCADE
        )`,
        `CREATE INDEX IF NOT EXISTS idx_runner_executions_runner ON bronze_runner_executions(runner_id, start_time DESC)`,
        `CREATE TABLE IF NOT EXISTS bronze_runner_execution_results (
          id TEXT PRIMARY KEY,
          execution_id TEXT NOT NULL,
          runner_request_id TEXT NOT NULL,
          logged_request_id TEXT,
          status INTEGER,
          duration INTEGER,
          success BOOLEAN NOT NULL,
          error_message TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY(execution_id) REFERENCES bronze_runner_executions(id) ON DELETE CASCADE,
          FOREIGN KEY(runner_request_id) REFERENCES config_runner_requests(id) ON DELETE CASCADE,
          FOREIGN KEY(logged_request_id) REFERENCES bronze_requests(id) ON DELETE SET NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_runner_results_execution ON bronze_runner_execution_results(execution_id)`,
      ];

      for (const query of createQueries) {
        database.executeQuery(query);
      }

      if (database.saveDatabase) {
        await database.saveDatabase();
      }

      return { success: true, message: "Runner tables created" };
    }
  } catch (error) {
    console.error("Ensure runner tables error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle run runner
 */
async function handleRunRunner(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    const runnerId = message.runnerId;
    const result = await requestRunner.runRunner(runnerId, (progress) => {
      // Progress updates available via getRunnerProgress
    });

    return {
      success: true,
      executionId: result.id,
      status: result.status,
    };
  } catch (error) {
    console.error("Run runner error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get runner history
 */
async function handleGetRunnerHistory(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    const runnerId = message.runnerId;
    const limit = message.limit || 10;

    const executions = await database.runner.getRunnerExecutions(
      runnerId,
      limit
    );

    return {
      success: true,
      executions,
    };
  } catch (error) {
    console.error("Get runner history error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get execution results
 */
async function handleGetExecutionResults(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    const executionId = message.executionId;
    const results = await database.runner.getExecutionResults(executionId);

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error("Get execution results error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle convert to saved runner
 */
async function handleConvertToSavedRunner(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    return {
      success: true,
      message:
        "Runner is already saved. Use 'Add to Collection' to organize runners.",
    };
  } catch (error) {
    console.error("Convert to saved runner error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle update runner metadata
 */
async function handleUpdateRunnerMetadata(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    const { runnerId, name, description } = message;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    await database.runner.updateRunnerDefinition(runnerId, updates);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Update runner metadata error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle cleanup temporary runners
 */
async function handleCleanupTemporaryRunners(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    const daysOld = message.daysOld || 7;
    const count = await database.runner.cleanupTemporaryRunners(daysOld);

    return {
      success: true,
      deletedCount: count,
    };
  } catch (error) {
    console.error("Cleanup temporary runners error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle delete runner
 */
async function handleDeleteRunner(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.runner) {
      return { success: false, error: "Database not initialized" };
    }

    const runnerId = message.runnerId;
    await database.runner.deleteRunner(runnerId);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Delete runner error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for runner operations
 */
export const runnerHandlers = new Map([
  ["runRequests", handleRunRequests],
  ["getRunnerProgress", handleGetRunnerProgress],
  ["cancelRun", handleCancelRun],
  ["getRunHistory", handleGetRunHistory],
  ["getRunResults", handleGetRunResults],
  ["createRunner", handleCreateRunner],
  ["getRunnerDefinition", handleGetRunnerDefinition],
  ["getAllRunners", handleGetAllRunners],
  ["ensureRunnerTables", handleEnsureRunnerTables],
  ["runRunner", handleRunRunner],
  ["getRunnerHistory", handleGetRunnerHistory],
  ["getExecutionResults", handleGetExecutionResults],
  ["convertToSavedRunner", handleConvertToSavedRunner],
  ["updateRunnerMetadata", handleUpdateRunnerMetadata],
  ["cleanupTemporaryRunners", handleCleanupTemporaryRunners],
  ["deleteRunner", handleDeleteRunner],
]);
