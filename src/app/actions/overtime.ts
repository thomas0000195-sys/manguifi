"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { assertOvertimeInScope } from "@/lib/guard";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function validateOvertimeAction(id: string, status: "VALIDEE" | "REJETEE") {
  const session = await requireSession();
  if (session.role !== "ADMIN" && session.role !== "RESPONSABLE") {
    return { error: "Action non autorisée." };
  }

  const record = await assertOvertimeInScope(
    { orgId: session.orgId, role: session.role, id: session.userId },
    id
  );
  if (!record) return { error: "Introuvable ou hors de votre périmètre." };

  await prisma.overtimeRecord.update({
    where: { id },
    data: { status, validatedById: session.userId, validatedAt: new Date() },
  });

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: status === "VALIDEE" ? "VALIDATE_OVERTIME" : "REJECT_OVERTIME",
    entityType: "OvertimeRecord",
    entityId: id,
  });

  revalidatePath("/rapports");
  revalidatePath("/dashboard");
  return { success: true };
}
