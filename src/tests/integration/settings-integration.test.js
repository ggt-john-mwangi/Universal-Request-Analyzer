import featureFlags from "../../config/feature-flags"
import aclManager from "../../auth/acl-manager"
import themeManager from "../../config/theme-manager"
import settingsManager from "../../popup/js/settings-manager"
import { describe, beforeEach, test, expect, jest } from "@jest/globals"

// This is an integration test that tests the interaction between
// the different modules (feature flags, ACL, theme, settings)

describe("Settings Integration", () => {
  beforeEach(async () => {
    // Reset all modules to default state
    await featureFlags.resetToDefaults()
    await aclManager.resetToDefaults()
    await themeManager.resetToDefaults()

    // Initialize settings manager
    await settingsManager.initialize()
  })

  test("should update permission level when role changes", async () => {
    // Set role to admin
    await settingsManager.setRole("admin")

    // Check that permission level was updated in feature flags
    expect(featureFlags.getPermissionLevel()).toBe("admin")

    // Check that we can now enable advanced features
    await featureFlags.enableFeature("requestModification")
    expect(featureFlags.isEnabled("requestModification")).toBe(true)
  })

  test("should respect feature dependencies across modules", async () => {
    // Set role to team member to have appropriate permissions
    await settingsManager.setRole("teamMember")

    // Enable team sharing feature
    await featureFlags.enableFeature("teamSharing")

    // Check that dependencies were enabled
    expect(featureFlags.isEnabled("teamSharing")).toBe(true)
    expect(featureFlags.isEnabled("authentication")).toBe(true)
    expect(featureFlags.isEnabled("onlineSync")).toBe(true)

    // Now disable authentication through settings manager
    await settingsManager.updateFeatureFlags({
      authentication: false,
    })

    // Check that dependent features were disabled
    expect(featureFlags.isEnabled("authentication")).toBe(false)
    expect(featureFlags.isEnabled("teamSharing")).toBe(false)
  })

  test("should apply theme changes through settings manager", async () => {
    // Mock the applyTheme method
    const originalApplyTheme = themeManager.applyTheme
    themeManager.applyTheme = jest.fn()

    // Change theme through settings manager
    await settingsManager.setTheme("dark")

    // Check that theme was updated
    expect(themeManager.currentTheme).toBe("dark")
    expect(themeManager.applyTheme).toHaveBeenCalled()

    // Restore original method
    themeManager.applyTheme = originalApplyTheme
  })

  test("should reset all modules when settings are reset", async () => {
    // Make changes to all modules
    await settingsManager.setRole("admin")
    await settingsManager.setTheme("dark")
    await settingsManager.updateFeatureFlags({
      onlineSync: true,
      authentication: true,
    })
    await settingsManager.updateSettings({
      general: {
        maxStoredRequests: 5000,
      },
    })

    // Reset all settings
    await settingsManager.resetAllToDefaults()

    // Check that all modules were reset
    expect(aclManager.currentRole).toBe("user")
    expect(themeManager.currentTheme).toBe("light")
    expect(featureFlags.isEnabled("onlineSync")).toBe(false)
    expect(settingsManager.settings.general.maxStoredRequests).toBe(10000)
  })
})

