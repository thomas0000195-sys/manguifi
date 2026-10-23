import crypto from "node:crypto";
import { prisma } from "./prisma";
import { sendEmployeeOtpEmail } from "./email";
import { hashEmail } from "./crypto";
import { logError } from "./console/errors";

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
 * Resend. Any previously pending code for this email is consumed first, so
 * only the most recent code can ever be validated.
 */
export async function sendEmailOtp(email: string): Promise<SendEmailOtpResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, error: "L'envoi de code par email n'est pas configuré." };
  }

  const emailHash = hashEmail(email);
  const code = generateCode();
  await prisma.emailOtpCode.updateMany({
    where: { emailHash, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.emailOtpCode.create({
    data: {
      emailHash,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + EXPIRY_MS),
    },
  });

  const delivered = await sendEmployeeOtpEmail(email, code);
  if (!delivered) {
    await logError({ severity: "error", source: "otp_email", message: "Envoi du code de connexion par e-mail échoué" });
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

  if (!codeMatches(pending.codeHash, hashCode(code))) {
    await prisma.emailOtpCode.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 } },
    });
    return { approved: false, error: "Code invalide ou expiré." };
  }

  // Consommation conditionnelle : si deux requêtes valident le même code en
  // parallèle, une seule reçoit count = 1 et obtient la session.
  const consumed = await prisma.emailOtpCode.updateMany({
    where: { id: pending.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) {
    return { approved: false, error: "Code invalide ou expiré." };
  }
  return { approved: true };
}

function codeMatches(storedHash: string, candidateHash: string): boolean {
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(candidateHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
