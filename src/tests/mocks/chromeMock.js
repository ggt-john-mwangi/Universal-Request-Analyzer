// Chrome API mock for tests
const chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const data = {};
        if (typeof keys === "string") {
          data[keys] = localStorage.getItem(keys);
        } else if (Array.isArray(keys)) {
          keys.forEach((key) => {
            data[key] = localStorage.getItem(key);
          });
        } else if (typeof keys === "object") {
          Object.keys(keys).forEach((key) => {
            data[key] = localStorage.getItem(key);
          });
        }
        callback(data);
      }),
      set: jest.fn((items, callback) => {
        Object.entries(items).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
        callback();
      }),
    },
  },
  runtime: {
    getManifest: jest.fn(() => ({
      version: "1.0.0",
    })),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};

export default chrome;
