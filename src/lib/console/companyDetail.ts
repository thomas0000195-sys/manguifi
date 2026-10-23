import { prisma } from "@/lib/prisma";
import { decryptDataUrlForDisplay } from "@/lib/crypto";
import { maskEmailAddress } from "@/lib/console/mask";

/** Données de la fiche entreprise. Agrégats et métadonnées uniquement, jamais de pointage détaillé. */
export async function getCompanyDetail(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: { where: { role: "ADMIN" }, take: 1, select: { email: true } },
      _count: { select: { sites: true, employees: true } },
    },
  });
  if (!org || org.isDemo) return null;

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [punches30, lastPunch] = await Promise.all([
    prisma.attendance.count({ where: { orgId: id, timestamp: { gte: since30 } } }),
    prisma.attendance.findFirst({ where: { orgId: id }, orderBy: { timestamp: "desc" }, select: { timestamp: true } }),
  ]);
  const admin = org.users[0];

  return {
    id: org.id,
    name: org.name,
    suspended: !!org.suspendedAt,
    createdAt: org.createdAt,
    sites: org._count.sites,
    employees: org._count.employees,
    punches30,
    lastPunch: lastPunch?.timestamp ?? null,
    adminEmail: admin?.email ? maskEmailAddress(decryptDataUrlForDisplay(admin.email)) : "—",
  };
}
