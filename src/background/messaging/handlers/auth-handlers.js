/**
 * Authentication Handlers
 * Handles register, login, logout operations
 * Extracted from popup-message-handler.js
 */

/**
 * Handle user registration
 */
async function handleRegister(data, context) {
  try {
    const { auth } = context;

    if (!auth) {
      return { success: false, error: "Auth manager not initialized" };
    }

    const { email, password, name } = data;
    const result = await auth.register(email, password, name);

    return result;
  } catch (error) {
    console.error("Registration handler error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle user login
 */
async function handleLogin(data, context) {
  try {
    const { auth } = context;

    if (!auth) {
      return { success: false, error: "Auth manager not initialized" };
    }

    const { email, password } = data;
    const result = await auth.login(email, password);

    return result;
  } catch (error) {
    console.error("Login handler error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle user logout
 */
async function handleLogout(data, context) {
  try {
    const { auth } = context;

    if (!auth) {
      return { success: false, error: "Auth manager not initialized" };
    }

    const result = await auth.logout();
    return result;
  } catch (error) {
    console.error("Logout handler error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export handler map for auth operations
 */
export const authHandlers = new Map([
  [
    "register",
    async (message, sender, context) => {
      return await handleRegister(message.data, context);
    },
  ],

  [
    "login",
    async (message, sender, context) => {
      return await handleLogin(message.data, context);
    },
  ],

  [
    "logout",
    async (message, sender, context) => {
      return await handleLogout(message.data, context);
    },
  ],
]);
