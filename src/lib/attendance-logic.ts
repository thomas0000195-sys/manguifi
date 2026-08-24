import { prisma } from "./prisma";
import type { Attendance, Employee, Schedule } from "@prisma/client";

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** `date` at a given number of minutes past its own midnight. */
function atMinutes(date: Date, minutesFromMidnight: number) {
  const d = startOfDay(date);
  d.setMinutes(d.getMinutes() + minutesFromMidnight);
  return d;
}

function parseTimeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** A schedule "wraps" past midnight when its end time is <= its start time. */
function isOvernightSchedule(schedule: Schedule) {
  return parseTimeToMinutes(schedule.endTime) <= parseTimeToMinutes(schedule.startTime);
}

export function minutesToLabel(mins: number) {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? "-" : "";
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}

export async function getScheduleForEmployee(
  employee: Employee,
  date: Date
): Promise<Schedule | null> {
  const day = date.getDay();
  const empSchedules = await prisma.schedule.findMany({
    where: { employeeId: employee.id },
  });
  const empMatch = empSchedules.find((s) =>
    s.daysOfWeek.split(",").includes(String(day))
  );
  if (empMatch) return empMatch;

  const teamSchedules = await prisma.schedule.findMany({
    where: { teamId: employee.teamId, employeeId: null },
  });
  const teamMatch = teamSchedules.find((s) =>
    s.daysOfWeek.split(",").includes(String(day))
  );
  return teamMatch ?? null;
}

/**
 * Which calendar "shift day" a DEPART scan happening right now actually
 * belongs to. For a same-day schedule this is always today. For an
 * overnight schedule (e.g. 22:00–06:00), a scan at 05:50 belongs to
 * *yesterday's* shift, not today's — this resolves that so overtime and
 * the OvertimeRecord land on the day the shift started, matching how the
 * team actually thinks about "last night's shift".
 */
export async function resolveShiftDate(employee: Employee, now: Date): Promise<Date> {
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdaySchedule = await getScheduleForEmployee(employee, yesterday);
  if (yesterdaySchedule && isOvernightSchedule(yesterdaySchedule)) {
    const yEnd = parseTimeToMinutes(yesterdaySchedule.endTime);
    // Still plausibly inside (or shortly after) yesterday's overnight shift.
    if (nowMin < yEnd + 6 * 60) {
      return startOfDay(yesterday);
    }
  }

  return startOfDay(now);
}

/**
 * Determines whether the next scan for this employee is an arrival or a
 * departure. Deliberately NOT bounded to "today" — it looks at the single
 * most recent punch, whenever it was, so an overnight shift (arrival at
 * 22:00, departure at 06:00 the next calendar day) still alternates
 * correctly. If the last ARRIVEE is implausibly old (> 20h — nobody's
 * shift runs that long), we treat it as abandoned and start fresh with a
 * new ARRIVEE rather than forcing an ancient "departure".
 */
export async function determineNextPunchType(
  employeeId: string,
  now: Date
): Promise<"ARRIVEE" | "DEPART"> {
  const last = await prisma.attendance.findFirst({
    where: { employeeId },
    orderBy: { timestamp: "desc" },
  });
  if (!last || last.type === "DEPART") return "ARRIVEE";

  const hoursSinceArrival = (now.getTime() - last.timestamp.getTime()) / (60 * 60 * 1000);
  if (hoursSinceArrival > 20) return "ARRIVEE";

  return "DEPART";
}

export async function computeConfidence(
  employeeId: string,
  deviceFingerprint: string | undefined,
  now: Date
): Promise<"ELEVE" | "A_VERIFIER"> {
  if (!deviceFingerprint) return "A_VERIFIER";

  const recent = await prisma.attendance.findMany({
    where: { employeeId },
    orderBy: { timestamp: "desc" },
    take: 10,
  });

  if (recent.length === 0) return "ELEVE";

  const knownDevices = new Set(
    recent.map((r) => r.deviceFingerprint).filter(Boolean)
  );
  const deviceKnown = knownDevices.has(deviceFingerprint) || knownDevices.size === 0;

  const hour = now.getHours() + now.getMinutes() / 60;
  const usualHours = recent.map(
    (r) => r.timestamp.getHours() + r.timestamp.getMinutes() / 60
  );
  const avgHour =
    usualHours.reduce((a, b) => a + b, 0) / (usualHours.length || 1);
  const withinUsualRange = Math.abs(hour - avgHour) <= 4;

  return deviceKnown && withinUsualRange ? "ELEVE" : "A_VERIFIER";
}

export type DailyStatus = {
  employee: Employee;
  date: Date;
  scheduled: boolean;
  arrivee: Attendance | null;
  depart: Attendance | null;
  status:
    | "PRESENT"
    | "ABSENT_NON_JUSTIFIE"
    | "ABSENT_JUSTIFIE"
    | "RETARD"
    | "DEPART_ANTICIPE"
    | "OUBLI_DEPART"
    | "NON_PLANIFIE";
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  plannedMinutes: number;
};

