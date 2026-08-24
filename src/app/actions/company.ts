"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { encryptDataUrl } from "@/lib/crypto";
import { generateMatricule } from "@/lib/matricule";
import { revalidatePath } from "next/cache";

export type ActionState = { error?: string; success?: boolean; id?: string };

export async function createSiteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const latitude = formData.get("latitude") ? Number(formData.get("latitude")) : null;
  const longitude = formData.get("longitude") ? Number(formData.get("longitude")) : null;
  const radiusMeters = Number(formData.get("radiusMeters") ?? 150);
  if (!name) return { error: "Le nom du site est requis." };
  if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { error: "La position GPS du site est requise — utilisez le bouton de géolocalisation." };
  }

  const site = await prisma.site.create({
    data: {
      orgId: session.orgId,
      name,
      address: address || null,
      latitude,
      longitude,
      radiusMeters: Number.isNaN(radiusMeters) ? 150 : radiusMeters,
    },
  });
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "CREATE_SITE",
    entityType: "Site",
    entityId: site.id,
    details: name,
  });
  revalidatePath("/equipes");
  return { success: true, id: site.id };
}

export async function updateSiteLocationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };

  const siteId = String(formData.get("siteId") ?? "");
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const radiusMeters = Number(formData.get("radiusMeters"));

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { error: "Position GPS invalide." };
  }

  const site = await prisma.site.findFirst({ where: { id: siteId, orgId: session.orgId } });
  if (!site) return { error: "Site introuvable." };

  await prisma.site.update({
    where: { id: siteId },
    data: {
      latitude,
      longitude,
      radiusMeters: Number.isNaN(radiusMeters) ? site.radiusMeters : radiusMeters,
    },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "UPDATE_SITE_LOCATION",
    entityType: "Site",
    entityId: siteId,
  });

  revalidatePath("/equipes");
  return { success: true };
}

export async function regenerateSiteQrAction(siteId: string): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };

  const site = await prisma.site.findFirst({ where: { id: siteId, orgId: session.orgId } });
  if (!site) return { error: "Site introuvable." };

  // A fresh token immediately invalidates the previous QR — anyone still
  // holding a photo of the old poster can no longer use it to punch in.
  const crypto = await import("node:crypto");
  const newToken = crypto.randomUUID();

  await prisma.site.update({
    where: { id: siteId },
    data: { qrToken: newToken, qrRegeneratedAt: new Date() },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "REGENERATE_SITE_QR",
    entityType: "Site",
    entityId: siteId,
    details: site.name,
  });

  revalidatePath("/equipes");
  return { success: true };
}

export async function toggleSiteActiveAction(siteId: string) {
  const session = await requireSession();
  if (session.role !== "ADMIN") return;

  const site = await prisma.site.findFirst({ where: { id: siteId, orgId: session.orgId } });
  if (!site) return;

  await prisma.site.update({ where: { id: siteId }, data: { active: !site.active } });
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "TOGGLE_SITE_ACTIVE",
    entityType: "Site",
    entityId: siteId,
    details: site.active ? "Désactivé" : "Réactivé",
  });
  revalidatePath("/equipes");
}

export async function createTeamAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };
  const name = String(formData.get("name") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "");
  if (!name) return { error: "Le nom de l'équipe est requis." };
  if (!siteId) return { error: "Sélectionnez un site." };

  const site = await prisma.site.findFirst({ where: { id: siteId, orgId: session.orgId } });
  if (!site) return { error: "Site introuvable." };

  const team = await prisma.team.create({
    data: { orgId: session.orgId, siteId, name },
  });

  await prisma.schedule.create({
    data: {
      orgId: session.orgId,
      teamId: team.id,
      daysOfWeek: "1,2,3,4,5,6",
      startTime: "08:00",
      endTime: "17:00",
      toleranceMinutes: 10,
    },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "CREATE_TEAM",
    entityType: "Team",
    entityId: team.id,
    details: name,
  });
  revalidatePath("/equipes");
  revalidatePath("/horaires");
  return { success: true, id: team.id };
}

const employeeSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  phone: z.string().min(6, "Téléphone requis"),
  email: z.string().email().optional().or(z.literal("")),
  teamId: z.string().min(1, "Équipe requise"),
  position: z.string().optional().or(z.literal("")),
  photoDataUrl: z.string().min(10, "La photo de profil est obligatoire."),
  dateOfBirth: z.string().optional().or(z.literal("")),
  idNumber: z.string().optional().or(z.literal("")),
});

