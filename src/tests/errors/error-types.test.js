import {
  AppError,
  DatabaseError,
  ConfigError,
  handleError,
} from "../../background/errors/error-types";

describe("Error Handling System", () => {
  describe("AppError", () => {
    it("should create base error with default values", () => {
      const error = new AppError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("UNKNOWN_ERROR");
      expect(error.details).toEqual({});
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it("should serialize to JSON correctly", () => {
      const error = new AppError("Test error", "TEST_CODE", { foo: "bar" });
      const json = error.toJSON();

      expect(json).toEqual({
        name: "AppError",
        message: "Test error",
        code: "TEST_CODE",
        details: { foo: "bar" },
        timestamp: error.timestamp,
      });
    });
  });

  describe("Specific Error Types", () => {
    it("should create DatabaseError with correct code", () => {
      const error = new DatabaseError("DB error");
      expect(error.code).toBe("DATABASE_ERROR");
    });

    it("should create ConfigError with correct code", () => {
      const error = new ConfigError("Config error");
      expect(error.code).toBe("CONFIG_ERROR");
    });
  });

  describe("Error Handler", () => {
    let consoleErrorSpy;
    let mockErrorReporter;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      mockErrorReporter = { report: jest.fn() };
      global.window = { errorReporter: mockErrorReporter };
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      delete global.window;
    });

    it("should handle AppError instances", () => {
      const error = new DatabaseError("Test DB error", { table: "users" });
      const result = handleError(error, { userId: "123" });

      expect(result).toEqual({
        name: "DatabaseError",
        message: "Test DB error",
        code: "DATABASE_ERROR",
        details: { table: "users" },
        timestamp: error.timestamp,
        context: { userId: "123" },
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockErrorReporter.report).toHaveBeenCalledWith(result);
    });

    it("should handle regular Error instances", () => {
      const error = new Error("Regular error");
      const result = handleError(error);

      expect(result.name).toBe("Error");
      expect(result.message).toBe("Regular error");
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.details).toEqual({});
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });
});
