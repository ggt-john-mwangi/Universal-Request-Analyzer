// Cross-browser compatibility layer

// Set up cross-browser compatibility
export function setupCrossBrowserCompat() {
  // Define global browser object if it doesn't exist
  if (typeof window !== "undefined" && !window.browser) {
    window.browser = getBrowserAPI()
  }

  console.log("Cross-browser compatibility layer initialized")

  return {
    getBrowser,
    isChrome,
    isFirefox,
    isEdge,
    isSafari,
    getAPI,
  }
}

// Get browser API (compatible with Chrome, Firefox, Edge, Safari)
function getBrowserAPI() {
  // Chrome
  if (typeof chrome !== "undefined") {
    return {
      // Storage API
      storage: {
        local: {
          get: chrome.storage.local.get.bind(chrome.storage.local),
          set: chrome.storage.local.set.bind(chrome.storage.local),
          remove: chrome.storage.local.remove.bind(chrome.storage.local),
          clear: chrome.storage.local.clear.bind(chrome.storage.local),
        },
        sync: {
          get: chrome.storage.sync.get.bind(chrome.storage.sync),
          set: chrome.storage.sync.set.bind(chrome.storage.sync),
          remove: chrome.storage.sync.remove.bind(chrome.storage.sync),
          clear: chrome.storage.sync.clear.bind(chrome.storage.sync),
        },
        onChanged: {
          addListener: chrome.storage.onChanged.addListener.bind(chrome.storage.onChanged),
          removeListener: chrome.storage.onChanged.removeListener.bind(chrome.storage.onChanged),
        },
      },

      // Runtime API
      runtime: {
        getManifest: chrome.runtime.getManifest.bind(chrome.runtime),
        getURL: chrome.runtime.getURL.bind(chrome.runtime),
        sendMessage: chrome.runtime.sendMessage.bind(chrome.runtime),
        onMessage: {
          addListener: chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage),
          removeListener: chrome.runtime.onMessage.removeListener.bind(chrome.runtime.onMessage),
        },
        getBackgroundPage: chrome.runtime.getBackgroundPage.bind(chrome.runtime),
        lastError: chrome.runtime.lastError,
      },

      // Tabs API
      tabs: {
        query: chrome.tabs.query.bind(chrome.tabs),
        create: chrome.tabs.create.bind(chrome.tabs),
        update: chrome.tabs.update.bind(chrome.tabs),
        remove: chrome.tabs.remove.bind(chrome.tabs),
        get: chrome.tabs.get.bind(chrome.tabs),
        onUpdated: {
          addListener: chrome.tabs.onUpdated.addListener.bind(chrome.tabs.onUpdated),
          removeListener: chrome.tabs.onUpdated.removeListener.bind(chrome.tabs.onUpdated),
        },
      },

      // Web Request API
      webRequest: {
        onBeforeRequest: {
          addListener: chrome.webRequest.onBeforeRequest.addListener.bind(chrome.webRequest.onBeforeRequest),
          removeListener: chrome.webRequest.onBeforeRequest.removeListener.bind(chrome.webRequest.onBeforeRequest),
        },
        onHeadersReceived: {
          addListener: chrome.webRequest.onHeadersReceived.addListener.bind(chrome.webRequest.onHeadersReceived),
          removeListener: chrome.webRequest.onHeadersReceived.removeListener.bind(chrome.webRequest.onHeadersReceived),
        },
        onCompleted: {
          addListener: chrome.webRequest.onCompleted.addListener.bind(chrome.webRequest.onCompleted),
          removeListener: chrome.webRequest.onCompleted.removeListener.bind(chrome.webRequest.onCompleted),
        },
        onErrorOccurred: {
          addListener: chrome.webRequest.onErrorOccurred.addListener.bind(chrome.webRequest.onErrorOccurred),
          removeListener: chrome.webRequest.onErrorOccurred.removeListener.bind(chrome.webRequest.onErrorOccurred),
        },
      },

      // Downloads API
      downloads: {
        download: chrome.downloads.download.bind(chrome.downloads),
        onChanged: {
          addListener: chrome.downloads.onChanged.addListener.bind(chrome.downloads.onChanged),
          removeListener: chrome.downloads.onChanged.removeListener.bind(chrome.downloads.onChanged),
        },
      },

      // Notifications API
      notifications: {
        create: chrome.notifications.create.bind(chrome.notifications),
        clear: chrome.notifications.clear.bind(chrome.notifications),
        onClicked: {
          addListener: chrome.notifications.onClicked.addListener.bind(chrome.notifications.onClicked),
          removeListener: chrome.notifications.onClicked.removeListener.bind(chrome.notifications.onClicked),
        },
      },
    }
  }

  // Firefox
  if (typeof browser !== "undefined") {
    return browser
  }

  // Fallback to empty implementation
  return {
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      },
      sync: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      },
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    runtime: {
      getManifest: () => ({}),
      getURL: (path) => path,
      sendMessage: () => Promise.resolve(),
      onMessage: {
        addListener: () => {},
        removeListener: () => {},
      },
      getBackgroundPage: () => Promise.resolve(window),
      lastError: null,
    },
    tabs: {
      query: () => Promise.resolve([]),
      create: () => Promise.resolve({}),
      update: () => Promise.resolve({}),
      remove: () => Promise.resolve(),
      get: () => Promise.resolve({}),
      onUpdated: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    webRequest: {
      onBeforeRequest: {
        addListener: () => {},
        removeListener: () => {},
      },
      onHeadersReceived: {
        addListener: () => {},
        removeListener: () => {},
      },
      onCompleted: {
        addListener: () => {},
        removeListener: () => {},
      },
      onErrorOccurred: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    downloads: {
      download: () => Promise.resolve(0),
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    notifications: {
      create: () => Promise.resolve(""),
      clear: () => Promise.resolve(true),
      onClicked: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
  }
}

// Get browser name
function getBrowser() {
  const userAgent = navigator.userAgent

  if (userAgent.indexOf("Chrome") > -1) {
    if (userAgent.indexOf("Edg") > -1) {
      return "Edge"
    }
    return "Chrome"
  }

  if (userAgent.indexOf("Firefox") > -1) {
    return "Firefox"
  }

  if (userAgent.indexOf("Safari") > -1) {
    return "Safari"
  }

  return "Unknown"
}

// Check if browser is Chrome
function isChrome() {
  return getBrowser() === "Chrome"
}

// Check if browser is Firefox
function isFirefox() {
  return getBrowser() === "Firefox"
}

// Check if browser is Edge
function isEdge() {
  return getBrowser() === "Edge"
}

// Check if browser is Safari
function isSafari() {
  return getBrowser() === "Safari"
}

// Get appropriate API for current browser
function getAPI(apiName) {
  const browser = getBrowser()

  switch (apiName) {
    case "storage":
      return browser === "Firefox" ? browser.storage : chrome.storage

    case "runtime":
      return browser === "Firefox" ? browser.runtime : chrome.runtime

    case "tabs":
      return browser === "Firefox" ? browser.tabs : chrome.tabs

    case "webRequest":
      return browser === "Firefox" ? browser.webRequest : chrome.webRequest

    case "downloads":
      return browser === "Firefox" ? browser.downloads : chrome.downloads

    case "notifications":
      return browser === "Firefox" ? browser.notifications : chrome.notifications

    default:
      return null
  }
}