export async function createEmployeeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };
  const parsed = employeeSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    teamId: formData.get("teamId"),
    position: formData.get("position") || "",
    photoDataUrl: formData.get("photoDataUrl") || "",
    dateOfBirth: formData.get("dateOfBirth") || "",
    idNumber: formData.get("idNumber") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const { firstName, lastName, phone: rawPhone, email, teamId, position, photoDataUrl, dateOfBirth, idNumber } =
    parsed.data;

  if (!photoDataUrl.startsWith("data:image/")) {
    return { error: "Format d'image invalide pour la photo de profil." };
  }

  const { toE164 } = await import("@/lib/phone");
  const phone = toE164(rawPhone);
  if (!phone) return { error: "Numéro de téléphone invalide." };

  const existingPhone = await prisma.employee.findUnique({ where: { phone } });
  if (existingPhone) return { error: "Ce numéro est déjà utilisé par un autre employé." };

  const team = await prisma.team.findFirst({ where: { id: teamId, orgId: session.orgId } });
  if (!team) return { error: "Équipe introuvable." };

  const matricule = await generateMatricule(session.orgId);

  const employee = await prisma.employee.create({
    data: {
      orgId: session.orgId,
      teamId,
      firstName,
      lastName,
      phone,
      email: email || null,
      position: position || null,
      photoUrl: encryptDataUrl(photoDataUrl),
      matricule,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      idNumber: idNumber || null,
    },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "CREATE_EMPLOYEE",
    entityType: "Employee",
    entityId: employee.id,
    details: `${firstName} ${lastName} (${matricule})`,
  });

  revalidatePath("/employes");
  revalidatePath("/dashboard");
  return { success: true, id: employee.id };
}

export async function toggleEmployeeStatusAction(employeeId: string) {
  const session = await requireSession();
  if (session.role !== "ADMIN") return;
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, orgId: session.orgId },
  });
  if (!employee) return;
  await prisma.employee.update({
    where: { id: employeeId },
    data: { status: employee.status === "ACTIF" ? "INACTIF" : "ACTIF" },
  });
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "TOGGLE_EMPLOYEE_STATUS",
    entityType: "Employee",
    entityId: employeeId,
  });
  revalidatePath("/employes");
}

export async function deleteEmployeeAction(employeeId: string) {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, orgId: session.orgId },
  });
  if (!employee) return { error: "Employé introuvable." };

  await prisma.employee.delete({ where: { id: employeeId } });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "DELETE_EMPLOYEE",
    entityType: "Employee",
    entityId: employeeId,
    details: `${employee.firstName} ${employee.lastName} (données de pointage et justificatifs supprimées)`,
  });

  revalidatePath("/employes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function importEmployeesCsvAction(
  rows: { firstName: string; lastName: string; phone: string; email?: string; position?: string }[],
  teamId: string
) {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };
  if (!teamId) return { error: "Équipe requise" };

  const team = await prisma.team.findFirst({ where: { id: teamId, orgId: session.orgId } });
  if (!team) return { error: "Équipe introuvable." };

  const { toE164 } = await import("@/lib/phone");
  // Phone is now globally unique (it's the WhatsApp login key), so the
  // dedupe check has to look across the whole table, not just this org.
  const existingPhones = new Set(
    (await prisma.employee.findMany({ select: { phone: true } })).map((e) => e.phone)
  );

  let count = 0;
  let skipped = 0;
  const seenInFile = new Set<string>();
  for (const row of rows) {
    if (!row.firstName || !row.lastName || !row.phone) continue;
    const phone = toE164(row.phone);
    if (!phone) {
      skipped++;
      continue;
    }
    // Skip anyone already registered or duplicated within the file itself
    // — re-importing the same CSV twice shouldn't create clones.
    if (existingPhones.has(phone) || seenInFile.has(phone)) {
      skipped++;
      continue;
    }
    seenInFile.add(phone);
    const matricule = await generateMatricule(session.orgId);
    await prisma.employee.create({
      data: {
        orgId: session.orgId,
        teamId,
        firstName: row.firstName,
        lastName: row.lastName,
        phone,
        email: row.email || null,
        position: row.position || null,
        matricule,
      },
    });
    count++;
  }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "IMPORT_EMPLOYEES_CSV",
    entityType: "Employee",
    entityId: teamId,
    details: `${count} employés importés, ${skipped} doublon(s) ignoré(s)`,
  });

  revalidatePath("/employes");
  return { success: true, count, skipped };
}

const responsableSchema = z.object({
  fullEmail: z.string().email("Email invalide"),
  password: z.string().optional().or(z.literal("")),
  teamId: z.string().min(1),
});

