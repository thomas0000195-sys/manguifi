import { describe, it, expect } from "@jest/globals";
import { toE164, hashPhone } from "../phone";

describe("Phone Utility", () => {
  describe("toE164", () => {
    it("should convert local Senegal format to E.164", () => {
      expect(toE164("77 123 45 67")).toBe("+22177123456 7");
      expect(toE164("771234567")).toBe("+221771234567");
      expect(toE164("77-123-45-67")).toBe("+221771234567");
    });

    it("should normalize international format", () => {
      expect(toE164("+221 77 123 45 67")).toBe("+221771234567");
      expect(toE164("+22177123456 7")).toBe("+221771234567");
    });

    it("should return same value for already normalized", () => {
      expect(toE164("+221771234567")).toBe("+221771234567");
    });

    it("should reject invalid numbers", () => {
      expect(toE164("")).toBe(null);
      expect(toE164("abc")).toBe(null);
      expect(toE164("123")).toBe(null);
    });

    it("should normalize different formats to same result", () => {
      const formats = [
        "77 123 45 67",
        "771234567",
        "+22177123456 7",
        "+221 77 123 45 67",
      ];
      const normalized = formats.map((f) => toE164(f)).filter(Boolean);
      const uniqueNormalized = new Set(normalized);
      expect(uniqueNormalized.size).toBe(1);
    });
  });

  describe("hashPhone", () => {
    it("should hash phone number deterministically", () => {
      const phone = "+221771234567";
      const hash1 = hashPhone(phone);
      const hash2 = hashPhone(phone);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different numbers", () => {
      const hash1 = hashPhone("+221771234567");
      const hash2 = hashPhone("+221771234568");
      expect(hash1).not.toBe(hash2);
    });

    it("should be HMAC-based (not reversible)", () => {
      const phone = "+221771234567";
      const hash = hashPhone(phone);
      expect(hash).not.toContain(phone);
      expect(hash.length).toBeGreaterThan(0);
    });
  });
});
