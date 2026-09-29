import { prisma } from "./prisma";
import { computeDailyStatus, startOfDay, isDateJustified } from "./attendance-logic";

export { getScopedTeamIds } from "./guard";

export async function getDashboardData(
  orgId: string,
  scopedTeamIds: string[] | null
) {
  const employees = await prisma.employee.findMany({
    where: {
      orgId,
      status: "ACTIF",
      ...(scopedTeamIds ? { teamId: { in: scopedTeamIds } } : {}),
    },
    include: { team: { include: { site: true } } },
  });

  const today = new Date();
  const statuses = await Promise.all(
    employees.map(async (emp) => {
      const status = await computeDailyStatus(emp, today);
      let justified = false;
      if (status.status === "ABSENT_NON_JUSTIFIE") {
        const j = await isDateJustified(emp.id, today);
        if (j) justified = true;
      }
      return { ...status, justified };
    })
  );

  const present = statuses.filter((s) =>
    ["PRESENT", "RETARD", "DEPART_ANTICIPE", "OUBLI_DEPART"].includes(s.status)
  ).length;
  const absentNonJustifie = statuses.filter(
    (s) => s.status === "ABSENT_NON_JUSTIFIE" && !s.justified
  ).length;
  const absentJustifie = statuses.filter(
    (s) => s.status === "ABSENT_NON_JUSTIFIE" && s.justified
  ).length;
  const retards = statuses.filter((s) => s.status === "RETARD").length;
  const oublisDepart = statuses.filter((s) => s.status === "OUBLI_DEPART").length;
  const totalWorkedMinutes = statuses.reduce((sum, s) => sum + s.workedMinutes, 0);

  const employeeIds = employees.map((e) => e.id);

  const pendingJustificatifs = await prisma.justificatif.count({
    where: { orgId, status: "EN_ATTENTE", employeeId: { in: employeeIds } },
  });

  const anomalousAttendances = await prisma.attendance.findMany({
    where: {
      orgId,
      employeeId: { in: employeeIds },
      isAnomaly: true,
      timestamp: { gte: startOfDay(today) },
    },
    include: { employee: true },
  });

  const recentAttendances = await prisma.attendance.findMany({
    where: { orgId, employeeId: { in: employeeIds } },
    include: { employee: { include: { team: true } } },
    orderBy: { timestamp: "desc" },
    take: 12,
  });

  const pendingOvertimes = await prisma.overtimeRecord.count({
    where: {
      orgId,
      employeeId: { in: employeeIds },
      status: "NON_PLANIFIEE",
    },
  });

  const weekTrend: { day: string; ponctualite: number; absenteisme: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStatuses = await Promise.all(
      employees.map((emp) => computeDailyStatus(emp, d))
    );
    const scheduled = dStatuses.filter((s) => s.scheduled && s.status !== "NON_PLANIFIE");
    const onTime = scheduled.filter((s) => s.status === "PRESENT").length;
    const absent = scheduled.filter((s) => s.status === "ABSENT_NON_JUSTIFIE").length;
    weekTrend.push({
      day: d.toLocaleDateString("fr-FR", { weekday: "short" }),
      ponctualite: scheduled.length ? Math.round((onTime / scheduled.length) * 100) : 0,
      absenteisme: scheduled.length ? Math.round((absent / scheduled.length) * 100) : 0,
    });
  }

  return {
    totalEmployees: employees.length,
    present,
    absentNonJustifie,
    absentJustifie,
    retards,
    oublisDepart,
    totalWorkedMinutes,
    pendingJustificatifs,
    anomalousAttendances,
    recentAttendances,
    pendingOvertimes,
    weekTrend,
  };
}
