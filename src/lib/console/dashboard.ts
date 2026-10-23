import { prisma } from "@/lib/prisma";
import { ALERTS } from "@/lib/console/config";
import { EXPECTED_MAX_AGE_HOURS } from "@/lib/console/heartbeat";

export type Period = "today" | "7" | "30";

export function periodStart(period: Period, now = new Date()): Date {
  const d = new Date(now);
  if (period === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setDate(d.getDate() - Number(period));
  return d;
}

export async function getDashboard(period: Period) {
  const now = new Date();
  const from = periodStart(period, now);
  const sevenDaysAgo = periodStart("7", now);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [usersCreated, employeesCreated, punches, companiesTotal, activeCompanyIds, employeesTotal, activeEmployeeIds, unresolvedErrors, otpFailures24h, heartbeats, recentCompanies, activeEmployeeCompanies, dailyPunches] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: from } } }),
    prisma.employee.count({ where: { createdAt: { gte: from } } }),
    prisma.attendance.count({ where: { timestamp: { gte: from } } }),
    prisma.organization.count({ where: { isDemo: false } }),
    prisma.attendance.findMany({ where: { timestamp: { gte: sevenDaysAgo } }, distinct: ["orgId"], select: { orgId: true } }),
    prisma.employee.count({ where: { status: "ACTIF" } }),
    prisma.attendance.findMany({ where: { timestamp: { gte: sevenDaysAgo } }, distinct: ["employeeId"], select: { employeeId: true } }),
    prisma.errorLog.count({ where: { status: "OPEN" } }),
    prisma.errorLog.count({ where: { source: { in: ["otp_email", "otp_whatsapp"] }, createdAt: { gte: dayAgo } } }),
    prisma.systemHeartbeat.findMany(),
    prisma.organization.findMany({ where: { createdAt: { gte: from }, isDemo: false }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, createdAt: true } }),
    prisma.employee.findMany({ where: { status: "ACTIF" }, distinct: ["orgId"], select: { orgId: true } }),
    prisma.attendance.findMany({ where: { timestamp: { gte: from } }, select: { timestamp: true } }),
  ]);

  // Entreprises avec des employés actifs mais sans pointage depuis 7 jours.
  const activeOrgSet = new Set(activeCompanyIds.map((a) => a.orgId));
  const idleCompanies = activeEmployeeCompanies.filter((e) => !activeOrgSet.has(e.orgId)).length;

  // Pointages par jour (graphique).
  const days = period === "today" ? 1 : Number(period);
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const p of dailyPunches) {
    const key = p.timestamp.toISOString().slice(0, 10);
    if (key in buckets) buckets[key] += 1;
  }

  const overdue = heartbeats.filter((h) => {
    const maxAge = EXPECTED_MAX_AGE_HOURS[h.jobName];
    if (!maxAge) return false;
    return now.getTime() - h.lastRunAt.getTime() > maxAge * 60 * 60 * 1000;
  });
  const failedJobs = heartbeats.filter((h) => h.lastStatus !== "ok");

  const alerts: { severity: "critical" | "warning"; text: string; href: string }[] = [];
  if (otpFailures24h >= ALERTS.otpFailuresPer24h) alerts.push({ severity: "critical", text: `${otpFailures24h} échecs d'envoi OTP sur 24 h`, href: "/console/erreurs" });
  for (const h of overdue) alerts.push({ severity: "critical", text: `Tâche « ${h.jobName} » en retard`, href: "/console/sante" });
  for (const h of failedJobs) alerts.push({ severity: "warning", text: `Dernière exécution en erreur : « ${h.jobName} »`, href: "/console/sante" });
  if (idleCompanies > 0) alerts.push({ severity: "warning", text: `${idleCompanies} entreprise(s) sans pointage depuis 7 jours`, href: "/console/entreprises" });
  if (unresolvedErrors >= ALERTS.unresolvedErrorsWarning) alerts.push({ severity: "warning", text: `${unresolvedErrors} erreur(s) non résolue(s)`, href: "/console/erreurs" });

  return {
    indicators: {
      accountsCreated: usersCreated + employeesCreated,
      activeCompanies: activeOrgSet.size,
      totalCompanies: companiesTotal,
      activeEmployees: activeEmployeeIds.length,
      totalEmployees: employeesTotal,
      punches,
      unresolvedErrors,
    },
    daily: Object.entries(buckets).map(([day, count]) => ({ day, count })),
    alerts,
    recentCompanies,
  };
}
