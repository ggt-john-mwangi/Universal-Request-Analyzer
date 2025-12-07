// Database schema definition

export async function createTables(db) {
  // Create db_version table first (required for migrations)
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
