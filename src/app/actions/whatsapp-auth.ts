"use server";

import { prisma } from "@/lib/prisma";
import { createSession, requireSession } from "@/lib/auth";
import { toE164, hashPhone } from "@/lib/phone";
import { encryptDataUrl, decryptDataUrl } from "@/lib/crypto";
import { sendEmailOtp, checkEmailOtp } from "@/lib/email-otp";
import { sendOtp, checkOtp } from "@/lib/twilio";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type OtpRequestState = { error?: string; submitted?: boolean; phone?: string };
export type OtpVerifyState = { error?: string };

async function logAttempt(phone: string, outcome: string, employeeId?: string) {
  await prisma.phoneVerificationAttempt.create({
    data: { phone: encryptDataUrl(phone), outcome, employeeId: employeeId ?? null },
  });
}

/**
 * Step 1 of employee login: request an OTP for a phone number. Deliberately
 * generic in its rejection — an unrecognized number gets the exact same
 * "not associated with any company" message whether the number is simply
 * wrong or genuinely doesn't belong to any employee, so this can't be used
 * to enumerate real employee phone numbers.
 */
export async function requestEmployeeOtpAction(
  _prev: OtpRequestState,
  formData: FormData
): Promise<OtpRequestState> {
  const raw = String(formData.get("phone") ?? "");
  const e164 = toE164(raw);
  if (!e164) return { error: "Numéro de téléphone invalide." };

  if (!(await checkRateLimit("otp-request", e164, { limit: 5, windowMs: 15 * 60 * 1000, ipLimit: 30 }))) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  // Le code part sur l'email professionnel de l'employé, via le même mécanisme
  // haché et limité que la connexion par email (src/lib/email-otp.ts). Un numéro
  // inconnu, ou un employé sans email, reçoit la même réponse sans envoi.
  const employee = await prisma.employee.findFirst({
    where: { phoneHash: hashPhone(e164), status: "ACTIF" },
    select: { id: true, email: true },
  });

  if (!employee || !employee.email) {
    await logAttempt(e164, "UNKNOWN_NUMBER", employee?.id);
    return { submitted: true, phone: e164 };
  }

  const result = await sendEmailOtp(decryptDataUrl(employee.email));
  if (!result.sent) return { error: result.error };

  return { submitted: true, phone: e164 };
}

/**
 * Step 2: check the submitted code. On success, resolves (or lazily
 * creates) the employee's User row — employees never set a password, their
 * account simply comes into existence the first time their phone is
 * verified — flips invitationStatus to ACTIVE, and starts the session.
 */
export async function verifyEmployeeOtpAction(
  _prev: OtpVerifyState,
  formData: FormData
): Promise<OtpVerifyState> {
  const e164 = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!e164 || !code) return { error: "Code requis." };

  if (!(await checkRateLimit("otp-verify-employee", e164, { limit: 8, windowMs: 15 * 60 * 1000, ipLimit: 60 }))) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const employee = await prisma.employee.findFirst({
    where: { phoneHash: hashPhone(e164), status: "ACTIF" },
    include: { user: true },
  });
  if (!employee || !employee.email) {
    await logAttempt(e164, "UNKNOWN_NUMBER", employee?.id);
    return { error: "Code invalide ou expiré." };
  }

  const check = await checkEmailOtp(decryptDataUrl(employee.email), code);
  if (!check.approved) {
    await logAttempt(e164, "OTP_INVALID", employee.id);
    return { error: check.error };
  }

  await logAttempt(e164, "SUCCESS", employee.id);

  const now = new Date();
  const phoneHash = hashPhone(e164);
  let user = employee.user;
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
      data: { phone: encryptDataUrl(e164), phoneHash, phoneVerifiedAt: now },
    });
  }

  if (employee.invitationStatus !== "ACTIVE") {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { invitationStatus: "ACTIVE", phoneVerifiedAt: now },
    });
  }

  await createSession({
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    email: user.email ? decryptDataUrl(user.email) : null,
    employeeId: user.employeeId,
  });

  redirect("/espace");
}

