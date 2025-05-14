// Remote authentication service - handles authentication with remote server

import { AuthError } from "../errors/error-types.js"
import { generateId } from "../utils/id-generator.js"

let eventBus = null
let authConfig = null
let currentUser = null
let currentSession = null
let jwtToken = null
let refreshTokenTimeout = null
let dbManager = null

// Set up remote authentication service
export async function setupRemoteAuthService(config, events, databaseManager) {
  authConfig = config
  eventBus = events
  dbManager = databaseManager

  // Try to restore session
  await restoreSession()

  // Set up token refresh if we have a valid session
  if (isAuthenticated()) {
    scheduleTokenRefresh()
  }

  console.log(`Remote authentication service initialized (user: ${currentUser ? currentUser.email : "none"})`)

  return {
    login,
    logout,
    register,
    getCurrentUser,
    isAuthenticated,
    hasPermission,
    getJwtToken,
    refreshToken,
    generateCsrfToken,
    validateCsrfToken,
    verifyServerConnection,
  }
}

// Restore session from database
async function restoreSession() {
  if (!dbManager) return;
  try {
    const sessionResult = dbManager.getCurrentRemoteSession ? dbManager.getCurrentRemoteSession() : null;
    if (sessionResult && sessionResult.user && sessionResult.session && sessionResult.jwtToken) {
      const session = sessionResult.session;
      try {
        const tokenData = parseJwt(sessionResult.jwtToken);
        const now = Date.now() / 1000;
        if (tokenData.exp && tokenData.exp > now) {
          currentUser = sessionResult.user;
          currentSession = session;
          jwtToken = sessionResult.jwtToken;
          eventBus.publish("auth:session_restored", {
            userId: currentUser.id,
            email: currentUser.email,
          });
        } else {
          refreshToken()
            .then(() => {})
            .catch(() => {
              if (dbManager.clearCurrentRemoteSession) dbManager.clearCurrentRemoteSession();
            });
        }
      } catch (error) {
        if (dbManager.clearCurrentRemoteSession) dbManager.clearCurrentRemoteSession();
      }
    }
  } catch (e) {}
}

// Login user with remote server
async function login(email, password) {
  try {
    // Validate server connection
    await verifyServerConnection()

    // Prepare login data
    const loginData = {
      email,
      password,
      deviceInfo: {
        type: "extension",
        browser: navigator.userAgent,
        version: chrome.runtime.getManifest().version,
      },
    }

    // Send login request to server
    const response = await fetch(`${authConfig.serverUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new AuthError(errorData.message || "Login failed")
    }

    const data = await response.json()

    // Extract user and token data
    const user = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role,
      permissions: data.user.permissions || [],
    }

    // Create a session
    const session = {
      id: generateId(),
      userId: user.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + (authConfig.sessionDuration || 86400000), // Default 24 hours
      ipAddress: "unknown",
      userAgent: navigator.userAgent,
    }

    // Store JWT token
    jwtToken = data.token

    // Save to database
    if (dbManager.saveRemoteSession) {
      dbManager.saveRemoteSession(user, session, jwtToken);
    }

    // Update current user and session
    currentUser = user
    currentSession = session

    // Schedule token refresh
    scheduleTokenRefresh()

    // Publish login event
    eventBus.publish("auth:login", {
      userId: user.id,
      email: user.email,
    })

    return { user, token: jwtToken }
  } catch (error) {
    console.error("Login failed:", error)
    throw new AuthError("Login failed: " + error.message, error)
  }
}

// Logout user
async function logout() {
  try {
    // Only attempt server logout if we have a token
    if (jwtToken) {
      try {
        // Send logout request to server
        await fetch(`${authConfig.serverUrl}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwtToken}`,
          },
        })
      } catch (error) {
        console.warn("Error during server logout:", error)
        // Continue with local logout even if server logout fails
      }
    }

    // Clear token refresh timeout
    if (refreshTokenTimeout) {
      clearTimeout(refreshTokenTimeout)
      refreshTokenTimeout = null
    }

    // Clear from database
    if (dbManager && dbManager.clearCurrentRemoteSession) {
      dbManager.clearCurrentRemoteSession();
    }

    // Clear current user and session
    const userId = currentUser?.id
    currentUser = null
    currentSession = null
    jwtToken = null

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
    // Validate server connection
    await verifyServerConnection()

    // Prepare registration data
    const registrationData = {
      email,
      password,
      name,
      deviceInfo: {
        type: "extension",
        browser: navigator.userAgent,
        version: chrome.runtime.getManifest().version,
      },
    }

    // Send registration request to server
    const response = await fetch(`${authConfig.serverUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registrationData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new AuthError(errorData.message || "Registration failed")
    }

    // Automatically log in the new user
    return login(email, password)
  } catch (error) {
    console.error("Registration failed:", error)
    throw new AuthError("Registration failed: " + error.message, error)
  }
}

