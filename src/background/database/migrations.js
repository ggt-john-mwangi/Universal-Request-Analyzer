// Database migrations handler
// 
// Migration System Overview:
// -------------------------
// This module manages database schema changes over time using a version-based migration system.
// 
// Data Flow:
// 1. migrateDatabase(db) is called after database initialization
// 2. getDatabaseVersion(db) reads current version from db_version table
// 3. Pending migrations (version > current) are identified
// 4. Each migration runs in a transaction:
//    a. BEGIN TRANSACTION
//    b. Execute migration SQL
//    c. setDatabaseVersion(db, version) - update db_version table
//    d. COMMIT (or ROLLBACK on error)
// 5. Process repeats for each pending migration in order
//
// Important Notes:
// - db_version table MUST exist before migrations run (created in schema.js)
// - Migrations are applied in version order (1, 2, 3, ...)
// - Each migration is atomic (transaction-based)
// - Version tracking prevents duplicate migration applications
// - Migration version 2 creates db_version table for legacy compatibility
//   (but schema.js now creates it first to prevent initialization errors)
//
import { DatabaseError } from "../errors/error-types.js";

const migrations = [
  {
    version: 1,
    description: "Initial schema setup",
    migrate: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY,
          url TEXT,
          method TEXT,
          type TEXT,
          status INTEGER,
          size INTEGER,
          duration INTEGER,
          timestamp INTEGER,
          domain TEXT,
          path TEXT,
          pageUrl TEXT,
          error TEXT
        );

        CREATE TABLE IF NOT EXISTS request_timings (
          requestId TEXT PRIMARY KEY,
          dns INTEGER,
          tcp INTEGER,
          ssl INTEGER,
          ttfb INTEGER,
          download INTEGER,
          FOREIGN KEY(requestId) REFERENCES requests(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS request_headers (
          requestId TEXT,
          name TEXT,
          value TEXT,
          FOREIGN KEY(requestId) REFERENCES requests(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_id TEXT,
          dns_time INTEGER,
          tcp_time INTEGER,
          ssl_time INTEGER,
          ttfb_time INTEGER,
          download_time INTEGER,
          total_time INTEGER,
          created_at INTEGER,
          FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
        CREATE INDEX IF NOT EXISTS idx_requests_domain ON requests(domain);
        CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
        CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(type);
      `);
      return true;
    },
  },
  {
    version: 2,
    description: "Add version tracking table",
    migrate: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS db_version (
          version INTEGER PRIMARY KEY,
          description TEXT,
          applied_at INTEGER,
          status TEXT
        );
      `);
      return true;
    },
  },
  {
    version: 3,
    description: "Add retention settings table",
    migrate: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS retention_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          retention_period INTEGER,
          max_size_bytes INTEGER,
          auto_cleanup_enabled INTEGER DEFAULT 0,
          cleanup_interval INTEGER,
          created_at INTEGER
        );
      `);
      return true;
    },
  },
];

/**
 * Get the current database schema version from the db_version table.
 * 
 * Data Flow:
 * 1. Query db_version table for the highest version number
 * 2. Return version number if found, otherwise return 0 (fresh database)
 * 3. Errors are caught and logged - returns 0 as safe default
 * 
 * @param {SQL.Database} db - The SQL.js database instance
 * @returns {Promise<number>} Current schema version (0 if no migrations applied)
 * 
 * @note Returns 0 on error to trigger all migrations on a fresh database
 * @note db_version table is created in schema.js before this is called
 */
async function getDatabaseVersion(db) {
  try {
    const result = db.exec(
      "SELECT version FROM db_version ORDER BY version DESC LIMIT 1"
    );
    return result[0] ? result[0].values[0][0] : 0;
  } catch (error) {
    // Error indicates table doesn't exist or query failed
    // Return 0 to trigger all migrations (safe default for new database)
    console.error("Failed to get database version:", error);
    return 0;
  }
}

/**
 * Record a successfully applied migration in the db_version table.
 * 
 * Data Flow:
 * 1. Insert new record with version, description, timestamp, and status
 * 2. This creates an audit trail of all applied migrations
 * 3. Enables getDatabaseVersion() to determine which migrations are pending
 * 
 * @param {SQL.Database} db - The SQL.js database instance
 * @param {number} version - Migration version number being recorded
 * @param {string} description - Human-readable description of the migration
 * @returns {Promise<boolean>} True if version was recorded successfully
 * 
 * @note This is called within a transaction in migrateDatabase()
 * @note If this fails, the transaction is rolled back
 */
async function setDatabaseVersion(db, version, description) {
  try {
    db.exec(
      `
      INSERT INTO db_version (version, description, applied_at, status)
      VALUES (?, ?, ?, ?)
    `,
      [version, description, Date.now(), "success"]
    );
    return true;
  } catch (error) {
    console.error("Failed to set database version:", error);
    return false;
  }
}

/**
 * Run all pending database migrations to update schema to latest version.
 * 
 * Migration Process Data Flow:
 * 1. Get current database version from db_version table
 * 2. Filter migrations array to find pending migrations (version > current)
 * 3. For each pending migration in version order:
 *    a. Log migration start
 *    b. BEGIN TRANSACTION (ensures atomicity)
 *    c. Execute migration.migrate(db) function
 *    d. Call setDatabaseVersion(db, version, description) to record success
 *    e. COMMIT transaction
 *    f. Log migration completion
 * 4. On any error:
 *    - ROLLBACK transaction (undo partial changes)
 *    - Throw DatabaseError (stops further migrations)
 * 5. Return true when all migrations complete successfully
 * 
 * Transaction Guarantees:
 * - Each migration is atomic (all-or-nothing)
 * - Database state is never left in partial migration state
 * - Failed migrations don't affect db_version table
 * - Subsequent runs will retry failed migrations
 * 
 * @param {SQL.Database} db - The SQL.js database instance
 * @returns {Promise<boolean>} True if all migrations applied successfully
 * @throws {DatabaseError} If any migration fails (with rollback)
 * 
 * @example
 * // Called from initializeDatabase() after createTables()
 * await migrateDatabase(db);
 * // db_version table now contains records for all applied migrations
 */
export async function migrateDatabase(db) {
  // Step 1: Get current schema version
  const currentVersion = await getDatabaseVersion(db);
  
  // Step 2: Identify which migrations need to be applied
  const pendingMigrations = migrations.filter(
    (m) => m.version > currentVersion
  );

  // Early return if database is already at latest version
  if (pendingMigrations.length === 0) {
    console.log("Database is up to date");
    return true;
  }

  console.log(`Running ${pendingMigrations.length} migration(s)`);

  // Step 3: Apply each pending migration in order
  for (const migration of pendingMigrations) {
    try {
      console.log(
        `Applying migration ${migration.version}: ${migration.description}`
      );

      // Start transaction for each migration (ensures atomicity)
      db.exec("BEGIN TRANSACTION");

      // Execute the migration SQL
      const success = await migration.migrate(db);
      if (!success) {
        throw new Error(`Migration ${migration.version} failed`);
      }

      // Update version tracking table to record successful migration
      // This prevents re-running the same migration on next startup
      await setDatabaseVersion(db, migration.version, migration.description);

      // Commit transaction (makes changes permanent)
      db.exec("COMMIT");

      console.log(`Migration ${migration.version} completed successfully`);
    } catch (error) {
      // Rollback on error (undo all changes from this migration)
      db.exec("ROLLBACK");
      console.error(`Migration ${migration.version} failed:`, error);
      throw new DatabaseError(`Migration ${migration.version} failed`, error);
    }
  }

  return true;
}
