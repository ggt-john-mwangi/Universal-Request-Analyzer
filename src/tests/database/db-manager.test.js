import { DatabaseManager } from "../../background/database/db-manager";

describe("DatabaseManager", () => {
  let dbManager;
  const mockDb = {
    prepare: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(async () => {
    dbManager = new DatabaseManager();
    dbManager.db = mockDb;
    await dbManager.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Write Queue", () => {
    it("should process write operations in order", async () => {
      const operations = [];
      mockDb.prepare.mockImplementation((query) => ({
        run: (...params) => {
          operations.push({ query, params });
          return {};
        },
      }));

      // Queue multiple write operations
      const op1 = dbManager.saveRequest({
        id: "1",
        method: "GET",
        url: "http://test1.com",
      });

      const op2 = dbManager.saveRequest({
        id: "2",
        method: "POST",
        url: "http://test2.com",
      });

      // Wait for all operations to complete
      await Promise.all([op1, op2]);

      // Verify operations were executed in order
      expect(operations).toHaveLength(2);
      expect(operations[0].params[0]).toBe("1");
      expect(operations[1].params[0]).toBe("2");
    });

    it("should handle write operation failures without affecting queue", async () => {
      let failedOp = false;
      mockDb.prepare.mockImplementation((query) => ({
        run: (...params) => {
          if (!failedOp) {
            failedOp = true;
            throw new Error("Write failed");
          }
          return {};
        },
      }));

      // Queue operations
      const op1 = dbManager.saveRequest({
        id: "1",
        method: "GET",
        url: "http://test1.com",
      });

      const op2 = dbManager.saveRequest({
        id: "2",
        method: "POST",
        url: "http://test2.com",
      });

      // First operation should fail, second should succeed
      await expect(op1).rejects.toThrow("Write failed");
      await expect(op2).resolves.not.toThrow();
    });
  });

  describe("Performance Metrics", () => {
    it("should save and retrieve performance metrics", async () => {
      const metrics = {
        dns: 100,
        tcp: 200,
        ssl: 300,
        ttfb: 400,
        download: 500,
        total: 1500,
      };

      let savedMetrics;
      mockDb.prepare.mockImplementation((query) => ({
        run: (...params) => {
          savedMetrics = params;
          return {};
        },
        get: () => savedMetrics,
      }));

      await dbManager.saveRequestMetrics("test-id", metrics);
      const retrieved = await dbManager.getRequestMetrics("test-id");

      expect(retrieved).toBeDefined();
      expect(savedMetrics).toContain("test-id");
      expect(savedMetrics).toContain(metrics.dns);
      expect(savedMetrics).toContain(metrics.tcp);
    });
  });

  describe("Cleanup", () => {
    it("should wait for pending writes before cleanup", async () => {
      const writeOp = dbManager.saveRequest({
        id: "1",
        method: "GET",
        url: "http://test.com",
      });

      // Start cleanup
      const cleanupPromise = dbManager.cleanup();

      // Resolve write operation
      await writeOp;

      // Cleanup should complete
      await cleanupPromise;

      expect(mockDb.close).toHaveBeenCalled();
      expect(dbManager.initialized).toBe(false);
    });
  });
});
