// Browser compatibility layer - provides consistent API across different browsers

// Get the appropriate browser API
const getBrowserAPI = () => {
  if (typeof browser !== "undefined" && browser.runtime) {
    return browser; // Firefox
  }
  if (typeof chrome !== "undefined" && chrome.runtime) {
    return chrome; // Chrome, Edge, Safari
  }
  console.error(
    "[browser-compat] No browser API available! Neither chrome nor browser object found."
  );
  return null;
};

const browserAPI = getBrowserAPI();

if (!browserAPI) {
  throw new Error(
    "[browser-compat] Fatal: No browser extension API available. This code must run in a browser extension context."
  );
}

// Browser detection
const browserInfo = {
  isFirefox: typeof browser !== "undefined" && !!browser.runtime,
  isChrome:
    typeof chrome !== "undefined" &&
    !!chrome.runtime &&
    !navigator.userAgent.includes("Edg") &&
    !navigator.userAgent.includes("Safari"),
  isEdge:
    typeof chrome !== "undefined" &&
    !!chrome.runtime &&
    navigator.userAgent.includes("Edg"),
  isSafari:
    typeof chrome !== "undefined" &&
    !!chrome.runtime &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
};

// Storage API compatibility
export const storage = {
  async get(keys) {
    if (browserInfo.isFirefox) {
      return browser.storage.local.get(keys);
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.storage.local.get(keys, (result) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async set(items) {
    if (browserInfo.isFirefox) {
      return browser.storage.local.set(items);
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.storage.local.set(items, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async remove(keys) {
    if (browserInfo.isFirefox) {
      return browser.storage.local.remove(keys);
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.storage.local.remove(keys, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async clear() {
    if (browserInfo.isFirefox) {
      return browser.storage.local.clear();
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.storage.local.clear(() => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
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
        browserAPI.storage.onChanged.addListener(wrappedCallback);
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
    return new Promise((resolve, reject) => {
      try {
        browserAPI.runtime.sendMessage(message, (response) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async connect(connectInfo) {
    if (browserInfo.isFirefox) {
      return browser.runtime.connect(connectInfo);
    }
    return browserAPI.runtime.connect(connectInfo);
  },

  onMessage: {
    addListener(callback) {
      if (browserInfo.isFirefox) {
        browser.runtime.onMessage.addListener((message, sender) => {
          return callback(message, sender);
        });
      } else {
        browserAPI.runtime.onMessage.addListener(
          (message, sender, sendResponse) => {
            const response = callback(message, sender, sendResponse);
            if (response instanceof Promise) {
              response.then(sendResponse).catch((error) => {
                console.error("Message handler error:", error);
                sendResponse({ success: false, error: error.message });
              });
              return true; // Required for async responses
            }
            // Don't call sendResponse if callback handles it
            return true;
          }
        );
      }
    },
  },

  getURL(path) {
    if (browserInfo.isFirefox) {
      return browser.runtime.getURL(path);
    }
    return browserAPI.runtime.getURL(path);
  },

  get id() {
    return browserAPI.runtime.id;
  },

  openOptionsPage() {
    if (browserInfo.isFirefox) {
      return browser.runtime.openOptionsPage();
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.runtime.openOptionsPage(() => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  onInstalled: {
    addListener(callback) {
      if (browserInfo.isFirefox) {
        browser.runtime.onInstalled.addListener(callback);
      } else {
        browserAPI.runtime.onInstalled.addListener(callback);
      }
    },
  },

  onStartup: {
    addListener(callback) {
      if (browserInfo.isFirefox) {
        browser.runtime.onStartup.addListener(callback);
      } else {
        browserAPI.runtime.onStartup.addListener(callback);
      }
    },
  },

  onSuspend: browserAPI.runtime.onSuspend
    ? {
        addListener(callback) {
          if (browserInfo.isFirefox) {
            browser.runtime.onSuspend.addListener(callback);
          } else {
            browserAPI.runtime.onSuspend.addListener(callback);
          }
        },
      }
    : null,
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
      return browserAPI.webRequest.onBeforeRequest.addListener(
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
      return browserAPI.webRequest.onCompleted.addListener(
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
      return browserAPI.webRequest.onErrorOccurred.addListener(
        callback,
        filter
      );
    },
  },
};

// Notifications API compatibility
export const notifications = {
  async create(id, options) {
    if (browserInfo.isFirefox) {
      return browser.notifications.create(id, options);
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.notifications.create(id, options, (notificationId) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(notificationId);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async clear(id) {
    if (browserInfo.isFirefox) {
      return browser.notifications.clear(id);
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.notifications.clear(id, (wasCleared) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(wasCleared);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  onClicked: {
    addListener(callback) {
      if (browserInfo.isFirefox) {
        browser.notifications.onClicked.addListener(callback);
      } else {
        browserAPI.notifications.onClicked.addListener(callback);
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
    return new Promise((resolve, reject) => {
      try {
        browserAPI.downloads.download(options, (downloadId) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(downloadId);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },
};

// Tabs API compatibility
export const tabs = {
  async query(queryInfo) {
    if (browserInfo.isFirefox) {
      return browser.tabs.query(queryInfo);
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.tabs.query(queryInfo, (result) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async sendMessage(tabId, message) {
    if (browserInfo.isFirefox) {
      return browser.tabs.sendMessage(tabId, message);
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.tabs.sendMessage(tabId, message, (response) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async create(createProperties) {
    if (browserInfo.isFirefox) {
      return browser.tabs.create(createProperties);
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.tabs.create(createProperties, (tab) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async update(tabId, updateProperties) {
    if (browserInfo.isFirefox) {
      return browser.tabs.update(tabId, updateProperties);
    }
    return new Promise((resolve, reject) => {
      try {
        browserAPI.tabs.update(tabId, updateProperties, (tab) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },
};

// Extension feature detection
export const features = {
  hasClipboardAccess:
    browserInfo.isChrome || browserInfo.isEdge || browserInfo.isSafari,
  hasUnlimitedStorage: browserInfo.isChrome || browserInfo.isEdge,
  hasBackgroundWorkers:
    browserInfo.isChrome || browserInfo.isEdge || browserInfo.isSafari,
  hasMV3Support:
    browserInfo.isChrome || browserInfo.isEdge || browserInfo.isSafari,
  hasWebRequestBlocking: true, // Will be false for MV3 in Chrome
  hasNativeMessaging:
    browserInfo.isChrome || browserInfo.isEdge || browserInfo.isFirefox,
  supportsPromises: browserInfo.isFirefox || browserInfo.isSafari, // Firefox and Safari support promises natively
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
