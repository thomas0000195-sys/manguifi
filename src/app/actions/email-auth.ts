"use server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { encryptDataUrl, hashEmail } from "@/lib/crypto";
import { sendEmailOtp, checkEmailOtp } from "@/lib/email-otp";
import { checkRateLimit } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type EmailOtpRequestState = { error?: string; submitted?: boolean; email?: string };
export type EmailOtpVerifyState = { error?: string };

/**
 * Email equivalent of requestEmployeeOtpAction (whatsapp-auth.ts) — used
 * only for employees whose organization has Organization.authChannel set
 * to EMAIL (pilot / pre-Meta-approval testing). Same generic rejection
 * message as the WhatsApp path, for the same anti-enumeration reason.
 */
export async function requestEmployeeEmailOtpAction(
  _prev: EmailOtpRequestState,
  formData: FormData
): Promise<EmailOtpRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) return { error: "Adresse email invalide." };

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`email-otp-request:${ip}:${email}`, 5, 15 * 60 * 1000)) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  const employee = await prisma.employee.findFirst({
    where: { emailHash: hashEmail(email), status: "ACTIF" },
    include: { org: true },
  });

  if (!employee || employee.org.authChannel !== "EMAIL") {
    return {
      error: "Cet email n'est associé à aucune entreprise. Contactez votre responsable pour être ajouté.",
    };
  }

  const result = await sendEmailOtp(email);
  if (!result.sent) return { error: result.error };

  return { submitted: true, email };
}

export async function verifyEmployeeEmailOtpAction(
  _prev: EmailOtpVerifyState,
  formData: FormData
): Promise<EmailOtpVerifyState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !code) return { error: "Code requis." };

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`email-otp-verify:${ip}:${email}`, 8, 15 * 60 * 1000)) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const employee = await prisma.employee.findFirst({
    where: { emailHash: hashEmail(email), status: "ACTIF" },
    include: { user: true, org: true },
  });
  if (!employee || employee.org.authChannel !== "EMAIL") {
    return { error: "Cet email n'est associé à aucune entreprise. Contactez votre responsable pour être ajouté." };
  }

  const check = await checkEmailOtp(email, code);
  if (!check.approved) return { error: check.error };

  const now = new Date();
  let user = employee.user;
  if (!user) {
    user = await prisma.user.create({
      data: {
        orgId: employee.orgId,
        role: "EMPLOYEE",
        employeeId: employee.id,
        email: encryptDataUrl(email),
        emailHash: hashEmail(email),
      },
    });
  }

  if (employee.invitationStatus !== "ACTIVE") {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { invitationStatus: "ACTIVE" },
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
