// SQL.js loader

let SQL = null

export async function initSqlJs() {
  if (SQL) return SQL

  try {
    // Load SQL.js
    const initSqlJs = window.initSqlJs || self.initSqlJs

    if (!initSqlJs) {
      // Load SQL.js dynamically if not available
      await loadSqlJsScript()

      if (!window.initSqlJs && !self.initSqlJs) {
        throw new Error("Failed to load SQL.js")
      }
    }

    // Initialize SQL.js
    SQL = await (window.initSqlJs || self.initSqlJs)({
      locateFile: (file) => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
          return chrome.runtime.getURL(`assets/wasm/${file}`)
        } else {
          // Handle cases where chrome is not defined (e.g., testing environment)
          console.warn("chrome.runtime.getURL is not available. Using a fallback URL.")
          return `assets/wasm/${file}` // Or a different fallback strategy
        }
      },
    })

    return SQL
  } catch (error) {
    console.error("Failed to initialize SQL.js:", error)
    throw error
  }
}

// Load SQL.js script dynamically
async function loadSqlJsScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js"
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

