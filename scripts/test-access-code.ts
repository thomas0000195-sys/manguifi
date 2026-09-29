/**
 * Simple test runner for access code service
 * Run with: node --env-file-if-exists=.env --import tsx scripts/test-access-code.ts
 */

import {
  generateAccessCode,
  hashAccessCode,
  verifyAccessCode,
} from "@/lib/access-code";
import { toE164, hashPhone } from "@/lib/phone";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message });
    console.log(`✗ ${name}: ${message}`);
  }
}

async function runTests() {
  console.log("🧪 Testing Access Code Service\n");

  // generateAccessCode tests
  await test("generateAccessCode should generate 8-digit code", () => {
    const code = generateAccessCode();
    assert(code.length === 8, `Code length should be 8, got ${code.length}`);
    assert(/^\d{8}$/.test(code), `Code should be all digits, got ${code}`);
  });

  await test("generateAccessCode should not contain ambiguous digits (0, 1)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateAccessCode();
      assert(
        !code.match(/[01]/),
        `Code ${code} contains ambiguous digit 0 or 1`
      );
    }
  });

  await test("generateAccessCode should generate unique codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = generateAccessCode();
      assert(!codes.has(code), `Duplicate code generated: ${code}`);
      codes.add(code);
    }
    assert(codes.size === 50, `Expected 50 unique codes, got ${codes.size}`);
  });

  // hashAccessCode tests
  let testCode = "";
  let testHash = "";

  await test("hashAccessCode should hash code", async () => {
    testCode = generateAccessCode();
    testHash = await hashAccessCode(testCode);
    assert(testHash.length > 0, "Hash should not be empty");
    assert(testHash !== testCode, "Hash should not equal plaintext");
  });

  await test("verifyAccessCode should accept correct code", async () => {
    const isValid = await verifyAccessCode(testCode, testHash);
    assert(isValid === true, `Should verify correct code`);
  });

  await test("verifyAccessCode should reject wrong code", async () => {
    const wrongCode = generateAccessCode();
    const isValid = await verifyAccessCode(wrongCode, testHash);
    assert(isValid === false, `Should reject wrong code`);
  });

  // Phone tests
  console.log("\n🧪 Testing Phone Utility\n");

  await test("toE164 should convert local Senegal format", () => {
    const result = toE164("77 123 45 67");
    assert(result === "+221771234567", `Expected +221771234567, got ${result}`);
  });

  await test("toE164 should normalize international format", () => {
    const result = toE164("+221 77 123 45 67");
    assert(result === "+221771234567", `Expected +221771234567, got ${result}`);
  });

  await test("toE164 should normalize different formats to same result", () => {
    const formats = ["77 123 45 67", "771234567", "+221771234567"];
    const results = formats.map((f) => toE164(f)).filter(Boolean);
    const uniqueResults = new Set(results);
    assert(
      uniqueResults.size === 1,
      `All formats should normalize to same value, got ${uniqueResults.size}`
    );
  });

  await test("toE164 should reject invalid numbers", () => {
    assert(toE164("") === null, "Should reject empty string");
    assert(toE164("abc") === null, "Should reject non-numeric");
    assert(toE164("123") === null, "Should reject too short");
  });

  await test("hashPhone should be deterministic", () => {
    const phone = "+221771234567";
    const hash1 = hashPhone(phone);
    const hash2 = hashPhone(phone);
    assert(hash1 === hash2, "Same phone should produce same hash");
  });

  await test("hashPhone should produce different hashes for different numbers", () => {
    const hash1 = hashPhone("+221771234567");
    const hash2 = hashPhone("+221771234568");
    assert(hash1 !== hash2, "Different phones should produce different hashes");
  });

  await test("hashPhone should not be reversible", () => {
    const phone = "+221771234567";
    const hash = hashPhone(phone);
    assert(!hash.includes(phone), "Hash should not contain plaintext phone");
  });

  // Summary
  console.log("\n" + "=".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n📊 Results: ${passed}/${total} tests passed\n`);

  if (passed === total) {
    console.log("✓ All tests passed!");
    process.exit(0);
  } else {
    console.log("✗ Some tests failed:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
