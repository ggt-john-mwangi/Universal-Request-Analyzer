/**
 * Shared helper functions for message handlers
 */

/**
 * Maps an SQL.js result set to an array of objects.
 * @param {object} result - The result object from an sql.js query.
 * @returns {Array<object>} An array of objects, where each object represents a row.
 */
export function mapResultToArray(result) {
  if (!result || !result.columns || !result.values) {
    return [];
  }

  const columns = result.columns;
  return result.values.map((row) => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

/**
 * Escapes a string for safe inclusion in an SQL query.
 * @param {*} val - The value to escape.
 * @returns {string} The escaped string, or "NULL" for null/undefined values.
 */
export function escapeStr(val) {
  if (val === undefined || val === null) return "NULL";
  return `'${String(val).replace(/'/g, "''")}'`;
}
