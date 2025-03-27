/**
 * Event bus for internal communication between background script components
 */
export function setupEventBus() {
  const subscribers = {}

  return {
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
      if (!subscribers[event]) {
        subscribers[event] = []
      }
      subscribers[event].push(callback)

      // Return unsubscribe function
      return () => {
        subscribers[event] = subscribers[event].filter((cb) => cb !== callback)
      }
    },

    /**
     * Publish an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    publish(event, data) {
      if (subscribers[event]) {
        subscribers[event].forEach((callback) => {
          try {
            callback(data)
          } catch (error) {
            console.error(`Error in event subscriber for ${event}:`, error)
          }
        })
      }
    },

    /**
     * Get all subscribers
     * @returns {Object} All subscribers
     */
    getSubscribers() {
      return { ...subscribers }
    },

    /**
     * Clear all subscribers
     */
    clear() {
      Object.keys(subscribers).forEach((event) => {
        subscribers[event] = []
      })
    },
  }
}

