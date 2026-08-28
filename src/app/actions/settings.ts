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
  const retentionEnabled = formData.get("attendanceRetentionEnabled") === "on";
  const attendanceRetentionMonthsRaw = Number(formData.get("attendanceRetentionMonths") || 24);
  const attendanceRetentionMonths =
    retentionEnabled && attendanceRetentionMonthsRaw >= 1 ? Math.floor(attendanceRetentionMonthsRaw) : null;
  const authChannel = formData.get("authChannel") === "EMAIL" ? "EMAIL" : "WHATSAPP";

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
      attendanceRetentionMonths,
      authChannel,
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
        phone: e.phone ? decryptDataUrl(e.phone) : null,
        email: e.email ? decryptDataUrl(e.email) : null,
        photoUrl: e.photoUrl ? decryptDataUrl(e.photoUrl) : null,
        dateOfBirth: e.dateOfBirth ? decryptDataUrl(e.dateOfBirth) : null,
        idNumber: e.idNumber ? decryptDataUrl(e.idNumber) : null,
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
async function buildEmployeeDataExport(employee: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  dateOfBirth: string | null;
  idNumber: string | null;
  [key: string]: unknown;
}) {
  const employeeId = employee.id;
  const [attendances, justificatifs, overtimes] = await Promise.all([
    prisma.attendance.findMany({ where: { employeeId } }),
    prisma.justificatif.findMany({ where: { employeeId } }),
    prisma.overtimeRecord.findMany({ where: { employeeId } }),
  ]);

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      employee: {
        ...employee,
        phone: employee.phone ? decryptDataUrl(employee.phone) : null,
        email: employee.email ? decryptDataUrl(employee.email) : null,
        photoUrl: employee.photoUrl ? decryptDataUrl(employee.photoUrl) : null,
        dateOfBirth: employee.dateOfBirth ? decryptDataUrl(employee.dateOfBirth) : null,
        idNumber: employee.idNumber ? decryptDataUrl(employee.idNumber) : null,
      },
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

export async function exportEmployeeDataAction(employeeId: string) {
  const session = await requireSession();
  const { assertEmployeeInScope } = await import("@/lib/guard");
  const employee = await assertEmployeeInScope(
    { orgId: session.orgId, role: session.role, id: session.userId },
    employeeId
  );

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "EXPORT_EMPLOYEE_DATA",
    entityType: "Employee",
    entityId: employeeId,
    details: `${employee.firstName} ${employee.lastName}`,
  });

  return buildEmployeeDataExport(employee);
}

/**
 * RGPD self-service : un EMPLOYEE exporte SES PROPRES données depuis
 * /espace, sans passer par un admin. Pas de guard IDOR nécessaire au-delà
 * du rôle — session.employeeId identifie déjà sans ambiguïté "soi-même".
 */
export async function exportMyDataAction() {
  const session = await requireSession();
  if (session.role !== "EMPLOYEE" || !session.employeeId) {
    throw new Error("Réservé aux comptes employé.");
  }

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: session.employeeId } });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "EXPORT_MY_DATA",
    entityType: "Employee",
    entityId: employee.id,
  });

  return buildEmployeeDataExport(employee);
}

/**
 * RGPD self-service : un EMPLOYEE demande la suppression de ses données.
 * On ne supprime pas automatiquement — les pointages/heures sup ont une
 * valeur légale de paie que l'entreprise peut être tenue de conserver,
 * donc la décision finale (et son délai) reste à l'admin. Ceci se contente
 * de tracer la demande dans le journal d'audit, visible par l'admin, pour
 * qu'il puisse y répondre en connaissance de cause.
 */
export async function requestDataDeletionAction() {
  const session = await requireSession();
  if (session.role !== "EMPLOYEE" || !session.employeeId) {
    throw new Error("Réservé aux comptes employé.");
  }

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: session.employeeId } });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "REQUEST_DATA_DELETION",
    entityType: "Employee",
    entityId: employee.id,
    details: `${employee.firstName} ${employee.lastName} a demandé la suppression de ses données.`,
  });

  return { success: true };
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
