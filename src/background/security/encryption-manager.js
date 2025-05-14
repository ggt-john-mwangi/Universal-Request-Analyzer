// Encryption manager - handles data encryption and decryption

import { EncryptionError } from "../errors/error-types.js"

let encryptionKey = null
let isEnabled = false
let eventBus = null

// Set up encryption system
export async function setupEncryption(securityConfig, events) {
  eventBus = events

  // Check if encryption is enabled in config
  if (securityConfig.encryption && securityConfig.encryption.enabled) {
    isEnabled = true

    // Try to load saved key
    const savedKey = await loadEncryptionKey()
    if (savedKey) {
      encryptionKey = savedKey
    }
  }

  console.log(`Encryption system initialized (enabled: ${isEnabled})`)

  return {
    encrypt,
    decrypt,
    setKey,
    generateKey,
    exportKey,
    isEnabled: () => isEnabled,
    enable,
    disable,
  }
}

// Load encryption key from database
async function loadEncryptionKey() {
  if (dbManager && dbManager.getEncryptionKey) {
    return dbManager.getEncryptionKey();
  }
  return null;
}

// Save encryption key to database
async function saveEncryptionKey(key) {
  if (dbManager && dbManager.saveEncryptionKey) {
    dbManager.saveEncryptionKey(key);
    return true;
  }
  return false;
}

// Generate a new encryption key
function generateKey() {
  try {
    // Generate a random key
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)

    // Convert to base64 for storage
    const key = btoa(String.fromCharCode.apply(null, array))

    // Save the key
    encryptionKey = key
    saveEncryptionKey(key)

    // Generate a key file for download
    const keyFile = `UNIVERSAL_REQUEST_ANALYZER_ENCRYPTION_KEY\n${key}\nDO NOT SHARE THIS FILE`
    const blob = new Blob([keyFile], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    // Download the key file
    if (typeof chrome !== "undefined" && chrome.downloads) {
      chrome.downloads.download({
        url: url,
        filename: "request-analyzer-encryption-key.txt",
        saveAs: true,
      })
    } else {
      console.warn("Chrome downloads API not available.")
      // Handle the case where chrome.downloads is not available (e.g., in a testing environment)
    }

    eventBus.publish("encryption:key_generated", { timestamp: Date.now() })

    return key
  } catch (error) {
    console.error("Failed to generate encryption key:", error)
    throw new EncryptionError("Failed to generate encryption key", error)
  }
}

// Set encryption key
function setKey(key) {
  encryptionKey = key
  saveEncryptionKey(key)
  eventBus.publish("encryption:key_set", { timestamp: Date.now() })
}

// Export encryption key
function exportKey() {
  if (!encryptionKey) {
    throw new EncryptionError("No encryption key available")
  }

  try {
    // Generate a key file for download
    const keyFile = `UNIVERSAL_REQUEST_ANALYZER_ENCRYPTION_KEY\n${encryptionKey}\nDO NOT SHARE THIS FILE`
    const blob = new Blob([keyFile], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    // Download the key file
    if (typeof chrome !== "undefined" && chrome.downloads) {
      chrome.downloads.download({
        url: url,
        filename: "request-analyzer-encryption-key.txt",
        saveAs: true,
      })
    } else {
      console.warn("Chrome downloads API not available.")
      // Handle the case where chrome.downloads is not available (e.g., in a testing environment)
    }

    eventBus.publish("encryption:key_exported", { timestamp: Date.now() })

    return true
  } catch (error) {
    console.error("Failed to export encryption key:", error)
    throw new EncryptionError("Failed to export encryption key", error)
  }
}

// Enable encryption
function enable() {
  if (!encryptionKey) {
    throw new EncryptionError("No encryption key available")
  }

  isEnabled = true
  eventBus.publish("encryption:enabled", { timestamp: Date.now() })
}

// Disable encryption
function disable() {
  isEnabled = false
  eventBus.publish("encryption:disabled", { timestamp: Date.now() })
}

// Encrypt data
function encrypt(data) {
  if (!isEnabled || !encryptionKey) {
    return data
  }

  try {
    // For simplicity, we're using a basic XOR encryption
    // In a real-world scenario, you would use a more secure encryption algorithm

    // Convert data to string if it's not already
    let dataStr
    if (data instanceof Uint8Array) {
      dataStr = Array.from(data)
        .map((byte) => String.fromCharCode(byte))
        .join("")
    } else if (typeof data !== "string") {
      dataStr = JSON.stringify(data)
    } else {
      dataStr = data
    }

    // Decode the base64 key
    const keyBytes = atob(encryptionKey)
      .split("")
      .map((char) => char.charCodeAt(0))

    // XOR encrypt
    const encrypted = []
    for (let i = 0; i < dataStr.length; i++) {
      const charCode = dataStr.charCodeAt(i)
      const keyByte = keyBytes[i % keyBytes.length]
      encrypted.push(String.fromCharCode(charCode ^ keyByte))
    }

    // Convert to base64
    return btoa(encrypted.join(""))
  } catch (error) {
    console.error("Encryption failed:", error)
    throw new EncryptionError("Encryption failed", error)
  }
}

// Decrypt data
function decrypt(encryptedData) {
  if (!isEnabled || !encryptionKey) {
    return encryptedData
  }

  try {
    // Decode the base64 encrypted data
    const encryptedBytes = atob(encryptedData)
      .split("")
      .map((char) => char.charCodeAt(0))

    // Decode the base64 key
    const keyBytes = atob(encryptionKey)
      .split("")
      .map((char) => char.charCodeAt(0))

    // XOR decrypt
    const decrypted = []
    for (let i = 0; i < encryptedBytes.length; i++) {
      const encryptedByte = encryptedBytes[i]
      const keyByte = keyBytes[i % keyBytes.length]
      decrypted.push(String.fromCharCode(encryptedByte ^ keyByte))
    }

    // Convert back to original format
    const decryptedStr = decrypted.join("")

    // Try to parse as JSON if it looks like JSON
    if (decryptedStr.startsWith("{") || decryptedStr.startsWith("[")) {
      try {
        return JSON.parse(decryptedStr)
      } catch (e) {
        // Not valid JSON, return as string
        return decryptedStr
      }
    }

    // Try to convert to Uint8Array if it looks like binary data
    try {
      return new Uint8Array(decryptedStr.split("").map((char) => char.charCodeAt(0)))
    } catch (e) {
      // Not binary data, return as string
      return decryptedStr
    }
  } catch (error) {
    console.error("Decryption failed:", error)
    throw new EncryptionError("Decryption failed", error)
  }
}

