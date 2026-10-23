"use server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireConsoleUser } from "@/lib/console/guard";
import { revalidatePath } from "next/cache";

export type ConsoleActionState = { error?: string; success?: boolean };

/** Suspension d'entreprise : saisie du nom exact requise. Données conservées. */
export async function suspendCompanyAction(_prev: ConsoleActionState, formData: FormData): Promise<ConsoleActionState> {
  const admin = await requireConsoleUser();
  const orgId = String(formData.get("orgId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, suspendedAt: true } });
  if (!org) return { error: "Entreprise introuvable." };
  if (confirmation !== org.name) return { error: "Le nom saisi ne correspond pas à celui de l'entreprise." };
  if (org.suspendedAt) return { error: "Cette entreprise est déjà suspendue." };

  await prisma.organization.update({ where: { id: org.id }, data: { suspendedAt: new Date() } });
  await logAudit({ orgId: org.id, userId: admin.id, action: "console.company_suspended", entityType: "Organization", entityId: org.id });
  revalidatePath(`/console/entreprises/${org.id}`);
  return { success: true };
}

export async function reactivateCompanyAction(_prev: ConsoleActionState, formData: FormData): Promise<ConsoleActionState> {
  const admin = await requireConsoleUser();
  const orgId = String(formData.get("orgId") ?? "");
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, suspendedAt: true } });
  if (!org) return { error: "Entreprise introuvable." };
  if (!org.suspendedAt) return { error: "Cette entreprise n'est pas suspendue." };

  await prisma.organization.update({ where: { id: org.id }, data: { suspendedAt: null } });
  await logAudit({ orgId: org.id, userId: admin.id, action: "console.company_reactivated", entityType: "Organization", entityId: org.id });
  revalidatePath(`/console/entreprises/${org.id}`);
  return { success: true };
}

/** Blocage d'un compte : aucune session utilisable tant qu'il est bloqué. */
export async function setUserBlockedAction(_prev: ConsoleActionState, formData: FormData): Promise<ConsoleActionState> {
  const admin = await requireConsoleUser();
  const userId = String(formData.get("userId") ?? "");
  const block = String(formData.get("block") ?? "") === "true";
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, orgId: true, role: true } });
  if (!target) return { error: "Compte introuvable." };
  if (target.role === "SUPER_ADMIN") return { error: "Le compte super admin ne peut pas être bloqué depuis la console." };

  await prisma.user.update({ where: { id: target.id }, data: { blockedAt: block ? new Date() : null } });
  await logAudit({
    orgId: target.orgId,
    userId: admin.id,
    action: block ? "console.user_blocked" : "console.user_unblocked",
    entityType: "User",
    entityId: target.id,
  });
  revalidatePath("/console/utilisateurs");
  return { success: true };
}

export async function resolveErrorAction(_prev: ConsoleActionState, formData: FormData): Promise<ConsoleActionState> {
  const admin = await requireConsoleUser();
  const id = String(formData.get("errorId") ?? "");
  const row = await prisma.errorLog.findUnique({ where: { id }, select: { id: true, status: true, companyId: true } });
  if (!row) return { error: "Erreur introuvable." };
  if (row.status === "RESOLVED") return { success: true };

  await prisma.errorLog.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: admin.id } });
  await logAudit({
    orgId: admin.orgId,
    userId: admin.id,
    action: "console.error_resolved",
    entityType: "ErrorLog",
    entityId: id,
  });
  revalidatePath("/console/erreurs");
  return { success: true };
}
