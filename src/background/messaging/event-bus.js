/**
 * Event bus for internal communication between background script components
 */

class EventBus {
  constructor() {
    this.handlers = new Map();
    this.middlewares = [];
    this.eventHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Subscribe to an event
   * @param {string} eventType - Event name
   * @param {Function} handler - Callback function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventType, handler, options = {}) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const subscription = {
      handler,
      options: {
        once: options.once || false,
        filter: options.filter || (() => true),
        priority: options.priority || 0,
      },
    };

    this.handlers.get(eventType).add(subscription);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(subscription);
        if (handlers.size === 0) {
          this.handlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribe to an event once
   * @param {string} eventType - Event name
   * @param {Function} handler - Callback function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  once(eventType, handler, options = {}) {
    return this.subscribe(eventType, handler, { ...options, once: true });
  }

  /**
   * Publish an event
   * @param {string} eventType - Event name
   * @param {*} payload - Event data
   * @returns {Promise<void>}
   */
  async publish(eventType, payload = {}) {
    const event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
    };

    // Store event in history
    this.storeEvent(event);

    // Run through middleware chain
    const modifiedEvent = await this.runMiddlewares(event);
    if (!modifiedEvent) return; // Event was cancelled by middleware

    const handlers = this.handlers.get(eventType);
    if (!handlers) return;

    // Sort handlers by priority
    const sortedHandlers = Array.from(handlers).sort(
      (a, b) => b.options.priority - a.options.priority
    );

    const promises = [];
    const handlersToRemove = new Set();

    for (const subscription of sortedHandlers) {
      const { handler, options } = subscription;

      // Check if event passes the filter
      if (!options.filter(modifiedEvent)) continue;

      // Handle the event
      try {
        const promise = Promise.resolve(
          handler(modifiedEvent.payload, modifiedEvent)
        );
        promises.push(promise);

        if (options.once) {
          handlersToRemove.add(subscription);
        }
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
      }
    }

    // Remove one-time handlers
    handlersToRemove.forEach((subscription) => {
      handlers.delete(subscription);
    });

    // Clean up empty handler sets
    if (handlers.size === 0) {
      this.handlers.delete(eventType);
    }

    // Wait for all handlers to complete
    await Promise.all(promises);
  }

  /**
   * Add middleware to the event pipeline
   * @param {Function} middleware - Middleware function
   * @returns {Function} Remove middleware function
   */
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
    return () => {
      const index = this.middlewares.indexOf(middleware);
      if (index !== -1) {
        this.middlewares.splice(index, 1);
      }
    };
  }

  /**
   * Run event through middleware chain
   * @param {Object} event - Event object
   * @returns {Promise<Object|null>} Modified event or null if cancelled
   */
  async runMiddlewares(event) {
    let currentEvent = { ...event };

    for (const middleware of this.middlewares) {
      try {
        const result = await middleware(currentEvent);
        if (!result) return null; // Event cancelled
        currentEvent = result;
      } catch (error) {
        console.error("Middleware error:", error);
        return null;
      }
    }

    return currentEvent;
  }

  /**
   * Store event in history
   * @param {Object} event - Event object
   */
  storeEvent(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered event history
   */
  getHistory(filter = {}) {
    let events = this.eventHistory;

    if (filter.type) {
      events = events.filter((e) => e.type === filter.type);
    }

    if (filter.from) {
      events = events.filter((e) => e.timestamp >= filter.from);
    }

    if (filter.to) {
      events = events.filter((e) => e.timestamp <= filter.to);
    }

    if (filter.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
  }

  /**
   * Get all registered event types
   * @returns {Array} Event types
   */
  getEventTypes() {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if event type has subscribers
   * @param {string} eventType - Event type
   * @returns {boolean} True if event has subscribers
   */
  hasSubscribers(eventType) {
    return this.handlers.has(eventType);
  }

  /**
   * Get subscriber count for event type
   * @param {string} eventType - Event type
   * @returns {number} Number of subscribers
   */
  getSubscriberCount(eventType) {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.size : 0;
  }

  /**
   * Remove all subscribers for an event type
   * @param {string} eventType - Event type (optional)
   */
  clearSubscribers(eventType) {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get all subscribers
   * @returns {Map} All subscribers
   */
  getSubscribers() {
    return new Map(this.handlers);
  }

  /**
   * Clear all subscribers
   */
  clear() {
    this.handlers.clear();
  }
}

// Create and export singleton instance
const eventBus = new EventBus();
export default eventBus;

// For backwards compatibility with the functional API
export function setupEventBus() {
  console.warn('setupEventBus() is deprecated, please use the default export instead');
  return {
    subscribe: (event, callback) => eventBus.subscribe(event, callback),
    publish: (event, data) => eventBus.publish(event, data),
    getSubscribers: () => {
      const result = {};
      for (const [event, handlers] of eventBus.handlers.entries()) {
        result[event] = Array.from(handlers).map(h => h.handler);
      }
      return result;
    },
    clear: () => eventBus.clear()
  };
}

// Export useful middleware functions
export const middleware = {
  // Log all events
  logger: (event) => {
    console.log(`[EventBus] ${event.type}:`, event);
    return event;
  },

  // Add metadata to events
  metadata: (event) => {
    return {
      ...event,
      metadata: {
        browser: navigator.userAgent,
        timestamp: Date.now(),
        ...event.metadata,
      },
    };
  },

  // Filter events by type
  filterType: (allowedTypes) => (event) => {
    return allowedTypes.includes(event.type) ? event : null;
  },

  // Add error handling
  errorHandler: (event) => {
    if (event.payload instanceof Error) {
      console.error(`[EventBus] Error in ${event.type}:`, event.payload);
      // You could also report to an error tracking service here
    }
    return event;
  },

  // Validate event payload
  validator: (schema) => (event) => {
    try {
      // Assuming you have a validation function
      if (schema && typeof validate === 'function' && !validate(event.payload, schema)) {
        console.error(`[EventBus] Invalid payload for ${event.type}`);
        return null;
      }
      return event;
    } catch (error) {
      console.error(`[EventBus] Validation error for ${event.type}:`, error);
      return null;
    }
  },
};

