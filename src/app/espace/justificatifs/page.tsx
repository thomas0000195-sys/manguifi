import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import JustificatifsEmployeClient from "./JustificatifsEmployeClient";

export default async function EspaceJustificatifsPage() {
  const user = await requireUser(["EMPLOYEE"]);
  if (!user.employee) return null;

  const justificatifs = await prisma.justificatif.findMany({
    where: { employeeId: user.employee.id },
    orderBy: { createdAt: "desc" },
  });

  return <JustificatifsEmployeClient justificatifs={justificatifs} />;
}
