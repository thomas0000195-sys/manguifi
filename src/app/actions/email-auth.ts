"use server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { encryptDataUrl, hashEmail } from "@/lib/crypto";
import { sendEmailOtp, checkEmailOtp } from "@/lib/email-otp";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";

export type EmailOtpRequestState = { error?: string; submitted?: boolean; email?: string };
export type EmailOtpVerifyState = { error?: string };

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const INVALID_CODE = "Code invalide ou expiré.";
const TOO_MANY_ATTEMPTS = "Trop de tentatives. Réessayez dans quelques minutes.";

function normalizeEmail(raw: FormDataEntryValue | null): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  return email.includes("@") && email.length <= 254 ? email : null;
}

/**
 * Étape 1 de la connexion employé par email. Le matricule n'est plus une
 * preuve d'identité : seul un code envoyé à l'adresse enregistrée permet
 * d'ouvrir une session.
 *
 * Anti-énumération : si l'email n'appartient à aucun employé actif, aucun
 * code n'est envoyé mais la réponse est identique à un envoi réussi, donc
 * l'interface ne révèle pas quels emails sont enregistrés.
 */
export async function requestEmployeeEmailOtpAction(
  _prev: EmailOtpRequestState,
  formData: FormData
): Promise<EmailOtpRequestState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { error: "Adresse email invalide." };

  const emailHash = hashEmail(email);
  if (!(await checkRateLimit("email-otp-request", email, { limit: 5, windowMs: FIFTEEN_MINUTES, ipLimit: 30 }))) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  const employee = await prisma.employee.findFirst({
    where: { emailHash, status: "ACTIF" },
    select: { id: true },
  });

  if (employee) {
    const result = await sendEmailOtp(email);
    if (!result.sent) return { error: result.error };
  }

  return { submitted: true, email };
}

/**
 * Étape 2 : vérifie le code et ouvre la session employé. Toute erreur
 * (email inconnu, code faux, expiré ou déjà utilisé) renvoie le même message.
 */
export async function verifyEmployeeEmailOtpAction(
  _prev: EmailOtpVerifyState,
  formData: FormData
): Promise<EmailOtpVerifyState> {
  const email = normalizeEmail(formData.get("email"));
  const code = String(formData.get("code") ?? "").trim();
  if (!email) return { error: INVALID_CODE };
  if (!/^\d{6}$/.test(code)) return { error: "Saisissez le code à 6 chiffres." };

  const emailHash = hashEmail(email);
  if (!(await checkRateLimit("email-otp-verify", email, { limit: 8, windowMs: FIFTEEN_MINUTES, ipLimit: 60 }))) {
    return { error: TOO_MANY_ATTEMPTS };
  }

  const employee = await prisma.employee.findFirst({
    where: { emailHash, status: "ACTIF" },
    include: { user: true },
  });
  if (!employee) return { error: INVALID_CODE };

  const check = await checkEmailOtp(email, code);
  if (!check.approved) return { error: check.error };

  let user = employee.user;
  if (!user) {
    const emailTaken = await prisma.user.findUnique({ where: { emailHash } });
    if (emailTaken) {
      return { error: "Connexion impossible avec cet email. Contactez votre responsable." };
    }
    user = await prisma.user.create({
      data: {
        orgId: employee.orgId,
        role: "EMPLOYEE",
        employeeId: employee.id,
        email: encryptDataUrl(email),
        emailHash,
      },
    });
  }

  if (employee.invitationStatus !== "ACTIVE") {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { invitationStatus: "ACTIVE" },
    });
  }

  await logAudit({
    orgId: user.orgId,
    userId: user.id,
    action: "EMPLOYEE_LOGIN_EMAIL_OTP",
    entityType: "Employee",
    entityId: employee.id,
  });

  await createSession({
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    email,
    employeeId: employee.id,
  });

  redirect("/espace");
}
