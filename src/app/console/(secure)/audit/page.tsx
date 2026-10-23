import Link from "next/link";
import { listAuditLogs, AUDIT_PAGE_SIZE } from "@/lib/console/audit";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(sp.to) : undefined;
  const data = await listAuditLogs({ action: sp.action, from, to, page });
  const pages = Math.max(1, Math.ceil(data.total / AUDIT_PAGE_SIZE));
  const qs = new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) }).toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Journal d&apos;audit</h1>
        <a href={`/api/console/audit/export?${qs}`} className="rounded-xl border border-border px-3 py-2 text-sm font-medium">Exporter en CSV</a>
      </div>
      <p className="text-sm text-muted">Lecture seule : ce journal ne peut être ni modifié ni supprimé depuis l&apos;application.</p>
      <form className="flex flex-wrap gap-2 text-sm">
        <input name="action" defaultValue={sp.action ?? ""} placeholder="Action (ex. console.)" className="rounded-xl border border-border px-3 py-2" />
        <input name="from" type="date" defaultValue={sp.from ?? ""} className="rounded-xl border border-border px-3 py-2" />
        <input name="to" type="date" defaultValue={sp.to ?? ""} className="rounded-xl border border-border px-3 py-2" />
        <button className="rounded-xl bg-navy-900 px-4 py-2 font-semibold text-white">Filtrer</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-xs">
          <thead className="bg-navy-50 text-left text-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Acteur</th>
              <th className="px-3 py-2">Entreprise</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Cible</th>
              <th className="px-3 py-2">Détails</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-3 py-2 whitespace-nowrap">{r.createdAt.toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2">{r.actorRole} · {r.actor}</td>
                <td className="px-3 py-2">{r.company}</td>
                <td className="px-3 py-2 font-mono">{r.action}</td>
                <td className="px-3 py-2">{r.entityType}</td>
                <td className="px-3 py-2 break-words">{r.details ?? "—"}</td>
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td className="px-3 py-4 text-muted" colSpan={6}>Aucune entrée.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        {page > 1 ? <Link href={`/console/audit?${qs}&page=${page - 1}`}>← Précédent</Link> : <span />}
        <span className="text-muted">Page {page} / {pages}</span>
        {page < pages ? <Link href={`/console/audit?${qs}&page=${page + 1}`}>Suivant →</Link> : <span />}
      </div>
    </div>
  );
}
