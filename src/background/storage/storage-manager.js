export const saveToStorage = (key, value) => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        resolve();
      }
    } catch (error) {
      reject(error);
    }
  });
};

export const loadFromStorage = (key) => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result[key]);
          }
        });
      } else {
        const value = localStorage.getItem(key);
        resolve(value ? JSON.parse(value) : null);
      }
    } catch (error) {
      reject(error);
    }
  });
};