/**
 * Status of one employee for one "shift day". `date` names the calendar
 * day the shift STARTS on — for an overnight schedule (22:00–06:00), the
 * relevant attendance window runs from `date` 22:00 to `date`+1 06:00, so
 * the whole night shift is reported against the day it began, not split
 * across two calendar days.
 */
export async function computeDailyStatus(
  employee: Employee,
  date: Date
): Promise<DailyStatus> {
  const schedule = await getScheduleForEmployee(employee, date);
  const now = new Date();

  if (!schedule) {
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: employee.id,
        timestamp: { gte: startOfDay(date), lte: endOfDay(date) },
      },
      orderBy: { timestamp: "asc" },
    });
    const arrivee = attendances.find((a) => a.type === "ARRIVEE") ?? null;
    const depart = [...attendances].reverse().find((a) => a.type === "DEPART") ?? null;
    return {
      employee,
      date,
      scheduled: false,
      arrivee,
      depart,
      status: arrivee ? "PRESENT" : "NON_PLANIFIE",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workedMinutes:
        arrivee && depart
          ? Math.max(0, Math.round((depart.timestamp.getTime() - arrivee.timestamp.getTime()) / 60000))
          : 0,
      overtimeMinutes: 0,
      plannedMinutes: 0,
    };
  }

  const tolerance = schedule.toleranceMinutes;
  const startMin = parseTimeToMinutes(schedule.startTime);
  const endMin = parseTimeToMinutes(schedule.endTime);
  const overnight = isOvernightSchedule(schedule);
  const plannedMinutes = overnight ? 24 * 60 - startMin + endMin : Math.max(0, endMin - startMin);

  const windowStart = atMinutes(date, startMin);
  const shiftEndDay = overnight ? new Date(date.getTime() + 86400000) : date;
  const windowEnd = atMinutes(shiftEndDay, endMin);

  // Generous buffers: catch an early clock-in and a heavily-overtime
  // clock-out without bleeding into the *next* shift's own window.
  const queryFrom = new Date(windowStart.getTime() - 2 * 60 * 60 * 1000);
  const queryTo = new Date(windowEnd.getTime() + 6 * 60 * 60 * 1000);

  const attendances = await prisma.attendance.findMany({
    where: { employeeId: employee.id, timestamp: { gte: queryFrom, lte: queryTo } },
    orderBy: { timestamp: "asc" },
  });

  const arrivee = attendances.find((a) => a.type === "ARRIVEE") ?? null;
  const depart = arrivee
    ? [...attendances].reverse().find((a) => a.type === "DEPART" && a.timestamp > arrivee.timestamp) ?? null
    : null;

  if (!arrivee) {
    if (now.getTime() < windowStart.getTime() + tolerance * 60000) {
      return {
        employee, date, scheduled: true, arrivee: null, depart: null,
        status: "NON_PLANIFIE", lateMinutes: 0, earlyLeaveMinutes: 0,
        workedMinutes: 0, overtimeMinutes: 0, plannedMinutes,
      };
    }
    return {
      employee, date, scheduled: true, arrivee: null, depart: null,
      status: "ABSENT_NON_JUSTIFIE", lateMinutes: 0, earlyLeaveMinutes: 0,
      workedMinutes: 0, overtimeMinutes: 0, plannedMinutes,
    };
  }

  const arriveeMin = arrivee.timestamp.getHours() * 60 + arrivee.timestamp.getMinutes();
  const lateMinutes = Math.max(0, arriveeMin - startMin - tolerance);

  let earlyLeaveMinutes = 0;
  let workedMinutes = 0;
  let overtimeMinutes = 0;
  let status: DailyStatus["status"] = lateMinutes > 0 ? "RETARD" : "PRESENT";

  if (depart) {
    const departMin = depart.timestamp.getHours() * 60 + depart.timestamp.getMinutes();
    earlyLeaveMinutes = Math.max(0, endMin - departMin - tolerance);
    workedMinutes = Math.max(
      0,
      Math.round((depart.timestamp.getTime() - arrivee.timestamp.getTime()) / 60000)
    );
    overtimeMinutes = Math.max(0, workedMinutes - plannedMinutes - tolerance);
    if (earlyLeaveMinutes > 0 && status === "PRESENT") status = "DEPART_ANTICIPE";
  } else if (now.getTime() > windowEnd.getTime() + tolerance * 60000) {
    status = "OUBLI_DEPART";
  }

  return {
    employee,
    date,
    scheduled: true,
    arrivee,
    depart,
    status,
    lateMinutes,
    earlyLeaveMinutes,
    workedMinutes,
    overtimeMinutes,
    plannedMinutes,
  };
}

export async function isDateJustified(employeeId: string, date: Date) {
  const day = startOfDay(date);
  const justif = await prisma.justificatif.findFirst({
    where: {
      employeeId,
      status: { in: ["JUSTIFIE", "EN_ATTENTE"] },
      dateStart: { lte: endOfDay(date) },
      dateEnd: { gte: day },
    },
  });
  return justif;
}