export async function createResponsableAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };
  const parsed = responsableSchema.safeParse({
    fullEmail: formData.get("email"),
    password: formData.get("password") || "",
    teamId: formData.get("teamId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const { fullEmail, password, teamId } = parsed.data;

  const team = await prisma.team.findFirst({ where: { id: teamId, orgId: session.orgId } });
  if (!team) return { error: "Équipe introuvable." };

  const existing = await prisma.user.findUnique({ where: { email: fullEmail } });

  if (existing) {
    if (existing.orgId !== session.orgId || existing.role !== "RESPONSABLE") {
      return { error: "Un compte existe déjà avec cet email et n'est pas un responsable de cette entreprise." };
    }
    const alreadyLinked = await prisma.responsableTeam.findUnique({
      where: { userId_teamId: { userId: existing.id, teamId } },
    });
    if (alreadyLinked) return { error: "Ce responsable est déjà assigné à cette équipe." };

    await prisma.responsableTeam.create({ data: { userId: existing.id, teamId } });
    await logAudit({
      orgId: session.orgId,
      userId: session.userId,
      action: "ASSIGN_RESPONSABLE_TEAM",
      entityType: "User",
      entityId: existing.id,
      details: `${fullEmail} → ${team.name}`,
    });
    revalidatePath("/equipes");
    return { success: true, id: existing.id };
  }

  if (!password || password.length < 8) {
    return { error: "8 caractères minimum pour le mot de passe d'un nouveau compte." };
  }

  const { hashPassword } = await import("@/lib/auth");
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      orgId: session.orgId,
      email: fullEmail,
      passwordHash,
      role: "RESPONSABLE",
      responsableTeams: { create: { teamId } },
    },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "CREATE_RESPONSABLE",
    entityType: "User",
    entityId: user.id,
    details: fullEmail,
  });

  revalidatePath("/equipes");
  return { success: true, id: user.id };
}

/**
 * Lets an admin fix a mistyped WhatsApp number — only while the employee
 * hasn't activated yet (invitationStatus EN_ATTENTE). Once they've logged
 * in once, the number is how the system recognizes them, so changing it
 * becomes a "replace this employee's phone" operation with different
 * implications and isn't allowed here.
 */
export async function updateEmployeePhoneAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };

  const employeeId = String(formData.get("employeeId") ?? "");
  const rawPhone = String(formData.get("phone") ?? "");

  const { toE164 } = await import("@/lib/phone");
  const e164 = toE164(rawPhone);
  if (!e164) return { error: "Numéro de téléphone invalide." };

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, orgId: session.orgId } });
  if (!employee) return { error: "Employé introuvable." };
  if (employee.invitationStatus === "ACTIVE") {
    return { error: "Ce numéro ne peut plus être modifié une fois la connexion WhatsApp activée." };
  }

  const existing = await prisma.employee.findUnique({ where: { phone: e164 } });
  if (existing && existing.id !== employeeId) {
    return { error: "Ce numéro est déjà utilisé par un autre employé." };
  }

  await prisma.employee.update({ where: { id: employeeId }, data: { phone: e164 } });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "UPDATE_EMPLOYEE_PHONE",
    entityType: "Employee",
    entityId: employeeId,
    details: `${employee.firstName} ${employee.lastName} → ${e164}`,
  });

  revalidatePath(`/employes/${employeeId}`);
  return { success: true };
}

export async function completeOnboardingAction() {
  const session = await requireSession();
  await prisma.organization.update({
    where: { id: session.orgId },
    data: { onboardingCompleted: true },
  });
  revalidatePath("/dashboard");
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MB, generous for a face photo

export async function updateEmployeePhotoAction(
  employeeId: string,
  photoDataUrl: string
): Promise<ActionState> {
  const session = await requireSession();
  if (session.role !== "ADMIN") return { error: "Action réservée à l'administrateur." };

  if (!photoDataUrl.startsWith("data:image/")) {
    return { error: "Format d'image invalide." };
  }
  if (photoDataUrl.length > MAX_PHOTO_BYTES * 1.4) {
    return { error: "La photo dépasse 3 Mo. Choisissez une image plus légère." };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, orgId: session.orgId },
  });
  if (!employee) return { error: "Employé introuvable." };

  await prisma.employee.update({
    where: { id: employeeId },
    data: { photoUrl: encryptDataUrl(photoDataUrl) },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "UPDATE_EMPLOYEE_PHOTO",
    entityType: "Employee",
    entityId: employeeId,
  });

  revalidatePath("/employes");
  revalidatePath(`/employes/${employeeId}`);
  return { success: true };
}
