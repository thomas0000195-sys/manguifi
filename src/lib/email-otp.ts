import crypto from "node:crypto";
import { prisma } from "./prisma";
import { sendEmployeeOtpEmail } from "./email";
import { hashEmail } from "./crypto";

const CODE_LENGTH = 6;
const EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  const max = 10 ** CODE_LENGTH;
  return crypto.randomInt(0, max).toString().padStart(CODE_LENGTH, "0");
}

export type SendEmailOtpResult = { sent: true } | { sent: false; error: string };

/**
 * Email equivalent of Twilio's sendOtp — generates a 6-digit code, stores
 * only its hash (same pattern as PasswordResetToken), and emails it via
 * Resend. Any previous pending codes for this email are left alone (they
 * simply expire); we don't need Twilio's single-active-verification
 * behavior since our own verify step already checks attempts + expiry.
 */
export async function sendEmailOtp(email: string): Promise<SendEmailOtpResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, error: "L'envoi de code par email n'est pas configuré." };
  }

  const code = generateCode();
  await prisma.emailOtpCode.create({
    data: {
      emailHash: hashEmail(email),
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + EXPIRY_MS),
    },
  });

  const delivered = await sendEmployeeOtpEmail(email, code);
  if (!delivered) {
    return { sent: false, error: "Impossible d'envoyer le code pour le moment. Réessayez dans un instant." };
  }
  return { sent: true };
}

export type CheckEmailOtpResult = { approved: true } | { approved: false; error: string };

export async function checkEmailOtp(email: string, code: string): Promise<CheckEmailOtpResult> {
  const emailHash = hashEmail(email);

  const pending = await prisma.emailOtpCode.findFirst({
    where: { emailHash, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) {
    return { approved: false, error: "Code invalide ou expiré." };
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    return { approved: false, error: "Trop de tentatives pour ce code. Demandez-en un nouveau." };
  }

  if (pending.codeHash !== hashCode(code)) {
    await prisma.emailOtpCode.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    return { approved: false, error: "Code invalide ou expiré." };
  }

  await prisma.emailOtpCode.update({
    where: { id: pending.id },
    data: { consumedAt: new Date() },
  });
  return { approved: true };
}
