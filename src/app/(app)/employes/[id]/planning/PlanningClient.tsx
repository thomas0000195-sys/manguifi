"use client";

import { useState, useTransition, useEffect } from "react";
import toast from "react-hot-toast";
import {
  upsertWorkScheduleDayAction,
  duplicatePreviousMonthAction,
  getWorkScheduleMonth,
} from "@/app/actions/work-schedule";
import { Calendar, ChevronLeft, ChevronRight, Copy, Loader2, X } from "lucide-react";

type DayEntry = { date: string; isWorkingDay: boolean; startTime: string | null; endTime: string | null };

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Local "YYYY-MM-DD" — not toISOString()'s UTC one, which silently shifts
// the date by a day in any timezone ahead of UTC.
function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Inverse of toIsoDate — plain `new Date("2026-08-01")` parses as UTC
// midnight per spec, which is the same bug in reverse.
function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildMonthGrid(monthIso: string) {
  const first = parseIsoDate(monthIso);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  // Monday-first offset: getDay() is 0=Sunday..6=Saturday.
  const offset = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), day));
  }
  return cells;
}

export default function PlanningClient({
  employeeId,
  employeeName,
  initialMonth,
  initialDays,
}: {
  employeeId: string;
  employeeName: string;
  initialMonth: string;
  initialDays: DayEntry[];
}) {
  const [monthIso, setMonthIso] = useState(initialMonth);
  const [days, setDays] = useState<Record<string, DayEntry>>(
    Object.fromEntries(initialDays.map((d) => [d.date, d]))
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingMonth, setLoadingMonth] = useState(false);

  const today = toIsoDate(new Date());

  useEffect(() => {
    if (monthIso === initialMonth) return;
    getWorkScheduleMonth(employeeId, monthIso)
      .then((res) => setDays(Object.fromEntries(res.days.map((d) => [d.date, d]))))
      .catch(() => toast.error("Impossible de charger ce mois."))
      .finally(() => setLoadingMonth(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthIso]);

  function changeMonth(delta: number) {
    const d = monthStart(parseIsoDate(monthIso));
    d.setMonth(d.getMonth() + delta);
    setSelectedDate(null);
    setLoadingMonth(true);
    setMonthIso(toIsoDate(d));
  }

  function submitDay(date: string, isWorkingDay: boolean, startTime: string, endTime: string) {
    if (date < today) {
      toast.error("Impossible de modifier un jour déjà passé.");
      return;
    }
    const formData = new FormData();
    formData.set("employeeId", employeeId);
    formData.set("date", date);
    formData.set("isWorkingDay", String(isWorkingDay));
    if (isWorkingDay) {
      formData.set("startTime", startTime);
      formData.set("endTime", endTime);
    }
    startTransition(async () => {
      const res = await upsertWorkScheduleDayAction({}, formData);
      if (res.error) { toast.error(res.error); return; }
      setDays((prev) => ({
        ...prev,
        [date]: { date, isWorkingDay, startTime: isWorkingDay ? startTime : null, endTime: isWorkingDay ? endTime : null },
      }));
      toast.success("Jour enregistré");
      setSelectedDate(null);
    });
  }

  function duplicatePreviousMonth() {
    startTransition(async () => {
      const res = await duplicatePreviousMonthAction(employeeId, monthIso);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Mois précédent dupliqué");
      const res2 = await getWorkScheduleMonth(employeeId, monthIso);
      setDays(Object.fromEntries(res2.days.map((d) => [d.date, d])));
    });
  }

  const cells = buildMonthGrid(monthIso);
  const monthLabel = parseIsoDate(monthIso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-navy-800" />
        <h1 className="text-lg font-bold text-navy-950">Planning — {employeeName}</h1>
      </div>
      <p className="mt-1 text-sm text-muted">
        Définissez les jours travaillés et de repos. Un jour de repos planifié ne déclenche jamais d&apos;absence.
      </p>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
        <button onClick={() => changeMonth(-1)} className="rounded-lg p-1.5 hover:bg-navy-50" aria-label="Mois précédent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold capitalize text-navy-950">
          {monthLabel} {loadingMonth && <Loader2 className="ml-1 inline h-3.5 w-3.5 animate-spin" />}
        </span>
        <button onClick={() => changeMonth(1)} className="rounded-lg p-1.5 hover:bg-navy-50" aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={duplicatePreviousMonth}
        disabled={pending}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-navy-800 hover:underline disabled:opacity-60"
      >
        <Copy className="h-3.5 w-3.5" /> Dupliquer le mois précédent
      </button>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted">
        {WEEKDAY_LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const iso = toIsoDate(date);
          const entry = days[iso];
          const isPast = iso < today;
          const bg = !entry
            ? "bg-navy-50/40 text-muted"
            : entry.isWorkingDay
            ? "bg-green-100 text-green-800"
            : "bg-navy-100 text-navy-700";
          return (
            <button
              key={iso}
              disabled={isPast}
              onClick={() => setSelectedDate(iso)}
              className={`aspect-square rounded-lg text-xs font-medium transition ${bg} ${
                isPast ? "cursor-not-allowed opacity-40" : "hover:ring-2 hover:ring-navy-200"
              } ${selectedDate === iso ? "ring-2 ring-navy-600" : ""}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-100" /> Travaillé</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-navy-100" /> Repos</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-navy-50" /> Non renseigné</span>
      </div>

      {selectedDate && (
        <DayEditor
          date={selectedDate}
          entry={days[selectedDate] ?? null}
          pending={pending}
          onClose={() => setSelectedDate(null)}
          onSubmit={submitDay}
        />
      )}
    </div>
  );
}

function DayEditor({
  date,
  entry,
  pending,
  onClose,
  onSubmit,
}: {
  date: string;
  entry: DayEntry | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (date: string, isWorkingDay: boolean, startTime: string, endTime: string) => void;
}) {
  const [isWorkingDay, setIsWorkingDay] = useState(entry?.isWorkingDay ?? true);
  const [startTime, setStartTime] = useState(entry?.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(entry?.endTime ?? "17:00");

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy-950">
          {parseIsoDate(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-navy-50">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setIsWorkingDay(true)}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
            isWorkingDay ? "bg-green-600 text-white" : "border border-border text-navy-800"
          }`}
        >
          Travaillé
        </button>
        <button
          onClick={() => setIsWorkingDay(false)}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
            !isWorkingDay ? "bg-navy-700 text-white" : "border border-border text-navy-800"
          }`}
        >
          Repos
        </button>
      </div>

      {isWorkingDay && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
          />
          <span className="text-sm text-muted">à</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-navy-600"
          />
        </div>
      )}

      <button
        onClick={() => onSubmit(date, isWorkingDay, startTime, endTime)}
        disabled={pending}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enregistrer
      </button>
    </div>
  );
}
