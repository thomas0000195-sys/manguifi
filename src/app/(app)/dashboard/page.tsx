import { requireUser } from "@/lib/guard";
import { getDashboardData, getScopedTeamIds } from "@/lib/dashboard";
import { minutesToLabel } from "@/lib/attendance-logic";
import WeeklyTrendChart from "@/components/WeeklyTrendChart";
import AutoRefresh from "@/components/AutoRefresh";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  FileWarning,
  ArrowRight,
  TimerReset,
  ChevronRight,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);
  const data = await getDashboardData(user.orgId, scopedTeamIds);

  const todoCount =
    data.anomalousAttendances.length + data.absentNonJustifie + data.pendingJustificatifs;

  const summaryParts: string[] = [
    `${data.present} présent${data.present > 1 ? "s" : ""} sur ${data.totalEmployees}`,
  ];
  if (data.absentNonJustifie > 0) {
    summaryParts.push(
      `${data.absentNonJustifie} absence${data.absentNonJustifie > 1 ? "s" : ""} non justifiée${
        data.absentNonJustifie > 1 ? "s" : ""
      }`
    );
  }
  if (data.anomalousAttendances.length > 0) {
    summaryParts.push(
      `${data.anomalousAttendances.length} anomalie${
        data.anomalousAttendances.length > 1 ? "s" : ""
      } à vérifier`
    );
  }
  if (summaryParts.length === 1) {
    summaryParts.push("Aucune anomalie détectée");
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
      <AutoRefresh intervalMs={15000} />
      <div className="animate-fade-in-up rounded-2xl bg-navy-950 px-6 py-5 text-white shadow-lg shadow-navy-900/10">
        <p className="text-sm text-white/60">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <p className="mt-1 text-lg font-semibold sm:text-xl">
          {summaryParts.join(". ")}.
        </p>
      </div>

      {todoCount > 0 && (
        <div className="mt-5 animate-fade-in-up rounded-2xl border border-orange-100 bg-orange-50 p-5">
          <div className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-4.5 w-4.5" />
            <h2 className="font-semibold">
              À traiter aujourd&apos;hui ({todoCount})
            </h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {data.anomalousAttendances.length > 0 && (
              <Link
                href="/rapports"
                className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm shadow-sm transition hover:-translate-y-0.5"
              >
                <span className="font-medium text-navy-900">
                  {data.anomalousAttendances.length} anomalie(s) de pointage
                </span>
                <ChevronRight className="h-4 w-4 text-muted" />
              </Link>
            )}
            {data.absentNonJustifie > 0 && (
              <Link
                href="/justificatifs"
                className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm shadow-sm transition hover:-translate-y-0.5"
              >
                <span className="font-medium text-navy-900">
                  {data.absentNonJustifie} absence(s) non justifiée(s)
                </span>
                <ChevronRight className="h-4 w-4 text-muted" />
              </Link>
            )}
            {data.pendingJustificatifs > 0 && (
              <Link
                href="/justificatifs"
                className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm shadow-sm transition hover:-translate-y-0.5"
              >
                <span className="font-medium text-navy-900">
                  {data.pendingJustificatifs} justificatif(s) en attente
                </span>
                <ChevronRight className="h-4 w-4 text-muted" />
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Présents", value: data.present, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
          { label: "Absents", value: data.absentNonJustifie + data.absentJustifie, icon: XCircle, color: "text-red-500 bg-red-50" },
          { label: "Retards", value: data.retards, icon: Clock, color: "text-orange-600 bg-orange-50" },
          { label: "Départs oubliés", value: data.oublisDepart, icon: TimerReset, color: "text-orange-600 bg-orange-50" },
          { label: "Heures travaillées", value: minutesToLabel(data.totalWorkedMinutes), icon: Users, color: "text-navy-800 bg-navy-50" },
          { label: "Heures sup à valider", value: data.pendingOvertimes, icon: FileWarning, color: "text-navy-800 bg-navy-50" },
        ].map((k) => (
          <div
            key={k.label}
            className="animate-fade-in-up rounded-2xl border border-border bg-surface p-4"
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${k.color}`}>
              <k.icon className="h-4 w-4" />
            </div>
            <p className="mt-3 text-2xl font-bold text-navy-950">{k.value}</p>
            <p className="text-xs text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-navy-950">Derniers pointages</h3>
            <Link href="/rapports" className="flex items-center gap-1 text-xs font-medium text-navy-800 hover:underline">
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-3 divide-y divide-border">
            {data.recentAttendances.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                Aucun pointage pour le moment. Générez les QR codes de vos
                employés pour démarrer.
              </p>
            )}
            {data.recentAttendances.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy-900">
                    {a.employee.firstName} {a.employee.lastName}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {a.employee.team.name} ·{" "}
                    {a.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      a.type === "ARRIVEE"
                        ? "bg-green-100 text-green-600"
                        : "bg-navy-50 text-navy-800"
                    }`}
                  >
                    {a.type === "ARRIVEE" ? "Arrivée" : "Départ"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                      a.confidence === "ELEVE"
                        ? "bg-green-50 text-green-600"
                        : "bg-orange-50 text-orange-600"
                    }`}
                  >
                    {a.confidence === "ELEVE" ? "Fiable" : "À vérifier"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-semibold text-navy-950">Tendance hebdomadaire</h3>
          <p className="text-xs text-muted">Ponctualité vs absentéisme</p>
          <div className="mt-2">
            <WeeklyTrendChart data={data.weekTrend} />
          </div>
        </div>
      </div>
    </div>
  );
}
