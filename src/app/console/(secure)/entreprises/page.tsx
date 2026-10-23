import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? "";
  const orgs = await prisma.organization.findMany({
    where: {
      isDemo: false,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(status === "suspended" ? { suspendedAt: { not: null } } : status === "active" ? { suspendedAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, createdAt: true, suspendedAt: true, _count: { select: { sites: true, employees: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Entreprises</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Rechercher par nom" className="rounded-xl border border-border px-3 py-2 text-sm" />
        <select name="status" defaultValue={status} className="rounded-xl border border-border px-3 py-2 text-sm">
          <option value="">Tous les statuts</option>
          <option value="active">Actives</option>
          <option value="suspended">Suspendues</option>
        </select>
        <button className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Filtrer</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Sites</th>
              <th className="px-3 py-2">Employés</th>
              <th className="px-3 py-2">Inscrite le</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-3 py-2"><Link href={`/console/entreprises/${o.id}`} className="font-medium hover:underline">{o.name}</Link></td>
                <td className="px-3 py-2">{o.suspendedAt ? "Suspendue" : "Active"}</td>
                <td className="px-3 py-2">{o._count.sites}</td>
                <td className="px-3 py-2">{o._count.employees}</td>
                <td className="px-3 py-2">{o.createdAt.toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr><td className="px-3 py-4 text-muted" colSpan={5}>Aucune entreprise.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
