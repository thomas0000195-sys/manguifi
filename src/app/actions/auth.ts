"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  createPasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { encryptDataUrl, decryptDataUrl, hashEmail } from "@/lib/crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

const signupSchema = z.object({
  orgName: z.string().min(2, "Le nom de l'entreprise est requis"),
  fullName: z.string().min(2, "Votre nom est requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
});

export type ActionState = { error?: string; success?: boolean };

export async function signupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    orgName: formData.get("orgName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) {
    return { error: "Trop de créations de compte depuis cette adresse. Réessayez plus tard." };
  }

  const { orgName, email, password } = parsed.data;

  const emailHash = hashEmail(email);
  const existing = await prisma.user.findUnique({ where: { emailHash } });
  if (existing) {
    return { error: "Un compte existe déjà avec cet email." };
  }

  const org = await prisma.organization.create({
    data: { name: orgName },
  });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      orgId: org.id,
      email: encryptDataUrl(email),
      emailHash,
      passwordHash,
      role: "ADMIN",
    },
  });

  await createSession({
    userId: user.id,
    orgId: org.id,
    role: user.role,
    email,
    employeeId: null,
  });

  redirect("/onboarding");
}

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const { email, password } = parsed.data;

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`login:${ip}:${email}`, 8, 10 * 60 * 1000)) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const user = await prisma.user.findUnique({ where: { emailHash: hashEmail(email) } });

  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email ou mot de passe incorrect." };
  }

  await createSession({
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    email,
    employeeId: user.employeeId,
  });

  redirect(user.role === "EMPLOYEE" ? "/espace" : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/connexion");
}

export type ResetRequestState = {
  error?: string;
  devResetUrl?: string;
  submitted?: boolean;
  emailSent?: boolean;
};

const resetRequestSchema = z.object({ email: z.string().email("Email invalide") });

export async function requestPasswordResetAction(
  _prev: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Email invalide" };
  }

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`reset:${ip}`, 5, 15 * 60 * 1000)) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  const user = await prisma.user.findUnique({ where: { emailHash: hashEmail(parsed.data.email) } });

  // Always report success even if the email doesn't exist, so this endpoint
  // can't be used to enumerate registered accounts.
  if (!user || !user.email) return { submitted: true };
  const userEmail = decryptDataUrl(user.email);

  const token = await createPasswordResetToken(user.id);
  await logAudit({
    orgId: user.orgId,
    userId: user.id,
    action: "REQUEST_PASSWORD_RESET",
    entityType: "User",
    entityId: user.id,
  });

  const emailSent = await sendPasswordResetEmail(userEmail, token);

  if (emailSent) {
    return { submitted: true, emailSent: true };
  }

  // No email provider configured (or the send failed). In production we
  // never hand the working link back to whoever filled the form — that
  // would let anyone reset any account just by knowing its email. Locally,
  // showing it inline is what makes the flow testable without real email.
  if (process.env.NODE_ENV === "production") {
    console.error(
      `Password reset email could not be sent to ${userEmail} — RESEND_API_KEY missing or Resend call failed.`
    );
    return { submitted: true, emailSent: false };
  }

  return {
    submitted: true,
    emailSent: false,
    devResetUrl: `/reinitialiser-mot-de-passe?token=${token}`,
  };
}

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "8 caractères minimum"),
});

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const result = await consumePasswordResetToken(parsed.data.token);
  if ("error" in result) return { error: result.error };

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: result.user.id },
    data: { passwordHash },
  });

  await logAudit({
    orgId: result.user.orgId,
    userId: result.user.id,
    action: "RESET_PASSWORD",
    entityType: "User",
    entityId: result.user.id,
  });

  redirect("/connexion?reset=1");
}
