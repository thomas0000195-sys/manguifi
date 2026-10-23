import { listErrorGroups, otpFailureCounts } from "@/lib/console/errorsList";
import ResolveButton from "./ResolveButton";

const SEVERITIES = ["", "info", "warning", "error", "critical"];
const SOURCES = ["", "api", "client", "cron", "otp_email", "otp_whatsapp", "pointage"];

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; source?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const [groups, otp] = await Promise.all([listErrorGroups(sp), otpFailureCounts()]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Erreurs et incidents</h1>
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
        <p className="font-semibold">Échecs d&apos;envoi OTP sur 24 h</p>
        <p className="mt-1 text-muted">E-mail : {otp.email} · WhatsApp : {otp.whatsapp}</p>
      </div>
      <form className="flex flex-wrap gap-2 text-sm">
        <select name="severity" defaultValue={sp.severity ?? ""} className="rounded-xl border border-border px-3 py-2">
          {SEVERITIES.map((s) => <option key={s} value={s}>{s || "Toutes gravités"}</option>)}
        </select>
        <select name="source" defaultValue={sp.source ?? ""} className="rounded-xl border border-border px-3 py-2">
          {SOURCES.map((s) => <option key={s} value={s}>{s || "Toutes sources"}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-xl border border-border px-3 py-2">
          <option value="">Tous statuts</option>
          <option value="OPEN">Ouverts</option>
          <option value="RESOLVED">Résolus</option>
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Texte" className="rounded-xl border border-border px-3 py-2" />
        <button className="rounded-xl bg-navy-900 px-4 py-2 font-semibold text-white">Filtrer</button>
      </form>
      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.id} className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{g.severity} · {g.source} · {g.count} occurrence(s)</span>
              <span className="text-xs text-muted">{g.last.toLocaleString("fr-FR")}</span>
            </div>
            <p className="mt-1 break-words">{g.message}</p>
            {g.route && <p className="mt-1 font-mono text-xs text-muted">{g.route}</p>}
            {g.status === "OPEN" && <div className="mt-2"><ResolveButton errorId={g.id} /></div>}
          </li>
        ))}
        {groups.length === 0 && <li className="text-sm text-muted">Aucune erreur sur la période.</li>}
      </ul>
      <p className="text-xs text-muted">Conservation : 90 jours. Les codes, jetons, e-mails et téléphones sont masqués avant enregistrement.</p>
    </div>
  );
}
