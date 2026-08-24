"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import {
  upsertTeamScheduleAction,
  upsertEmployeeScheduleAction,
  deleteScheduleAction,
} from "@/app/actions/schedule";
import { Clock, X, Loader2, UserCog, Trash2 } from "lucide-react";

const DAYS = [
  { v: 1, l: "Lun" },
  { v: 2, l: "Mar" },
  { v: 3, l: "Mer" },
  { v: 4, l: "Jeu" },
  { v: 5, l: "Ven" },
  { v: 6, l: "Sam" },
  { v: 0, l: "Dim" },
];

type Schedule = {
  id: string;
  daysOfWeek: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
};
type Employee = { id: string; firstName: string; lastName: string; schedules: Schedule[] };
type Team = {
  id: string;
  name: string;
  site: { name: string };
  schedules: Schedule[];
  employees: Employee[];
};

function daysLabel(daysOfWeek: string) {
  const set = new Set(daysOfWeek.split(",").map(Number));
  return DAYS.filter((d) => set.has(d.v))
    .map((d) => d.l)
    .join(", ");
}

export default function HorairesClient({
  teams,
  canManage,
}: {
  teams: Team[];
  canManage: boolean;
}) {
  const [editTeam, setEditTeam] = useState<{ teamId: string; schedule: Schedule | null } | null>(null);
  const [editEmp, setEditEmp] = useState<{ employeeId: string; schedule: Schedule | null; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleTeamSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await upsertTeamScheduleAction({}, formData);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Horaire enregistré");
      setEditTeam(null);
    });
  }

  function handleEmpSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await upsertEmployeeScheduleAction({}, formData);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Horaire personnalisé enregistré");
      setEditEmp(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteScheduleAction(id);
      toast.success("Horaire personnalisé supprimé");
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
      <h1 className="text-xl font-bold text-navy-950">Horaires</h1>
      <p className="text-sm text-muted">
        Définissez les horaires par équipe, avec des exceptions possibles par
        employé.
      </p>

      <div className="mt-6 space-y-5">
        {teams.map((team) => {
          const schedule = team.schedules[0] ?? null;
          return (
            <div key={team.id} className="rounded-2xl border border-border bg-surface p-5 animate-fade-in-up">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy-950">{team.name}</p>
                  <p className="text-xs text-muted">{team.site.name}</p>
                </div>
                {schedule ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl bg-navy-50 px-3 py-2 text-sm text-navy-800">
                      <Clock className="h-4 w-4" />
                      {schedule.startTime}–{schedule.endTime} · {daysLabel(schedule.daysOfWeek)}
                      <span className="text-xs text-muted">
                        (tolérance {schedule.toleranceMinutes} min)
                      </span>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => setEditTeam({ teamId: team.id, schedule })}
                        className="text-xs font-semibold text-navy-800 hover:underline"
                      >
                        Modifier
                      </button>
                    )}
                  </div>
                ) : (
                  canManage && (
                    <button
                      onClick={() => setEditTeam({ teamId: team.id, schedule: null })}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-navy-50"
                    >
                      Définir un horaire
                    </button>
                  )
                )}
              </div>

              {team.employees.some((e) => e.schedules.length > 0) && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Horaires personnalisés
                  </p>
                  <div className="space-y-2">
                    {team.employees
                      .filter((e) => e.schedules.length > 0)
                      .map((emp) =>
                        emp.schedules.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                          >
                            <span className="text-navy-900">
                              {emp.firstName} {emp.lastName} — {s.startTime}–{s.endTime} ({daysLabel(s.daysOfWeek)})
                            </span>
                            {canManage && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    setEditEmp({ employeeId: emp.id, schedule: s, name: `${emp.firstName} ${emp.lastName}` })
                                  }
                                  className="text-xs font-medium text-navy-800 hover:underline"
                                >
                                  Modifier
                                </button>
                                <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                  </div>
                </div>
              )}

              {canManage && (
                <button
                  onClick={() =>
                    setEditEmp({ employeeId: team.employees[0]?.id ?? "", schedule: null, name: "" })
                  }
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-navy-800 hover:underline"
                >
                  <UserCog className="h-3.5 w-3.5" /> Ajouter un horaire personnalisé
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editTeam && (
        <ScheduleModal
          title="Horaire de l'équipe"
          initial={editTeam.schedule}
          hiddenFields={{ teamId: editTeam.teamId, scheduleId: editTeam.schedule?.id ?? "" }}
          action={handleTeamSubmit}
          pending={pending}
          onClose={() => setEditTeam(null)}
        />
      )}

      {editEmp && (
        <ScheduleModal
          title="Horaire personnalisé"
          initial={editEmp.schedule}
          hiddenFields={{ employeeId: editEmp.employeeId, scheduleId: editEmp.schedule?.id ?? "" }}
          action={handleEmpSubmit}
          pending={pending}
          onClose={() => setEditEmp(null)}
          employeeSelect={
            !editEmp.schedule
              ? teams.flatMap((t) => t.employees).map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))
              : undefined
          }
        />
      )}
    </div>
  );
}

function ScheduleModal({
  title,
  initial,
  hiddenFields,
  action,
  pending,
  onClose,
  employeeSelect,
}: {
  title: string;
  initial: Schedule | null;
  hiddenFields: Record<string, string>;
  action: (fd: FormData) => void;
  pending: boolean;
  onClose: () => void;
  employeeSelect?: { id: string; name: string }[];
}) {
  const [days, setDays] = useState<Set<number>>(
    new Set(initial ? initial.daysOfWeek.split(",").map(Number) : [1, 2, 3, 4, 5, 6])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center">
      <div className="w-full max-w-md animate-fade-in-up rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-950">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-navy-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form action={action} className="mt-4 space-y-4">
          {Object.entries(hiddenFields)
            .filter(([k]) => !(k === "employeeId" && employeeSelect))
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <input type="hidden" name="daysOfWeek" value={[...days].join(",")} />

          {employeeSelect && (
            <select
              name="employeeId"
              defaultValue={hiddenFields.employeeId}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
            >
              {employeeSelect.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-900">Jours</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button
                  type="button"
                  key={d.v}
                  onClick={() =>
                    setDays((prev) => {
                      const next = new Set(prev);
                      if (next.has(d.v)) next.delete(d.v);
                      else next.add(d.v);
                      return next;
                    })
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    days.has(d.v) ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-800"
                  }`}
                >
                  {d.l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-900">Début</label>
              <input
                type="time"
                name="startTime"
                required
                defaultValue={initial?.startTime ?? "08:00"}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-900">Fin</label>
              <input
                type="time"
                name="endTime"
                required
                defaultValue={initial?.endTime ?? "17:00"}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-900">
              Tolérance (minutes)
            </label>
            <input
              type="number"
              name="toleranceMinutes"
              min={0}
              max={120}
              defaultValue={initial?.toleranceMinutes ?? 10}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
            />
          </div>

          <button
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  );
}
