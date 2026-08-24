"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertAttendanceInScope } from "@/lib/guard";
import { computeDailyStatus, resolveShiftDate, startOfDay } from "@/lib/attendance-logic";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type ReviewState = { error?: string; success?: boolean };

/**
 * Recomputes and upserts the OvertimeRecord for the shift a (possibly just
 * corrected) DEPART belongs to — keeps hours consistent after a manual fix
 * instead of leaving a stale overtime figure behind.
 */
async function refreshOvertimeForDeparture(employeeId: string, orgId: string, timestamp: Date) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return;

  const shiftDate = await resolveShiftDate(employee, timestamp);
  const status = await computeDailyStatus(employee, shiftDate);

  if (status.overtimeMinutes > 0) {
    await prisma.overtimeRecord.upsert({
      where: { employeeId_date: { employeeId, date: startOfDay(shiftDate) } },
      create: {
        orgId,
        employeeId,
        date: startOfDay(shiftDate),
        plannedMinutes: status.plannedMinutes,
        workedMinutes: status.workedMinutes,
        overtimeMinutes: status.overtimeMinutes,
        status: "NON_PLANIFIEE",
      },
      update: {
        workedMinutes: status.workedMinutes,
        overtimeMinutes: status.overtimeMinutes,
      },
    });
  } else {
    // Correction removed the overtime — drop any stale unvalidated record
    // for that day rather than leaving a number that's no longer true.
    await prisma.overtimeRecord.deleteMany({
      where: { employeeId, date: startOfDay(shiftDate), status: "NON_PLANIFIEE" },
    });
  }
}

/** Marks a flagged pointage as reviewed and fine as-is — no change to its data. */
export async function validateAttendanceAction(
  attendanceId: string,
  reason: string
): Promise<ReviewState> {
  const session = await requireSession();
  if (session.role !== "ADMIN" && session.role !== "RESPONSABLE") {
    return { error: "Action non autorisée." };
  }
  if (!reason.trim()) return { error: "Un motif est requis." };

  const attendance = await assertAttendanceInScope(
    { orgId: session.orgId, role: session.role, id: session.userId },
    attendanceId
  );
  if (!attendance) return { error: "Pointage introuvable ou hors de votre périmètre." };

  await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      isAnomaly: false,
      correctedById: session.userId,
      correctionReason: reason.trim(),
    },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "VALIDATE_ATTENDANCE",
    entityType: "Attendance",
    entityId: attendanceId,
    details: reason.trim(),
  });

  revalidatePath("/rapports");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Edits a pointage's time (and/or type) with a mandatory reason. */
export async function correctAttendanceAction(input: {
  attendanceId: string;
  newTime: string; // "HH:MM"
  newType: "ARRIVEE" | "DEPART";
  reason: string;
}): Promise<ReviewState> {
  const session = await requireSession();
  if (session.role !== "ADMIN" && session.role !== "RESPONSABLE") {
    return { error: "Action non autorisée." };
  }
  if (!input.reason.trim()) return { error: "Un motif est requis pour toute correction." };

  const attendance = await assertAttendanceInScope(
    { orgId: session.orgId, role: session.role, id: session.userId },
    input.attendanceId
  );
  if (!attendance) return { error: "Pointage introuvable ou hors de votre périmètre." };

  const [h, m] = input.newTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return { error: "Heure invalide." };

  const newTimestamp = new Date(attendance.timestamp);
  newTimestamp.setHours(h, m, 0, 0);

  await prisma.attendance.update({
    where: { id: input.attendanceId },
    data: {
      timestamp: newTimestamp,
      type: input.newType,
      isAnomaly: false,
      correctedById: session.userId,
      correctionReason: input.reason.trim(),
    },
  });

  if (input.newType === "DEPART") {
    await refreshOvertimeForDeparture(attendance.employeeId, session.orgId, newTimestamp);
  }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "CORRECT_ATTENDANCE",
    entityType: "Attendance",
    entityId: input.attendanceId,
    details: `${input.reason.trim()} (nouvelle heure : ${input.newTime})`,
  });

  revalidatePath("/rapports");
  revalidatePath("/dashboard");
  revalidatePath("/espace/historique");
  return { success: true };
}
