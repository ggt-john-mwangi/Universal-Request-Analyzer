// Runner Collections - Group and manage request runner sessions
// Supports saving, scheduling, and organizing runner configurations

import { storage } from "../compat/browser-compat.js";

class RunnerCollections {
  constructor() {
    this.collections = [];
    this.scheduledRuns = [];
    this.initialized = false;
  }

  /**
   * Initialize collections from storage
   */
  async initialize() {
    try {
      const data = await storage.get(["runnerCollections", "scheduledRuns"]);
      this.collections = data.runnerCollections || [];
      this.scheduledRuns = data.scheduledRuns || [];
      this.initialized = true;
      console.log("Runner collections initialized");
    } catch (error) {
      console.error("Failed to initialize runner collections:", error);
    }
  }

  /**
   * Create a new runner collection
   */
  async createCollection(name, description, requests, config = {}) {
    if (!this.initialized) await this.initialize();

    const collection = {
      id: `collection_${Date.now()}`,
      name,
      description,
      requests: requests.map((req) => ({
        id: req.id,
        url: req.url,
        method: req.method,
        request_headers: req.request_headers,
        request_payload: req.request_payload,
        type: req.type,
      })),
      config: {
        mode: config.mode || "sequential",
        delay: config.delay || 1000,
        followRedirects: config.followRedirects !== false,
        validateStatus: config.validateStatus || false,
        headerOverrides: config.headerOverrides || {},
        useVariables: config.useVariables !== false,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      runCount: 0,
      lastRunAt: null,
    };

    this.collections.push(collection);
    await this.saveCollections();

    return collection;
  }

  /**
   * Update a collection
   */
  async updateCollection(collectionId, updates) {
    if (!this.initialized) await this.initialize();

    const index = this.collections.findIndex((c) => c.id === collectionId);
    if (index === -1) {
      throw new Error("Collection not found");
    }

    this.collections[index] = {
      ...this.collections[index],
      ...updates,
      updatedAt: Date.now(),
    };

    await this.saveCollections();
    return this.collections[index];
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionId) {
    if (!this.initialized) await this.initialize();

    const index = this.collections.findIndex((c) => c.id === collectionId);
    if (index === -1) {
      return false;
    }

    this.collections.splice(index, 1);
    await this.saveCollections();

    // Also remove any scheduled runs for this collection
    this.scheduledRuns = this.scheduledRuns.filter(
      (s) => s.collectionId !== collectionId
    );
    await this.saveScheduledRuns();

    return true;
  }

  /**
   * Get all collections
   */
  async getCollections() {
    if (!this.initialized) await this.initialize();
    return this.collections;
  }

  /**
   * Get specific collection
   */
  async getCollection(collectionId) {
    if (!this.initialized) await this.initialize();
    return this.collections.find((c) => c.id === collectionId);
  }

  /**
   * Increment run count for collection
   */
  async incrementRunCount(collectionId) {
    if (!this.initialized) await this.initialize();

    const index = this.collections.findIndex((c) => c.id === collectionId);
    if (index !== -1) {
      this.collections[index].runCount++;
      this.collections[index].lastRunAt = Date.now();
      await this.saveCollections();
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
   * Save collections to storage
   */
  async saveCollections() {
    try {
      await storage.set({ runnerCollections: this.collections });
    } catch (error) {
      console.error("Failed to save runner collections:", error);
    }
  }

  /**
   * Save scheduled runs to storage
   */
  async saveScheduledRuns() {
    try {
      await storage.set({ scheduledRuns: this.scheduledRuns });
    } catch (error) {
      console.error("Failed to save scheduled runs:", error);
    }
  }
}

// Singleton instance
const runnerCollections = new RunnerCollections();
export default runnerCollections;
