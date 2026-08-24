import { prisma } from "./prisma";

/**
 * Atomically issues the next matricule for an organization, e.g. "MGF-2026-000123".
 * Uses Organization.employeeSequence as a per-org counter so numbers stay
 * sequential and unique even if employees are later deleted.
 */
export async function generateMatricule(orgId: string, year = new Date().getFullYear()) {
  const org = await prisma.organization.update({
    where: { id: orgId },
    data: { employeeSequence: { increment: 1 } },
    select: { matriculePrefix: true, employeeSequence: true },
  });

  const sequence = String(org.employeeSequence).padStart(6, "0");
  return `${org.matriculePrefix}-${year}-${sequence}`;
}
