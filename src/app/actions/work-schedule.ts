"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertEmployeeInScope, requireUser } from "@/lib/guard";
import { startOfDay, parseLocalDate, toLocalDateString } from "@/lib/attendance-logic";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type ActionState = { error?: string; success?: boolean };

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
