/**
 * Theme Manager for Universal Request Analyzer
 *
 * This module provides theme management and customization.
 */

// Default themes
const DEFAULT_THEMES = {
  light: {
    id: "light",
    name: "Light",
    description: "Default light theme",
    colors: {
      background: "#ffffff",
      surface: "#f5f5f5",
      primary: "#0066cc",
      secondary: "#6c757d",
      accent: "#ff9800",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#17a2b8",
      success: "#28a745",
      text: {
        primary: "#212529",
        secondary: "#6c757d",
        disabled: "#adb5bd",
      },
      border: "#dee2e6",
      divider: "#e9ecef",
      shadow: "rgba(0, 0, 0, 0.1)",
    },
  },
  dark: {
    id: "dark",
    name: "Dark",
    description: "Default dark theme",
    colors: {
      background: "#212529",
      surface: "#343a40",
      primary: "#0d6efd",
      secondary: "#6c757d",
      accent: "#fd7e14",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#0dcaf0",
      success: "#198754",
      text: {
        primary: "#f8f9fa",
        secondary: "#e9ecef",
        disabled: "#adb5bd",
      },
      border: "#495057",
      divider: "#6c757d",
      shadow: "rgba(0, 0, 0, 0.5)",
    },
  },
  highContrast: {
    id: "highContrast",
    name: "High Contrast",
    description: "High contrast theme for accessibility",
    colors: {
      background: "#000000",
      surface: "#121212",
      primary: "#ffffff",
      secondary: "#cccccc",
      accent: "#ffff00",
      error: "#ff0000",
      warning: "#ffff00",
      info: "#00ffff",
      success: "#00ff00",
      text: {
        primary: "#ffffff",
        secondary: "#eeeeee",
        disabled: "#aaaaaa",
      },
      border: "#ffffff",
      divider: "#ffffff",
      shadow: "rgba(255, 255, 255, 0.5)",
    },
  },
  blue: {
    id: "blue",
    name: "Blue",
    description: "Blue-focused theme",
    colors: {
      background: "#f0f8ff",
      surface: "#e6f2ff",
      primary: "#0066cc",
      secondary: "#4d94ff",
      accent: "#00ccff",
      error: "#cc0000",
      warning: "#ff9900",
      info: "#0099cc",
      success: "#009933",
      text: {
        primary: "#003366",
        secondary: "#0066cc",
        disabled: "#99ccff",
      },
      border: "#99ccff",
      divider: "#cce6ff",
      shadow: "rgba(0, 102, 204, 0.2)",
    },
  },
}

// CSS variables map
const CSS_VARIABLES = {
  background: "--background-color",
  surface: "--surface-color",
  primary: "--primary-color",
  secondary: "--secondary-color",
  accent: "--accent-color",
  error: "--error-color",
  warning: "--warning-color",
  info: "--info-color",
  success: "--success-color",
  "text.primary": "--text-primary-color",
  "text.secondary": "--text-secondary-color",
  "text.disabled": "--text-disabled-color",
  border: "--border-color",
  divider: "--divider-color",
  shadow: "--shadow-color",
}

// Utility: send message to background and return promise via event-based response
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      // Generate a unique requestId for this message
      const requestId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      message.requestId = requestId;
      // Listen for the event-based response
      function handler(response) {
        if (response && response.requestId === requestId) {
          chrome.runtime.onMessage.removeListener(handler);
          if (response.success === false || response.error) {
            reject(response.error || new Error("Unknown error"));
          } else {
            resolve(response);
          }
        }
      }
      chrome.runtime.onMessage.addListener(handler);
      chrome.runtime.sendMessage(message);
    } else {
      reject(new Error("chrome.runtime not available"));
    }
  });
}

/**
 * Theme manager class
 */
class ThemeManager {
  constructor() {
    this.themes = {} // Will be loaded from DB/config
    this.currentTheme = "light" // Default, will be overwritten by DB/config
    this.customThemes = {}
    this.initialized = false
  }

