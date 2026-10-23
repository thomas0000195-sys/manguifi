"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { encryptDataUrl, decryptDataUrl } from "@/lib/crypto";
import { hashPhone } from "@/lib/phone";
import { normalizeSenegalMobile, maskPhone } from "@/lib/profile";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type ProfileState = { error?: string; success?: boolean };

/**
 * Un employé modifie son propre numéro de téléphone. L'identifiant vient de la
 * session, jamais du formulaire, et seul le téléphone est accepté : nom,
 * matricule, poste, équipe, site et horaire restent gérés par l'administration.
 */
export async function updateMyPhoneAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await requireSession();
  if (session.role !== "EMPLOYEE" || !session.employeeId) {
    return { error: "Réservé aux comptes employé." };
  }

  if (!(await checkRateLimit("profile-update", session.employeeId, { limit: 5, windowMs: 60 * 1000 }))) {
    return { error: "Trop de modifications. Réessayez dans une minute." };
  }

  const e164 = normalizeSenegalMobile(String(formData.get("phone") ?? ""));
  if (!e164) {
    return { error: "Numéro invalide : 9 chiffres commençant par 70, 75, 76, 77 ou 78." };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: session.employeeId, orgId: session.orgId },
    include: { user: true },
  });
  if (!employee) return { error: "Profil introuvable." };

  const newHash = hashPhone(e164);
  if (employee.phoneHash === newHash) return { success: true };

  // Le numéro doit rester unique : on refuse sans révéler à qui il appartient.
  const takenByEmployee = await prisma.employee.findFirst({
    where: { phoneHash: newHash, id: { not: employee.id } },
    select: { id: true },
  });
  const takenByUser = employee.user
    ? await prisma.user.findFirst({ where: { phoneHash: newHash, id: { not: employee.user.id } }, select: { id: true } })
    : null;
  if (takenByEmployee || takenByUser) {
    return { error: "Ce numéro ne peut pas être utilisé. Contactez votre administrateur." };
  }

  const oldPhone = employee.phone ? decryptDataUrl(employee.phone) : null;

  await prisma.employee.update({
    where: { id: employee.id },
    data: { phone: encryptDataUrl(e164), phoneHash: newHash },
  });
  if (employee.user) {
    await prisma.user.update({
      where: { id: employee.user.id },
      data: { phone: encryptDataUrl(e164), phoneHash: newHash },
    });
  }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: "profile.phone_updated",
    entityType: "Employee",
    entityId: employee.id,
    details: JSON.stringify({
      old: oldPhone ? maskPhone(oldPhone) : null,
      new: maskPhone(e164),
    }),
  });

  revalidatePath("/espace/compte");
  return { success: true };
}
