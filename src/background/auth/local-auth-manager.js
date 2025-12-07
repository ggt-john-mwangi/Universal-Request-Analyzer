// Local Authentication Manager (SQLite-based)
// Handles user registration and login using local SQLite storage

export class LocalAuthManager {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.currentUser = null;
  }

  /**
   * Initialize auth system
   */
  async initialize() {
    // Create users table if not exists
    this.dbManager.executeQuery(`
      CREATE TABLE IF NOT EXISTS local_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at INTEGER NOT NULL,
        last_login INTEGER
      )
    `);

    // Load current user from storage
    await this.loadCurrentUser();
  }

  /**
   * Register new user
   */
  async register(email, password, name) {
    try {
      // Validate inputs
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
      }

      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      // Check if user already exists
      const existing = this.dbManager.executeQuery(
        'SELECT id FROM local_users WHERE email = ?',
        [email]
      );

      if (existing && existing[0]?.values.length > 0) {
        return { success: false, error: 'Email already registered' };
      }

      // Hash password (simple hash for local storage)
      const passwordHash = await this.hashPassword(password);
      const now = Date.now();

      // Insert user
      this.dbManager.executeQuery(`
        INSERT INTO local_users (email, password_hash, name, created_at)
        VALUES (?, ?, ?, ?)
      `, [email, passwordHash, name || '', now]);

      // Get the inserted user
      const result = this.dbManager.executeQuery(
        'SELECT id, email, name FROM local_users WHERE email = ?',
        [email]
      );

      if (result && result[0]?.values.length > 0) {
        const [id, userEmail, userName] = result[0].values[0];
        const user = { id, email: userEmail, name: userName };

        // Set as current user
        await this.setCurrentUser(user);

        return { success: true, user };
      }

      return { success: false, error: 'Registration failed' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Login user
   */
  async login(email, password) {
    try {
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
      }

      // Get user by email
      const result = this.dbManager.executeQuery(
        'SELECT id, email, name, password_hash FROM local_users WHERE email = ?',
        [email]
      );

      if (!result || !result[0]?.values.length) {
        return { success: false, error: 'Invalid email or password' };
      }

      const [id, userEmail, userName, storedHash] = result[0].values[0];

      // Verify password
      const passwordHash = await this.hashPassword(password);
      if (passwordHash !== storedHash) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Update last login
      this.dbManager.executeQuery(
        'UPDATE local_users SET last_login = ? WHERE id = ?',
        [Date.now(), id]
      );

      const user = { id, email: userEmail, name: userName };

      // Set as current user
      await this.setCurrentUser(user);

      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout current user
   */
  async logout() {
    this.currentUser = null;
    await chrome.storage.local.remove('currentUser');
    return { success: true };
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return !!this.currentUser;
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Set current user
   */
  async setCurrentUser(user) {
    this.currentUser = user;
    await chrome.storage.local.set({ currentUser: user });
  }

  /**
   * Load current user from storage
   */
  async loadCurrentUser() {
    try {
      const result = await chrome.storage.local.get('currentUser');
      if (result.currentUser) {
        this.currentUser = result.currentUser;
      }
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  }

  /**
   * Simple password hashing (for local storage only)
   * NOT secure for production - use bcrypt or similar for real backend
   */
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'local-salt-2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export function setupLocalAuth(dbManager) {
  const authManager = new LocalAuthManager(dbManager);
  return authManager;
}
