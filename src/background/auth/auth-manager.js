// Authentication manager - handles user authentication and authorization

import { AuthError } from "../errors/error-types.js"
import { generateId } from "../utils/id-generator.js"

let dbManager = null
let eventBus = null
let authConfig = null
let currentUser = null
let currentSession = null

// Set up authentication system
export async function setupAuthSystem(config, events) {
  authConfig = config
  eventBus = events

  // Try to restore session
  await restoreSession()

  console.log(`Authentication system initialized (user: ${currentUser ? currentUser.email : "none"})`)

  return {
    login,
    logout,
    register,
    getCurrentUser,
    isAuthenticated,
    hasPermission,
    validateToken,
    refreshToken,
    generateCsrfToken,
    validateCsrfToken,
  }
}

// Set database manager (called after database is initialized)
export function setDatabaseManager(database) {
  dbManager = database
}

// Restore session from storage
async function restoreSession() {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["authUser", "authSession"], (result) => {
        if (result.authUser && result.authSession) {
          // Check if session is still valid
          const session = result.authSession
          if (session.expiresAt > Date.now()) {
            currentUser = result.authUser
            currentSession = session

            eventBus.publish("auth:session_restored", {
              userId: currentUser.id,
              email: currentUser.email,
            })
          } else {
            // Session expired, clear it
            chrome.storage.local.remove(["authUser", "authSession"])
          }
        }

        resolve()
      })
    } else {
      resolve()
    }
  })
}

// Login user
async function login(email, password) {
  try {
    // In a real extension, you would validate against a server
    // For this example, we'll check against the database

    if (!dbManager) {
      throw new AuthError("Database not initialized")
    }

    // Find user by email
    const query = `
      SELECT * FROM users 
      WHERE email = ?
      LIMIT 1
    `

    const result = dbManager.executeQuery(query, [email])

    if (!result[0] || result[0].values.length === 0) {
      throw new AuthError("Invalid email or password")
    }

    const user = {
      id: result[0].values[0][0],
      email: result[0].values[0][1],
      name: result[0].values[0][2],
      role: result[0].values[0][3],
    }

    // In a real system, you would verify the password hash
    // For this example, we'll just assume it's correct

    // Create a new session
    const session = {
      id: generateId(),
      userId: user.id,
      token: generateToken(),
      createdAt: Date.now(),
      expiresAt: Date.now() + (authConfig.sessionDuration || 86400000), // Default 24 hours
      ipAddress: "unknown", // In a real system, you would get this from the server
      userAgent: navigator.userAgent,
    }

    // Save session to database
    const sessionQuery = `
      INSERT INTO sessions (id, userId, token, createdAt, expiresAt, ipAddress, userAgent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `

    dbManager.executeQuery(sessionQuery, [
      session.id,
      session.userId,
      session.token,
      session.createdAt,
      session.expiresAt,
      session.ipAddress,
      session.userAgent,
    ])

    // Update user's last login time
    dbManager.executeQuery("UPDATE users SET lastLogin = ? WHERE id = ?", [Date.now(), user.id])

    // Save to storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({
        authUser: user,
        authSession: session,
      })
    }

    // Update current user and session
    currentUser = user
    currentSession = session

    // Log the login event
    logAuthEvent("login", user.id)

    // Publish login event
    eventBus.publish("auth:login", {
      userId: user.id,
      email: user.email,
    })

    return { user, token: session.token }
  } catch (error) {
    console.error("Login failed:", error)
    throw new AuthError("Login failed", error)
  }
}

// Logout user
async function logout() {
  try {
    if (currentSession && dbManager) {
      // Remove session from database
      dbManager.executeQuery("DELETE FROM sessions WHERE id = ?", [currentSession.id])
    }

    // Clear from storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.remove(["authUser", "authSession"])
    }

    // Log the logout event
    if (currentUser) {
      logAuthEvent("logout", currentUser.id)
    }

    // Clear current user and session
    const userId = currentUser?.id
    currentUser = null
    currentSession = null

    // Publish logout event
    eventBus.publish("auth:logout", { userId })

    return true
  } catch (error) {
    console.error("Logout failed:", error)
    throw new AuthError("Logout failed", error)
  }
}

