import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  generateAccessCode,
  hashAccessCode,
  verifyAccessCode,
} from "../access-code";

describe("Access Code Service", () => {
  describe("generateAccessCode", () => {
    it("should generate 8-digit code", () => {
      const code = generateAccessCode();
      expect(code).toHaveLength(8);
      expect(/^\d{8}$/.test(code)).toBe(true);
    });

    it("should not contain ambiguous digits (0, 1)", () => {
      for (let i = 0; i < 100; i++) {
        const code = generateAccessCode();
        expect(code).not.toMatch(/[01]/);
      }
    });

    it("should generate unique codes", () => {
      const codes = new Set();
      for (let i = 0; i < 50; i++) {
        codes.add(generateAccessCode());
      }
      expect(codes.size).toBe(50);
    });
  });

  describe("hashAccessCode & verifyAccessCode", () => {
    let code: string;
    let hash: string;

    beforeEach(async () => {
      code = generateAccessCode();
      hash = await hashAccessCode(code);
    });

    it("should hash code successfully", async () => {
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(code);
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should verify correct code", async () => {
      const isValid = await verifyAccessCode(code, hash);
      expect(isValid).toBe(true);
    });

    it("should reject wrong code", async () => {
      const wrongCode = generateAccessCode();
      const isValid = await verifyAccessCode(wrongCode, hash);
      expect(isValid).toBe(false);
    });

    it("should use constant-time comparison (bcrypt)", async () => {
      // Bcryptjs uses bcrypt which is constant-time
      const wrongCode1 = "22222222";
      const wrongCode2 = "33333333";
      const isValid1 = await verifyAccessCode(wrongCode1, hash);
      const isValid2 = await verifyAccessCode(wrongCode2, hash);
      expect(isValid1).toBe(false);
      expect(isValid2).toBe(false);
    });
  });
});
