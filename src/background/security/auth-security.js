import { SecurityError } from "../errors/error-types";
import { subtle } from "crypto";

export class AuthSecurity {
  constructor() {
    this.iterations = 100000;
    this.keyLength = 256;
    this.saltLength = 16;
    this.pepper = crypto.getRandomValues(new Uint8Array(32));
  }

  async hashPassword(password) {
    try {
      // Generate a random salt
      const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));

      // Combine password with pepper
      const pepperedPassword = new TextEncoder().encode(password);
      const combinedPassword = new Uint8Array(
        pepperedPassword.length + this.pepper.length
      );
      combinedPassword.set(pepperedPassword);
      combinedPassword.set(this.pepper, pepperedPassword.length);

      // Generate key using PBKDF2
      const key = await subtle.importKey(
        "raw",
        combinedPassword,
        "PBKDF2",
        false,
        ["deriveBits"]
      );

      const derivedKey = await subtle.deriveBits(
        {
          name: "PBKDF2",
          salt,
          iterations: this.iterations,
          hash: "SHA-256",
        },
        key,
        this.keyLength
      );

      // Combine salt and derived key
      const hash = new Uint8Array(salt.length + derivedKey.byteLength);
      hash.set(salt);
      hash.set(new Uint8Array(derivedKey), salt.length);

      return Buffer.from(hash).toString("base64");
    } catch (error) {
      throw new SecurityError("Password hashing failed", {
        error: error.message,
      });
    }
  }

  async verifyPassword(password, storedHash) {
    try {
      const hashBuffer = Buffer.from(storedHash, "base64");
      const salt = hashBuffer.slice(0, this.saltLength);
      const storedKey = hashBuffer.slice(this.saltLength);

      // Combine password with pepper
      const pepperedPassword = new TextEncoder().encode(password);
      const combinedPassword = new Uint8Array(
        pepperedPassword.length + this.pepper.length
      );
      combinedPassword.set(pepperedPassword);
      combinedPassword.set(this.pepper, pepperedPassword.length);

      const key = await subtle.importKey(
        "raw",
        combinedPassword,
        "PBKDF2",
        false,
        ["deriveBits"]
      );

      const derivedKey = await subtle.deriveBits(
        {
          name: "PBKDF2",
          salt,
          iterations: this.iterations,
          hash: "SHA-256",
        },
        key,
        this.keyLength
      );

      // Compare derived key with stored key
      return Buffer.from(derivedKey).equals(storedKey);
    } catch (error) {
      throw new SecurityError("Password verification failed", {
        error: error.message,
      });
    }
  }

  async generateSecureToken(length = 32) {
    try {
      const buffer = new Uint8Array(length);
      crypto.getRandomValues(buffer);

      // Convert to URL-safe base64
      return Buffer.from(buffer)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    } catch (error) {
      throw new SecurityError("Token generation failed", {
        error: error.message,
      });
    }
  }

  async generateSessionId() {
    return this.generateSecureToken(48);
  }

  // Session management
  async createSession(userId, ip) {
    const sessionId = await this.generateSessionId();
    const token = await this.generateSecureToken();

    return {
      id: sessionId,
      token,
      userId,
      ip,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  }

  validateSessionExpiry(session) {
    if (!session.expiresAt) return false;
    return new Date(session.expiresAt) > new Date();
  }

  validateSessionIP(session, currentIP) {
    return session.ip === currentIP;
  }
}
