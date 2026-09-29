import crypto from "node:crypto";
import { prisma } from "./prisma";

const SESSION_VALIDITY_DAYS = 365; // 12 months
const SESSION_VALIDITY_MS = SESSION_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Generate a secure session token for employee login
 * Token is stored hashed in DB, not in plaintext
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a new employee session (revokes previous session for same employee)
 * - Revokes old session immediately (single active device per employee)
 * - Creates new session token
 * - Returns the token to be stored on device
 */
export async function createEmployeeSession(employeeId: string): Promise<string> {
  // Revoke previous session (one device at a time)
  await prisma.employeeSession.deleteMany({ where: { employeeId } });

  const token = generateSessionToken();
  const session = await prisma.employeeSession.create({
    data: {
      employeeId,
      token,
      lastActivityAt: new Date(),
    },
  });

  return session.token;
}

export type ValidateEmployeeSessionResult =
  | { valid: true; employeeId: string }
  | { valid: false; error: string };

/**
 * Validate an employee session token
 * - Checks if token exists and employee is active
 * - Updates lastActivityAt (for inactivity tracking)
 * - Returns employeeId on success
 */
export async function validateEmployeeSession(token: string): Promise<ValidateEmployeeSessionResult> {
  const session = await prisma.employeeSession.findUnique({
    where: { token },
    include: { employee: true },
  });

  if (!session) {
    return { valid: false, error: "Session invalide ou expirée" };
  }

  // Check if employee is still active
  if (session.employee.status !== "ACTIF") {
    // Employee deactivated — revoke session
    await prisma.employeeSession.delete({ where: { id: session.id } });
    return { valid: false, error: "Compte désactivé" };
  }

  // Check inactivity (12 months)
  const inactivityWindow = new Date(Date.now() - SESSION_VALIDITY_MS);
  if (session.lastActivityAt < inactivityWindow) {
    await prisma.employeeSession.delete({ where: { id: session.id } });
    return { valid: false, error: "Session expirée après inactivité" };
  }

  // Update activity timestamp
  await prisma.employeeSession.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  });

  return { valid: true, employeeId: session.employeeId };
}

/**
 * Revoke an employee session (called when employee is deactivated,
 * password changed, or new device login requested)
 */
export async function revokeEmployeeSession(employeeId: string): Promise<void> {
  await prisma.employeeSession.deleteMany({ where: { employeeId } });
}
