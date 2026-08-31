"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { applyRotationPatternAction } from "@/app/actions/work-schedule";
import { Repeat, Loader2, Users, CheckSquare, Square } from "lucide-react";

type Employee = { id: string; firstName: string; lastName: string; position: string | null };
type Team = { id: string; name: string; site: { name: string }; employees: Employee[] };

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

export default function PlanningGroupClient({ teams }: { teams: Team[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [workDays, setWorkDays] = useState(2);
  const [restDays, setRestDays] = useState(2);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [toleranceMinutes, setToleranceMinutes] = useState(10);
  const [cycleStart, setCycleStart] = useState(toIsoDate(new Date()));
  const [staggerDays, setStaggerDays] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(toIsoDate(addMonths(new Date(), 3)));
  const [pending, startTransition] = useTransition();

  function toggleEmployee(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setOrderedIds((ids) => ids.filter((i) => i !== id));
      } else {
        next.add(id);
        setOrderedIds((ids) => [...ids, id]);
      }
      return next;
    });
  }

  function toggleTeam(team: Team) {
    const teamIds = team.employees.map((e) => e.id);
    const allSelected = teamIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) teamIds.forEach((id) => next.delete(id));
      else teamIds.forEach((id) => next.add(id));
      return next;
    });
    setOrderedIds((prev) => {
      if (allSelected) return prev.filter((id) => !teamIds.includes(id));
      const missing = teamIds.filter((id) => !prev.includes(id));
      return [...prev, ...missing];
    });
  }

  function submit() {
    if (orderedIds.length === 0) {
      toast.error("Sélectionnez au moins un employé.");
      return;
    }
    if (workDays < 1 || restDays < 1) {
      toast.error("Jours travaillés et jours de repos doivent être au moins 1.");
      return;
    }
    const formData = new FormData();
    orderedIds.forEach((id) => formData.append("employeeIds", id));
    formData.set("workDays", String(workDays));
    formData.set("restDays", String(restDays));
    formData.set("startTime", startTime);
    formData.set("endTime", endTime);
    formData.set("toleranceMinutes", String(toleranceMinutes));
    formData.set("cycleStart", cycleStart);
    formData.set("staggerDays", String(staggerDays));
    formData.set("rangeEnd", rangeEnd);

    startTransition(async () => {
      const res = await applyRotationPatternAction({}, formData);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Planning généré pour ${orderedIds.length} employé(s) — ${res.count ?? 0} jour(s) écrit(s).`);
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:py-8">
      <div className="flex items-center gap-2">
        <Repeat className="h-5 w-5 text-navy-800" />
        <h1 className="text-xl font-bold text-navy-950">Planning — motif de rotation</h1>
      </div>
      <p className="mt-1 text-sm text-muted">
        Générez un planning répétitif (ex. 2 jours travaillés / 2 jours repos) pour plusieurs employés en une seule fois,
        au lieu de saisir chaque jour un par un.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-navy-950">
            <Users className="h-4 w-4" /> Employés ({orderedIds.length} sélectionné(s))
          </h2>
          <div className="mt-3 space-y-4">
            {teams.map((team) => {
              const teamIds = team.employees.map((e) => e.id);
              const allSelected = teamIds.length > 0 && teamIds.every((id) => selected.has(id));
              return (
                <div key={team.id} className="rounded-2xl border border-border bg-surface p-4">
                  <button
                    onClick={() => toggleTeam(team)}
                    className="flex w-full items-center gap-2 text-sm font-semibold text-navy-950"
                  >
                    {allSelected ? <CheckSquare className="h-4 w-4 text-navy-800" /> : <Square className="h-4 w-4 text-muted" />}
                    {team.name} <span className="font-normal text-muted">— {team.site.name}</span>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {team.employees.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => toggleEmployee(emp.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          selected.has(emp.id)
                            ? "bg-navy-900 text-white"
                            : "border border-border text-navy-800 hover:bg-navy-50"
                        }`}
                      >
                        {emp.firstName} {emp.lastName}
                        {selected.has(emp.id) && orderedIds.length > 1 && (
                          <span className="ml-1 opacity-70">#{orderedIds.indexOf(emp.id) + 1}</span>
                        )}
                      </button>
                    ))}
                    {team.employees.length === 0 && <p className="text-xs text-muted">Aucun employé.</p>}
                  </div>
                </div>
              );
            })}
            {teams.length === 0 && <p className="text-sm text-muted">Aucune équipe.</p>}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-navy-950">Motif</h2>
          <div className="mt-3 space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted">Jours travaillés</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={workDays}
                  onChange={(e) => setWorkDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted">Jours de repos</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={restDays}
                  onChange={(e) => setRestDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted">Heure de début</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted">Heure de fin</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Tolérance (minutes)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={toleranceMinutes}
                onChange={(e) => setToleranceMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Date de début du cycle</label>
              <input
                type="date"
                value={cycleStart}
                onChange={(e) => setCycleStart(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Générer jusqu&apos;au</label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">
                Décalage entre employés (jours) — l&apos;ordre de sélection ci-contre définit qui commence en premier
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={staggerDays}
                onChange={(e) => setStaggerDays(Number(e.target.value))}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
              />
              <p className="mt-1 text-[11px] text-muted">
                0 = tout le monde synchronisé. 1 = chaque employé suivant commence son cycle un jour plus tard (pour ne
                jamais avoir toute l&apos;équipe en repos le même jour).
              </p>
            </div>

            <button
              onClick={submit}
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Générer le planning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
