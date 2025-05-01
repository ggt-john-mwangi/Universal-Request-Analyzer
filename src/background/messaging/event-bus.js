// Event bus for handling all internal extension communications

class EventBus {
  constructor() {
    this.handlers = new Map();
    this.middlewares = [];
    this.eventHistory = [];
    this.maxHistorySize = 1000;
  }

  // Subscribe to an event
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

  // Subscribe to an event once
  once(eventType, handler, options = {}) {
    return this.subscribe(eventType, handler, { ...options, once: true });
  }

  // Publish an event
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

  // Add middleware to the event pipeline
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
    return () => {
      const index = this.middlewares.indexOf(middleware);
      if (index !== -1) {
        this.middlewares.splice(index, 1);
      }
    };
  }

  // Run event through middleware chain
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

  // Store event in history
  storeEvent(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  // Get event history
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

  // Clear event history
  clearHistory() {
    this.eventHistory = [];
  }

  // Get all registered event types
  getEventTypes() {
    return Array.from(this.handlers.keys());
  }

  // Check if event type has subscribers
  hasSubscribers(eventType) {
    return this.handlers.has(eventType);
  }

  // Get subscriber count for event type
  getSubscriberCount(eventType) {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.size : 0;
  }

  // Remove all subscribers for an event type
  clearSubscribers(eventType) {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }
}

// Create and export singleton instance
const eventBus = new EventBus();
export default eventBus;

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
      if (schema && !validate(event.payload, schema)) {
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
