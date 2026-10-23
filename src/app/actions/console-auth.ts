"use server";

import { prisma } from "@/lib/prisma";
import { encryptDataUrl, decryptDataUrl, hashEmail } from "@/lib/crypto";
import { sendEmailOtp, checkEmailOtp } from "@/lib/email-otp";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { clearPreAuth, readPreAuth, setConsoleSession, setPreAuth } from "@/lib/console/session";
import { checkTotp, newTotpSecret, totpQrDataUrl } from "@/lib/console/totp";
import { redirect } from "next/navigation";

export type ConsoleStep = { error?: string; step?: "code" | "totp" | "enroll"; email?: string; qr?: string; secret?: string };

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const GENERIC = "Code invalide ou expiré.";

function normalize(raw: FormDataEntryValue | null) {
  return String(raw ?? "").trim().toLowerCase();
}

/** Étape 1 : envoi du code e-mail. Réponse identique que le compte existe ou non. */
export async function requestConsoleCodeAction(_prev: ConsoleStep, formData: FormData): Promise<ConsoleStep> {
  const email = normalize(formData.get("email"));
  if (!email.includes("@")) return { error: "Adresse e-mail invalide." };

  if (!(await checkRateLimit("console-login", email, { limit: 5, windowMs: FIFTEEN_MINUTES, ipLimit: 5 }))) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const user = await prisma.user.findUnique({ where: { emailHash: hashEmail(email) } });
  if (user && user.role === "SUPER_ADMIN") {
    const sent = await sendEmailOtp(email);
    if (!sent.sent) return { error: sent.error };
  }
  return { step: "code", email };
}

/** Étape 2 : code e-mail. Ouvre l'étape TOTP (enrôlement la première fois). */
export async function verifyConsoleCodeAction(_prev: ConsoleStep, formData: FormData): Promise<ConsoleStep> {
  const email = normalize(formData.get("email"));
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { error: "Saisissez le code à 6 chiffres.", step: "code", email };

  if (!(await checkRateLimit("console-login", email, { limit: 5, windowMs: FIFTEEN_MINUTES, ipLimit: 5 }))) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes.", step: "code", email };
  }

  const user = await prisma.user.findUnique({ where: { emailHash: hashEmail(email) } });
  if (!user || user.role !== "SUPER_ADMIN") return { error: GENERIC, step: "code", email };

  const check = await checkEmailOtp(email, code);
  if (!check.approved) return { error: check.error, step: "code", email };

  await setPreAuth(user.id);

  // Second facteur désactivable uniquement par une variable d'environnement explicite.
  // Par défaut il reste obligatoire. À ne jamais mettre en production.
  if (process.env.CONSOLE_TOTP_REQUIRED === "false") {
    await clearPreAuth();
    await setConsoleSession(user.id);
    await logAudit({
      orgId: user.orgId,
      userId: user.id,
      action: "console.login",
      entityType: "User",
      entityId: user.id,
      details: "second facteur désactivé par configuration",
    });
    redirect("/console");
  }

  if (user.totpEnabledAt && user.totpSecret) {
    return { step: "totp", email };
  }

  // Premier accès : on crée le secret TOTP, affiché une seule fois pour l'application d'authentification.
  const secret = newTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: encryptDataUrl(secret) } });
  return { step: "enroll", email, secret, qr: await totpQrDataUrl(secret, email) };
}

/** Étape 3 : code TOTP. Ouvre la session console si le code est bon. */
export async function verifyConsoleTotpAction(_prev: ConsoleStep, formData: FormData): Promise<ConsoleStep> {
  const token = String(formData.get("totp") ?? "").trim();
  const userId = await readPreAuth();
  if (!userId) return { error: "Session expirée. Recommencez la connexion.", step: "code" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "SUPER_ADMIN" || !user.totpSecret) {
    return { error: GENERIC, step: "code" };
  }

  const secret = decryptDataUrl(user.totpSecret);
  if (!(await checkTotp(secret, token))) {
    await logAudit({
      orgId: user.orgId,
      userId: user.id,
      action: "console.login_failed",
      entityType: "User",
      entityId: user.id,
      details: "code TOTP invalide",
    });
    return { error: "Code invalide.", step: user.totpEnabledAt ? "totp" : "enroll" };
  }

  if (!user.totpEnabledAt) {
    await prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } });
  }

  await clearPreAuth();
  await setConsoleSession(user.id);
  await logAudit({
    orgId: user.orgId,
    userId: user.id,
    action: "console.login",
    entityType: "User",
    entityId: user.id,
  });

  redirect("/console");
}
