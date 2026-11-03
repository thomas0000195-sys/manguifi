import { loadOnlinePayments, ONLINE_PAYMENT_STATUSES } from "@/lib/console/paiements";
import VerifierButton from "./VerifierButton";

export const dynamic = "force-dynamic";

const STATUSES = ONLINE_PAYMENT_STATUSES;

export default async function PaiementsEnLignePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status ?? "") : "";
  const mode = sp.mode === "test" || sp.mode === "reel" ? sp.mode : "";

  const { attempts, toReview, rejectedSignatures, realPayments, testPayments } = await loadOnlinePayments({ status, mode });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Paiements en ligne (PayDunya)</h1>

      {attempts.some((a) => a.isTest) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
          Les paiements de test sont séparés des encaissements réels ci-dessous.
        </div>
      )}

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="font-semibold">Encaissements réels (hors test)</p>
          <p className="mt-1 text-muted">
            {realPayments._count} paiement(s) · {(realPayments._sum.amountXof ?? 0).toLocaleString("fr-FR")} FCFA
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="font-semibold">Paiements de test (exclus des indicateurs)</p>
          <p className="mt-1 text-muted">
            {testPayments._count} paiement(s) · {(testPayments._sum.amountXof ?? 0).toLocaleString("fr-FR")} FCFA
          </p>
        </div>
      </div>

      {(toReview > 0 || rejectedSignatures > 0) && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {toReview > 0 && <p>{toReview} paiement(s) à examiner (montant ou mode différent : aucune facture marquée payée).</p>}
          {rejectedSignatures > 0 && <p>{rejectedSignatures} notification(s) PayDunya rejetée(s) sur 24 h (signature invalide).</p>}
        </div>
      )}

      <form className="flex flex-wrap gap-2 text-sm">
        <select name="status" defaultValue={status} className="rounded-xl border border-border px-3 py-2">
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || "Tous statuts"}</option>
          ))}
        </select>
        <select name="mode" defaultValue={mode} className="rounded-xl border border-border px-3 py-2">
          <option value="">Test et réel</option>
          <option value="test">Test seulement</option>
          <option value="reel">Réel seulement</option>
        </select>
        <button className="rounded-xl bg-navy-900 px-4 py-2 font-semibold text-white">Filtrer</button>
      </form>

      <ul className="space-y-2">
        {attempts.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{a.org.name} · facture {a.invoice.number}</span>
              <span className="text-xs text-muted">{a.createdAt.toLocaleString("fr-FR")}</span>
            </div>
            <p className="mt-1">
              {a.amountXof.toLocaleString("fr-FR")} FCFA · {a.status} · {a.isTest ? "TEST" : "RÉEL"}
              {a.statusDetail && <span className="text-muted"> · {a.statusDetail}</span>}
            </p>
            {a.confirmedAt && <p className="text-xs text-muted">Confirmé le {a.confirmedAt.toLocaleString("fr-FR")}</p>}
            {a.providerToken && ["PENDING", "INITIATED", "TO_REVIEW"].includes(a.status) && (
              <div className="mt-2">
                <VerifierButton attemptId={a.id} />
              </div>
            )}
          </li>
        ))}
        {attempts.length === 0 && <li className="text-sm text-muted">Aucun paiement en ligne pour ce filtre.</li>}
      </ul>
    </div>
  );
}
