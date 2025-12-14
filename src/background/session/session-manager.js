// Session Manager for tracking user sessions
// Handles session lifecycle, activity recording, and automatic timeouts

class SessionManager {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.currentSession = null;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.lastActivityTime = null;
    this.cleanupInterval = null;

    // Start session cleanup checker
    this.startCleanupChecker();
  }

  /**
   * Start a new session
   * @param {Object} data - Initial session data (domain, user_agent, etc.)
   * @returns {Promise<string>} Session ID
   */
  async startSession(data = {}) {
    // End previous session if exists and expired
    if (this.currentSession && this.isSessionExpired()) {
      await this.endSession();
    }

    // If we have an active session, return its ID
    if (this.currentSession) {
      return this.currentSession.id;
    }

    this.currentSession = {
      id: this.generateSessionId(),
      domain: data.domain || null,
      user_id: data.user_id || null,
      started_at: Date.now(),
      ended_at: null,
      duration: null,
      events_count: 0,
      requests_count: 0,
      pages_count: 0,
      pages_visited: new Set(),
      user_agent: data.user_agent || null,
      metadata: data.metadata || null,
    };

    this.lastActivityTime = Date.now();

    try {
      // Save initial session to database
      await this.saveSession();
      console.log(`[Session] Started new session: ${this.currentSession.id}`);
      return this.currentSession.id;
    } catch (error) {
      console.error("[Session] Error starting session:", error);
      return null;
    }
  }

  /**
   * Record activity in the current session
   * @param {string} type - Activity type ('request', 'event', 'pageVisit')
   * @param {Object} data - Activity data
   * @returns {Promise<void>}
   */
  async recordActivity(type, data) {
    // Start new session if none exists or expired
    if (!this.currentSession || this.isSessionExpired()) {
      await this.startSession({
        domain: data.domain,
        user_agent: data.user_agent,
      });
    }

    if (!this.currentSession) {
      console.warn("[Session] No active session to record activity");
      return;
    }

    this.lastActivityTime = Date.now();

    // Update session counts based on activity type
    if (type === "request") {
      this.currentSession.requests_count++;
      // Update domain if not set
      if (!this.currentSession.domain && data.domain) {
        this.currentSession.domain = data.domain;
      }
    } else if (type === "event") {
      this.currentSession.events_count++;
    } else if (type === "pageVisit") {
      if (data.url) {
        this.currentSession.pages_visited.add(data.url);
        this.currentSession.pages_count =
          this.currentSession.pages_visited.size;
      }
      // Update domain from page visit
      if (!this.currentSession.domain && data.domain) {
        this.currentSession.domain = data.domain;
      }
    }

    // Save session periodically (every 10 activities)
    const totalActivities =
      this.currentSession.requests_count + this.currentSession.events_count;
    if (totalActivities % 10 === 0) {
      await this.saveSession();
    }
  }

  /**
   * End the current session
   * @returns {Promise<boolean>}
   */
  async endSession() {
    if (!this.currentSession) {
      return false;
    }

    const session = {
      ...this.currentSession,
      ended_at: Date.now(),
      duration: Date.now() - this.currentSession.started_at,
      pages_count: this.currentSession.pages_visited.size,
      pages_visited: JSON.stringify(
        Array.from(this.currentSession.pages_visited)
      ),
    };

    try {
      // Save final session state to database
      await this.dbManager.medallion.insertSession(session);
      console.log(
        `[Session] Ended session: ${
          session.id
        } (duration: ${this.formatDuration(session.duration)})`
      );

      this.currentSession = null;
      this.lastActivityTime = null;
      return true;
    } catch (error) {
      console.error("[Session] Error ending session:", error);
      return false;
    }
  }

  /**
   * Save current session to database
   * @returns {Promise<boolean>}
   */
  async saveSession() {
    if (!this.currentSession) {
      return false;
    }

    const session = {
      ...this.currentSession,
      pages_visited: JSON.stringify(
        Array.from(this.currentSession.pages_visited)
      ),
    };

    try {
      await this.dbManager.medallion.upsertSession(session);
      return true;
    } catch (error) {
      console.error("[Session] Error saving session:", error);
      return false;
    }
  }

  /**
   * Check if current session is expired
   * @returns {boolean}
   */
  isSessionExpired() {
    if (!this.lastActivityTime) {
      return false;
    }
    return Date.now() - this.lastActivityTime > this.sessionTimeout;
  }

  /**
   * Get current session ID
   * @returns {string|null}
   */
  getCurrentSessionId() {
    return this.currentSession?.id || null;
  }

  /**
   * Generate unique session ID
   * @returns {string}
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start cleanup checker for expired sessions
   */
  startCleanupChecker() {
    // Check every 5 minutes for expired sessions
    this.cleanupInterval = setInterval(async () => {
      if (this.currentSession && this.isSessionExpired()) {
        console.log("[Session] Session expired, ending...");
        await this.endSession();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup checker
   */
  stopCleanupChecker() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Format duration in milliseconds to readable string
   * @param {number} ms - Duration in milliseconds
   * @returns {string}
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.stopCleanupChecker();
    if (this.currentSession) {
      await this.endSession();
    }
  }
}

export default SessionManager;
