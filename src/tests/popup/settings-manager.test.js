import settingsManager from "../../popup/js/settings-manager"
import featureFlags from "../../config/feature-flags"
import aclManager from "../../auth/acl-manager"
import themeManager from "../../config/theme-manager"

// Mock the dependencies
jest.mock("../../config/feature-flags", () => ({
  initialize: jest.fn().mockResolvedValue(true),
  updateFeatures: jest.fn().mockResolvedValue(true),
  resetToDefaults: jest.fn().mockResolvedValue(true),
  getFeatureInfo: jest.fn().mockReturnValue({
    core: [],
    online: [],
    advanced: [],
    experimental: [],
  }),
  default: {
    initialize: jest.fn().mockResolvedValue(true),
    updateFeatures: jest.fn().mockResolvedValue(true),
    resetToDefaults: jest.fn().mockResolvedValue(true),
    getFeatureInfo: jest.fn().mockReturnValue({
      core: [],
      online: [],
      advanced: [],
      experimental: [],
    }),
    flags: {},
  },
}))

jest.mock("../../auth/acl-manager", () => ({
  initialize: jest.fn().mockResolvedValue(true),
  setRole: jest.fn().mockResolvedValue(true),
  resetToDefaults: jest.fn().mockResolvedValue(true),
  getRolesInfo: jest.fn().mockReturnValue({}),
  getPermissionsInfo: jest.fn().mockReturnValue({}),
  currentRole: "user",
  default: {
    initialize: jest.fn().mockResolvedValue(true),
    setRole: jest.fn().mockResolvedValue(true),
    resetToDefaults: jest.fn().mockResolvedValue(true),
    getRolesInfo: jest.fn().mockReturnValue({}),
    getPermissionsInfo: jest.fn().mockReturnValue({}),
    currentRole: "user",
  },
}))

jest.mock("../../config/theme-manager", () => ({
  initialize: jest.fn().mockResolvedValue(true),
  setTheme: jest.fn().mockResolvedValue(true),
  resetToDefaults: jest.fn().mockResolvedValue(true),
  getThemesInfo: jest.fn().mockReturnValue([]),
  currentTheme: "light",
  default: {
    initialize: jest.fn().mockResolvedValue(true),
    setTheme: jest.fn().mockResolvedValue(true),
    resetToDefaults: jest.fn().mockResolvedValue(true),
    getThemesInfo: jest.fn().mockReturnValue([]),
    currentTheme: "light",
  },
}))

describe("Settings Manager", () => {
  beforeEach(async () => {
    // Reset mocks
    featureFlags.initialize.mockClear()
    aclManager.initialize.mockClear()
    themeManager.initialize.mockClear()

    // Initialize settings manager
    await settingsManager.initialize()
  })

  test("should initialize with default values", () => {
    expect(settingsManager.initialized).toBe(true)
    expect(settingsManager.settings).toHaveProperty("general")
    expect(settingsManager.settings).toHaveProperty("capture")
    expect(settingsManager.settings).toHaveProperty("display")
    expect(settingsManager.settings).toHaveProperty("advanced")

    // Check that dependencies were initialized
    expect(featureFlags.initialize).toHaveBeenCalled()
    expect(aclManager.initialize).toHaveBeenCalled()
    expect(themeManager.initialize).toHaveBeenCalled()
  })

  test("should update settings", async () => {
    const newSettings = {
      general: {
        maxStoredRequests: 5000,
        autoStartCapture: false,
      },
      display: {
        requestsPerPage: 25,
      },
    }

    const result = await settingsManager.updateSettings(newSettings)

    expect(result).toBe(true)
    expect(settingsManager.settings.general.maxStoredRequests).toBe(5000)
    expect(settingsManager.settings.general.autoStartCapture).toBe(false)
    expect(settingsManager.settings.display.requestsPerPage).toBe(25)
  })

  test("should update feature flags", async () => {
    const flags = {
      captureRequests: false,
      filterRequests: false,
    }

    await settingsManager.updateFeatureFlags(flags)

    expect(featureFlags.updateFeatures).toHaveBeenCalledWith(flags)
  })

  test("should set role", async () => {
    await settingsManager.setRole("admin")

    expect(aclManager.setRole).toHaveBeenCalledWith("admin")
  })

  test("should set theme", async () => {
    await settingsManager.setTheme("dark")

    expect(themeManager.setTheme).toHaveBeenCalledWith("dark")
  })

  test("should get all settings", () => {
    const allSettings = settingsManager.getAllSettings()

    expect(allSettings).toHaveProperty("settings")
    expect(allSettings).toHaveProperty("featureFlags")
    expect(allSettings).toHaveProperty("acl")
    expect(allSettings).toHaveProperty("theme")
  })

  test("should reset all to defaults", async () => {
    const result = await settingsManager.resetAllToDefaults()

    expect(result).toBe(true)
    expect(featureFlags.resetToDefaults).toHaveBeenCalled()
    expect(aclManager.resetToDefaults).toHaveBeenCalled()
    expect(themeManager.resetToDefaults).toHaveBeenCalled()
  })
})