  /**
   * Initialize the theme manager
   * @param {Object} options - Initialization options
   * @param {string} options.initialTheme - Initial theme to use
   * @param {Object} options.customThemes - Custom themes to add
   * @param {Function} options.onUpdate - Callback when theme changes
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    try {
      // Load saved theme data from database
      const data = await this.loadFromStorage();

      if (data) {
        // Use themes from DB/config if present, else fallback to defaults
        if (data.themes && typeof data.themes === 'object' && Object.keys(data.themes).length > 0) {
          this.themes = { ...data.themes };
        } else {
          this.themes = { ...DEFAULT_THEMES };
        }
        if (data.currentTheme) {
          this.currentTheme = data.currentTheme;
        }
        if (data.customThemes) {
          this.customThemes = data.customThemes;
          // Merge custom themes with loaded themes
          this.themes = { ...this.themes, ...this.customThemes };
        }
      } else {
        // Fallback: use defaults if nothing in DB
        this.themes = { ...DEFAULT_THEMES };
        this.currentTheme = "light";
        this.customThemes = {};
      }

      // Override with initial theme if provided
      if (options.initialTheme && (this.themes[options.initialTheme] || options.initialTheme === "system")) {
        this.currentTheme = options.initialTheme;
      }

      // Add custom themes if provided
      if (options.customThemes) {
        for (const [id, theme] of Object.entries(options.customThemes)) {
          this.addTheme(id, theme, false); // Don't save to storage yet
        }
      }

      // Store callback
      this.onUpdateCallback = options.onUpdate;
      this.initialized = true;
      this.applyTheme();
      await this.saveToStorage();
      console.log("Theme manager initialized:", {
        currentTheme: this.currentTheme,
        availableThemes: Object.keys(this.themes),
      });
    } catch (error) {
      console.error("Error initializing theme manager:", error);
      // Fall back to defaults
      this.themes = { ...DEFAULT_THEMES };
      this.currentTheme = "light";
      this.customThemes = {};
      this.initialized = true;
      this.applyTheme();
    }
  }

  /**
   * Load theme data from database via event-based messaging
   * @returns {Promise<Object>}
   */
  async loadFromStorage() {
    try {
      const response = await sendMessage({ action: "getConfig" });
      if (response && response.config && response.config.themeData) {
        return response.config.themeData;
      }
      // Fallback: try to extract from config.ui if present
      if (response && response.config && response.config.ui) {
        return {
          currentTheme: response.config.ui.theme,
        };
      }
      return null;
    } catch (error) {
      console.error("Failed to load theme from database:", error);
      return null;
    }
  }

  /**
   * Save theme data to database via event-based messaging
   * @returns {Promise<void>}
   */
  async saveToStorage() {
    try {
      await sendMessage({
        action: "updateConfig",
        config: {
          themeData: {
            currentTheme: this.currentTheme,
            customThemes: this.customThemes,
            timestamp: Date.now(),
          },
        },
      });
    } catch (error) {
      console.error("Failed to save theme to database:", error);
    }
  }

  /**
   * Apply the current theme to the document
   */
  applyTheme() {
    if (!this.initialized) {
      console.warn("Theme manager not initialized, using default theme");
      this.applyThemeToDocument(DEFAULT_THEMES.light);
      return;
    }

    // Handle system theme preference
    if (this.currentTheme === "system") {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = prefersDark ? this.themes.dark : this.themes.light;
      this.applyThemeToDocument(theme);
      return;
    }

    // Apply the selected theme
    const theme = this.themes[this.currentTheme];
    if (theme) {
      this.applyThemeToDocument(theme);
    } else {
      console.warn(`Theme "${this.currentTheme}" not found, using default`);
      this.applyThemeToDocument(DEFAULT_THEMES.light);
    }
  }

  /**
   * Apply a theme to the document
   * @param {Object} theme - Theme to apply
   */
  applyThemeToDocument(theme) {
    const root = document.documentElement;

    // Apply theme colors as CSS variables
    this.applyColorsToCss(root, theme.colors);

    // Add theme class to body
    document.body.classList.remove("theme-light", "theme-dark", "theme-high-contrast", "theme-blue");
    document.body.classList.add(`theme-${theme.id}`);

    // Set data attribute for theme
    document.body.setAttribute("data-theme", theme.id);

    // Handle dark mode class
    if (theme.id === "dark" || theme.id === "highContrast") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }

