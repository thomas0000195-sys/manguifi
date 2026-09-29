"use server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { encryptDataUrl, decryptDataUrl } from "@/lib/crypto";
import { toE164, hashPhone } from "@/lib/phone";
import { verifyEmployeeAccessCode } from "@/lib/access-code";
import { createEmployeeSession } from "@/lib/employee-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type AccessCodeRequestState = { error?: string; submitted?: boolean; phone?: string };
export type AccessCodeVerifyState = { error?: string };

/**
 * Step 1 : Request an access code verification form for a phone number
 * Doesn't send anything — just displays "enter your code" screen
 */
export async function requestAccessCodeAction(
  _prev: AccessCodeRequestState,
  formData: FormData
): Promise<AccessCodeRequestState> {
  const raw = String(formData.get("phone") ?? "");
  const e164 = toE164(raw);
  if (!e164) {
    return { error: "Numéro de téléphone invalide." };
  }

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`access-code-request:${ip}:${e164}`, 5, 15 * 60 * 1000)) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  // Check if employee with this phone exists (but don't enumerate)
  const employee = await prisma.employee.findFirst({
    where: { phoneHash: hashPhone(e164), status: "ACTIF" },
  });

  if (!employee) {
    // Same generic message whether phone doesn't exist or has no code
    return {
      error: "Ce numéro n'est associé à aucune entreprise. Contactez votre responsable.",
    };
  }

  // Check if employee has an active access code
  const hasActiveCode = await prisma.employeeAccessCode.findFirst({
    where: {
      employeeId: employee.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!hasActiveCode) {
    return {
      error: "Aucun code d'accès actif pour ce numéro. Contactez votre responsable.",
    };
  }

  return { submitted: true, phone: e164 };
}

/**
 * Step 2 : Verify the access code and create session
 * - Validates code
 * - Revokes previous session for this employee (single device)
 * - Creates new session
 * - Redirects to /espace
 */
export async function verifyAccessCodeAction(
  _prev: AccessCodeVerifyState,
  formData: FormData
): Promise<AccessCodeVerifyState> {
  const e164 = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!e164 || !code) {
    return { error: "Numéro et code requis." };
  }

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`access-code-verify:${ip}:${e164}`, 8, 15 * 60 * 1000)) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  // Verify the access code
  const verification = await verifyEmployeeAccessCode(e164, code, ip);
  if (!verification.valid) {
    return { error: verification.error };
  }

  // Load employee and create/get user
  const employee = await prisma.employee.findUnique({
    where: { id: verification.employeeId },
    include: { user: true, org: true },
  });

  if (!employee) {
    return { error: "Employé non trouvé." };
  }

  const now = new Date();
  const phoneHash = hashPhone(e164);
  let user = employee.user;

  // Create user on first login if doesn't exist
  if (!user) {
    user = await prisma.user.create({
      data: {
        orgId: employee.orgId,
        role: "EMPLOYEE",
        employeeId: employee.id,
        phone: encryptDataUrl(e164),
        phoneHash,
        phoneVerifiedAt: now,
      },
    });
  } else if (!user.phoneVerifiedAt) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: encryptDataUrl(e164),
        phoneHash,
        phoneVerifiedAt: now,
      },
    });
  }

  // Update employee invitation status
  if (employee.invitationStatus !== "ACTIVE") {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        invitationStatus: "ACTIVE",
        phoneVerifiedAt: now,
      },
    });
  }

  // Create employee session (revokes previous, single device)
  await createEmployeeSession(employee.id);

  // Create session cookie
  await createSession({
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    email: user.email ? decryptDataUrl(user.email) : null,
    employeeId: user.employeeId,
  });

  // Log successful authentication
  await logAudit({
    orgId: employee.orgId,
    userId: user.id,
    action: "EMPLOYEE_ACCESS_CODE_LOGIN",
    entityType: "Employee",
    entityId: employee.id,
    details: `Phone: ${e164.slice(-4)}...`,
  });

  redirect("/espace");
}
