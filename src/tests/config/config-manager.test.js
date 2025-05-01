import { setupConfigManager } from "../../background/config/config-manager";

describe("ConfigManager", () => {
  let configManager;
  const mockEventBus = {
    publish: jest.fn(),
  };

  beforeEach(() => {
    configManager = setupConfigManager(mockEventBus);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Caching", () => {
    it("should cache values and return from cache when valid", async () => {
      await configManager.set("test.key", "test-value");
      const spy = jest.spyOn(configManager.config, "get");

      // First get should cache
      const value1 = configManager.get("test.key");
      expect(value1).toBe("test-value");
      expect(spy).toHaveBeenCalledTimes(1);

      // Second get should use cache
      const value2 = configManager.get("test.key");
      expect(value2).toBe("test-value");
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should refresh cache after timeout", async () => {
      await configManager.set("test.key", "test-value");
      const spy = jest.spyOn(configManager.config, "get");

      // First get should cache
      const value1 = configManager.get("test.key");
      expect(value1).toBe("test-value");

      // Advance time past cache timeout
      jest.advanceTimersByTime(6 * 60 * 1000);

      // Should fetch fresh value
      const value2 = configManager.get("test.key");
      expect(value2).toBe("test-value");
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("should clear cache when requested", async () => {
      await configManager.set("test.key", "test-value");
      const spy = jest.spyOn(configManager.config, "get");

      // First get should cache
      configManager.get("test.key");
      expect(spy).toHaveBeenCalledTimes(1);

      // Clear cache
      configManager.clearCache();

      // Should fetch fresh value
      configManager.get("test.key");
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Async Operations", () => {
    it("should handle async set operations", async () => {
      const promise = configManager.set("test.key", "test-value");
      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).resolves.not.toThrow();

      const value = configManager.get("test.key");
      expect(value).toBe("test-value");
    });

    it("should validate values asynchronously", async () => {
      configManager.setValidator("test.number", async (value) => {
        if (typeof value !== "number") {
          throw new Error("Must be a number");
        }
      });

      await expect(
        configManager.set("test.number", "not-a-number")
      ).rejects.toThrow("Must be a number");

      await expect(configManager.set("test.number", 42)).resolves.not.toThrow();
    });
  });
});
