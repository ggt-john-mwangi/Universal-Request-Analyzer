// SQL.js Loader for Service Worker (Manifest V3)
// Handles WASM loading without XMLHttpRequest

// Import the SQL.js module
import initSqlJsModule from "../../assets/wasm/sql-wasm.js";

let sqlJsInstance = null;
let initPromise = null;

/**
 * Initialize SQL.js with proper service worker configuration
 * Provides wasmBinary directly to prevent XMLHttpRequest usage
 */
export async function initSqlJs() {
  // Return cached instance if available
  if (sqlJsInstance) {
    return sqlJsInstance;
  }
  
  // Return existing promise if initialization is in progress
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log('Initializing SQL.js in service worker context...');
      
      // Get the WASM file URL using chrome.runtime.getURL
      const wasmUrl = chrome.runtime.getURL('assets/wasm/sql-wasm.wasm');
      console.log('WASM URL:', wasmUrl);
      
      // Fetch the WASM binary before initializing SQL.js
      // This prevents the library from using XMLHttpRequest
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
      }
      
      const wasmBinary = await response.arrayBuffer();
      console.log('WASM binary loaded, size:', wasmBinary.byteLength, 'bytes');
      
      // Initialize SQL.js with the pre-loaded WASM binary
      // This configuration prevents any file loading attempts
      const config = {
        // Provide the WASM binary directly
        wasmBinary: new Uint8Array(wasmBinary),
        // Prevent any file loading by providing empty locateFile
        locateFile: (file) => {
          console.warn('locateFile called for:', file);
          return chrome.runtime.getURL(`assets/wasm/${file}`);
        }
      };
      
      console.log('Calling initSqlJsModule with config...');
      sqlJsInstance = await initSqlJsModule(config);
      
      console.log('✓ SQL.js initialized successfully');
      return sqlJsInstance;
      
    } catch (error) {
      console.error('❌ Failed to initialize SQL.js:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Clear the promise so retry is possible
      initPromise = null;
      
      throw new Error(`SQL.js initialization failed: ${error.message}`);
    }
  })();

  return initPromise;
}
