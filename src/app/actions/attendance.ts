"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  determineNextPunchType,
  computeConfidence,
  computeDailyStatus,
  resolveShiftDate,
  startOfDay,
} from "@/lib/attendance-logic";
import { distanceInMeters } from "@/lib/geo";
import { encryptDataUrl, decryptDataUrl } from "@/lib/crypto";
import type { Employee, Organization, Site, Team } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type PunchResult = {
  error?: string;
  success?: boolean;
  employeeName?: string;
  employeePhotoUrl?: string | null;
  employeePosition?: string | null;
  type?: "ARRIVEE" | "DEPART";
  time?: string;
  siteName?: string;
  confidence?: "ELEVE" | "A_VERIFIER";
  isAnomaly?: boolean;
  anomalyMessage?: string;
};

type EmployeeWithContext = Employee & { team: Team & { site: Site }; org: Organization };

async function performPunch(
  employee: EmployeeWithContext,
  site: Site,
  input: { latitude: number; longitude: number; photoDataUrl?: string; deviceFingerprint?: string }
): Promise<PunchResult> {
  const now = new Date();
  const org = employee.org;

  const type = await determineNextPunchType(employee.id, now);
  const confidence = await computeConfidence(employee.id, input.deviceFingerprint, now);

  let isAnomaly = false;
  let anomalyType: string | null = null;
  let anomalyMessage: string | undefined;

  if (site.latitude == null || site.longitude == null) {
    isAnomaly = true;
    anomalyType = "SITE_NON_GEOLOCALISE";
    anomalyMessage = "Ce site n'a pas encore de coordonnées GPS configurées — demandez à votre administrateur de les renseigner.";
  } else {
    const distance = distanceInMeters(input.latitude, input.longitude, site.latitude, site.longitude);
    if (distance > site.radiusMeters) {
      isAnomaly = true;
      anomalyType = "HORS_ZONE_GEOGRAPHIQUE";
      anomalyMessage = `Pointage à ${Math.round(distance)} m du site (zone autorisée : ${site.radiusMeters} m).`;
    }
  }

  if (org.allowedTimeWindowEnabled && org.allowedTimeWindowStart && org.allowedTimeWindowEnd) {
    const [sh, sm] = org.allowedTimeWindowStart.split(":").map(Number);
    const [eh, em] = org.allowedTimeWindowEnd.split(":").map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (nowMin < startMin || nowMin > endMin) {
      isAnomaly = true;
      anomalyType = anomalyType ?? "HORS_PLAGE_HORAIRE";
      anomalyMessage = anomalyMessage ?? "Pointage en dehors de la plage horaire autorisée.";
    }
  }

  if (confidence === "A_VERIFIER") {
    isAnomaly = true;
    anomalyType = anomalyType ?? "CONFIANCE_FAIBLE";
  }

  // The duplicate check and the insert happen inside one transaction so two
  // near-simultaneous scans (double-tap, flaky camera re-trigger) can't both
  // slip past the "last punch < 2 min ago" check before either row exists.
  try {
    await prisma.$transaction(async (tx) => {
      const last = await tx.attendance.findFirst({
        where: { employeeId: employee.id },
        orderBy: { timestamp: "desc" },
      });
      if (last && now.getTime() - last.timestamp.getTime() < 2 * 60 * 1000) {
        throw new Error("DUPLICATE_PUNCH");
      }

      return tx.attendance.create({
        data: {
          orgId: employee.orgId,
          employeeId: employee.id,
          siteId: site.id,
          type,
          timestamp: now,
          confidence,
          photoDataUrl:
            org.photoOnPunchEnabled && input.photoDataUrl
              ? encryptDataUrl(input.photoDataUrl)
              : null,
          latitude: input.latitude,
          longitude: input.longitude,
          deviceFingerprint: input.deviceFingerprint ?? null,
          isAnomaly,
          anomalyType,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE_PUNCH") {
      return {
        error: "Pointage déjà enregistré il y a moins de 2 minutes. Patientez un instant.",
      };
    }
    throw err;
  }

  if (type === "DEPART") {
    // For an overnight shift, "now" (early morning) belongs to the shift
    // that started the evening before — resolve that before computing
    // hours, so overtime lands on the day the shift actually started.
    const shiftDate = await resolveShiftDate(employee, now);
    const status = await computeDailyStatus(employee, shiftDate);

    if (status.overtimeMinutes > 0) {
      await prisma.overtimeRecord.upsert({
        where: {
          employeeId_date: { employeeId: employee.id, date: startOfDay(shiftDate) },
        },
        create: {
          orgId: employee.orgId,
          employeeId: employee.id,
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
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/rapports");
  revalidatePath("/espace");

  return {
    success: true,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeePhotoUrl: employee.photoUrl ? decryptDataUrl(employee.photoUrl) : null,
    employeePosition: employee.position,
    type,
    time: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    siteName: site.name,
    confidence,
    isAnomaly,
    anomalyMessage,
  };
}

/**
 * Scans a SITE's QR code. The employee is never derived from the QR — it's
 * always the currently logged-in user (session.employeeId). Geolocation is
 * not optional: without it, there is no way to confirm the person is
 * actually at the site, so the punch is refused rather than recorded.
 */
export async function recordPunchAction(input: {
  siteToken: string;
  latitude?: number;
  longitude?: number;
  photoDataUrl?: string;
  deviceFingerprint?: string;
}): Promise<PunchResult> {
  const session = await requireSession();
  if (!session.employeeId) {
    return { error: "Aucun profil employé n'est associé à ce compte." };
  }

  if (input.latitude == null || input.longitude == null) {
    return {
      error:
        "La géolocalisation est obligatoire pour pointer. Activez la localisation sur votre téléphone et réessayez.",
    };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: session.employeeId, orgId: session.orgId },
    include: { team: { include: { site: true } }, org: true },
  });
  if (!employee) return { error: "Employé introuvable." };
  if (employee.status !== "ACTIF") return { error: "Ce compte employé est inactif." };

  const site = await prisma.site.findFirst({
    where: { qrToken: input.siteToken, orgId: session.orgId },
  });
  if (!site) return { error: "QR code de site non reconnu." };
  if (!site.active) {
    return { error: "Ce site est désactivé. Contactez votre administrateur." };
  }

  return performPunch(employee, site, {
    latitude: input.latitude,
    longitude: input.longitude,
    photoDataUrl: input.photoDataUrl,
    deviceFingerprint: input.deviceFingerprint,
  });
}

/**
 * Manual departure fallback for when auto-detection fails (spec: "bouton de
 * confirmation manuelle de sortie"). No QR scan involved — it always
 * targets the employee's own assigned site — but geolocation is still
 * required and checked against that site the same way.
 */
export async function manualDepartureAction(input: {
  latitude?: number;
  longitude?: number;
}): Promise<PunchResult> {
  const session = await requireSession();
  if (!session.employeeId) return { error: "Aucun employé associé à ce compte." };

  if (input.latitude == null || input.longitude == null) {
    return {
      error:
        "La géolocalisation est obligatoire pour pointer. Activez la localisation sur votre téléphone et réessayez.",
    };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: session.employeeId },
    include: { team: { include: { site: true } }, org: true },
  });
  if (!employee) return { error: "Employé introuvable." };

  const last = await prisma.attendance.findFirst({
    where: { employeeId: employee.id },
    orderBy: { timestamp: "desc" },
  });
  if (!last || last.type === "DEPART") {
    return { error: "Aucune arrivée en cours à clôturer." };
  }

  return performPunch(employee, employee.team.site, {
    latitude: input.latitude,
    longitude: input.longitude,
  });
}
