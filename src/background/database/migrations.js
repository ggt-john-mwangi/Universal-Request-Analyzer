// Database migrations to handle schema updates

const migrations = [
  {
    version: 1,
    description: "Initial schema",
    migrate: (db) => {
      // No migration needed for initial schema
      return true;
    },
  },
  {
    version: 2,
    description: "Add user and project fields",
    migrate: (db) => {
      try {
        // Check if table exists
        const tableExists = db.exec(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='requests'"
        );
        if (!tableExists[0] || tableExists[0].values.length === 0) {
          console.warn("Table 'requests' does not exist. Creating table.");
          db.exec(`CREATE TABLE requests (
            id TEXT PRIMARY KEY,
            url TEXT,
            method TEXT,
            type TEXT,
            status INTEGER,
            statusText TEXT,
            domain TEXT,
            path TEXT,
            startTime INTEGER,
            endTime INTEGER,
            duration INTEGER,
            size INTEGER,
            timestamp INTEGER,
            tabId INTEGER,
            pageUrl TEXT,
            error TEXT
          )`);
        }

        const result = db.exec("PRAGMA table_info(requests)");
        if (!result || !result[0] || !result[0].values) {
          throw new Error("Failed to retrieve table info for 'requests'.");
        }

        const columns = result[0].values.map((v) => v[1]);

        if (!columns.includes("userId")) {
          db.exec("ALTER TABLE requests ADD COLUMN userId TEXT");
        }

        if (!columns.includes("projectId")) {
          db.exec("ALTER TABLE requests ADD COLUMN projectId TEXT");
        }

        if (!columns.includes("environmentId")) {
          db.exec("ALTER TABLE requests ADD COLUMN environmentId TEXT");
        }

        if (!columns.includes("tags")) {
          db.exec("ALTER TABLE requests ADD COLUMN tags TEXT");
        }

        return true;
      } catch (error) {
        console.error("Migration version 2 failed:", error);
        return false;
      }
    },
  },
  {
    version: 3,
    description: "Add users and projects tables",
    migrate: (db) => {
      // Create users table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          name TEXT,
          role TEXT,
          lastLogin INTEGER,
          settings TEXT
        )
      `);

      // Create projects table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          createdAt INTEGER,
          updatedAt INTEGER,
          ownerId TEXT,
          settings TEXT
        )
      `);

      // Create environments table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS environments (
          id TEXT PRIMARY KEY,
          name TEXT,
          projectId TEXT,
          createdAt INTEGER,
          updatedAt INTEGER,
          settings TEXT,
          FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);

      return true;
    },
  },
  {
    version: 4,
    description: "Add errors table for logging",
    migrate: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS errors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT,
          message TEXT,
          stack TEXT,
          timestamp INTEGER,
          context TEXT -- Store additional context as JSON string
        );
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON errors(timestamp);`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_errors_category ON errors(category);`);
      return true;
    },
  },
  {
    version: 5,
    description: "Add authentication and audit logging",
    migrate: (db) => {
      // Create sessions table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          userId TEXT,
          token TEXT,
          createdAt INTEGER,
          expiresAt INTEGER,
          ipAddress TEXT,
          userAgent TEXT,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create audit_log table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT,
          action TEXT,
          resource TEXT,
          resourceId TEXT,
          timestamp INTEGER,
          ipAddress TEXT,
          details TEXT
        )
      `);

      return true;
    },
  },
  {
    version: 6,
    description: "Add request_timings table",
    migrate: (db) => {
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS request_timings (
            requestId TEXT PRIMARY KEY,
            dns INTEGER,
            tcp INTEGER,
            ssl INTEGER,
            ttfb INTEGER,
            download INTEGER,
            FOREIGN KEY(requestId) REFERENCES requests(id) ON DELETE CASCADE
          )
        `);
        return true;
      } catch (error) {
        console.error("Migration version 6 failed:", error);
        return false;
      }
    },
  },
  {
    version: 7,
    description: "Add sql_history table for executed SQL queries",
    migrate: (db) => {
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS sql_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT NOT NULL,
            executed_at INTEGER NOT NULL,
            success INTEGER NOT NULL,
            error_message TEXT,
            duration_ms INTEGER
          )
        `);
        return true;
      } catch (error) {
        console.error("Migration version 7 failed:", error);
        return false;
      }
    },
  },
  {
    version: 8,
    description: "Add config table for persistent configuration storage",
    migrate: (db) => {
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        `);
        return true;
      } catch (error) {
        console.error("Migration version 8 (config table) failed:", error);
        return false;
      }
    },
  },
];

// Get current database version
function getDatabaseVersion(db) {
  try {
    // Check if version table exists
    const tableCheck = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='version'"
    );

    if (!tableCheck[0] || !tableCheck[0].values.length === 0) {
      // Create version table
      db.exec("CREATE TABLE version (version INTEGER)");
      db.exec("INSERT INTO version VALUES (0)");
      return 0;
    }

    // Get current version
    const result = db.exec("SELECT version FROM version LIMIT 1");
    return result[0].values[0][0];
  } catch (error) {
    console.error("Failed to get database version:", error);
    return 0;
  }
}

// Set database version
function setDatabaseVersion(db, version) {
  try {
    db.exec("UPDATE version SET version = ?", [version]);
    return true;
  } catch (error) {
    console.error("Failed to set database version:", error);
    return false;
  }
}

// Run migrations
export async function migrateDatabase(db) {
  try {
    // Get current version
    const currentVersion = getDatabaseVersion(db);
    console.log(`Current database version: ${currentVersion}`);

    // Find migrations to run
    const pendingMigrations = migrations.filter(
      (m) => m.version > currentVersion
    );

    if (pendingMigrations.length === 0) {
      console.log("Database is up to date");
      return true;
    }

    console.log(`Running ${pendingMigrations.length} migrations...`);

    // Run migrations in a transaction
    db.exec("BEGIN TRANSACTION");

    try {
      for (const migration of pendingMigrations) {
        console.log(
          `Running migration ${migration.version}: ${migration.description}`
        );

        // Run migration
        const success = migration.migrate(db);

        if (!success) {
          throw new Error(`Migration ${migration.version} failed`);
        }

        // Update version
        setDatabaseVersion(db, migration.version);
      }

      db.exec("COMMIT");
      console.log("Database migration completed successfully");
      return true;
    } catch (error) {
      db.exec("ROLLBACK");
      console.error("Database migration failed:", error);
      throw error;
    }
  } catch (error) {
    console.error("Database migration failed:", error);
    throw error;
  }
}
