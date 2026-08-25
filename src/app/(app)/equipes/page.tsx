import { requireUser, getScopedTeamIds } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { generateSiteQrDataUrl } from "@/lib/qr";
import { decryptDataUrl } from "@/lib/crypto";
import EquipesClient from "./EquipesClient";

export default async function EquipesPage() {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);

  const sitesRaw = await prisma.site.findMany({
    where: { orgId: user.orgId },
    include: {
      teams: {
        where: scopedTeamIds ? { id: { in: scopedTeamIds } } : undefined,
        include: {
          _count: { select: { employees: true } },
          responsables: { include: { user: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // A responsable only sees sites that actually host one of their teams.
  const visibleSites = scopedTeamIds ? sitesRaw.filter((s) => s.teams.length > 0) : sitesRaw;

  const sites = await Promise.all(
    visibleSites.map(async (s) => ({
      ...s,
      qrDataUrl: user.role === "ADMIN" ? await generateSiteQrDataUrl(s.qrToken) : null,
      teams: s.teams.map((t) => ({
        ...t,
        responsables: t.responsables.map((r) => ({
          ...r,
          user: {
            ...r.user,
            email: r.user.email ? decryptDataUrl(r.user.email) : null,
            phone: r.user.phone ? decryptDataUrl(r.user.phone) : null,
          },
        })),
      })),
    }))
  );

  return <EquipesClient sites={sites} canManage={user.role === "ADMIN"} />;
}
