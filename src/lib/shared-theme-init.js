/**
 * Shared Theme Initializer
 * This script ensures theme is applied uniformly across all extension pages
 */

(function () {
  "use strict";

  // Apply theme as early as possible to prevent flash
  async function initializeTheme() {
    try {
      // Get current theme from storage
      const result = await chrome.storage.local.get([
        "themeData",
        "currentTheme",
      ]);
      const themeId =
        result.currentTheme || result.themeData?.currentTheme || "light";

      // Apply theme class immediately
      applyThemeClass(themeId);

      // Listen for theme changes from other pages
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local" && changes.currentTheme) {
          applyThemeClass(changes.currentTheme.newValue);
        }
      });
    } catch (error) {
      console.error("Failed to initialize theme:", error);
      // Fallback to light theme
      applyThemeClass("light");
    }
  }

  function applyThemeClass(themeId) {
    // Ensure document.body exists before trying to access classList
    if (!document.body) {
      console.warn("document.body not ready, deferring theme application");
      // Retry when DOM is ready
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () =>
          applyThemeClass(themeId)
        );
      }
      return;
    }

    // Remove all theme classes
    document.body.classList.remove(
      "theme-light",
      "theme-dark",
      "theme-highContrast",
      "theme-blue",
      "dark"
    );

    // Add new theme class
    document.body.classList.add(`theme-${themeId}`);

    // Add 'dark' class for dark themes
    if (themeId === "dark" || themeId === "highContrast") {
      document.body.classList.add("dark");
    }

    // Set data attribute
    document.body.setAttribute("data-theme", themeId);
  }

  // Initialize immediately
  initializeTheme();
})();
