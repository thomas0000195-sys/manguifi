import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { computeDailyStatus, minutesToLabel, startOfDay } from "@/lib/attendance-logic";
import Link from "next/link";
import { QrCode, Clock, AlertTriangle, FileClock } from "lucide-react";
import ManualDepartureButton from "./ManualDepartureButton";
import AutoRefresh from "@/components/AutoRefresh";

export default async function EspacePage() {
  const user = await requireUser(["EMPLOYEE"]);
  if (!user.employee) {
    return (
      <div className="mx-auto max-w-md px-5 py-10 text-center text-sm text-muted">
        Aucun profil employé n&apos;est associé à ce compte.
      </div>
    );
  }
  const employee = user.employee;

  const today = new Date();
  const status = await computeDailyStatus(employee, today);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekAttendances = await prisma.attendance.findMany({
    where: { employeeId: employee.id, timestamp: { gte: startOfDay(weekStart) } },
    orderBy: { timestamp: "asc" },
  });
  let weekMinutes = 0;
  for (let i = 0; i < weekAttendances.length - 1; i++) {
    if (weekAttendances[i].type === "ARRIVEE" && weekAttendances[i + 1].type === "DEPART") {
      weekMinutes += Math.round(
        (weekAttendances[i + 1].timestamp.getTime() - weekAttendances[i].timestamp.getTime()) / 60000
      );
    }
  }

  const anomalies = await prisma.attendance.count({
    where: { employeeId: employee.id, isAnomaly: true, timestamp: { gte: startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14)) } },
  });
  const pendingJustificatifs = await prisma.justificatif.count({
    where: { employeeId: employee.id, status: "EN_ATTENTE" },
  });

  const statusLabel: Record<string, { text: string; color: string }> = {
    PRESENT: { text: "Vous êtes pointé", color: "text-green-600 bg-green-50" },
    RETARD: { text: "Arrivée en retard", color: "text-orange-600 bg-orange-50" },
    DEPART_ANTICIPE: { text: "Départ anticipé", color: "text-orange-600 bg-orange-50" },
    OUBLI_DEPART: { text: "Départ non pointé hier", color: "text-red-500 bg-red-50" },
    ABSENT_NON_JUSTIFIE: { text: "Pas encore pointé", color: "text-muted bg-navy-50" },
    NON_PLANIFIE: { text: "Pas encore pointé", color: "text-muted bg-navy-50" },
    REPOS_PLANIFIE: { text: "Jour de repos planifié", color: "text-navy-700 bg-navy-50" },
  };
  const s = statusLabel[status.status] ?? statusLabel.NON_PLANIFIE;

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <AutoRefresh intervalMs={20000} />
      <p className="text-sm text-muted">
        Bonjour {employee.firstName} 👋
      </p>
      <h1 className="text-xl font-bold text-navy-950">
        {today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      </h1>

      <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${s.color}`}>
        {s.text}
        {status.arrivee && (
          <span className="ml-1 font-normal">
            · Arrivée à {status.arrivee.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <Link
        href="/espace/scanner"
        className="mt-6 flex flex-col items-center justify-center gap-3 rounded-3xl bg-navy-950 py-10 text-white shadow-xl shadow-navy-900/20 transition active:scale-[0.98]"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 animate-pulse-ring">
          <QrCode className="h-8 w-8" />
        </div>
        <span className="text-lg font-semibold">Scanner le QR du site</span>
        <span className="text-xs text-white/60">Pointer en moins de 10 secondes</span>
      </Link>

      {status.arrivee && !status.depart && (
        <div className="mt-4">
          <ManualDepartureButton />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-800">
            <Clock className="h-4 w-4" />
          </div>
          <p className="mt-2 text-lg font-bold text-navy-950">{minutesToLabel(weekMinutes)}</p>
          <p className="text-xs text-muted">Cette semaine</p>
        </div>
        <Link href="/espace/justificatifs" className="rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <FileClock className="h-4 w-4" />
          </div>
          <p className="mt-2 text-lg font-bold text-navy-950">{pendingJustificatifs}</p>
          <p className="text-xs text-muted">Justificatif(s) en attente</p>
        </Link>
      </div>

      {anomalies > 0 && (
        <Link
          href="/espace/historique"
          className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 transition hover:bg-red-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {anomalies} anomalie(s) récente(s) à régulariser avec votre responsable.
        </Link>
      )}
    </div>
  );
}
