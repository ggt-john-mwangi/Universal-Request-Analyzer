/**
 * Create all database tables with proper schema definition.
 * 
 * Table Creation Order:
 * 1. db_version - MUST be created first (required for migration tracking)
 * 2. requests - Main table for HTTP request data
 * 3. request_timings - Performance timing data (foreign key to requests)
 * 4. request_headers - HTTP headers (foreign key to requests)
 * 5. users, projects, environments - Multi-tenant organization
 * 6. tags - Request categorization
 * 7. performance_metrics, sessions, audit_log - Supporting tables
 * 
 * Data Flow:
 * - db_version table is created BEFORE all other tables
 * - This ensures migrateDatabase() can track which migrations have been applied
 * - Prevents "no such table: db_version" errors during initialization
 * - Foreign key constraints ensure referential integrity
 * - Indexes are created for performance optimization on common queries
 * 
 * @param {SQL.Database} db - The SQL.js database instance
 * @returns {Promise<boolean>} Returns true when all tables are created successfully
 * @throws {Error} If table creation fails
 */
export async function createTables(db) {
  // CRITICAL: Create db_version table FIRST before any other tables
  // The migration system (migrations.js) requires this table to exist
  // before it can track which migrations have been applied
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_version (
      version INTEGER PRIMARY KEY,
      description TEXT,
      applied_at INTEGER,
      status TEXT
    )
  `);

  // Create requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
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
      error TEXT,
      userId TEXT,
      projectId TEXT,
      environmentId TEXT,
      tags TEXT
    )
  `);

  // Create request_timings table
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

  // Create request_headers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS request_headers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requestId TEXT,
      name TEXT,
      value TEXT,
      FOREIGN KEY(requestId) REFERENCES requests(id) ON DELETE CASCADE
    )
  `);

  // Create users table
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

  // Create projects table
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

  // Create environments table
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

  // Create tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      color TEXT,
      createdAt INTEGER
    )
  `);

  // Create request_tags table (many-to-many relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS request_tags (
      requestId TEXT,
      tagId INTEGER,
      PRIMARY KEY (requestId, tagId),
      FOREIGN KEY(requestId) REFERENCES requests(id) ON DELETE CASCADE,
      FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Create performance_metrics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS performance_metrics (
      request_id TEXT PRIMARY KEY,
      dns_time INTEGER,
      tcp_time INTEGER,
      ssl_time INTEGER,
      ttfb_time INTEGER,
      download_time INTEGER,
      total_time INTEGER,
      created_at INTEGER,
      FOREIGN KEY (request_id) REFERENCES requests (id) ON DELETE CASCADE
    )
  `);

  // Create performance_settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS performance_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enabled BOOLEAN DEFAULT 0,
      sampling_rate INTEGER DEFAULT 100,
      capture_navigation_timing BOOLEAN DEFAULT 0,
      capture_resource_timing BOOLEAN DEFAULT 0,
      capture_server_timing BOOLEAN DEFAULT 0,
      capture_custom_metrics BOOLEAN DEFAULT 0,
      retention_period INTEGER DEFAULT 604800000
    )
  `);

  // Create indexes for better query performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_domain ON requests(domain)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp)`
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_userId ON requests(userId)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_requests_projectId ON requests(projectId)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_headers_requestId ON request_headers(requestId)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_performance_metrics_request_id ON performance_metrics(request_id)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at)`
  );

  // Create sessions table for authentication
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

  // Create audit_log table for security tracking
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

  console.log("Database schema created successfully");
  return true;
}
