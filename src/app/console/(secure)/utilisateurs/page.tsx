import { searchUsers } from "@/lib/console/users";
import BlockButton from "./BlockButton";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const results = q ? await searchUsers(q) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Utilisateurs</h1>
      <p className="text-sm text-muted">Recherche par nom, matricule, e-mail exact ou téléphone exact. Les coordonnées sont masquées.</p>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Nom, matricule MGF-…, e-mail ou téléphone" className="flex-1 rounded-xl border border-border px-3 py-2 text-sm" />
        <button className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Rechercher</button>
      </form>
      {q && results.length === 0 && <p className="text-sm text-muted">Aucun résultat.</p>}
      <ul className="space-y-3">
        {results.map((r) => (
          <li key={r.employeeId} className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{r.name} <span className="font-mono text-xs text-muted">{r.matricule}</span></p>
              <span className={`rounded-full px-2 py-0.5 text-xs ${r.blocked ? "bg-red-50 text-red-700" : "bg-navy-50 text-navy-800"}`}>
                {r.blocked ? "Bloqué" : r.status === "ACTIF" ? "Actif" : "Inactif"}
              </span>
            </div>
            <p className="mt-1 text-muted">{r.company}{r.companySuspended ? " · entreprise suspendue" : ""}</p>
            <p className="mt-1 text-xs text-muted">E-mail : {r.email} · Téléphone : {r.phone}</p>
            {r.userId && (
              <div className="mt-3">
                <BlockButton userId={r.userId} blocked={r.blocked} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">La dernière connexion et le dernier appareil ne sont pas encore enregistrés : ils n&apos;apparaissent donc pas ici.</p>
    </div>
  );
}
