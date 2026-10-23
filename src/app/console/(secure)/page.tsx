import Link from "next/link";
import { getDashboard, type Period } from "@/lib/console/dashboard";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "7", label: "7 jours" },
  { key: "30", label: "30 jours" },
];

function Card({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const inner = (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy-950">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function ConsoleDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = sp.period === "7" || sp.period === "30" ? sp.period : "today";
  const data = await getDashboard(period);
  const max = Math.max(1, ...data.daily.map((d) => d.count));
  const barWidth = 100 / data.daily.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Tableau de bord</h1>
        <div className="flex gap-1 rounded-xl bg-navy-50 p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/console?period=${p.key}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${period === p.key ? "bg-white text-navy-950 shadow-sm" : "text-muted"}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Comptes créés" value={data.indicators.accountsCreated} />
        <Card label="Entreprises actives (7 j)" value={`${data.indicators.activeCompanies} / ${data.indicators.totalCompanies}`} href="/console/entreprises" />
        <Card label="Employés actifs (7 j)" value={`${data.indicators.activeEmployees} / ${data.indicators.totalEmployees}`} />
        <Card label="Pointages (période)" value={data.indicators.punches} />
        <Card label="Erreurs non résolues" value={data.indicators.unresolvedErrors} href="/console/erreurs" />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Pointages par jour</h2>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-3 h-40 w-full" role="img" aria-label="Pointages par jour">
          {data.daily.map((d, i) => {
            const h = (d.count / max) * 36;
            return <rect key={d.day} x={i * barWidth + barWidth * 0.15} y={38 - h} width={barWidth * 0.7} height={h} className="fill-navy-700" />;
          })}
        </svg>
        <p className="mt-2 text-xs text-muted">Maximum sur la période : {max}</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Alertes en cours</h2>
        {data.alerts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucune alerte.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.alerts.map((a, i) => (
              <li key={i}>
                <Link href={a.href} className={`block rounded-lg px-3 py-2 text-sm ${a.severity === "critical" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>
                  {a.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Dernières inscriptions</h2>
        {data.recentCompanies.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucune inscription sur la période.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.recentCompanies.map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <Link href={`/console/entreprises/${c.id}`} className="font-medium text-navy-950 hover:underline">{c.name}</Link>
                <span className="text-muted">{c.createdAt.toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
