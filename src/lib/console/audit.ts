import { prisma } from "@/lib/prisma";
import { decryptDataUrlForDisplay } from "@/lib/crypto";
import { maskEmailAddress } from "@/lib/console/mask";

/**
 * Lecture seule du journal d'audit. Aucune fonction d'écriture, de mise à jour
 * ou de suppression n'est exposée par ce module.
 */

export type AuditFilters = {
  from?: Date;
  to?: Date;
  action?: string;
  orgId?: string;
  page?: number;
};

export const AUDIT_PAGE_SIZE = 50;

export async function listAuditLogs(filters: AuditFilters) {
  const where = {
    ...(filters.action ? { action: { startsWith: filters.action } } : {}),
    ...(filters.orgId ? { orgId: filters.orgId } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {}),
  };
  const page = Math.max(1, filters.page ?? 1);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { user: { select: { role: true, email: true } }, org: { select: { name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    total,
    page,
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      actorRole: r.user?.role ?? "—",
      actor: maskEmailAddress(r.user?.email ? decryptDataUrlForDisplay(r.user.email) : null),
      company: r.org?.name ?? "—",
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      details: r.details,
    })),
  };
}
