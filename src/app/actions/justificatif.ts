"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { encryptDataUrl } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

export type ActionState = { error?: string; success?: boolean };

const motifPayType: Record<string, "PAYE" | "NON_PAYE"> = {
  MALADIE: "PAYE",
  CONGE_PAYE: "PAYE",
  CONGE_SANS_SOLDE: "NON_PAYE",
  AUTORISATION_EXCEPTIONNELLE: "PAYE",
  DEUIL: "PAYE",
  AUTRE: "NON_PAYE",
};

const submitSchema = z.object({
  dateStart: z.string().min(1),
  dateEnd: z.string().min(1),
  motif: z.enum([
    "MALADIE",
    "CONGE_PAYE",
    "CONGE_SANS_SOLDE",
    "AUTORISATION_EXCEPTIONNELLE",
    "DEUIL",
    "AUTRE",
  ]),
  documentDataUrl: z
    .string()
    .min(10, "Un document est requis")
    .max(7_500_000, "Le fichier dépasse la taille maximale autorisée (5 Mo)."),
});

export async function submitJustificatifAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  if (!session.employeeId) return { error: "Aucun employé associé à ce compte." };

  const parsed = submitSchema.safeParse({
    dateStart: formData.get("dateStart"),
    dateEnd: formData.get("dateEnd"),
    motif: formData.get("motif"),
    documentDataUrl: formData.get("documentDataUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const { dateStart, dateEnd, motif, documentDataUrl } = parsed.data;

  await prisma.justificatif.create({
    data: {
      orgId: session.orgId,
      employeeId: session.employeeId,
      dateStart: new Date(dateStart),
      dateEnd: new Date(dateEnd),
      motif,
      payType: motifPayType[motif],
      documentDataUrl: encryptDataUrl(documentDataUrl),
      status: "EN_ATTENTE",
    },
  });

  revalidatePath("/espace/justificatifs");
  revalidatePath("/justificatifs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function reviewJustificatifAction(input: {
  id: string;
  status: "JUSTIFIE" | "REFUSE";
  comment?: string;
}) {
  const session = await requireSession();
  if (session.role !== "ADMIN" && session.role !== "RESPONSABLE") {
    return { error: "Action non autorisée." };
  }

  const justificatif = await prisma.justificatif.findFirst({
    where: { id: input.id, orgId: session.orgId },
    include: { employee: true },
  });
  if (!justificatif) return { error: "Justificatif introuvable" };

  if (session.role === "RESPONSABLE") {
    const { getScopedTeamIds } = await import("@/lib/guard");
    const scopedTeamIds = await getScopedTeamIds(session.orgId, session.role, session.userId);
    if (scopedTeamIds && !scopedTeamIds.includes(justificatif.employee.teamId)) {
      return { error: "Ce justificatif ne fait pas partie de votre périmètre." };
    }
  }

  await prisma.justificatif.update({
    where: { id: input.id },
    data: {
      status: input.status,
      comment: input.comment || null,
      reviewedById: session.userId,
      reviewedAt: new Date(),
    },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: input.status === "JUSTIFIE" ? "APPROVE_JUSTIFICATIF" : "REJECT_JUSTIFICATIF",
    entityType: "Justificatif",
    entityId: input.id,
    details: input.comment,
  });

  revalidatePath("/justificatifs");
  revalidatePath("/dashboard");
  revalidatePath("/espace/justificatifs");
  return { success: true };
}
