import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getScopedTeamIds } from "@/lib/dashboard";
import { decryptDataUrl } from "@/lib/crypto";
import EmployeesClient from "./EmployeesClient";

export default async function EmployesPage() {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);

  const [employeesRaw, teams] = await Promise.all([
    prisma.employee.findMany({
      where: {
        orgId: user.orgId,
        ...(scopedTeamIds ? { teamId: { in: scopedTeamIds } } : {}),
      },
      include: { team: { include: { site: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.findMany({
      where: {
        orgId: user.orgId,
        ...(scopedTeamIds ? { id: { in: scopedTeamIds } } : {}),
      },
      include: { site: true },
    }),
  ]);

  const employees = employeesRaw.map((e) => ({
    ...e,
    photoUrl: e.photoUrl ? decryptDataUrl(e.photoUrl) : null,
  }));

  return (
    <EmployeesClient
      employees={employees}
      teams={teams}
      canManage={user.role === "ADMIN"}
      idNumberEnabled={user.org.idNumberEnabled}
    />
  );
}
