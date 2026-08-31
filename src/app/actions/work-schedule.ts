"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertEmployeeInScope, requireUser } from "@/lib/guard";
import { startOfDay, parseLocalDate, toLocalDateString } from "@/lib/attendance-logic";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type ActionState = { error?: string; success?: boolean; count?: number };

/**
 * Every WorkSchedule this app creates stays open (effectiveTo = null) —
 * there's no explicit "close and start a new version" step. Instead, the
 * single invariant that keeps history safe is enforced here: a day before
 * today can never be written, so nothing already used to compute a past
 * day's attendance status can change retroactively. Editing only ever
 * touches today or the future.
 */
async function getOrCreateActiveWorkSchedule(employeeId: string, orgId: string, createdById: string) {
  const existing = await prisma.workSchedule.findFirst({
    where: { employeeId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });
  if (existing) return existing;

  return prisma.workSchedule.create({
    data: { orgId, employeeId, effectiveFrom: startOfDay(new Date()), createdById },
  });
}

const dayInputSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  isWorkingDay: z.coerce.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  toleranceMinutes: z.coerce.number().min(0).max(120).default(10),
});

export async function upsertWorkScheduleDayAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = dayInputSchema.safeParse({
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
    isWorkingDay: formData.get("isWorkingDay") === "true",
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    toleranceMinutes: formData.get("toleranceMinutes") || 10,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const { employeeId, date, isWorkingDay, startTime, endTime, toleranceMinutes } = parsed.data;

  const employee = await assertEmployeeInScope(
    { orgId: session.orgId, role: session.role, id: session.userId },
    employeeId
  );

  const day = startOfDay(parseLocalDate(date));
  if (day.getTime() < startOfDay(new Date()).getTime()) {
    return { error: "Impossible de modifier un jour déjà passé — le planning ne s'applique qu'à partir d'aujourd'hui." };
  }
  if (isWorkingDay && (!startTime || !endTime)) {
    return { error: "Heure de début et de fin requises pour un jour travaillé." };
  }

  const workSchedule = await getOrCreateActiveWorkSchedule(employee.id, session.orgId, session.userId);

  await prisma.workScheduleDay.upsert({
    where: { workScheduleId_date: { workScheduleId: workSchedule.id, date: day } },
    create: {
      workScheduleId: workSchedule.id,
      date: day,
      isWorkingDay,
      startTime: isWorkingDay ? startTime : null,
      endTime: isWorkingDay ? endTime : null,
      toleranceMinutes,
    },
    update: {
      isWorkingDay,
      startTime: isWorkingDay ? startTime : null,
      endTime: isWorkingDay ? endTime : null,
      toleranceMinutes,
    },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "SET_WORK_SCHEDULE_DAY",
    entityType: "WorkScheduleDay",
    entityId: employeeId,
    details: `${date}: ${isWorkingDay ? `travaillé ${startTime}-${endTime}` : "repos"}`,
  });

  revalidatePath(`/employes/${employeeId}/planning`);
  return { success: true };
}

/**
 * Copies every day from the previous calendar month onto the current one
 * (same day-of-month, shifted forward one month) — the "duplicate last
 * month" shortcut for regular rotations. Days that would land in the past
 * are skipped, same rule as upsertWorkScheduleDayAction.
 */
export async function duplicatePreviousMonthAction(
  employeeId: string,
  monthStartIso: string
): Promise<ActionState> {
  const session = await requireSession();
  const employee = await assertEmployeeInScope(
    { orgId: session.orgId, role: session.role, id: session.userId },
    employeeId
  );

  const monthStart = startOfDay(parseLocalDate(monthStartIso));
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

  const workSchedule = await prisma.workSchedule.findFirst({
    where: { employeeId: employee.id, effectiveTo: null },
  });
  if (!workSchedule) return { error: "Aucun planning à dupliquer pour cet employé." };

  const prevDays = await prisma.workScheduleDay.findMany({
    where: {
      workScheduleId: workSchedule.id,
      date: { gte: prevMonthStart, lt: monthStart },
    },
  });
  if (prevDays.length === 0) return { error: "Aucun jour renseigné le mois précédent." };

  const today = startOfDay(new Date());
  for (const d of prevDays) {
    const target = new Date(d.date);
    target.setMonth(target.getMonth() + 1);
    if (target.getTime() < today.getTime()) continue;

    await prisma.workScheduleDay.upsert({
      where: { workScheduleId_date: { workScheduleId: workSchedule.id, date: target } },
      create: {
        workScheduleId: workSchedule.id,
        date: target,
        isWorkingDay: d.isWorkingDay,
        startTime: d.startTime,
        endTime: d.endTime,
        toleranceMinutes: d.toleranceMinutes,
      },
      update: {
        isWorkingDay: d.isWorkingDay,
        startTime: d.startTime,
        endTime: d.endTime,
        toleranceMinutes: d.toleranceMinutes,
      },
    });
  }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "DUPLICATE_WORK_SCHEDULE_MONTH",
    entityType: "WorkSchedule",
    entityId: workSchedule.id,
  });

  revalidatePath(`/employes/${employeeId}/planning`);
  return { success: true };
}

const rotationSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1, "Sélectionnez au moins un employé."),
  workDays: z.coerce.number().int().min(1).max(60),
  restDays: z.coerce.number().int().min(1).max(60),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  toleranceMinutes: z.coerce.number().min(0).max(120).default(10),
  cycleStart: z.string().min(1),
  staggerDays: z.coerce.number().int().min(0).max(30).default(0),
  rangeEnd: z.string().min(1),
});

/**
 * How many days after `cycleStart` a rotation cycle has advanced by `date`,
 * wrapped into [0, cycleLength) — negative when `date` precedes
 * `cycleStart` (a cycle that "started" a few days ago still has a
 * well-defined phase today), hence the double modulo.
 */
function isWorkingDayInCycle(date: Date, cycleStart: Date, workDays: number, restDays: number) {
  const cycleLength = workDays + restDays;
  const diffDays = Math.round((date.getTime() - cycleStart.getTime()) / 86400000);
  const phase = ((diffDays % cycleLength) + cycleLength) % cycleLength;
  return phase < workDays;
}

/**
 * Bulk-generates a repeating work/rest pattern (e.g. "2 jours travaillés /
 * 2 jours repos") across many employees at once — the shortcut for teams
 * too large to plan one calendar day at a time. `staggerDays` shifts each
 * subsequent employee's cycle start by that many days, so a team can be
 * kept desynchronized (never all off at once) without configuring each
 * person's calendar individually. Only ever writes today or later, same
 * rule as upsertWorkScheduleDayAction.
 */
export async function applyRotationPatternAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = rotationSchema.safeParse({
    employeeIds: formData.getAll("employeeIds"),
    workDays: formData.get("workDays"),
    restDays: formData.get("restDays"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    toleranceMinutes: formData.get("toleranceMinutes") || 10,
    cycleStart: formData.get("cycleStart"),
    staggerDays: formData.get("staggerDays") || 0,
    rangeEnd: formData.get("rangeEnd"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const { employeeIds, workDays, restDays, startTime, endTime, toleranceMinutes, cycleStart, staggerDays, rangeEnd } =
    parsed.data;

  const today = startOfDay(new Date());
  const rangeStart = today;
  const rangeEndDate = startOfDay(parseLocalDate(rangeEnd));
  if (rangeEndDate.getTime() < rangeStart.getTime()) {
    return { error: "La date de fin doit être après aujourd'hui." };
  }
  const baseCycleStart = startOfDay(parseLocalDate(cycleStart));

  let daysWritten = 0;
  for (let i = 0; i < employeeIds.length; i++) {
    const employeeId = employeeIds[i];
    const employee = await assertEmployeeInScope(
      { orgId: session.orgId, role: session.role, id: session.userId },
      employeeId
    );
    const employeeCycleStart = new Date(baseCycleStart);
    employeeCycleStart.setDate(employeeCycleStart.getDate() + i * staggerDays);

    const workSchedule = await getOrCreateActiveWorkSchedule(employee.id, session.orgId, session.userId);

    for (
      let d = new Date(rangeStart);
      d.getTime() <= rangeEndDate.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      const isWorking = isWorkingDayInCycle(d, employeeCycleStart, workDays, restDays);
      await prisma.workScheduleDay.upsert({
        where: { workScheduleId_date: { workScheduleId: workSchedule.id, date: new Date(d) } },
        create: {
          workScheduleId: workSchedule.id,
          date: new Date(d),
          isWorkingDay: isWorking,
          startTime: isWorking ? startTime : null,
          endTime: isWorking ? endTime : null,
          toleranceMinutes,
        },
        update: {
          isWorkingDay: isWorking,
          startTime: isWorking ? startTime : null,
          endTime: isWorking ? endTime : null,
          toleranceMinutes,
        },
      });
      daysWritten++;
    }
  }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "APPLY_ROTATION_PATTERN",
    entityType: "WorkSchedule",
    entityId: employeeIds.join(","),
    details: `${employeeIds.length} employé(s), ${workDays}j travail/${restDays}j repos, décalage ${staggerDays}j, jusqu'au ${rangeEnd}`,
  });

  revalidatePath("/planning");
  return { success: true, count: daysWritten };
}

export async function getWorkScheduleMonth(employeeId: string, monthStartIso: string) {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const employee = await assertEmployeeInScope(user, employeeId);

  const monthStart = startOfDay(parseLocalDate(monthStartIso));
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const workSchedule = await prisma.workSchedule.findFirst({
    where: { employeeId: employee.id, effectiveTo: null },
  });
  if (!workSchedule) return { days: [] as { date: string; isWorkingDay: boolean; startTime: string | null; endTime: string | null }[] };

  const days = await prisma.workScheduleDay.findMany({
    where: { workScheduleId: workSchedule.id, date: { gte: monthStart, lt: monthEnd } },
  });

  return {
    days: days.map((d) => ({
      date: toLocalDateString(d.date),
      isWorkingDay: d.isWorkingDay,
      startTime: d.startTime,
      endTime: d.endTime,
    })),
  };
}
