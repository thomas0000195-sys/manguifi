"use server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { decryptDataUrl, encryptDataUrl } from "@/lib/crypto";
import { hashPhone } from "@/lib/phone";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export type MatriculeLoginState = { error?: string; success?: boolean };

export async function matriculeLoginAction(
  _prev: MatriculeLoginState,
  formData: FormData
): Promise<MatriculeLoginState> {
  const matricule = String(formData.get("matricule") ?? "").trim().toUpperCase();
  if (!matricule) return { error: "Matricule requis." };

  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`matricule-login:${ip}:${matricule}`, 5, 15 * 60 * 1000)) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const employee = await prisma.employee.findFirst({
    where: { matricule, status: "ACTIF" },
    include: { org: true, user: true },
  });

  if (!employee) {
    return { error: "Matricule invalide ou employé inactif." };
  }

  const now = new Date();
  let user = employee.user;

  if (!user) {
    user = await prisma.user.create({
      data: {
        orgId: employee.orgId,
        role: "EMPLOYEE",
        employeeId: employee.id,
        phone: employee.phone ? encryptDataUrl(employee.phone) : null,
        phoneHash: employee.phoneHash,
        phoneVerifiedAt: now,
      },
    });
  }

  if (employee.invitationStatus !== "ACTIVE") {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { invitationStatus: "ACTIVE", phoneVerifiedAt: now },
    });
  }

  await logAudit({
    orgId: employee.orgId,
    userId: user.id,
    action: "EMPLOYEE_LOGIN_MATRICULE",
    entityType: "Employee",
    entityId: employee.id,
  });

  await createSession({
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    email: user.email ? decryptDataUrl(user.email) : null,
    employeeId: user.employeeId,
  });

  redirect("/espace");
}
