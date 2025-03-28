/**
 * Chrome API Mock for testing
 */

const jest = require("jest-mock") // Import jest

const chromeMock = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn((message, callback) => {
      if (callback) {
        // Simulate async response
        setTimeout(() => {
          // Default mock responses based on action
          if (message.action === "getConfig") {
            callback({
              config: {
                maxStoredRequests: 10000,
                captureEnabled: true,
                captureFilters: {
                  includeDomains: [],
                  excludeDomains: [],
                  includeTypes: ["xmlhttprequest", "fetch", "script", "stylesheet", "image", "font", "other"],
                },
              },
            })
          } else if (message.action === "updateConfig") {
            callback({ success: true })
          } else if (message.action === "getRequestsFromDB") {
            callback({
              requests: [],
              columns: ["id", "url", "method", "status", "type", "size", "duration", "timestamp"],
              total: 0,
            })
          } else if (message.action === "getStats") {
            callback({
              stats: {
                totalRequests: 0,
                avgResponseTime: 0,
                statusCodes: {},
                requestTypes: {},
                topDomains: [],
                timeDistribution: {},
              },
            })
          } else if (message.action === "clearRequests") {
            callback({ success: true })
          } else if (message.action === "exportData") {
            callback({ success: true })
          } else {
            callback(null)
          }
        }, 0)
      }
    }),
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const result = {}
        if (typeof keys === "string") {
          result[keys] = localStorage.getItem(keys)
        } else if (Array.isArray(keys)) {
          keys.forEach((key) => {
            result[key] = localStorage.getItem(key)
          })
        } else if (typeof keys === "object") {
          Object.keys(keys).forEach((key) => {
            const value = localStorage.getItem(key)
            result[key] = value !== null ? JSON.parse(value) : keys[key]
          })
        } else {
          // Get all items
          const allItems = localStorage.getAll()
          Object.keys(allItems).forEach((key) => {
            try {
              result[key] = JSON.parse(allItems[key])
            } catch (e) {
              result[key] = allItems[key]
            }
          })
        }
        callback(result)
      }),
      set: jest.fn((items, callback) => {
        Object.entries(items).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value))
        })
        if (callback) callback()
      }),
      remove: jest.fn((keys, callback) => {
        if (typeof keys === "string") {
          localStorage.removeItem(keys)
        } else if (Array.isArray(keys)) {
          keys.forEach((key) => localStorage.removeItem(key))
        }
        if (callback) callback()
      }),
      clear: jest.fn((callback) => {
        localStorage.clear()
        if (callback) callback()
      }),
    },
    sync: {
      get: jest.fn((keys, callback) => {
        // Mimic the same behavior as local storage for testing
        chromeMock.storage.local.get(keys, callback)
      }),
      set: jest.fn((items, callback) => {
        chromeMock.storage.local.set(items, callback)
      }),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn((queryInfo, callback) => {
      callback([{ id: 1, url: "https://example.com" }])
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      if (callback) callback({ success: true })
    }),
    create: jest.fn((createProperties, callback) => {
      if (callback) callback({ id: 2 })
    }),
    update: jest.fn((tabId, updateProperties, callback) => {
      if (callback) callback({ id: tabId })
    }),
  },
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onBeforeSendHeaders: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onHeadersReceived: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onCompleted: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onErrorOccurred: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  browserAction: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setIcon: jest.fn(),
  },
  extension: {
    getURL: jest.fn((path) => `chrome-extension://mock-extension-id/${path}`),
  },
  permissions: {
    request: jest.fn((permissions, callback) => {
      if (callback) callback(true)
    }),
    contains: jest.fn((permissions, callback) => {
      if (callback) callback(true)
    }),
    remove: jest.fn((permissions, callback) => {
      if (callback) callback(true)
    }),
  },
  contextMenus: {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    removeAll: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  notifications: {
    create: jest.fn((id, options, callback) => {
      if (callback) callback(id || "notification-id")
    }),
    clear: jest.fn((id, callback) => {
      if (callback) callback(true)
    }),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
}

export default chromeMock

