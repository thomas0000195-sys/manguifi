import { prisma } from "@/lib/prisma";
import { decryptDataUrlForDisplay } from "@/lib/crypto";
import { maskEmailAddress, csvCell } from "@/lib/console/mask";
import type { AuditFilters } from "@/lib/console/audit";

const EXPORT_LIMIT = 5000;

function where(f: AuditFilters) {
  return {
    ...(f.action ? { action: { startsWith: f.action } } : {}),
    ...(f.orgId ? { orgId: f.orgId } : {}),
    ...(f.from || f.to
      ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } }
      : {}),
  };
}

/** Export CSV du journal filtré. Plafonné à 5 000 lignes, données personnelles masquées. */
export async function auditCsv(f: AuditFilters): Promise<string> {
  const rows = await prisma.auditLog.findMany({
    where: where(f),
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    include: { user: { select: { role: true, email: true } }, org: { select: { name: true } } },
  });
  const header = ["date", "acteur_role", "acteur", "entreprise", "action", "type", "cible", "details"].join(",");
  const lines = rows.map((r) =>
    [
      csvCell(r.createdAt.toISOString()),
      csvCell(r.user?.role ?? ""),
      csvCell(r.user?.email ? maskEmailAddress(decryptDataUrlForDisplay(r.user.email)) : ""),
      csvCell(r.org?.name ?? ""),
      csvCell(r.action),
      csvCell(r.entityType),
      csvCell(r.entityId),
      csvCell(r.details ?? ""),
    ].join(",")
  );
  return [header, ...lines].join("\n");
}
