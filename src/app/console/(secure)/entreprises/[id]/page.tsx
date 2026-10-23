import { notFound } from "next/navigation";
import { getCompanyDetail } from "@/lib/console/companyDetail";
import CompanyActions from "./CompanyActions";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCompanyDetail(id);
  if (!c) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{c.name}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs text-muted">Statut</p><p className="font-semibold">{c.suspended ? "Suspendue" : "Active"}</p></div>
        <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs text-muted">Sites</p><p className="font-semibold">{c.sites}</p></div>
        <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs text-muted">Employés</p><p className="font-semibold">{c.employees}</p></div>
        <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs text-muted">Pointages (30 j)</p><p className="font-semibold">{c.punches30}</p></div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
        <p><span className="text-muted">Administrateur :</span> {c.adminEmail}</p>
        <p className="mt-1"><span className="text-muted">Dernier pointage :</span> {c.lastPunch ? c.lastPunch.toLocaleString("fr-FR") : "aucun"}</p>
        <p className="mt-1"><span className="text-muted">Inscrite le :</span> {c.createdAt.toLocaleDateString("fr-FR")}</p>
      </div>
      <CompanyActions orgId={c.id} orgName={c.name} suspended={c.suspended} />
      <p className="text-xs text-muted">Une entreprise suspendue ne peut ni se connecter ni pointer. Ses données sont conservées.</p>
    </div>
  );
}
