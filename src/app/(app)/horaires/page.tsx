import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getScopedTeamIds } from "@/lib/dashboard";
import HorairesClient from "./HorairesClient";

export default async function HorairesPage() {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);

  const teams = await prisma.team.findMany({
    where: {
      orgId: user.orgId,
      ...(scopedTeamIds ? { id: { in: scopedTeamIds } } : {}),
    },
    include: {
      schedules: { where: { employeeId: null } },
      employees: {
        include: { schedules: true },
      },
      site: true,
    },
  });

  return <HorairesClient teams={teams} canManage={user.role === "ADMIN"} />;
}