// Register a new user
async function register(email, password, name) {
  try {
    if (!dbManager) {
      throw new AuthError("Database not initialized")
    }

    // Check if user already exists
    const checkQuery = `
      SELECT COUNT(*) FROM users 
      WHERE email = ?
    `

    const checkResult = dbManager.executeQuery(checkQuery, [email])

    if (checkResult[0] && checkResult[0].values[0][0] > 0) {
      throw new AuthError("User already exists")
    }

    // Create a new user
    const userId = generateId()
    const user = {
      id: userId,
      email,
      name,
      role: "user", // Default role
      lastLogin: Date.now(),
    }

    // In a real system, you would hash the password
    // For this example, we'll just store it directly (not recommended in practice)

    // Save user to database
    const insertQuery = `
      INSERT INTO users (id, email, name, role, lastLogin)
      VALUES (?, ?, ?, ?, ?)
    `

    dbManager.executeQuery(insertQuery, [user.id, user.email, user.name, user.role, user.lastLogin])

    // Log the registration event
    logAuthEvent("register", user.id)

    // Publish register event
    eventBus.publish("auth:register", {
      userId: user.id,
      email: user.email,
    })

    // Automatically log in the new user
    return login(email, password)
  } catch (error) {
    console.error("Registration failed:", error)
    throw new AuthError("Registration failed", error)
  }
}

// Get current user
function getCurrentUser() {
  return currentUser
}

// Check if user is authenticated
function isAuthenticated() {
  return !!currentUser && !!currentSession && currentSession.expiresAt > Date.now()
}

// Check if user has a specific permission
function hasPermission(permission) {
  if (!isAuthenticated()) {
    return false
  }

  // In a real system, you would have a more sophisticated permission system
  // For this example, we'll use a simple role-based approach

  const rolePermissions = {
    admin: ["read", "write", "delete", "admin"],
    editor: ["read", "write"],
    user: ["read"],
  }

  const userRole = currentUser.role || "user"
  const permissions = rolePermissions[userRole] || []

  return permissions.includes(permission)
}

// Validate authentication token
function validateToken(token) {
  if (!dbManager) {
    throw new AuthError("Database not initialized")
  }

  try {
    // Find session by token
    const query = `
      SELECT * FROM sessions 
      WHERE token = ? AND expiresAt > ?
      LIMIT 1
    `

    const result = dbManager.executeQuery(query, [token, Date.now()])

    if (!result[0] || result[0].values.length === 0) {
      return false
    }

    return true
  } catch (error) {
    console.error("Token validation failed:", error)
    return false
  }
}

// Refresh authentication token
async function refreshToken() {
  if (!isAuthenticated() || !dbManager) {
    throw new AuthError("Not authenticated")
  }

  try {
    // Create a new session
    const newSession = {
      id: generateId(),
      userId: currentUser.id,
      token: generateToken(),
      createdAt: Date.now(),
      expiresAt: Date.now() + (authConfig.sessionDuration || 86400000),
      ipAddress: currentSession.ipAddress,
      userAgent: navigator.userAgent,
    }

    // Save new session to database
    const sessionQuery = `
      INSERT INTO sessions (id, userId, token, createdAt, expiresAt, ipAddress, userAgent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `

    dbManager.executeQuery(sessionQuery, [
      newSession.id,
      newSession.userId,
      newSession.token,
      newSession.createdAt,
      newSession.expiresAt,
      newSession.ipAddress,
      newSession.userAgent,
    ])

    // Delete old session
    dbManager.executeQuery("DELETE FROM sessions WHERE id = ?", [currentSession.id])

    // Update storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({
        authSession: newSession,
      })
    }

    // Update current session
    currentSession = newSession

    // Log the token refresh event
    logAuthEvent("token_refresh", currentUser.id)

    // Publish token refresh event
    eventBus.publish("auth:token_refreshed", {
      userId: currentUser.id,
    })

    return { token: newSession.token }
  } catch (error) {
    console.error("Token refresh failed:", error)
    throw new AuthError("Token refresh failed", error)
  }
}

// Generate a CSRF token
function generateCsrfToken() {
  if (!isAuthenticated()) {
    throw new AuthError("Not authenticated")
  }

  try {
    // Generate a random token
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    const token = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")

    // Store the token in session storage (it will be cleared when the browser is closed)
    sessionStorage.setItem("csrfToken", token)

    return token
  } catch (error) {
    console.error("CSRF token generation failed:", error)
    throw new AuthError("CSRF token generation failed", error)
  }
}

// Validate a CSRF token
function validateCsrfToken(token) {
  try {
    const storedToken = sessionStorage.getItem("csrfToken")

    if (!storedToken) {
      return false
    }

    return token === storedToken
  } catch (error) {
    console.error("CSRF token validation failed:", error)
    return false
  }
}

// Generate a random token
function generateToken() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// Log authentication events
function logAuthEvent(action, userId) {
  if (!dbManager) return

  try {
    dbManager.executeQuery(
      `
      INSERT INTO audit_log (userId, action, resource, resourceId, timestamp, ipAddress)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        userId,
        action,
        "auth",
        userId,
        Date.now(),
        "unknown", // In a real system, you would get this from the server
      ],
    )
  } catch (error) {
    console.error("Failed to log auth event:", error)
  }
}

