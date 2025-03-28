import aclManager from "../../auth/acl-manager"
import featureFlags from "../../config/feature-flags"

// Mock the feature flags module
jest.mock("../../config/feature-flags", () => ({
  setPermissionLevel: jest.fn().mockResolvedValue(true),
  default: {
    setPermissionLevel: jest.fn().mockResolvedValue(true),
  },
}))

describe("ACL Manager", () => {
  beforeEach(async () => {
    // Reset ACL manager to default state
    await aclManager.resetToDefaults()
    // Re-initialize with test settings
    await aclManager.initialize({
      initialRole: "user",
    })
  })

  test("should initialize with default values", () => {
    expect(aclManager.currentRole).toBe("user")
    expect(aclManager.hasPermission("view:requests")).toBe(true)
    expect(aclManager.hasPermission("manage:users")).toBe(false)
  })

  test("should set role", async () => {
    const result = await aclManager.setRole("admin")

    expect(result).toBe(true)
    expect(aclManager.currentRole).toBe("admin")
    expect(aclManager.hasPermission("manage:users")).toBe(true)
    expect(featureFlags.setPermissionLevel).toHaveBeenCalledWith("admin")
  })

  test("should check if user has all permissions", () => {
    // Set admin role to have all permissions
    aclManager.setRole("admin")

    const hasAll = aclManager.hasAllPermissions(["view:requests", "manage:users", "config:system"])
    expect(hasAll).toBe(true)

    // Set user role with limited permissions
    aclManager.setRole("user")

    const hasAllLimited = aclManager.hasAllPermissions(["view:requests", "manage:users"])
    expect(hasAllLimited).toBe(false)
  })

  test("should check if user has any permissions", () => {
    // Set user role with limited permissions
    aclManager.setRole("user")

    const hasAny = aclManager.hasAnyPermission(["view:requests", "manage:users"])
    expect(hasAny).toBe(true)

    const hasAnyNone = aclManager.hasAnyPermission(["manage:users", "manage:roles"])
    expect(hasAnyNone).toBe(false)
  })

  test("should add custom permission", async () => {
    const result = await aclManager.addCustomPermission("custom:permission")

    expect(result).toBe(true)
    expect(aclManager.hasPermission("custom:permission")).toBe(true)
  })

  test("should remove custom permission", async () => {
    // First add the permission
    await aclManager.addCustomPermission("custom:permission")

    // Then remove it
    const result = await aclManager.removeCustomPermission("custom:permission")

    expect(result).toBe(true)
    expect(aclManager.hasPermission("custom:permission")).toBe(false)
  })

  test("should set custom permissions", async () => {
    const permissions = ["custom:permission1", "custom:permission2"]

    const result = await aclManager.setCustomPermissions(permissions)

    expect(result).toBe(true)
    expect(aclManager.hasPermission("custom:permission1")).toBe(true)
    expect(aclManager.hasPermission("custom:permission2")).toBe(true)
  })

  test("should add or update role", async () => {
    const roleData = {
      description: "Test role",
      permissionLevel: "standard",
      permissions: ["view:requests", "custom:permission"],
    }

    const result = await aclManager.addOrUpdateRole("testRole", roleData)

    expect(result).toBe(true)

    // Set the role and check permissions
    await aclManager.setRole("testRole")
    expect(aclManager.hasPermission("view:requests")).toBe(true)
    expect(aclManager.hasPermission("custom:permission")).toBe(true)
    expect(aclManager.hasPermission("manage:users")).toBe(false)
  })

  test("should remove role", async () => {
    // First add a custom role
    await aclManager.addOrUpdateRole("testRole", {
      description: "Test role",
      permissionLevel: "standard",
      permissions: ["view:requests"],
    })

    // Set the role
    await aclManager.setRole("testRole")

    // Remove the role
    const result = await aclManager.removeRole("testRole")

    expect(result).toBe(true)

    // Should fall back to user role
    expect(aclManager.currentRole).toBe("user")
  })

  test("should not remove default role", async () => {
    const result = await aclManager.removeRole("user")

    expect(result).toBe(false)
  })

  test("should get roles info for UI display", () => {
    const info = aclManager.getRolesInfo()

    // Check structure
    expect(info).toHaveProperty("user")
    expect(info).toHaveProperty("admin")

    // Check content
    expect(info.user).toHaveProperty("name")
    expect(info.user).toHaveProperty("description")
    expect(info.user).toHaveProperty("permissionLevel")
    expect(info.user).toHaveProperty("permissions")
    expect(info.user).toHaveProperty("isCurrentRole")
    expect(info.user).toHaveProperty("isDefaultRole")
  })

  test("should get permissions info for UI display", () => {
    const info = aclManager.getPermissionsInfo()

    // Check that we have categories
    expect(Object.keys(info).length).toBeGreaterThan(0)

    // Check first category
    const firstCategory = Object.keys(info)[0]
    expect(Array.isArray(info[firstCategory])).toBe(true)

    // Check permission structure
    if (info[firstCategory].length > 0) {
      const permission = info[firstCategory][0]
      expect(permission).toHaveProperty("id")
      expect(permission).toHaveProperty("action")
      expect(permission).toHaveProperty("description")
      expect(permission).toHaveProperty("hasPermission")
    }
  })

  test("should reset to defaults", async () => {
    // Change some settings
    await aclManager.setRole("admin")
    await aclManager.addCustomPermission("custom:permission")

    // Reset to defaults
    await aclManager.resetToDefaults()

    // Check that defaults were restored
    expect(aclManager.currentRole).toBe("user")
    expect(aclManager.hasPermission("custom:permission")).toBe(false)
    expect(aclManager.hasPermission("manage:users")).toBe(false)
  })
})

