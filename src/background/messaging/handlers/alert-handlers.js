/**
 * Alert Handlers
 * Handles alert rules and alert history operations
sz * Ported from popup-message-handler.js
 */

import { mapResultToArray, escapeStr } from "../../utils/handler-helpers.js";

/**
 * Handle get alert rules
 */
async function handleGetAlertRules(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS alert_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        metric TEXT NOT NULL,
        condition TEXT NOT NULL,
        threshold REAL NOT NULL,
        domain TEXT,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER
      )
    `;

    if (database.executeQuery) {
      await database.executeQuery(createTableQuery);

      const query = "SELECT * FROM alert_rules ORDER BY created_at DESC";
      const result = await database.executeQuery(query);

      const rules = result && result[0] ? mapResultToArray(result[0]) : [];
      return { success: true, rules };
    }

    return { success: true, rules: [] };
  } catch (error) {
    console.error("Get alert rules error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle save alert rule
 */
async function handleSaveAlertRule(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const rule = message.rule || message;
    if (
      !rule ||
      !rule.name ||
      !rule.metric ||
      !rule.condition ||
      rule.threshold === undefined
    ) {
      return { success: false, error: "Invalid rule data" };
    }

    // Ensure table exists
    await handleGetAlertRules(message, sender, context);

    if (!database.executeQuery) {
      return { success: false, error: "Database not available" };
    }

    // Check for duplicate rule with same name and metric
    const checkQuery = `
      SELECT id FROM alert_rules 
      WHERE name = ? AND metric = ? AND domain = ?
      LIMIT 1
    `;

    const checkResult = database.executeQuery(checkQuery, [
      rule.name,
      rule.metric,
      rule.domain || null,
    ]);

    // If duplicate exists, update instead of insert
    if (
      checkResult &&
      checkResult[0] &&
      checkResult[0].values &&
      checkResult[0].values.length > 0
    ) {
      const existingId = checkResult[0].values[0][0];
      const updateQuery = `
        UPDATE alert_rules 
        SET condition = ?, threshold = ?, enabled = ?
        WHERE id = ?
      `;

      await database.executeQuery(updateQuery, [
        rule.condition,
        rule.threshold,
        rule.enabled !== false ? 1 : 0,
        existingId,
      ]);

      return { success: true, message: "Alert rule updated successfully" };
    }

    // Insert new rule
    const insertQuery = `
      INSERT INTO alert_rules (name, metric, condition, threshold, domain, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      rule.name,
      rule.metric,
      rule.condition,
      rule.threshold,
      rule.domain || null,
      rule.enabled !== false ? 1 : 0,
      Date.now(),
    ];

    await database.executeQuery(insertQuery, params);
    return { success: true, message: "Alert rule saved successfully" };
  } catch (error) {
    console.error("Save alert rule error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle delete alert rule
 */
async function handleDeleteAlertRule(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const ruleId = message.ruleId || message.id;
    if (!ruleId) {
      return { success: false, error: "Rule ID required" };
    }

    const query = "DELETE FROM alert_rules WHERE id = ?";

    if (database.executeQuery) {
      await database.executeQuery(query, [ruleId]);
      return { success: true, message: "Alert rule deleted successfully" };
    }

    return { success: false, error: "Database not available" };
  } catch (error) {
    console.error("Delete alert rule error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get alert history
 */
async function handleGetAlertHistory(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const limit = message.limit || 100;

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS alert_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER,
        rule_name TEXT,
        triggered_at INTEGER,
        value REAL,
        threshold REAL,
        message TEXT
      )
    `;

    if (database.executeQuery) {
      await database.executeQuery(createTableQuery);

      const query = `
        SELECT * FROM alert_history 
        ORDER BY triggered_at DESC 
        LIMIT ?
      `;
      const result = await database.executeQuery(query, [limit]);

      const history = result && result[0] ? mapResultToArray(result[0]) : [];
      return { success: true, history };
    }

    return { success: true, history: [] };
  } catch (error) {
    console.error("Get alert history error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle create runner alert
 */
async function handleCreateRunnerAlert(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const alert = message.alert || message;

    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const now = Date.now();

    const query = `
      INSERT INTO runner_alerts (
        collection_id, collection_name, alert_type, condition,
        threshold_value, comparison, enabled, notification_type,
        created_at, updated_at
      ) VALUES (
        ${escapeStr(alert.collectionId)},
        ${escapeStr(alert.collectionName)},
        ${escapeStr(alert.alertType)},
        ${escapeStr(alert.condition)},
        ${alert.thresholdValue},
        ${escapeStr(alert.comparison)},
        ${alert.enabled ? 1 : 0},
        ${escapeStr(alert.notificationType)},
        ${now},
        ${now}
      )
    `;

    database.db.exec(query);
    return { success: true };
  } catch (error) {
    console.error("Create runner alert error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle get runner alerts
 */
async function handleGetRunnerAlerts(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const collectionId = message.collectionId;

    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const whereClause = collectionId
      ? `WHERE collection_id = ${escapeStr(collectionId)}`
      : "";

    const query = `
      SELECT * FROM runner_alerts
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = database.db.exec(query);

    const alerts =
      result.length > 0 && result[0].values
        ? result[0].values.map((row) => {
            const obj = {};
            result[0].columns.forEach((col, idx) => {
              obj[col] = row[idx];
            });
            return obj;
          })
        : [];

    return { success: true, alerts };
  } catch (error) {
    console.error("Get runner alerts error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle update runner alert
 */
async function handleUpdateRunnerAlert(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const alertId = message.alertId || message.id;
    const updates = message.updates || message;

    const escapeStr = (val) => {
      if (val === undefined || val === null) return "NULL";
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const setClauses = [];
    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = ${updates.enabled ? 1 : 0}`);
    }
    if (updates.thresholdValue !== undefined) {
      setClauses.push(`threshold_value = ${updates.thresholdValue}`);
    }
    if (updates.notificationType) {
      setClauses.push(
        `notification_type = ${escapeStr(updates.notificationType)}`
      );
    }

    setClauses.push(`updated_at = ${Date.now()}`);

    const query = `
      UPDATE runner_alerts
      SET ${setClauses.join(", ")}
      WHERE id = ${parseInt(alertId)}
    `;

    database.db.exec(query);
    return { success: true };
  } catch (error) {
    console.error("Update runner alert error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle delete runner alert
 */
async function handleDeleteRunnerAlert(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const alertId = message.alertId || message.id;

    const query = `
      DELETE FROM runner_alerts
      WHERE id = ${parseInt(alertId)}
    `;

    database.db.exec(query);
    return { success: true };
  } catch (error) {
    console.error("Delete runner alert error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle log error
 */
async function handleLogError(message, sender, context) {
  try {
    const { database } = context;
    if (!database || !database.isReady || !database.db) {
      return { success: false, error: "Database not initialized" };
    }

    const { error, context: errorContext } = message;

    console.error("[Alert] Logged error:", error, errorContext);
    return { success: true };
  } catch (error) {
    console.error("Log error handler error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for alert operations
 */
export const alertHandlers = new Map([
  ["getAlertRules", handleGetAlertRules],
  ["saveAlertRule", handleSaveAlertRule],
  ["deleteAlertRule", handleDeleteAlertRule],
  ["getAlertHistory", handleGetAlertHistory],
  ["createRunnerAlert", handleCreateRunnerAlert],
  ["getRunnerAlerts", handleGetRunnerAlerts],
  ["updateRunnerAlert", handleUpdateRunnerAlert],
  ["deleteRunnerAlert", handleDeleteRunnerAlert],
  ["logError", handleLogError],
]);
