"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type ActionState = { error?: string; success?: boolean };

const scheduleSchema = z.object({
  daysOfWeek: z.string().min(1, "Sélectionnez au moins un jour"),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  toleranceMinutes: z.coerce.number().min(0).max(120),
});

export async function upsertTeamScheduleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };

  const scheduleId = String(formData.get("scheduleId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const parsed = scheduleSchema.safeParse({
    daysOfWeek: formData.get("daysOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    toleranceMinutes: formData.get("toleranceMinutes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  if (scheduleId) {
    const existing = await prisma.schedule.findFirst({
      where: { id: scheduleId, orgId: session.orgId },
    });
    if (!existing) return { error: "Horaire introuvable." };
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: parsed.data,
    });
  } else {
    const team = await prisma.team.findFirst({ where: { id: teamId, orgId: session.orgId } });
    if (!team) return { error: "Équipe introuvable." };
    await prisma.schedule.create({
      data: { ...parsed.data, orgId: session.orgId, teamId },
    });
  }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: scheduleId ? "UPDATE_SCHEDULE" : "CREATE_SCHEDULE",
    entityType: "Schedule",
    entityId: scheduleId || teamId,
  });

  revalidatePath("/horaires");
  return { success: true };
}

export async function upsertEmployeeScheduleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };

  const scheduleId = String(formData.get("scheduleId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const parsed = scheduleSchema.safeParse({
    daysOfWeek: formData.get("daysOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    toleranceMinutes: formData.get("toleranceMinutes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  if (scheduleId) {
    const existing = await prisma.schedule.findFirst({
      where: { id: scheduleId, orgId: session.orgId },
    });
    if (!existing) return { error: "Horaire introuvable." };
    await prisma.schedule.update({ where: { id: scheduleId }, data: parsed.data });
  } else {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, orgId: session.orgId },
    });
    if (!employee) return { error: "Employé introuvable." };
    await prisma.schedule.create({
      data: { ...parsed.data, orgId: session.orgId, employeeId },
    });
  }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: scheduleId ? "UPDATE_SCHEDULE" : "CREATE_SCHEDULE",
    entityType: "Schedule",
    entityId: scheduleId || employeeId,
  });

  revalidatePath("/horaires");
  return { success: true };
}

export async function deleteScheduleAction(scheduleId: string) {
  const session = await requireSession();
  if (session.role !== "ADMIN") return;

  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, orgId: session.orgId },
  });
  if (!existing) return;

  await prisma.schedule.delete({ where: { id: scheduleId } });
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "DELETE_SCHEDULE",
    entityType: "Schedule",
    entityId: scheduleId,
  });
  revalidatePath("/horaires");
}
