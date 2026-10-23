import { prisma } from "@/lib/prisma";
import { hashEmail, decryptDataUrlForDisplay } from "@/lib/crypto";
import { hashPhone } from "@/lib/phone";
import { normalizeSenegalMobile, maskPhone } from "@/lib/profile";
import { maskEmailAddress } from "@/lib/console/mask";

/**
 * Recherche d'utilisateurs : nom, matricule, e-mail exact, téléphone exact.
 * Les champs chiffrés ne sont jamais cherchés en clair : on passe par leur empreinte.
 */
export async function searchUsers(query: string) {
  const q = query.trim();
  if (q.length < 2) return [];

  const or: Record<string, unknown>[] = [
    { firstName: { contains: q, mode: "insensitive" } },
    { lastName: { contains: q, mode: "insensitive" } },
    { matricule: { equals: q.toUpperCase() } },
  ];
  if (q.includes("@")) or.push({ emailHash: hashEmail(q) });
  const e164 = normalizeSenegalMobile(q);
  if (e164) or.push({ phoneHash: hashPhone(e164) });

  const employees = await prisma.employee.findMany({
    where: { OR: or as never },
    take: 50,
    include: { org: { select: { id: true, name: true, suspendedAt: true } }, user: { select: { id: true, blockedAt: true, role: true } } },
  });

  return employees.map((e) => {
    const phoneClear = e.phone ? decryptDataUrlForDisplay(e.phone) : null;
    return {
    employeeId: e.id,
    userId: e.user?.id ?? null,
    name: `${e.firstName} ${e.lastName}`,
    matricule: e.matricule,
    company: e.org.name,
    companySuspended: !!e.org.suspendedAt,
    status: e.status,
    blocked: !!e.user?.blockedAt,
    email: e.email ? maskEmailAddress(decryptDataUrlForDisplay(e.email)) : "—",
    phone: phoneClear ? maskPhone(phoneClear) : "—",
    };
  });
}