  /**
   * Apply theme colors to CSS variables
   * @param {Element} root - Root element to apply variables to
   * @param {Object} colors - Theme colors
   * @param {string} prefix - CSS variable prefix
   */
  applyColorsToCss(root, colors, prefix = "") {
    for (const [key, value] of Object.entries(colors)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "object") {
        // Recursively handle nested color objects
        this.applyColorsToCss(root, value, fullKey);
      } else {
        // Set CSS variable
        const cssVar = CSS_VARIABLES[fullKey];
        if (cssVar) {
          root.style.setProperty(cssVar, value);
        }
      }
    }
  }

  /**
   * Set the current theme
   * @param {string} themeId - ID of the theme to set
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async setTheme(themeId) {
    if (themeId !== "system" && !this.themes[themeId]) {
      console.error(`Theme "${themeId}" not found`);
      return false;
    }

    this.currentTheme = themeId;
    this.applyTheme();

    await this.saveToStorage();

    if (this.onUpdateCallback) {
      this.onUpdateCallback({
        theme: this.currentTheme,
        themeData: this.themes[this.currentTheme],
      });
    }

    return true;
  }

  /**
   * Add a new theme or update an existing one
   * @param {string} themeId - ID of the theme
   * @param {Object} themeData - Theme data
   * @param {boolean} save - Whether to save to storage
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async addTheme(themeId, themeData, save = true) {
    if (!themeId || typeof themeData !== "object") {
      console.error("Invalid theme data");
      return false;
    }

    // Create a properly structured theme object
    const theme = {
      id: themeId,
      name: themeData.name || themeId,
      description: themeData.description || "",
      colors: themeData.colors || DEFAULT_THEMES.light.colors,
    };

    // Add to themes
    this.themes[themeId] = theme;

    // If it's a custom theme, add to customThemes
    if (!DEFAULT_THEMES[themeId]) {
      this.customThemes[themeId] = theme;
    }

    // If current theme is the one being updated, apply it
    if (this.currentTheme === themeId) {
      this.applyTheme();
    }

    if (save) {
      await this.saveToStorage();

      if (this.onUpdateCallback) {
        this.onUpdateCallback({
          theme: this.currentTheme,
          themeData: this.themes[this.currentTheme],
        });
      }
    }

    return true;
  }

  /**
   * Remove a theme
   * @param {string} themeId - ID of the theme to remove
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async removeTheme(themeId) {
    if (themeId in DEFAULT_THEMES) {
      console.error("Cannot remove default theme");
      return false;
    }

    if (this.customThemes[themeId]) {
      delete this.customThemes[themeId];
      delete this.themes[themeId];

      // If current theme was removed, fall back to light
      if (this.currentTheme === themeId) {
        this.currentTheme = "light";
        this.applyTheme();
      }

      await this.saveToStorage();

      if (this.onUpdateCallback) {
        this.onUpdateCallback({
          theme: this.currentTheme,
          themeData: this.themes[this.currentTheme],
        });
      }

      return true;
    }

    return false;
  }

  /**
   * Reset to default themes
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async resetToDefaults() {
    this.themes = { ...DEFAULT_THEMES };
    this.currentTheme = "light";
    this.customThemes = {};

    this.applyTheme();
    await this.saveToStorage();

    if (this.onUpdateCallback) {
      this.onUpdateCallback({
        theme: this.currentTheme,
        themeData: this.themes[this.currentTheme],
      });
    }

    return true;
  }

  /**
   * Get all themes information for UI display
   * @returns {Object[]} - Array of theme information objects
   */
  getThemesInfo() {
    return Object.entries(this.themes).map(([id, theme]) => ({
      id,
      name: theme.name,
      description: theme.description,
      isCurrentTheme: id === this.currentTheme,
      isDefaultTheme: id in DEFAULT_THEMES,
      previewColors: {
        background: theme.colors.background,
        surface: theme.colors.surface,
        primary: theme.colors.primary,
        text: theme.colors.text.primary,
      },
    }));
  }

  /**
   * Get the current theme data
   * @returns {Object} - Current theme data
   */
  getCurrentTheme() {
    if (this.currentTheme === "system") {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? this.themes.dark : this.themes.light;
    }

    return this.themes[this.currentTheme] || DEFAULT_THEMES.light;
  }
}

// Create and export singleton instance
const themeManager = new ThemeManager();

export default themeManager;

