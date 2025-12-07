// Tab manager component
export default class TabManager {
  constructor(options = {}) {
    this.activeTab = null;
    this.tabChangeHandlers = new Map();
    this.options = {
      defaultTab: "requests",
      ...options,
    };
  }

  initialize() {
    this.setupEventListeners();
    this.switchTab(this.options.defaultTab);
  }

  setupEventListeners() {
    document.querySelectorAll(".tab-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const tabId = button.dataset.tab;
        this.switchTab(tabId);
      });
    });
  }

  switchTab(tabId) {
    // Remove active class from all tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    // Add active class to selected tab
    const tabButton = document.querySelector(`[data-tab="${tabId}"]`);
    const tabContent = document.getElementById(`${tabId}-tab`);

    if (tabButton && tabContent) {
      tabButton.classList.add("active");
      tabContent.classList.add("active");
      this.activeTab = tabId;

      // Notify handlers of tab change
      if (this.tabChangeHandlers.has(tabId)) {
        this.tabChangeHandlers.get(tabId)();
      }
    }
  }

  getActiveTab() {
    return this.activeTab;
  }

  onTabChange(tabId, handler) {
    this.tabChangeHandlers.set(tabId, handler);
  }

  removeTabChangeHandler(tabId) {
    this.tabChangeHandlers.delete(tabId);
  }
}

// Export singleton instance
export const tabManager = new TabManager();
