import { prisma } from "@/lib/prisma";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";
export type ErrorSource = "api" | "client" | "cron" | "otp_email" | "otp_whatsapp" | "pointage";

const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g;
const PHONE = /\+?\d[\d\s]{7,}\d/g;
const LONG_SECRET = /[A-Za-z0-9_\-]{32,}/g;
const SIX_DIGITS = /\b\d{6}\b/g;

/**
 * Nettoie un message avant écriture : pas d'e-mail, de téléphone, de jeton
 * ou de code à 6 chiffres. Le journal ne doit jamais contenir de secret.
 */
export function scrubErrorText(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(LONG_SECRET, "[secret]")
    .replace(PHONE, "[téléphone]")
    .replace(SIX_DIGITS, "[code]")
    .slice(0, 1000);
}

/** Enregistre une erreur. N'échoue jamais : une erreur de journalisation ne doit pas en causer une autre. */
export async function logError(input: {
  severity: ErrorSeverity;
  source: ErrorSource;
  message: string;
  route?: string;
  stack?: string;
  companyId?: string | null;
  userId?: string | null;
}) {
  try {
    await prisma.errorLog.create({
      data: {
        severity: input.severity,
        source: input.source,
        message: scrubErrorText(input.message),
        route: input.route?.slice(0, 200) ?? null,
        stack: input.stack ? scrubErrorText(input.stack).slice(0, 2000) : null,
        companyId: input.companyId ?? null,
        userId: input.userId ?? null,
      },
    });
  } catch {
    console.error("Journal d'erreurs indisponible.");
  }
}
