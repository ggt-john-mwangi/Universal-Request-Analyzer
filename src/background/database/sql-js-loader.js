// SQL.js loader

let SQL = null;

export async function initSqlJs() {
  if (SQL) return SQL;
  try {
    // Determine the global object
    const globalObject =
      typeof window !== "undefined"
        ? window
        : typeof self !== "undefined"
        ? self
        : global;

    // Load SQL.js
    const initSqlJs = globalObject.initSqlJs;

    if (!initSqlJs) {
      // Load SQL.js dynamically if not available
      await loadSqlJsScript();

      if (!globalObject.initSqlJs) {
        throw new Error("Failed to load SQL.js");
      }
    }

    // Initialize SQL.js
    SQL = await globalObject.initSqlJs({
      locateFile: (file) => {
        if (
          typeof chrome !== "undefined" &&
          chrome.runtime &&
          chrome.runtime.getURL
        ) {
          return chrome.runtime.getURL(`assets/wasm/${file}`);
        } else {
          // Handle cases where chrome is not defined (e.g., testing environment)
          console.warn(
            "chrome.runtime.getURL is not available. Using a fallback URL."
          );
          return `assets/wasm/${file}`; // Or a different fallback strategy
        }
      },
    });

    return SQL;
  } catch (error) {
    console.error("Failed to initialize SQL.js:", error);
    throw error;
  }
}

// Load SQL.js script dynamically
async function loadSqlJsScript() {
  if (typeof document === "undefined") {
    console.warn(
      "Cannot load SQL.js script: document is not defined. Falling back to Node.js-compatible loading."
    );
    // Attempt to load SQL.js in a Node.js environment
    if (typeof require !== "undefined") {
      try {
        const sqlJs = "assets/wasm/sql-wasm.js";
        global.initSqlJs = sqlJs;
        return;
      } catch (error) {
        throw new Error(
          "Failed to load SQL.js in Node.js environment: " + error.message
        );
      }
    }
    throw new Error(
      "Cannot load SQL.js script: document is not defined and Node.js fallback failed."
    );
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("assets/wasm/sql-wasm.js");
    script.onload = () => {
      if (typeof window.initSqlJs === "function") {
        resolve();
      } else {
        reject(new Error("SQL.js script loaded but initSqlJs is not defined."));
      }
    };
    script.onerror = () => {
      reject(new Error("Failed to load SQL.js script."));
    };
    document.head.appendChild(script);
  });
}

// Dynamically load and initialize the sql-wasm.js script
export async function getInitSqlJs() {
  if (typeof window.initSqlJs === "function") {
    // If already loaded, return the initialized function
    return window.initSqlJs({
      locateFile: (file) => chrome.runtime.getURL(`assets/wasm/${file}`),
    });
  }

  // Dynamically load the sql-wasm.js script
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("assets/wasm/sql-wasm.js");
    script.onload = () => {
      if (typeof window.initSqlJs === "function") {
        resolve(
          window.initSqlJs({
            locateFile: (file) => chrome.runtime.getURL(`assets/wasm/${file}`),
          })
        );
      } else {
        reject(
          new Error(
            "Failed to initialize SQL-WASM.js: initSqlJs is not defined."
          )
        );
      }
    };
    script.onerror = () => {
      reject(new Error("Failed to load sql-wasm.js script."));
    };
    document.head.appendChild(script);
  });
}
