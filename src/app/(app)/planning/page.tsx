import { requireUser, getScopedTeamIds } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import PlanningGroupClient from "./PlanningGroupClient";

export default async function PlanningGroupPage() {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);

  const teams = await prisma.team.findMany({
    where: {
      orgId: user.orgId,
      ...(scopedTeamIds ? { id: { in: scopedTeamIds } } : {}),
    },
    include: {
      site: true,
      employees: {
        select: { id: true, firstName: true, lastName: true, position: true },
        orderBy: { firstName: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return <PlanningGroupClient teams={teams} />;
}
