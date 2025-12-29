// Runner Collections - Group and manage request runner sessions
// Supports saving, scheduling, and organizing runner configurations
// NOW USING DATABASE INSTEAD OF CHROME.STORAGE

import { storage } from "../compat/browser-compat.js";

class RunnerCollections {
  constructor() {
    this.collectionsCache = []; // In-memory cache for performance
    this.dbManager = null; // Will be set by message handler
    this.scheduledRuns = []; // TODO: Migrate to database table
    this.initialized = false;
  }

  /**
   * Set the database manager instance
   */
  setDbManager(dbManager) {
    this.dbManager = dbManager;
    console.log("[Collections] Database manager set");
  }

  /**
   * Initialize collections from database
   */
  async initialize() {
    try {
      if (!this.dbManager) {
        console.warn(
          "[Collections] Database manager not set yet, deferring initialization"
        );
        return;
      }

      // Load collections from database
      this.collectionsCache = await this.dbManager.collection.getCollections();

      // Load scheduled runs from storage (TODO: migrate to database)
      const data = await storage.get(["scheduledRuns"]);
      this.scheduledRuns = data.scheduledRuns || [];

      this.initialized = true;
      console.log(
        `[Collections] Initialized with ${this.collectionsCache.length} collections from database`
      );
    } catch (error) {
      console.error("[Collections] Failed to initialize:", error);
      this.collectionsCache = [];
      this.scheduledRuns = [];
    }
  }

