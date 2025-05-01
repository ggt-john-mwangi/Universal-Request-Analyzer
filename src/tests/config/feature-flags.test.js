import featureFlags from "../../config/feature-flags";
import { describe, beforeEach, test, expect } from "@jest/globals";

describe("Feature Flags", () => {
  beforeEach(async () => {
    // Reset feature flags to default state
    await featureFlags.resetToDefaults();
    // Re-initialize with test settings
    await featureFlags.initialize({
      permissionLevel: "basic",
      initialFlags: {
        onlineSync: false,
        authentication: false,
      },
    });
  });

  test("should initialize with default values", () => {
    expect(featureFlags.isEnabled("captureRequests")).toBe(true);
    expect(featureFlags.isEnabled("filterRequests")).toBe(true);
    expect(featureFlags.isEnabled("onlineSync")).toBe(false);
    expect(featureFlags.isEnabled("authentication")).toBe(false);
  });

  test("should enable a feature", async () => {
    // Set permission level to allow enabling this feature
    await featureFlags.setPermissionLevel("standard");

    const result = await featureFlags.enableFeature("onlineSync");
    expect(result).toBe(true);
    expect(featureFlags.isEnabled("onlineSync")).toBe(true);
  });

  test("should disable a feature", async () => {
    // First enable the feature
    await featureFlags.setPermissionLevel("standard");
    await featureFlags.enableFeature("onlineSync");

    // Then disable it
    const result = await featureFlags.disableFeature("onlineSync");
    expect(result).toBe(true);
    expect(featureFlags.isEnabled("onlineSync")).toBe(false);
  });

  test("should respect feature dependencies", async () => {
    // Set permission level to allow enabling these features
    await featureFlags.setPermissionLevel("team");

    // Enable a feature that has dependencies
    await featureFlags.enableFeature("teamSharing");

    // Check that dependencies were automatically enabled
    expect(featureFlags.isEnabled("teamSharing")).toBe(true);
    expect(featureFlags.isEnabled("authentication")).toBe(true);
    expect(featureFlags.isEnabled("onlineSync")).toBe(true);
  });

  test("should disable dependent features when dependency is disabled", async () => {
    // Set permission level to allow enabling these features
    await featureFlags.setPermissionLevel("team");

    // Enable a feature that has dependencies
    await featureFlags.enableFeature("teamSharing");

    // Disable a dependency
    await featureFlags.disableFeature("authentication");

    // Check that dependent feature was automatically disabled
    expect(featureFlags.isEnabled("authentication")).toBe(false);
    expect(featureFlags.isEnabled("teamSharing")).toBe(false);
  });

  test("should respect permission levels", async () => {
    // Set basic permission level
    await featureFlags.setPermissionLevel("basic");

    // Try to enable a feature that requires higher permission
    const result = await featureFlags.enableFeature("remoteStorage");

    // Should fail and feature should remain disabled
    expect(result).toBe(false);
    expect(featureFlags.isEnabled("remoteStorage")).toBe(false);

    // Set higher permission level
    await featureFlags.setPermissionLevel("standard");

    // Try again
    const result2 = await featureFlags.enableFeature("remoteStorage");

    // Should succeed
    expect(result2).toBe(true);
    expect(featureFlags.isEnabled("remoteStorage")).toBe(true);
  });

  test("should update multiple features at once", async () => {
    // Set permission level to allow enabling these features
    await featureFlags.setPermissionLevel("advanced");

    const updates = {
      captureRequests: false,
      filterRequests: false,
      requestModification: true,
    };

    const result = await featureFlags.updateFeatures(updates);

    expect(result).toBe(true);
    expect(featureFlags.isEnabled("captureRequests")).toBe(false);
    expect(featureFlags.isEnabled("filterRequests")).toBe(false);
    expect(featureFlags.isEnabled("requestModification")).toBe(true);
  });

  test("should get feature info for UI display", () => {
    const info = featureFlags.getFeatureInfo();

    // Check structure
    expect(info).toHaveProperty("core");
    expect(info).toHaveProperty("online");
    expect(info).toHaveProperty("advanced");
    expect(info).toHaveProperty("experimental");

    // Check content
    expect(Array.isArray(info.core)).toBe(true);
    expect(info.core.length).toBeGreaterThan(0);
    expect(info.core[0]).toHaveProperty("id");
    expect(info.core[0]).toHaveProperty("name");
    expect(info.core[0]).toHaveProperty("description");
    expect(info.core[0]).toHaveProperty("enabled");
    expect(info.core[0]).toHaveProperty("hasPermission");
  });

  test("should reset to defaults", async () => {
    // Change some settings
    await featureFlags.setPermissionLevel("admin");
    await featureFlags.updateFeatures({
      captureRequests: false,
      onlineSync: true,
      requestModification: true,
    });

    // Reset to defaults
    await featureFlags.resetToDefaults();

    // Check that defaults were restored
    expect(featureFlags.isEnabled("captureRequests")).toBe(true);
    expect(featureFlags.isEnabled("onlineSync")).toBe(false);
    expect(featureFlags.isEnabled("requestModification")).toBe(false);
  });
});

