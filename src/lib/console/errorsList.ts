import { prisma } from "@/lib/prisma";

export type ErrorFilters = { severity?: string; source?: string; status?: string; q?: string };

/** Erreurs des 90 derniers jours, groupées par message et route. */
export async function listErrorGroups(f: ErrorFilters) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await prisma.errorLog.findMany({
    where: {
      createdAt: { gte: since },
      ...(f.severity ? { severity: f.severity } : {}),
      ...(f.source ? { source: f.source } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.q ? { message: { contains: f.q.slice(0, 100), mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const groups = new Map<string, { id: string; message: string; route: string | null; source: string; severity: string; count: number; last: Date; status: string }>();
  for (const r of rows) {
    const key = `${r.message}|${r.route ?? ""}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { id: r.id, message: r.message, route: r.route, source: r.source, severity: r.severity, count: 1, last: r.createdAt, status: r.status });
  }
  return [...groups.values()];
}

/** Échecs d'envoi OTP par canal sur les dernières 24 heures. */
export async function otpFailureCounts() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.errorLog.groupBy({
    by: ["source"],
    where: { source: { in: ["otp_email", "otp_whatsapp"] }, createdAt: { gte: since } },
    _count: { _all: true },
  });
  return {
    email: rows.find((r) => r.source === "otp_email")?._count._all ?? 0,
    whatsapp: rows.find((r) => r.source === "otp_whatsapp")?._count._all ?? 0,
  };
}
