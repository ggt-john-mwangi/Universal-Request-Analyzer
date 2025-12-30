/**
 * Message handler - centralizes all extension messaging
 */

import { MessageError } from "../errors/error-types.js";

let eventBus = null;
let dbManager = null;
let authManager = null;
let encryptionManager = null;
const messageHandlers = new Map();

// Set up message handling system
export function setupMessageHandlers(database, auth, encryption, events) {
  dbManager = database;
  authManager = auth;
  encryptionManager = encryption;
  eventBus = events;

  // Register core message handlers
  registerCoreHandlers();

  // Set up message listeners
  setupMessageListeners();

  return {
    registerHandler,
    removeHandler,
    sendMessage,
  };
}

// Register core message handlers
function registerCoreHandlers() {
  // Database operations
  registerHandler("database:query", async (message) => {
    validateAuth(message);
    return await dbManager.query(message.query, message.params);
  });

  // Authentication operations
  registerHandler("auth:login", async (message) => {
    return await authManager.login(message.credentials);
  });

  registerHandler("auth:logout", async () => {
    return await authManager.logout();
  });

  // Export operations
  registerHandler("export:data", async (message) => {
    validateAuth(message);
    const exportManager = await import("../export/export-manager.js");
    return await exportManager.exportData(message.format, message.filters);
  });

  // Configuration operations
  registerHandler("config:update", async (message) => {
    validateAuth(message);
    const configManager = await import("../config/config-manager.js");
    return await configManager.updateConfig(message.config);
  });

  // Capture operations
  registerHandler("capture:toggle", async (message) => {
    validateAuth(message);
    const captureManager = await import("../capture/request-capture.js");
    return await captureManager.toggleCapture(message.enabled);
  });

  // Stats operations
  registerHandler("stats:get", async (message) => {
    validateAuth(message);
    return await dbManager.getStats(message.filters);
  });

  // Service operations
  registerHandler("service:status", () => {
    return Array.from(eventBus.getSubscriptions().keys());
  });
}

// Set up message listeners
function setupMessageListeners() {
  // Listen for runtime messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Keep the message channel open for async response
  });

  // Listen for external messages if allowed
  chrome.runtime.onMessageExternal?.addListener(
    (message, sender, sendResponse) => {
      if (isValidExternalSender(sender)) {
        handleMessage(message, sender).then(sendResponse);
        return true;
      }
    }
  );

  // Listen for connect events
  chrome.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener((message) => {
      handlePortMessage(message, port);
    });

    port.onDisconnect.addListener(() => {
      cleanupPort(port);
    });
  });
}

// Handle incoming messages
async function handleMessage(message, sender) {
  try {
    validateMessage(message);

    const handler = messageHandlers.get(message.type);
    if (!handler) {
      throw new MessageError(
        `No handler registered for message type: ${message.type}`
      );
    }

    const response = await handler(message.payload, sender);

    // Log message handling
    eventBus.publish("message:handled", {
      type: message.type,
      success: true,
      timestamp: Date.now(),
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error("Message handling failed:", error);

    eventBus.publish("message:error", {
      type: message.type,
      error: error.message,
      timestamp: Date.now(),
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

// Handle port messages
async function handlePortMessage(message, port) {
  try {
    const response = await handleMessage(message, { port });
    port.postMessage(response);
  } catch (error) {
    console.error("Port message handling failed:", error);
    port.postMessage({
      success: false,
      error: error.message,
    });
  }
}

// Register a new message handler
function registerHandler(type, handler) {
  if (messageHandlers.has(type)) {
    throw new MessageError(`Handler already registered for type: ${type}`);
  }
  messageHandlers.set(type, handler);
}

// Remove a message handler
function removeHandler(type) {
  return messageHandlers.delete(type);
}

// Send a message
async function sendMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type,
        payload,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new MessageError(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      }
    );
  });
}

// Validate message format
function validateMessage(message) {
  if (!message || !message.type) {
    throw new MessageError("Invalid message format");
  }
}

// Validate authentication for protected operations
function validateAuth(message) {
  if (!authManager.isAuthenticated() && !message.publicAccess) {
    throw new MessageError("Authentication required");
  }
}

// Validate external message senders
function isValidExternalSender(sender) {
  // Add your external sender validation logic here
  return false; // Default to rejecting external messages
}

// Clean up port resources
function cleanupPort(port) {
  // Add any port cleanup logic here
}
