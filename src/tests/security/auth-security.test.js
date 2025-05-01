import { AuthSecurity } from "../../background/security/auth-security";
import { SecurityError } from "../../background/errors/error-types";

describe("AuthSecurity", () => {
  let authSecurity;

  beforeEach(() => {
    authSecurity = new AuthSecurity();
  });

  describe("Password Handling", () => {
    it("should hash passwords securely", async () => {
      const password = "test123";
      const hash = await authSecurity.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(32); // Should be reasonably long
    });

    it("should verify correct passwords", async () => {
      const password = "test123";
      const hash = await authSecurity.hashPassword(password);

      const isValid = await authSecurity.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect passwords", async () => {
      const password = "test123";
      const hash = await authSecurity.hashPassword(password);

      const isValid = await authSecurity.verifyPassword("wrongpass", hash);
      expect(isValid).toBe(false);
    });

    it("should use different salts for same password", async () => {
      const password = "test123";
      const hash1 = await authSecurity.hashPassword(password);
      const hash2 = await authSecurity.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it("should throw SecurityError for invalid inputs", async () => {
      await expect(authSecurity.hashPassword("")).rejects.toThrow(
        SecurityError
      );
      await expect(authSecurity.verifyPassword("", "")).rejects.toThrow(
        SecurityError
      );
    });
  });

  describe("Token Generation", () => {
    it("should generate secure tokens", async () => {
      const token = await authSecurity.generateSecureToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(32);
      expect(token).not.toMatch(/[+/=]/); // Should be URL safe
    });

    it("should generate unique tokens", async () => {
      const token1 = await authSecurity.generateSecureToken();
      const token2 = await authSecurity.generateSecureToken();

      expect(token1).not.toBe(token2);
    });

    it("should respect custom length parameter", async () => {
      const token = await authSecurity.generateSecureToken(64);
      expect(token.length).toBeGreaterThan(64);
    });
  });

  describe("Session Management", () => {
    it("should create valid sessions", async () => {
      const userId = "user123";
      const ip = "127.0.0.1";
      const session = await authSecurity.createSession(userId, ip);

      expect(session).toMatchObject({
        userId,
        ip,
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date),
        id: expect.any(String),
        token: expect.any(String),
      });

      expect(session.token.length).toBeGreaterThan(32);
      expect(session.id.length).toBeGreaterThan(32);
    });

    it("should validate session expiry", () => {
      const validSession = {
        expiresAt: new Date(Date.now() + 3600000), // 1 hour in future
      };

      const expiredSession = {
        expiresAt: new Date(Date.now() - 3600000), // 1 hour in past
      };

      expect(authSecurity.validateSessionExpiry(validSession)).toBe(true);
      expect(authSecurity.validateSessionExpiry(expiredSession)).toBe(false);
    });

    it("should validate session IP", () => {
      const session = { ip: "127.0.0.1" };

      expect(authSecurity.validateSessionIP(session, "127.0.0.1")).toBe(true);
      expect(authSecurity.validateSessionIP(session, "192.168.1.1")).toBe(
        false
      );
    });
  });
});
