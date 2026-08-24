"use server";

import { prisma } from "@/lib/prisma";
import { createSession, requireSession } from "@/lib/auth";
import { toE164 } from "@/lib/phone";
import { sendOtp, checkOtp } from "@/lib/twilio";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export type OtpRequestState = { error?: string; submitted?: boolean; phone?: string };
export type OtpVerifyState = { error?: string };

async function logAttempt(phone: string, outcome: string, employeeId?: string) {
  await prisma.phoneVerificationAttempt.create({
    data: { phone, outcome, employeeId: employeeId ?? null },
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

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`otp-request:${ip}:${e164}`, 5, 15 * 60 * 1000)) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  const employee = await prisma.employee.findFirst({
    where: { phone: e164, status: "ACTIF" },
  });

  if (!employee) {
    await logAttempt(e164, "UNKNOWN_NUMBER");
    return {
      error:
        "Ce numéro n'est associé à aucune entreprise. Contactez votre responsable pour être ajouté.",
    };
  }

  const result = await sendOtp(e164);
  if (!result.sent) {
    return { error: result.error };
  }

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

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`otp-verify:${ip}:${e164}`, 8, 15 * 60 * 1000)) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const employee = await prisma.employee.findFirst({
    where: { phone: e164, status: "ACTIF" },
    include: { user: true },
  });
  if (!employee) {
    await logAttempt(e164, "UNKNOWN_NUMBER");
    return {
      error:
        "Ce numéro n'est associé à aucune entreprise. Contactez votre responsable pour être ajouté.",
    };
  }

  const check = await checkOtp(e164, code);
  if (!check.approved) {
    await logAttempt(e164, "OTP_INVALID", employee.id);
    return { error: check.error };
  }

  await logAttempt(e164, "SUCCESS", employee.id);

  const now = new Date();
  let user = employee.user;
  if (!user) {
    user = await prisma.user.create({
      data: {
        orgId: employee.orgId,
        role: "EMPLOYEE",
        employeeId: employee.id,
        phone: e164,
        phoneVerifiedAt: now,
      },
    });
  } else if (!user.phoneVerifiedAt) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { phone: e164, phoneVerifiedAt: now },
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
    email: user.email,
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

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`otp-link:${session.userId}`, 5, 15 * 60 * 1000)) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  const existing = await prisma.user.findUnique({ where: { phone: e164 } });
  if (existing && existing.id !== session.userId) {
    return { error: "Ce numéro est déjà utilisé par un autre compte." };
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

  if (!checkRateLimit(`otp-verify:${session.userId}`, 8, 15 * 60 * 1000)) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const check = await checkOtp(e164, code);
  if (!check.approved) return { error: check.error };

  await prisma.user.update({
    where: { id: session.userId },
    data: { phone: e164, phoneVerifiedAt: new Date() },
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

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`otp-login:${ip}:${e164}`, 5, 15 * 60 * 1000)) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  const user = await prisma.user.findFirst({
    where: { phone: e164, phoneVerifiedAt: { not: null }, role: { in: ["ADMIN", "RESPONSABLE"] } },
  });
  if (!user) {
    return { error: "Aucun compte administrateur/responsable n'est associé à ce numéro." };
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

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`otp-verify:${ip}:${e164}`, 8, 15 * 60 * 1000)) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const user = await prisma.user.findFirst({
    where: { phone: e164, phoneVerifiedAt: { not: null }, role: { in: ["ADMIN", "RESPONSABLE"] } },
  });
  if (!user) return { error: "Aucun compte n'est associé à ce numéro." };

  const check = await checkOtp(e164, code);
  if (!check.approved) return { error: check.error };

  await createSession({
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    email: user.email,
    employeeId: user.employeeId,
  });

  redirect("/dashboard");
}
