// Browser compatibility layer - provides consistent API across different browsers

// Browser detection
const browserInfo = {
  isChrome: typeof chrome !== "undefined" && !!chrome.runtime,
  isFirefox: typeof browser !== "undefined",
  isEdge:
    typeof chrome !== "undefined" &&
    !!chrome.runtime &&
    navigator.userAgent.includes("Edg"),
  isSafari:
    typeof chrome !== "undefined" &&
    !!chrome.runtime &&
    navigator.userAgent.includes("Safari") &&
    !navigator.userAgent.includes("Chrome"),
};

// Storage API compatibility
export const storage = {
  async get(keys) {
    if (browserInfo.isFirefox) {
      return browser.storage.local.get(keys);
    }
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  },

  async set(items) {
    if (browserInfo.isFirefox) {
      return browser.storage.local.set(items);
    }
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  },

  async remove(keys) {
    if (browserInfo.isFirefox) {
      return browser.storage.local.remove(keys);
    }
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
  },

  async clear() {
    if (browserInfo.isFirefox) {
      return browser.storage.local.clear();
    }
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  },

  onChanged: {
    addListener(callback) {
      const wrappedCallback = (changes, areaName) => {
        if (areaName === "local") {
          callback(changes);
        }
      };
      if (browserInfo.isFirefox) {
        browser.storage.onChanged.addListener(wrappedCallback);
      } else {
        chrome.storage.onChanged.addListener(wrappedCallback);
      }
    },
  },
};

// Runtime API compatibility
export const runtime = {
  async sendMessage(message) {
    if (browserInfo.isFirefox) {
      return browser.runtime.sendMessage(message);
    }
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  },

  async connect(connectInfo) {
    if (browserInfo.isFirefox) {
      return browser.runtime.connect(connectInfo);
    }
    return chrome.runtime.connect(connectInfo);
  },

  onMessage: {
    addListener(callback) {
      if (browserInfo.isFirefox) {
        browser.runtime.onMessage.addListener((message, sender) => {
          return callback(message, sender);
        });
      } else {
        chrome.runtime.onMessage.addListener(
          (message, sender, sendResponse) => {
            const response = callback(message, sender);
            if (response instanceof Promise) {
              response.then(sendResponse);
              return true;
            }
            sendResponse(response);
          }
        );
      }
    },
  },

  getURL(path) {
    if (browserInfo.isFirefox) {
      return browser.runtime.getURL(path);
    }
    return chrome.runtime.getURL(path);
  },
};

// Web Request API compatibility
export const webRequest = {
  onBeforeRequest: {
    addListener(callback, filter, extraInfoSpec) {
      if (browserInfo.isFirefox) {
        return browser.webRequest.onBeforeRequest.addListener(
          callback,
          filter,
          extraInfoSpec
        );
      }
      return chrome.webRequest.onBeforeRequest.addListener(
        callback,
        filter,
        extraInfoSpec
      );
    },
  },

  onCompleted: {
    addListener(callback, filter, extraInfoSpec) {
      if (browserInfo.isFirefox) {
        return browser.webRequest.onCompleted.addListener(
          callback,
          filter,
          extraInfoSpec
        );
      }
      return chrome.webRequest.onCompleted.addListener(
        callback,
        filter,
        extraInfoSpec
      );
    },
  },

  onErrorOccurred: {
    addListener(callback, filter) {
      if (browserInfo.isFirefox) {
        return browser.webRequest.onErrorOccurred.addListener(callback, filter);
      }
      return chrome.webRequest.onErrorOccurred.addListener(callback, filter);
    },
  },
};

// Notifications API compatibility
export const notifications = {
  async create(id, options) {
    if (browserInfo.isFirefox) {
      return browser.notifications.create(id, options);
    }
    return new Promise((resolve) => {
      chrome.notifications.create(id, options, resolve);
    });
  },

  async clear(id) {
    if (browserInfo.isFirefox) {
      return browser.notifications.clear(id);
    }
    return new Promise((resolve) => {
      chrome.notifications.clear(id, resolve);
    });
  },

  onClicked: {
    addListener(callback) {
      if (browserInfo.isFirefox) {
        browser.notifications.onClicked.addListener(callback);
      } else {
        chrome.notifications.onClicked.addListener(callback);
      }
    },
  },
};

// Downloads API compatibility
export const downloads = {
  async download(options) {
    if (browserInfo.isFirefox) {
      return browser.downloads.download(options);
    }
    return new Promise((resolve) => {
      chrome.downloads.download(options, resolve);
    });
  },
};

// Tabs API compatibility
export const tabs = {
  async query(queryInfo) {
    if (browserInfo.isFirefox) {
      return browser.tabs.query(queryInfo);
    }
    return new Promise((resolve) => {
      chrome.tabs.query(queryInfo, resolve);
    });
  },

  async sendMessage(tabId, message) {
    if (browserInfo.isFirefox) {
      return browser.tabs.sendMessage(tabId, message);
    }
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, resolve);
    });
  },
};

// Extension feature detection
export const features = {
  hasClipboardAccess: browserInfo.isChrome || browserInfo.isEdge,
  hasUnlimitedStorage: browserInfo.isChrome || browserInfo.isEdge,
  hasBackgroundWorkers: browserInfo.isChrome || browserInfo.isEdge,
  hasMV3Support: browserInfo.isChrome || browserInfo.isEdge,
  hasWebRequestBlocking: true, // Will be false for MV3 in Chrome
  hasNativeMessaging: true,
};

// Initialize compatibility layer
export function initCompatLayer() {
  // Set up MV2/MV3 compatibility
  if (features.hasMV3Support) {
    features.hasWebRequestBlocking = false;
    // Add any MV3-specific initializations
  }

  // Log browser environment
  console.log("Browser compatibility initialized:", {
    browser: browserInfo,
    features,
  });

  return {
    browserInfo,
    features,
    storage,
    runtime,
    webRequest,
    notifications,
    downloads,
    tabs,
  };
}
