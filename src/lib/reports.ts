import { prisma } from "./prisma";
import { computeDailyStatus, isDateJustified, startOfDay } from "./attendance-logic";
import type { Employee } from "@prisma/client";

export type EmployeeReportRow = {
  employee: Employee & { team: { name: string; site: { name: string } } };
  joursPresence: number;
  retards: number;
  absencesJustifieesPayees: number;
  absencesJustifieesNonPayees: number;
  absencesNonJustifieesEnAttente: number;
  absencesNonJustifieesDefinitives: number;
  minutesNormales: number;
  minutesSupValidees: number;
  minutesSupEnAttente: number;
};

export async function getReportData(
  orgId: string,
  scopedTeamIds: string[] | null,
  from: Date,
  to: Date
): Promise<EmployeeReportRow[]> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { justificationDelayDays: true },
  });
  const delayDays = org?.justificationDelayDays ?? 3;
  const now = new Date();

  const employees = await prisma.employee.findMany({
    where: {
      orgId,
      ...(scopedTeamIds ? { teamId: { in: scopedTeamIds } } : {}),
    },
    include: { team: { include: { site: true } } },
  });

  const rows: EmployeeReportRow[] = [];

  for (const emp of employees) {
    let joursPresence = 0;
    let retards = 0;
    let absencesJustifieesPayees = 0;
    let absencesJustifieesNonPayees = 0;
    let absencesNonJustifieesEnAttente = 0;
    let absencesNonJustifieesDefinitives = 0;
    let minutesNormales = 0;

    const cursor = new Date(from);
    while (cursor <= to) {
      const status = await computeDailyStatus(emp, cursor);
      if (status.scheduled) {
        if (status.status === "ABSENT_NON_JUSTIFIE") {
          const j = await isDateJustified(emp.id, cursor);
          if (j?.payType === "PAYE") absencesJustifieesPayees++;
          else if (j) absencesJustifieesNonPayees++;
          else {
            const daysSince = (now.getTime() - cursor.getTime()) / 86400000;
            if (daysSince > delayDays) absencesNonJustifieesDefinitives++;
            else absencesNonJustifieesEnAttente++;
          }
        } else if (status.status !== "NON_PLANIFIE") {
          joursPresence++;
          if (status.status === "RETARD") retards++;
          minutesNormales += Math.min(
            status.workedMinutes,
            status.workedMinutes - status.overtimeMinutes
          );
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const overtimes = await prisma.overtimeRecord.findMany({
      where: {
        employeeId: emp.id,
        date: { gte: startOfDay(from), lte: startOfDay(to) },
      },
    });
    const minutesSupValidees = overtimes
      .filter((o) => o.status === "VALIDEE" || o.status === "PLANIFIEE_A_L_AVANCE")
      .reduce((s, o) => s + o.overtimeMinutes, 0);
    const minutesSupEnAttente = overtimes
      .filter((o) => o.status === "NON_PLANIFIEE")
      .reduce((s, o) => s + o.overtimeMinutes, 0);

    rows.push({
      employee: emp,
      joursPresence,
      retards,
      absencesJustifieesPayees,
      absencesJustifieesNonPayees,
      absencesNonJustifieesEnAttente,
      absencesNonJustifieesDefinitives,
      minutesNormales,
      minutesSupValidees,
      minutesSupEnAttente,
    });
  }

  return rows;
}

/** Every pointage still flagged for review (low confidence, outside the allowed window...). */
export async function getUnresolvedAnomalies(orgId: string, scopedTeamIds: string[] | null) {
  const employees = await prisma.employee.findMany({
    where: { orgId, ...(scopedTeamIds ? { teamId: { in: scopedTeamIds } } : {}) },
    select: { id: true },
  });
  const employeeIds = employees.map((e) => e.id);

  return prisma.attendance.findMany({
    where: { orgId, employeeId: { in: employeeIds }, isAnomaly: true },
    include: { employee: { include: { team: true } } },
    orderBy: { timestamp: "desc" },
    take: 100,
  });
}
