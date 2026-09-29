import crypto from "node:crypto";
import bcryptjs from "bcryptjs";
import { prisma } from "./prisma";
import { hashPhone } from "./phone";

const CODE_LENGTH = 8;
const CODE_EXPIRY_DAYS = 30;
const CODE_EXPIRY_MS = CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a cryptographically secure access code (8 digits, no ambiguous chars)
 * Returns code in plaintext — must be displayed only once to user
 */
export function generateAccessCode(): string {
  // Generate random bytes and convert to decimal, extracting 8 digits
  // Reject if any digit is 0 or 1 (ambiguous with O/l)
  let code = "";
  while (code.length < CODE_LENGTH) {
    const byte = crypto.randomInt(0, 256);
    const digit = (byte % 10).toString();
    if (digit !== "0" && digit !== "1") {
      code += digit;
    }
  }
  return code;
}

/**
 * Hash an access code for storage (uses bcryptjs for constant-time comparison)
 */
export async function hashAccessCode(code: string): Promise<string> {
  return bcryptjs.hash(code, 10);
}

/**
 * Verify a plaintext code against stored hash (constant-time comparison)
 */
export async function verifyAccessCode(plaintext: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(plaintext, hash);
}

export type CreateAccessCodeResult = { success: true; code: string } | { success: false; error: string };

/**
 * Create a new access code for an employee
 * - Revokes any existing active code
 * - Returns plaintext code (displayed only once)
 */
export async function createEmployeeAccessCode(
  employeeId: string,
  createdBy: string = "system"
): Promise<CreateAccessCodeResult> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return { success: false, error: "Employé non trouvé" };
  }

  const plainCode = generateAccessCode();
  const codeHash = await hashAccessCode(plainCode);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

  try {
    // Revoke all previous codes for this employee
    await prisma.employeeAccessCode.updateMany({
      where: { employeeId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create new code
    await prisma.employeeAccessCode.create({
      data: { employeeId, codeHash, expiresAt, createdBy },
    });

    return { success: true, code: plainCode };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: `Impossible de créer le code : ${message}` };
  }
}

export type VerifyAccessCodeResult =
  | { valid: true; employeeId: string }
  | { valid: false; error: string };

/**
 * Verify an access code for employee login
 * - Checks if code is valid, not expired, not already used
 * - Enforces rate limit (max 5 attempts per 15 min window)
 * - Returns plaintext code (displayed only once)
 */
export async function verifyEmployeeAccessCode(
  phoneE164: string,
  code: string,
  ipAddress?: string
): Promise<VerifyAccessCodeResult> {
  const phoneHash = hashPhone(phoneE164);
  const now = new Date();

  // Check rate limit: count failed attempts in last 15 minutes
  const recentAttempts = await prisma.employeeLoginAttempt.count({
    where: {
      phoneHash,
      outcome: "CODE_INVALID",
      createdAt: { gte: new Date(now.getTime() - ATTEMPT_WINDOW_MS) },
    },
  });

  if (recentAttempts >= MAX_ATTEMPTS) {
    await prisma.employeeLoginAttempt.create({
      data: { phoneHash, outcome: "RATE_LIMITED", ipAddress: ipAddress ?? null },
    });
    return { valid: false, error: "Trop de tentatives. Réessayez dans 15 minutes." };
  }

  // Find employee by phone
  const employee = await prisma.employee.findFirst({
    where: { phoneHash, status: "ACTIF" },
  });

  if (!employee) {
    await prisma.employeeLoginAttempt.create({
      data: { phoneHash, outcome: "UNKNOWN_PHONE", ipAddress: ipAddress ?? null },
    });
    return {
      valid: false,
      error: "Ce numéro n'est associé à aucune entreprise. Contactez votre responsable.",
    };
  }

  // Find valid access code
  const accessCode = await prisma.employeeAccessCode.findFirst({
    where: {
      employeeId: employee.id,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!accessCode) {
    await prisma.employeeLoginAttempt.create({
      data: {
        phoneHash,
        outcome: "NO_CODE",
        employeeId: employee.id,
        ipAddress: ipAddress ?? null,
      },
    });
    return {
      valid: false,
      error: "Aucun code d'accès actif. Contactez votre responsable.",
    };
  }

  // Verify code (constant-time comparison)
  const isValid = await verifyAccessCode(code, accessCode.codeHash);
  if (!isValid) {
    await prisma.employeeLoginAttempt.create({
      data: {
        phoneHash,
        outcome: "CODE_INVALID",
        employeeId: employee.id,
        ipAddress: ipAddress ?? null,
      },
    });
    return { valid: false, error: "Code invalide. Vérifiez et réessayez." };
  }

  // Mark code as used
  await prisma.employeeAccessCode.update({
    where: { id: accessCode.id },
    data: { usedAt: now },
  });

  // Log successful attempt
  await prisma.employeeLoginAttempt.create({
    data: {
      phoneHash,
      outcome: "SUCCESS",
      employeeId: employee.id,
      ipAddress: ipAddress ?? null,
    },
  });

  return { valid: true, employeeId: employee.id };
}
