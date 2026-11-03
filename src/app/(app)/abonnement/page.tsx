import Link from "next/link";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getPaydunyaAccess } from "@/lib/billing/paydunya-payments";
import { readPaydunyaConfig } from "@/lib/paydunya/config";
import PayInvoiceButton from "./PayInvoiceButton";
import BandeauTest from "./BandeauTest";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  EMISE: "À payer",
  PAYEE: "Payée",
  ANNULEE: "Annulée",
} as const;

function formatXof(amount: number) {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

function safeConfig() {
  try {
    return readPaydunyaConfig();
  } catch {
    return null;
  }
}

export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ paiement?: string }>;
}) {
  const user = await requireUser(["ADMIN"]);
  const { paiement } = await searchParams;

  const [invoices, access] = await Promise.all([
    prisma.invoice.findMany({ where: { orgId: user.orgId }, orderBy: { issuedAt: "desc" }, take: 50 }),
    getPaydunyaAccess(user.orgId),
  ]);
  const cfg = safeConfig();

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:py-8">
      <h1 className="text-xl font-bold text-navy-950">Mon abonnement</h1>
      <p className="text-sm text-muted">{user.org.name}</p>

      {cfg?.isTest && <BandeauTest />}

      {paiement === "annule" && (
        <p className="mt-4 rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-700">
          Paiement annulé. Votre facture n&apos;a pas été modifiée.
        </p>
      )}

      <p className="mt-6 text-sm text-slate-600">
        Le plan et l&apos;échéance de votre abonnement ne sont pas encore affichés ici : ils seront ajoutés avec la gestion
        des factures.
      </p>

      <h2 className="mt-8 text-base font-semibold text-navy-950">Mes factures</h2>
      {invoices.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Aucune facture pour le moment.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {invoices.map((invoice) => {
            const payable =
              access.allowed && invoice.status === "EMISE" && !(cfg?.mode === "live" && invoice.isProforma);
            return (
              <li key={invoice.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-navy-950">Facture {invoice.number}</span>
                  <span className="text-sm text-slate-600">{STATUS_LABEL[invoice.status]}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {invoice.issuedAt.toLocaleDateString("fr-FR")} · {formatXof(invoice.amountXof)}
                  {invoice.isProforma && " · proforma"}
                </p>
                {payable && <PayInvoiceButton invoiceId={invoice.id} />}
              </li>
            );
          })}
        </ul>
      )}

      {!access.allowed && (
        <p className="mt-6 text-xs text-slate-500">
          Le paiement en ligne n&apos;est pas activé pour votre entreprise. Pour régler une facture, contactez Manguifi.
        </p>
      )}
      <p className="mt-6">
        <Link href="/dashboard" className="text-sm text-navy-950 underline">
          Retour au tableau de bord
        </Link>
      </p>
    </div>
  );
}