describe("FeatureFlagsManager", () => {
  beforeEach(async () => {
    await featureFlags.initialize({
      permissionLevel: "admin", // Start with full permissions
      initialFlags: {}, // Start with default flags
    });
  });

  describe("Dependency Resolution", () => {
    it("should enable dependencies when enabling a feature", async () => {
      await featureFlags.enableFeature("predictiveAnalytics");
      expect(featureFlags.isEnabled("statistics")).toBe(true);
      expect(featureFlags.isEnabled("aiAnalysis")).toBe(true);
    });

    it("should disable dependent features when disabling a dependency", async () => {
      await featureFlags.enableFeature("predictiveAnalytics");
      await featureFlags.disableFeature("statistics");
      expect(featureFlags.isEnabled("predictiveAnalytics")).toBe(false);
      expect(featureFlags.isEnabled("aiAnalysis")).toBe(false);
    });

    it("should detect circular dependencies", () => {
      const testCircular = () => {
        featureFlags.dependencyGraph.set("featureA", new Set(["featureB"]));
        featureFlags.dependencyGraph.set("featureB", new Set(["featureC"]));
        featureFlags.dependencyGraph.set("featureC", new Set(["featureA"]));
        featureFlags.detectCircularDependencies("featureA");
      };

      expect(testCircular).toThrow("Circular dependency detected");
    });
  });

  describe("Permission Validation", () => {
    it("should respect permission levels when enabling features", async () => {
      await featureFlags.setPermissionLevel("basic");

      // Try to enable a premium feature
      await featureFlags.enableFeature("aiAnalysis");
      expect(featureFlags.isEnabled("aiAnalysis")).toBe(false);

      // Should allow enabling a basic feature
      await featureFlags.enableFeature("captureRequests");
      expect(featureFlags.isEnabled("captureRequests")).toBe(true);
    });

    it("should automatically disable features when permission level is lowered", async () => {
      await featureFlags.setPermissionLevel("premium");
      await featureFlags.enableFeature("aiAnalysis");
      expect(featureFlags.isEnabled("aiAnalysis")).toBe(true);

      await featureFlags.setPermissionLevel("basic");
      expect(featureFlags.isEnabled("aiAnalysis")).toBe(false);
    });
  });

  describe("Batch Updates", () => {
    it("should handle multiple feature updates while maintaining dependencies", async () => {
      const updates = {
        teamSharing: true,
        cloudExport: true,
        authentication: false, // This should prevent both from enabling
      };

      await featureFlags.updateFeatures(updates);
      expect(featureFlags.isEnabled("teamSharing")).toBe(false);
      expect(featureFlags.isEnabled("cloudExport")).toBe(false);
      expect(featureFlags.isEnabled("authentication")).toBe(false);
    });
  });

  describe("Feature Info", () => {
    it("should provide complete feature information with dependencies", () => {
      const info = featureFlags.getFeatureInfo();
      expect(info).toHaveProperty("experimental");

      const predictiveAnalytics = info.experimental.find(
        (f) => f.id === "predictiveAnalytics"
      );
      expect(predictiveAnalytics).toBeDefined();
      expect(predictiveAnalytics.dependencies).toContain("statistics");
      expect(predictiveAnalytics.dependencies).toContain("aiAnalysis");
    });
  });
});
