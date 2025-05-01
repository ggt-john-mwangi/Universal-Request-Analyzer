// Database migrations handler
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

// Get current database version
async function getDatabaseVersion(db) {
  try {
    const result = db.exec(
      "SELECT version FROM db_version ORDER BY version DESC LIMIT 1"
    );
    return result[0] ? result[0].values[0][0] : 0;
  } catch (error) {
    console.error("Failed to get database version:", error);
    return 0;
  }
}

// Set database version with audit trail
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

// Run migrations with validation and rollback support
export async function migrateDatabase(db) {
  const currentVersion = await getDatabaseVersion(db);
  const pendingMigrations = migrations.filter(
    (m) => m.version > currentVersion
  );

  if (pendingMigrations.length === 0) {
    console.log("Database is up to date");
    return true;
  }

  console.log(`Running ${pendingMigrations.length} migration(s)`);

  for (const migration of pendingMigrations) {
    try {
      console.log(
        `Applying migration ${migration.version}: ${migration.description}`
      );

      // Start transaction for each migration
      db.exec("BEGIN TRANSACTION");

      const success = await migration.migrate(db);
      if (!success) {
        throw new Error(`Migration ${migration.version} failed`);
      }

      // Update version tracking
      await setDatabaseVersion(db, migration.version, migration.description);

      // Commit transaction
      db.exec("COMMIT");

      console.log(`Migration ${migration.version} completed successfully`);
    } catch (error) {
      // Rollback on error
      db.exec("ROLLBACK");
      console.error(`Migration ${migration.version} failed:`, error);
      throw new DatabaseError(`Migration ${migration.version} failed`, error);
    }
  }

  return true;
}
