import { getHealth } from "@/lib/console/health";

function mb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function HealthPage() {
  const h = await getHealth();
  const maxErr = Math.max(1, ...h.errorsByHour.map((e) => e.count));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Santé du système</h1>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Tâches planifiées</h2>
        {h.jobs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucun passage enregistré pour l&apos;instant.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {h.jobs.map((j) => (
              <li key={j.name} className="py-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{j.name}</span>
                  <span className={j.overdue || j.status !== "ok" ? "text-red-700" : "text-navy-800"}>
                    {j.overdue ? "En retard" : j.status === "ok" ? "OK" : "Erreur"}
                  </span>
                </div>
                <p className="text-xs text-muted">Dernier passage : {j.lastRunAt.toLocaleString("fr-FR")} · {j.durationMs} ms</p>
                {j.error && <p className="text-xs text-red-700">{j.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Taille de la base</p>
          <p className="mt-1 text-2xl font-bold">{mb(h.databaseBytes)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Erreurs sur 24 h</p>
          <p className="mt-1 text-2xl font-bold">{h.errorsByHour.reduce((a, e) => a + e.count, 0)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Erreurs par heure (24 h)</h2>
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-3 h-24 w-full" role="img" aria-label="Erreurs par heure">
          {h.errorsByHour.map((e, i) => {
            const width = 100 / Math.max(1, h.errorsByHour.length);
            const height = (e.count / maxErr) * 26;
            return <rect key={i} x={i * width + width * 0.15} y={28 - height} width={width * 0.7} height={height} className="fill-red-500" />;
          })}
        </svg>
        {h.errorsByHour.length === 0 && <p className="text-sm text-muted">Aucune erreur sur les 24 dernières heures.</p>}
      </section>

      <p className="text-xs text-muted">Les variables d&apos;environnement et les secrets ne sont jamais affichés ici.</p>
    </div>
  );
}