// Get current user
function getCurrentUser() {
  return currentUser
}

// Check if user is authenticated
function isAuthenticated() {
  if (!currentUser || !jwtToken) {
    return false
  }

  try {
    // Parse JWT to check expiration
    const tokenData = parseJwt(jwtToken)
    const now = Date.now() / 1000 // Convert to seconds

    return tokenData.exp > now
  } catch (error) {
    console.error("Error checking authentication status:", error)
    return false
  }
}

// Check if user has a specific permission
function hasPermission(permission) {
  if (!isAuthenticated() || !currentUser) {
    return false
  }

  // Check if user has the specific permission
  if (currentUser.permissions && Array.isArray(currentUser.permissions)) {
    return currentUser.permissions.includes(permission)
  }

  // Fall back to role-based permissions if specific permissions aren't available
  const rolePermissions = {
    admin: ["read", "write", "delete", "admin"],
    editor: ["read", "write"],
    user: ["read"],
  }

  const userRole = currentUser.role || "user"
  const permissions = rolePermissions[userRole] || []

  return permissions.includes(permission)
}

// Get JWT token
function getJwtToken() {
  return jwtToken
}

// Refresh authentication token
async function refreshToken() {
  if (!jwtToken) {
    throw new AuthError("No token to refresh")
  }

  try {
    // Send refresh token request to server
    const response = await fetch(`${authConfig.serverUrl}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
    })

    if (!response.ok) {
      // If refresh fails, force logout
      await logout()
      throw new AuthError("Token refresh failed")
    }

    const data = await response.json()

    // Update token
    jwtToken = data.token

    // Update user data if provided
    if (data.user) {
      currentUser = {
        ...currentUser,
        ...data.user,
      }
    }

    // Update session expiration
    if (currentSession) {
      currentSession.expiresAt = Date.now() + (authConfig.sessionDuration || 86400000)
    }

    // Save updated data to database
    if (dbManager.saveRemoteSession) {
      dbManager.saveRemoteSession(currentUser, currentSession, jwtToken);
    }

    // Schedule next token refresh
    scheduleTokenRefresh()

    // Publish token refresh event
    eventBus.publish("auth:token_refreshed", {
      userId: currentUser.id,
    })

    return { token: jwtToken }
  } catch (error) {
    console.error("Token refresh failed:", error)
    throw new AuthError("Token refresh failed", error)
  }
}

// Schedule token refresh
function scheduleTokenRefresh() {
  // Clear any existing timeout
  if (refreshTokenTimeout) {
    clearTimeout(refreshTokenTimeout)
  }

  // Only schedule if we have a token
  if (!jwtToken) {
    return
  }

  try {
    // Parse JWT to get expiration
    const tokenData = parseJwt(jwtToken)
    const expiresAt = tokenData.exp * 1000 // Convert to milliseconds
    const now = Date.now()

    // Calculate time until expiration (minus a buffer of 5 minutes)
    const timeUntilExpiry = expiresAt - now - 5 * 60 * 1000

    // Schedule refresh if token will expire in the future
    if (timeUntilExpiry > 0) {
      refreshTokenTimeout = setTimeout(() => {
        refreshToken().catch((error) => {
          console.error("Scheduled token refresh failed:", error)
          // Force logout if refresh fails
          logout()
        })
      }, timeUntilExpiry)
    } else {
      // Token is already expired or about to expire, refresh now
      refreshToken().catch((error) => {
        console.error("Immediate token refresh failed:", error)
        // Force logout if refresh fails
        logout()
      })
    }
  } catch (error) {
    console.error("Error scheduling token refresh:", error)
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
    if (typeof window !== "undefined" && window.crypto) {
      window.crypto.getRandomValues(array)
    } else if (typeof crypto !== "undefined") {
      crypto.getRandomValues(array)
    } else {
      throw new Error("No crypto implementation found.")
    }
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

// Verify server connection
async function verifyServerConnection() {
  try {
    const response = await fetch(`${authConfig.serverUrl}/api/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`)
    }

    return true
  } catch (error) {
    console.error("Server connection failed:", error)
    throw new AuthError("Cannot connect to authentication server", error)
  }
}

// Parse JWT token
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
        })
        .join(""),
    )

    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error("Error parsing JWT:", error)
    throw new AuthError("Invalid JWT token", error)
  }
}

