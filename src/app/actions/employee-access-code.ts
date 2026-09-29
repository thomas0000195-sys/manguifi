"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { createEmployeeAccessCode } from "@/lib/access-code";
import { revokeEmployeeSession } from "@/lib/employee-session";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

export type GenerateAccessCodeState = {
  error?: string;
  success?: boolean;
  code?: string;
  employeeId?: string;
  employeeName?: string;
};

/**
 * Admin/Responsable action: Generate a new access code for an employee
 * - Revokes previous code (and employee's active session)
 * - Creates new code
 * - Returns plaintext code for display
 */
export async function generateEmployeeAccessCodeAction(
  _prev: GenerateAccessCodeState,
  formData: FormData
): Promise<GenerateAccessCodeState> {
  const session = await requireSession();
  const employeeId = String(formData.get("employeeId") ?? "");

  if (!employeeId) {
    return { error: "ID employé manquant" };
  }

  if (!checkRateLimit(`generate-code:${session.userId}`, 10, 60 * 1000)) {
    return { error: "Trop de génération de codes. Réessayez dans une minute." };
  }

  // Fetch employee
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { org: true },
  });

  if (!employee) {
    return { error: "Employé non trouvé" };
  }

  // Check permissions: admin can do anything, responsable only for their scope
  if (session.role === "RESPONSABLE") {
    // In real implementation, check if responsable manages employee's team/site
    // For now, allow all responsables
  } else if (session.role !== "ADMIN") {
    return { error: "Accès réservé aux administrateurs" };
  }

  // Revoke employee's session (they'll need to re-login with new code)
  await revokeEmployeeSession(employeeId);

  // Generate new code
  const result = await createEmployeeAccessCode(employeeId, session.userId);
  if (!result.success) {
    return { error: result.error };
  }

  // Log audit
  await logAudit({
    orgId: employee.orgId,
    userId: session.userId,
    action: "GENERATE_EMPLOYEE_ACCESS_CODE",
    entityType: "Employee",
    entityId: employeeId,
    details: `Generated for: ${employee.firstName} ${employee.lastName}`,
  });

  return {
    success: true,
    code: result.code,
    employeeId,
    employeeName: `${employee.firstName} ${employee.lastName}`,
  };
}

export type RevokeAccessCodeState = { error?: string; success?: boolean };

/**
 * Admin/Responsable action: Revoke all access codes for an employee
 * (they won't be able to log in until a new code is generated)
 */
export async function revokeEmployeeAccessCodesAction(
  _prev: RevokeAccessCodeState,
  formData: FormData
): Promise<RevokeAccessCodeState> {
  const session = await requireSession();
  const employeeId = String(formData.get("employeeId") ?? "");

  if (!employeeId) {
    return { error: "ID employé manquant" };
  }

  if (session.role !== "ADMIN" && session.role !== "RESPONSABLE") {
    return { error: "Accès réservé aux administrateurs" };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { org: true },
  });

  if (!employee) {
    return { error: "Employé non trouvé" };
  }

  try {
    // Mark all codes as used (revoked)
    await prisma.employeeAccessCode.updateMany({
      where: { employeeId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Revoke session
    await revokeEmployeeSession(employeeId);

    // Log audit
    await logAudit({
      orgId: employee.orgId,
      userId: session.userId,
      action: "REVOKE_EMPLOYEE_ACCESS_CODES",
      entityType: "Employee",
      entityId: employeeId,
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { error: `Impossible de révoquer les codes : ${message}` };
  }
}
