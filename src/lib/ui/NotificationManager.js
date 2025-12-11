/**
 * NotificationManager - Shared notification handling
 * Consolidates duplicate notification functionality
 */

export class NotificationManager {
  constructor(options = {}) {
    this.container = null;
    this.notifications = new Map();
    this.defaultDuration = options.defaultDuration || 5000;
    this.maxNotifications = options.maxNotifications || 5;
    this.position = options.position || 'top-right';
    this.containerId = options.containerId || 'notification-container';
  }

  /**
   * Initialize notification manager
   */
  initialize() {
    // Create container if it doesn't exist
    this.container = document.getElementById(this.containerId);
    
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = this.containerId;
      this.container.className = `notification-container ${this.position}`;
      document.body.appendChild(this.container);
    }
  }

  /**
   * Show notification
   */
  show(message, options = {}) {
    if (!this.container) {
      this.initialize();
    }

    const {
      type = 'info',
      duration = this.defaultDuration,
      dismissible = true,
      action = null,
      id = this.generateId()
    } = options;

    // Remove oldest notification if limit reached
    if (this.notifications.size >= this.maxNotifications) {
      const firstId = this.notifications.keys().next().value;
      this.dismiss(firstId);
    }

    // Create notification element
    const notification = this.createNotificationElement(id, message, type, dismissible, action);
    
    // Add to container
    this.container.appendChild(notification);
    
    // Store reference
    this.notifications.set(id, {
      element: notification,
      timer: null
    });

    // Trigger animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // Auto-dismiss if duration specified
    if (duration > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, duration);
      
      this.notifications.get(id).timer = timer;
    }

    return id;
  }

  /**
   * Show success notification
   */
  success(message, options = {}) {
    return this.show(message, { ...options, type: 'success' });
  }

  /**
   * Show error notification
   */
  error(message, options = {}) {
    return this.show(message, { ...options, type: 'error', duration: 0 });
  }

  /**
   * Show warning notification
   */
  warning(message, options = {}) {
    return this.show(message, { ...options, type: 'warning' });
  }

  /**
   * Show info notification
   */
  info(message, options = {}) {
    return this.show(message, { ...options, type: 'info' });
  }

  /**
   * Dismiss notification
   */
  dismiss(id) {
    const notification = this.notifications.get(id);
    
    if (!notification) {
      return;
    }

    // Clear timer
    if (notification.timer) {
      clearTimeout(notification.timer);
    }

    // Trigger exit animation
    notification.element.classList.remove('show');
    notification.element.classList.add('hide');

    // Remove after animation
    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      this.notifications.delete(id);
    }, 300);
  }

  /**
   * Dismiss all notifications
   */
  dismissAll() {
    this.notifications.forEach((_, id) => {
      this.dismiss(id);
    });
  }

  /**
   * Create notification element
   */
  createNotificationElement(id, message, type, dismissible, action) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('data-notification-id', id);

    // Icon
    const icon = this.getIcon(type);
    const iconEl = document.createElement('span');
    iconEl.className = 'notification-icon';
    iconEl.innerHTML = icon;
    notification.appendChild(iconEl);

    // Message
    const messageEl = document.createElement('div');
    messageEl.className = 'notification-message';
    messageEl.textContent = message;
    notification.appendChild(messageEl);

    // Action button
    if (action) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'notification-action';
      actionBtn.textContent = action.label;
      actionBtn.onclick = () => {
        action.handler();
        this.dismiss(id);
      };
      notification.appendChild(actionBtn);
    }

    // Dismiss button
    if (dismissible) {
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'notification-dismiss';
      dismissBtn.innerHTML = '&times;';
      dismissBtn.setAttribute('aria-label', 'Dismiss notification');
      dismissBtn.onclick = () => this.dismiss(id);
      notification.appendChild(dismissBtn);
    }

    return notification;
  }

  /**
   * Get icon for notification type
   */
  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy notification manager
   */
  destroy() {
    this.dismissAll();
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    this.container = null;
    this.notifications.clear();
  }
}

/**
 * Factory function to create notification manager
 */
export function createNotificationManager(options) {
  const manager = new NotificationManager(options);
  manager.initialize();
  return manager;
}

/**
 * Global notification manager instance
 */
let globalNotificationManager = null;

/**
 * Get or create global notification manager
 */
export function getNotificationManager() {
  if (!globalNotificationManager) {
    globalNotificationManager = createNotificationManager();
  }
  return globalNotificationManager;
}

/**
 * Convenience functions using global manager
 */
export function showNotification(message, options) {
  return getNotificationManager().show(message, options);
}

export function showSuccess(message, options) {
  return getNotificationManager().success(message, options);
}

export function showError(message, options) {
  return getNotificationManager().error(message, options);
}

export function showWarning(message, options) {
  return getNotificationManager().warning(message, options);
}

export function showInfo(message, options) {
  return getNotificationManager().info(message, options);
}
