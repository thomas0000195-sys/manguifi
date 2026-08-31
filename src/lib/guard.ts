import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "./auth";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

export async function requireUser(allowedRoles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion-employe");
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect(user.role === "EMPLOYEE" ? "/espace" : "/dashboard");
  }
  return user;
}

/**
 * Returns the team ids a RESPONSABLE is allowed to see, or null for ADMIN
 * (meaning "no restriction, whole org"). Centralized here so every scope
 * check (pages + server actions) uses the exact same rule.
 */
export async function getScopedTeamIds(
  orgId: string,
  role: Role,
  userId: string
): Promise<string[] | null> {
  if (role === "ADMIN") return null;
  const [teamLinks, siteLinks] = await Promise.all([
    prisma.responsableTeam.findMany({ where: { userId } }),
    prisma.responsableSite.findMany({ where: { userId } }),
  ]);
  const teamIds = new Set(teamLinks.map((l) => l.teamId));
  if (siteLinks.length > 0) {
    const siteTeams = await prisma.team.findMany({
      where: { siteId: { in: siteLinks.map((l) => l.siteId) } },
      select: { id: true },
    });
    siteTeams.forEach((t) => teamIds.add(t.id));
  }
  return Array.from(teamIds);
}

/**
 * Guards against IDOR: ensures the current ADMIN/RESPONSABLE session can
 * actually see this employee (same org, and — for RESPONSABLE — team is in
 * their assigned scope). Call from any page/action keyed by employeeId.
 * Throws Next's notFound() rather than leaking existence via a 403.
 */
export async function assertEmployeeInScope(
  user: { orgId: string; role: Role; id: string },
  employeeId: string
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, orgId: user.orgId },
  });
  if (!employee) notFound();

  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);
  if (scopedTeamIds && !scopedTeamIds.includes(employee.teamId)) notFound();

  return employee;
}

/** Same idea, for a justificatif — resolved through its employee's team. */
export async function assertJustificatifInScope(
  user: { orgId: string; role: Role; id: string },
  justificatifId: string
) {
  const justificatif = await prisma.justificatif.findFirst({
    where: { id: justificatifId, orgId: user.orgId },
    include: { employee: { include: { team: true } }, reviewedBy: true },
  });
  if (!justificatif) notFound();

  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);
  if (scopedTeamIds && !scopedTeamIds.includes(justificatif.employee.teamId)) notFound();

  return justificatif;
}

/** Same idea, for an attendance (pointage) record. */
export async function assertAttendanceInScope(
  user: { orgId: string; role: Role; id: string },
  attendanceId: string
) {
  const attendance = await prisma.attendance.findFirst({
    where: { id: attendanceId, orgId: user.orgId },
    include: { employee: { include: { team: true } } },
  });
  if (!attendance) return null;

  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);
  if (scopedTeamIds && !scopedTeamIds.includes(attendance.employee.teamId)) return null;

  return attendance;
}

/** Same idea, for an overtime record. */
export async function assertOvertimeInScope(
  user: { orgId: string; role: Role; id: string },
  overtimeId: string
) {
  const record = await prisma.overtimeRecord.findFirst({
    where: { id: overtimeId, orgId: user.orgId },
    include: { employee: true },
  });
  if (!record) return null;

  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);
  if (scopedTeamIds && !scopedTeamIds.includes(record.employee.teamId)) return null;

  return record;
}
