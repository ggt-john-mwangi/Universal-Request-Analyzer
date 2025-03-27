// ID generator utility

// Generate a unique ID
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

// Generate a UUID v4
export function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Generate a short ID (for display)
export function generateShortId(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let id = ""

  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return id
}

// Generate a sequential ID with prefix
export function generateSequentialId(prefix, counter) {
  return `${prefix}-${counter.toString().padStart(6, "0")}`
}

// Generate a timestamp-based ID
export function generateTimestampId() {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  return `${timestamp}-${random}`
}

