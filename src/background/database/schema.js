// Database schema definition

export async function createTables(db) {
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
  `)

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
  `)

  // Create request_headers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS request_headers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requestId TEXT,
      name TEXT,
      value TEXT,
      FOREIGN KEY(requestId) REFERENCES requests(id) ON DELETE CASCADE
    )
  `)

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
  `)

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
  `)

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
  `)

  // Create tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      color TEXT,
      createdAt INTEGER
    )
  `)

  // Create request_tags table (many-to-many relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS request_tags (
      requestId TEXT,
      tagId INTEGER,
      PRIMARY KEY (requestId, tagId),
      FOREIGN KEY(requestId) REFERENCES requests(id) ON DELETE CASCADE,
      FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
    )
  `)

  // Create errors table for logging
  db.exec(`
    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      message TEXT,
      stack TEXT,
      timestamp INTEGER,
      context TEXT -- Store additional context as JSON string
    );
  `)

  // Create sql_history table for storing executed SQL queries
  db.exec(`
    CREATE TABLE IF NOT EXISTS sql_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      executed_at INTEGER NOT NULL,
      success INTEGER NOT NULL,
      error_message TEXT,
      duration_ms INTEGER
    )
  `)

  // Create indexes for better query performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_domain ON requests(domain)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(type)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_userId ON requests(userId)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_requests_projectId ON requests(projectId)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_headers_requestId ON request_headers(requestId)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON errors(timestamp)`) // Added from migration 4
  db.exec(`CREATE INDEX IF NOT EXISTS idx_errors_category ON errors(category)`) // Added from migration 4

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
  `)

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
  `)

  console.log("Database schema created successfully")
  return true
}

