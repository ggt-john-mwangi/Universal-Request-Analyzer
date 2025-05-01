// Notification system component
export default class NotificationSystem {
  constructor() {
    this.initialize();
  }

  initialize() {
    // Create container for notifications if it doesn't exist
    if (!document.getElementById('notification-container')) {
      const container = document.createElement('div');
      container.id = 'notification-container';
      document.body.appendChild(container);
    }
  }

  show(message, isError = false) {
    const notification = document.createElement("div");
    notification.className = `notification${isError ? " error" : ""}`;
    notification.textContent = message;
    
    const container = document.getElementById('notification-container');
    container.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.classList.add("fade-out");
      setTimeout(() => {
        container.removeChild(notification);
      }, 300);
    }, 3000);
  }

  showSuccess(message) {
    this.show(message, false);
  }

  showError(message) {
    this.show(message, true);
  }
}

// Create and export singleton instance
export const notificationSystem = new NotificationSystem();