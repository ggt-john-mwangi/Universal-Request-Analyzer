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
    throw new Error(
      "Cannot load SQL.js script: document is not defined. This function must be run in a browser environment."
    );
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "lib/sql-wasm.js" ||
      "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
