// Web Worker for background tasks
importScripts("../assets/wasm/sql-wasm.js");

self.addEventListener("message", async (event) => {
  const { action, payload } = event.data;

  if (action === "initialize") {
    try {
      const SQL = await initSqlJs({
        locateFile: (file) => `../assets/wasm/${file}`,
      });

      const db = new SQL.Database();
      db.exec(
        `CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, url TEXT);`
      );

      self.postMessage({ status: "initialized", db });
    } catch (error) {
      self.postMessage({ status: "error", error: error.message });
    }
  }

  // Handle other actions here
});
