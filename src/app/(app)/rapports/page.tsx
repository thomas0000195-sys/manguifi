import { requireUser, getScopedTeamIds } from "@/lib/guard";
import { getReportData, getUnresolvedAnomalies } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "@/lib/attendance-logic";
import { classifyOvertimeSeverity } from "@/lib/overtime-severity";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import RapportsClient from "./RapportsClient";
import AnomaliesPanel from "./AnomaliesPanel";

type View = "jour" | "semaine" | "mois";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function getBounds(view: View, dateStr?: string, monthStr?: string) {
  if (view === "jour") {
    const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
    return {
      from: startOfDay(d),
      to: endOfDay(d),
      anchor: d,
      label: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      prevAnchor: new Date(d.getTime() - 86400000),
      nextAnchor: new Date(d.getTime() + 86400000),
    };
  }
  if (view === "semaine") {
    const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      from: startOfDay(monday),
      to: endOfDay(sunday),
      anchor: monday,
      label: `Semaine du ${monday.toLocaleDateString("fr-FR")} au ${sunday.toLocaleDateString("fr-FR")}`,
      prevAnchor: new Date(monday.getTime() - 7 * 86400000),
      nextAnchor: new Date(monday.getTime() + 7 * 86400000),
    };
  }
  const now = new Date();
  const [y, m] = (monthStr || toMonthStr(now)).split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0, 23, 59, 59);
  return {
    from,
    to,
    anchor: from,
    label: from.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    prevAnchor: new Date(y, m - 2, 1),
    nextAnchor: new Date(y, m, 1),
  };
}

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    month?: string;
    teamId?: string;
    employeeId?: string;
  }>;
}) {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const params = await searchParams;
  const view: View = params.view === "jour" || params.view === "semaine" ? params.view : "mois";

  const bounds = getBounds(view, params.date, params.month);
  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);

  const teams = await prisma.team.findMany({
    where: { orgId: user.orgId, ...(scopedTeamIds ? { id: { in: scopedTeamIds } } : {}) },
    include: { site: true },
    orderBy: { name: "asc" },
  });

  const effectiveTeamIds =
    params.teamId && teams.some((t) => t.id === params.teamId)
      ? [params.teamId]
      : scopedTeamIds;

  const allRows = await getReportData(user.orgId, effectiveTeamIds, bounds.from, bounds.to);
  const rows = params.employeeId ? allRows.filter((r) => r.employee.id === params.employeeId) : allRows;

  const employeeIds = allRows.map((r) => r.employee.id);
  const pendingOvertimesRaw = await prisma.overtimeRecord.findMany({
    where: { orgId: user.orgId, employeeId: { in: employeeIds }, status: "NON_PLANIFIEE" },
    include: { employee: true },
    orderBy: { date: "desc" },
  });

  const countByEmployee = new Map<string, number>();
  for (const o of pendingOvertimesRaw) {
    countByEmployee.set(o.employeeId, (countByEmployee.get(o.employeeId) ?? 0) + 1);
  }
  const pendingOvertimes = pendingOvertimesRaw.map((o) => ({
    ...o,
    severity: classifyOvertimeSeverity(o.overtimeMinutes, countByEmployee.get(o.employeeId) ?? 1),
  }));

  const anomalies = await getUnresolvedAnomalies(user.orgId, scopedTeamIds);

  function urlFor(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = {
      view,
      date: view !== "mois" ? toDateStr(bounds.anchor) : undefined,
      month: view === "mois" ? toMonthStr(bounds.anchor) : undefined,
      teamId: params.teamId,
      employeeId: params.employeeId,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    return `/rapports?${p.toString()}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-950">Rapports</h1>
          <p className="text-sm text-muted">Heures, retards, absences et heures supplémentaires</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1.5">
          <Link
            href={urlFor({
              date: view !== "mois" ? toDateStr(bounds.prevAnchor) : undefined,
              month: view === "mois" ? toMonthStr(bounds.prevAnchor) : undefined,
            })}
            className="rounded-lg p-1.5 hover:bg-navy-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-40 text-center text-sm font-medium capitalize text-navy-900">
            {bounds.label}
          </span>
          <Link
            href={urlFor({
              date: view !== "mois" ? toDateStr(bounds.nextAnchor) : undefined,
              month: view === "mois" ? toMonthStr(bounds.nextAnchor) : undefined,
            })}
            className="rounded-lg p-1.5 hover:bg-navy-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border bg-surface p-1">
          {(["jour", "semaine", "mois"] as View[]).map((v) => (
            <Link
              key={v}
              href={urlFor({ view: v, date: toDateStr(new Date()), month: toMonthStr(new Date()) })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                view === v ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-navy-50"
              }`}
            >
              {v}
            </Link>
          ))}
        </div>

        <form action="/rapports" method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="view" value={view} />
          {view === "mois" ? (
            <input type="hidden" name="month" value={toMonthStr(bounds.anchor)} />
          ) : (
            <input type="hidden" name="date" value={toDateStr(bounds.anchor)} />
          )}
          <select
            name="teamId"
            defaultValue={params.teamId ?? ""}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-navy-900"
          >
            <option value="">Toutes les équipes</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.site.name}
              </option>
            ))}
          </select>
          <select
            name="employeeId"
            defaultValue={params.employeeId ?? ""}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-navy-900"
          >
            <option value="">Tous les employés</option>
            {allRows.map((r) => (
              <option key={r.employee.id} value={r.employee.id}>
                {r.employee.firstName} {r.employee.lastName}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-navy-900 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-800">
            Filtrer
          </button>
        </form>
      </div>

      <AnomaliesPanel anomalies={anomalies} />

      <RapportsClient rows={rows} pendingOvertimes={pendingOvertimes} monthLabel={bounds.label} />
    </div>
  );
}
