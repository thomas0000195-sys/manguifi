import { prisma } from "./prisma";

export async function logAudit(params: {
  orgId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
}) {
  await prisma.auditLog.create({ data: params });
}
