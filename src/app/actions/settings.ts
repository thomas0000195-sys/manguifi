"use server";

import { prisma } from "@/lib/prisma";
import { requireSession, destroySession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { decryptDataUrl } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionState = { error?: string; success?: boolean };

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };

  const photoOnPunchEnabled = formData.get("photoOnPunchEnabled") === "on";
  const hapticFeedbackEnabled = formData.get("hapticFeedbackEnabled") === "on";
  const allowedTimeWindowEnabled = formData.get("allowedTimeWindowEnabled") === "on";
  const allowedTimeWindowStart = String(formData.get("allowedTimeWindowStart") || "");
  const allowedTimeWindowEnd = String(formData.get("allowedTimeWindowEnd") || "");
  const justificationDelayDays = Number(formData.get("justificationDelayDays") || 3);
  const matriculePrefix = String(formData.get("matriculePrefix") || "MGF").trim().toUpperCase() || "MGF";
  const idNumberEnabled = formData.get("idNumberEnabled") === "on";

  await prisma.organization.update({
    where: { id: session.orgId },
    data: {
      photoOnPunchEnabled,
      hapticFeedbackEnabled,
      allowedTimeWindowEnabled,
      allowedTimeWindowStart: allowedTimeWindowEnabled ? allowedTimeWindowStart : null,
      allowedTimeWindowEnd: allowedTimeWindowEnabled ? allowedTimeWindowEnd : null,
      justificationDelayDays,
      matriculePrefix,
      idNumberEnabled,
    },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "UPDATE_SETTINGS",
    entityType: "Organization",
    entityId: session.orgId,
  });

  revalidatePath("/parametres");
  return { success: true };
}

export async function exportOrgDataAction() {
  const session = await requireSession();
  if (session.role !== "ADMIN") throw new Error("Action réservée à l'administrateur.");

  const [org, sites, teams, employees, attendances, justificatifs, overtimes] =
    await Promise.all([
      prisma.organization.findUnique({ where: { id: session.orgId } }),
      prisma.site.findMany({ where: { orgId: session.orgId } }),
      prisma.team.findMany({ where: { orgId: session.orgId } }),
      prisma.employee.findMany({ where: { orgId: session.orgId } }),
      prisma.attendance.findMany({ where: { orgId: session.orgId } }),
      prisma.justificatif.findMany({ where: { orgId: session.orgId } }),
      prisma.overtimeRecord.findMany({ where: { orgId: session.orgId } }),
    ]);

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "EXPORT_ORG_DATA",
    entityType: "Organization",
    entityId: session.orgId,
  });

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      org,
      sites,
      teams,
      employees: employees.map((e) => ({
        ...e,
        photoUrl: e.photoUrl ? decryptDataUrl(e.photoUrl) : null,
      })),
      attendances: attendances.map((a) => ({
        ...a,
        photoDataUrl: a.photoDataUrl ? decryptDataUrl(a.photoDataUrl) : null,
      })),
      justificatifs: justificatifs.map((j) => ({
        ...j,
        documentDataUrl: decryptDataUrl(j.documentDataUrl),
      })),
      overtimes,
    },
    null,
    2
  );
}

/**
 * RGPD — droit à la portabilité des données pour un employé précis (par
 * opposition à exportOrgDataAction qui exporte tout). Accessible à
 * ADMIN/RESPONSABLE dans leur périmètre, pour répondre à une demande
 * d'un employé sans avoir à extraire toute l'organisation.
 */
export async function exportEmployeeDataAction(employeeId: string) {
  const session = await requireSession();
  const { assertEmployeeInScope } = await import("@/lib/guard");
  const employee = await assertEmployeeInScope(
    { orgId: session.orgId, role: session.role, id: session.userId },
    employeeId
  );

  const [attendances, justificatifs, overtimes] = await Promise.all([
    prisma.attendance.findMany({ where: { employeeId } }),
    prisma.justificatif.findMany({ where: { employeeId } }),
    prisma.overtimeRecord.findMany({ where: { employeeId } }),
  ]);

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "EXPORT_EMPLOYEE_DATA",
    entityType: "Employee",
    entityId: employeeId,
    details: `${employee.firstName} ${employee.lastName}`,
  });

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      employee: { ...employee, photoUrl: employee.photoUrl ? decryptDataUrl(employee.photoUrl) : null },
      attendances: attendances.map((a) => ({
        ...a,
        photoDataUrl: a.photoDataUrl ? decryptDataUrl(a.photoDataUrl) : null,
      })),
      justificatifs: justificatifs.map((j) => ({
        ...j,
        documentDataUrl: decryptDataUrl(j.documentDataUrl),
      })),
      overtimes,
    },
    null,
    2
  );
}

/**
 * Danger zone: permanently deletes the organization and every record tied
 * to it (cascades through Prisma's onDelete: Cascade). Admin-only, requires
 * typing the organization's exact name as confirmation.
 */
export async function deleteOrganizationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };

  const org = await prisma.organization.findUnique({ where: { id: session.orgId } });
  if (!org) return { error: "Organisation introuvable." };

  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== org.name) {
    return { error: "Le nom saisi ne correspond pas exactement au nom de l'organisation." };
  }

  await prisma.organization.delete({ where: { id: org.id } });
  await destroySession();
  redirect("/");
}