  /**
   * Create a new runner collection
   */
  async createCollection(name, description, config = {}) {
    if (!this.initialized) await this.initialize();

    if (!this.dbManager) {
      throw new Error("Database manager not initialized");
    }

    const collectionData = {
      id: `collection_${Date.now()}`,
      name,
      description,
      color: config.color || "#007bff",
      icon: config.icon || "fa-folder",
      is_active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    try {
      const result = await this.dbManager.collection.createCollection(
        collectionData
      );

      if (result.success) {
        // Add to cache
        this.collectionsCache.push({
          ...collectionData,
          runner_count: 0,
        });

        console.log(`[Collections] Created collection: ${name}`);
        return collectionData;
      }

      throw new Error("Failed to create collection in database");
    } catch (error) {
      console.error("[Collections] Failed to create collection:", error);
      throw error;
    }
  }

  /**
   * Update a collection
   */
  async updateCollection(collectionId, updates) {
    if (!this.initialized) await this.initialize();

    if (!this.dbManager) {
      throw new Error("Database manager not initialized");
    }

    try {
      const result = await this.dbManager.collection.updateCollection(
        collectionId,
        updates
      );

      if (result.success) {
        // Update cache
        const index = this.collectionsCache.findIndex(
          (c) => c.id === collectionId
        );
        if (index !== -1) {
          this.collectionsCache[index] = {
            ...this.collectionsCache[index],
            ...updates,
            updated_at: Date.now(),
          };
        }

        console.log(`[Collections] Updated collection: ${collectionId}`);
        return this.collectionsCache[index];
      }

      throw new Error("Failed to update collection in database");
    } catch (error) {
      console.error("[Collections] Failed to update collection:", error);
      throw error;
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionId) {
    if (!this.initialized) await this.initialize();

    if (!this.dbManager) {
      throw new Error("Database manager not initialized");
    }

    try {
      const result = await this.dbManager.collection.deleteCollection(
        collectionId
      );

      if (result.success) {
        // Remove from cache
        this.collectionsCache = this.collectionsCache.filter(
          (c) => c.id !== collectionId
        );

        // Also remove any scheduled runs for this collection
        this.scheduledRuns = this.scheduledRuns.filter(
          (s) => s.collectionId !== collectionId
        );
        await this.saveScheduledRuns();

        console.log(`[Collections] Deleted collection: ${collectionId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error("[Collections] Failed to delete collection:", error);
      return false;
    }
  }

  /**
   * Get all collections from database
   */
  async getCollections(forceRefresh = false) {
    if (!this.initialized) await this.initialize();

    if (!this.dbManager) {
      console.error("[Collections] Database manager not initialized");
      return this.collectionsCache;
    }

    // Return cache unless force refresh requested
    if (!forceRefresh && this.collectionsCache.length > 0) {
      return this.collectionsCache;
    }

    try {
      this.collectionsCache = await this.dbManager.collection.getCollections();
      return this.collectionsCache;
    } catch (error) {
      console.error("[Collections] Failed to get collections:", error);
      return this.collectionsCache; // Return cache on error
    }
  }

  /**
   * Get specific collection with its runners
   */
  async getCollection(collectionId) {
    if (!this.initialized) await this.initialize();

    try {
      const collection =
        await this.dbManager.collection.getCollectionWithRunners(collectionId);
      return collection;
    } catch (error) {
      console.error("[Collections] Failed to get collection:", error);
      // Fallback to cache
      return this.collectionsCache.find((c) => c.id === collectionId) || null;
    }
  }

  /**
   * Assign runner(s) to a collection
   */
  async assignRunnersToCollection(runnerIds, collectionId) {
    if (!this.initialized) await this.initialize();

    try {
      const result = await this.dbManager.collection.assignRunnersToCollection(
        runnerIds,
        collectionId
      );

      if (result.success) {
        // Refresh cache to update runner counts
        await this.getCollections(true);
        console.log(
          `[Collections] Assigned runners to collection: ${collectionId}`
        );
      }

      return result;
    } catch (error) {
      console.error("[Collections] Failed to assign runners:", error);
      throw error;
    }
  }

  /**
   * Remove runner(s) from their collection
   */
  async removeRunnersFromCollection(runnerIds) {
    if (!this.initialized) await this.initialize();

    try {
      const result =
        await this.dbManager.collection.removeRunnersFromCollection(runnerIds);

      if (result.success) {
        // Refresh cache to update runner counts
        await this.getCollections(true);
        console.log(`[Collections] Removed runners from collection`);
      }

      return result;
    } catch (error) {
      console.error("[Collections] Failed to remove runners:", error);
      throw error;
    }
  }

  /**
   * Schedule a collection run
   */
  async scheduleRun(collectionId, scheduleConfig) {
    if (!this.initialized) await this.initialize();

    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const schedule = {
      id: `schedule_${Date.now()}`,
      collectionId,
      collectionName: collection.name,
      type: scheduleConfig.type, // 'once', 'daily', 'weekly', 'interval'
      interval: scheduleConfig.interval, // minutes for 'interval' type
      time: scheduleConfig.time, // HH:MM for daily/weekly
      daysOfWeek: scheduleConfig.daysOfWeek, // [0-6] for weekly
      nextRunAt: this.calculateNextRun(scheduleConfig),
      enabled: true,
      createdAt: Date.now(),
      lastRunAt: null,
      lastStatus: null,
    };

    this.scheduledRuns.push(schedule);
    await this.saveScheduledRuns();

    return schedule;
  }

  /**
   * Update scheduled run
   */
  async updateScheduledRun(scheduleId, updates) {
    if (!this.initialized) await this.initialize();

    const index = this.scheduledRuns.findIndex((s) => s.id === scheduleId);
    if (index === -1) {
      throw new Error("Scheduled run not found");
    }

    this.scheduledRuns[index] = {
      ...this.scheduledRuns[index],
      ...updates,
    };

    // Recalculate next run if schedule config changed
    if (
      updates.type ||
      updates.interval ||
      updates.time ||
      updates.daysOfWeek
    ) {
      this.scheduledRuns[index].nextRunAt = this.calculateNextRun(
        this.scheduledRuns[index]
      );
    }

    await this.saveScheduledRuns();
    return this.scheduledRuns[index];
  }

  /**
   * Delete scheduled run
   */
  async deleteScheduledRun(scheduleId) {
    if (!this.initialized) await this.initialize();

    const index = this.scheduledRuns.findIndex((s) => s.id === scheduleId);
    if (index === -1) {
      return false;
    }

    this.scheduledRuns.splice(index, 1);
    await this.saveScheduledRuns();

    return true;
  }

  /**
   * Get all scheduled runs
   */
  async getScheduledRuns() {
    if (!this.initialized) await this.initialize();
    return this.scheduledRuns;
  }

  /**
   * Get scheduled runs for a collection
   */
  async getCollectionSchedules(collectionId) {
    if (!this.initialized) await this.initialize();
    return this.scheduledRuns.filter((s) => s.collectionId === collectionId);
  }

  /**
   * Check for due scheduled runs
   */
  async checkScheduledRuns() {
    if (!this.initialized) await this.initialize();

    const now = Date.now();
    const dueRuns = this.scheduledRuns.filter(
      (s) => s.enabled && s.nextRunAt <= now
    );

    return dueRuns;
  }

  /**
   * Mark scheduled run as executed
   */
  async markScheduledRunExecuted(scheduleId, status) {
    if (!this.initialized) await this.initialize();

    const index = this.scheduledRuns.findIndex((s) => s.id === scheduleId);
    if (index === -1) {
      return false;
    }

    this.scheduledRuns[index].lastRunAt = Date.now();
    this.scheduledRuns[index].lastStatus = status;

    // Calculate next run time
    if (this.scheduledRuns[index].type !== "once") {
      this.scheduledRuns[index].nextRunAt = this.calculateNextRun(
        this.scheduledRuns[index]
      );
    } else {
      // Disable one-time schedules after execution
      this.scheduledRuns[index].enabled = false;
    }

    await this.saveScheduledRuns();
    return true;
  }

  /**
   * Calculate next run time based on schedule config
   */
  calculateNextRun(scheduleConfig) {
    const now = new Date();

    switch (scheduleConfig.type) {
      case "once":
        return scheduleConfig.nextRunAt || Date.now();

      case "interval":
        return Date.now() + scheduleConfig.interval * 60 * 1000;

      case "daily": {
        const [hours, minutes] = scheduleConfig.time.split(":").map(Number);
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);

        // If time has passed today, schedule for tomorrow
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }

        return next.getTime();
      }

      case "weekly": {
        const [hours, minutes] = scheduleConfig.time.split(":").map(Number);
        const targetDays = scheduleConfig.daysOfWeek || [0]; // Sunday default
        const currentDay = now.getDay();

        // Find next matching day
        let daysToAdd = 0;
        for (let i = 0; i < 7; i++) {
          const checkDay = (currentDay + i) % 7;
          if (targetDays.includes(checkDay)) {
            daysToAdd = i;
            break;
          }
        }

        const next = new Date(now);
        next.setDate(next.getDate() + daysToAdd);
        next.setHours(hours, minutes, 0, 0);

        // If time has passed today and it's the target day, add 7 days
        if (next <= now && daysToAdd === 0) {
          next.setDate(next.getDate() + 7);
        }

        return next.getTime();
      }

      default:
        return Date.now();
    }
  }

  /**
   * Save scheduled runs to storage (TODO: migrate to database)
   */
  async saveScheduledRuns() {
    try {
      await storage.set({ scheduledRuns: this.scheduledRuns });
    } catch (error) {
      console.error("[Collections] Failed to save scheduled runs:", error);
    }
  }
}

// Singleton instance
const runnerCollections = new RunnerCollections();
export default runnerCollections;