// ---------------------------------------------------------------------
// Admin / Responsable — WhatsApp as an OPTIONAL second channel alongside
// their existing email + password. Two separate concerns:
//  (a) linking a phone to an already-authenticated account (Paramètres)
//  (b) logging in with that phone once linked (an alternative to /connexion)
// Signup and the email/password login flow are untouched by any of this.
// ---------------------------------------------------------------------

export async function requestLinkPhoneOtpAction(
  _prev: OtpRequestState,
  formData: FormData
): Promise<OtpRequestState> {
  const session = await requireSession();
  const raw = String(formData.get("phone") ?? "");
  const e164 = toE164(raw);
  if (!e164) return { error: "Numéro de téléphone invalide." };

  if (!(await checkRateLimit("otp-link", session.userId, { limit: 5, windowMs: 15 * 60 * 1000 }))) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  const existing = await prisma.user.findUnique({ where: { phoneHash: hashPhone(e164) } });
  if (existing && existing.id !== session.userId) {
    return { error: "Ce numéro ne peut pas être lié à ce compte." };
  }

  const result = await sendOtp(e164);
  if (!result.sent) return { error: result.error };
  return { submitted: true, phone: e164 };
}

export async function verifyLinkPhoneOtpAction(
  _prev: OtpVerifyState,
  formData: FormData
): Promise<OtpVerifyState> {
  const session = await requireSession();
  const e164 = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!e164 || !code) return { error: "Code requis." };

  if (!(await checkRateLimit("otp-verify-link", session.userId, { limit: 8, windowMs: 15 * 60 * 1000 }))) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const check = await checkOtp(e164, code);
  if (!check.approved) return { error: check.error };

  await prisma.user.update({
    where: { id: session.userId },
    data: { phone: encryptDataUrl(e164), phoneHash: hashPhone(e164), phoneVerifiedAt: new Date() },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "LINK_WHATSAPP_PHONE",
    entityType: "User",
    entityId: session.userId,
  });

  revalidatePath("/parametres");
  return {};
}

export async function requestLoginOtpAction(
  _prev: OtpRequestState,
  formData: FormData
): Promise<OtpRequestState> {
  const raw = String(formData.get("phone") ?? "");
  const e164 = toE164(raw);
  if (!e164) return { error: "Numéro de téléphone invalide." };

  if (!(await checkRateLimit("otp-login", e164, { limit: 5, windowMs: 15 * 60 * 1000, ipLimit: 30 }))) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  const user = await prisma.user.findFirst({
    where: { phoneHash: hashPhone(e164), phoneVerifiedAt: { not: null }, role: { in: ["ADMIN", "RESPONSABLE"] } },
  });
  if (!user) {
    // Même réponse qu'un envoi réussi : on ne révèle pas quels numéros ont un compte.
    return { submitted: true, phone: e164 };
  }

  const result = await sendOtp(e164);
  if (!result.sent) return { error: result.error };
  return { submitted: true, phone: e164 };
}

export async function verifyLoginOtpAction(
  _prev: OtpVerifyState,
  formData: FormData
): Promise<OtpVerifyState> {
  const e164 = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!e164 || !code) return { error: "Code requis." };

  if (!(await checkRateLimit("otp-verify-login", e164, { limit: 8, windowMs: 15 * 60 * 1000, ipLimit: 60 }))) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const user = await prisma.user.findFirst({
    where: { phoneHash: hashPhone(e164), phoneVerifiedAt: { not: null }, role: { in: ["ADMIN", "RESPONSABLE"] } },
  });
  if (!user) return { error: "Code invalide ou expiré." };

  const check = await checkOtp(e164, code);
  if (!check.approved) return { error: check.error };

  await createSession({
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    email: user.email ? decryptDataUrl(user.email) : null,
    employeeId: user.employeeId,
  });

  redirect("/dashboard");
}
