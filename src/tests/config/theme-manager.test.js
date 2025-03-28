import themeManager from "../../config/theme-manager"
import { describe, beforeEach, test, expect, jest } from "@jest/globals"

// Mock document and window objects
document.documentElement = {
  style: {
    setProperty: jest.fn(),
  },
}

document.body = {
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
  },
  setAttribute: jest.fn(),
}

describe("Theme Manager", () => {
  beforeEach(async () => {
    // Reset theme manager to default state
    await themeManager.resetToDefaults()
    // Re-initialize with test settings
    await themeManager.initialize({
      initialTheme: "light",
    })

    // Clear mocks
    document.documentElement.style.setProperty.mockClear()
    document.body.classList.add.mockClear()
    document.body.classList.remove.mockClear()
    document.body.setAttribute.mockClear()
  })

  test("should initialize with default values", () => {
    expect(themeManager.currentTheme).toBe("light")
    expect(themeManager.themes).toHaveProperty("light")
    expect(themeManager.themes).toHaveProperty("dark")
  })

  test("should set theme", async () => {
    const result = await themeManager.setTheme("dark")

    expect(result).toBe(true)
    expect(themeManager.currentTheme).toBe("dark")

    // Check that CSS variables were set
    expect(document.documentElement.style.setProperty).toHaveBeenCalled()

    // Check that body classes were updated
    expect(document.body.classList.add).toHaveBeenCalledWith("dark")
    expect(document.body.setAttribute).toHaveBeenCalledWith("data-theme", "dark")
  })

  test("should add a new theme", async () => {
    const themeData = {
      name: "Custom Theme",
      description: "A custom theme for testing",
      colors: {
        background: "#f0f0f0",
        surface: "#e0e0e0",
        primary: "#ff0000",
        text: {
          primary: "#000000",
        },
      },
    }

    const result = await themeManager.addTheme("custom", themeData)

    expect(result).toBe(true)
    expect(themeManager.themes).toHaveProperty("custom")
    expect(themeManager.themes.custom.name).toBe("Custom Theme")
  })

  test("should remove a custom theme", async () => {
    // First add a custom theme
    await themeManager.addTheme("custom", {
      name: "Custom Theme",
      description: "A custom theme for testing",
      colors: {
        background: "#f0f0f0",
        surface: "#e0e0e0",
        primary: "#ff0000",
        text: {
          primary: "#000000",
        },
      },
    })

    // Set it as current theme
    await themeManager.setTheme("custom")

    // Remove the theme
    const result = await themeManager.removeTheme("custom")

    expect(result).toBe(true)
    expect(themeManager.themes).not.toHaveProperty("custom")

    // Should fall back to light theme
    expect(themeManager.currentTheme).toBe("light")
  })

  test("should not remove default theme", async () => {
    const result = await themeManager.removeTheme("light")

    expect(result).toBe(false)
    expect(themeManager.themes).toHaveProperty("light")
  })

  test("should get themes info for UI display", () => {
    const info = themeManager.getThemesInfo()

    // Check that it's an array
    expect(Array.isArray(info)).toBe(true)
    expect(info.length).toBeGreaterThan(0)

    // Check theme structure
    const theme = info[0]
    expect(theme).toHaveProperty("id")
    expect(theme).toHaveProperty("name")
    expect(theme).toHaveProperty("description")
    expect(theme).toHaveProperty("isCurrentTheme")
    expect(theme).toHaveProperty("isDefaultTheme")
    expect(theme).toHaveProperty("previewColors")
  })

  test("should get current theme data", () => {
    const theme = themeManager.getCurrentTheme()

    expect(theme).toBeDefined()
    expect(theme).toHaveProperty("id")
    expect(theme).toHaveProperty("name")
    expect(theme).toHaveProperty("colors")
    expect(theme.colors).toHaveProperty("background")
    expect(theme.colors).toHaveProperty("primary")
    expect(theme.colors.text).toHaveProperty("primary")
  })

  test("should reset to defaults", async () => {
    // Change theme
    await themeManager.setTheme("dark")

    // Add custom theme
    await themeManager.addTheme("custom", {
      name: "Custom Theme",
      description: "A custom theme for testing",
      colors: {
        background: "#f0f0f0",
        surface: "#e0e0e0",
        primary: "#ff0000",
        text: {
          primary: "#000000",
        },
      },
    })

    // Reset to defaults
    await themeManager.resetToDefaults()

    // Check that defaults were restored
    expect(themeManager.currentTheme).toBe("light")
    expect(themeManager.themes).not.toHaveProperty("custom")
  })
})

