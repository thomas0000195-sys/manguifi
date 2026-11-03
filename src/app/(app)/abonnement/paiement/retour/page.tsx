import Link from "next/link";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { reconcileAttempt } from "@/lib/billing/paydunya-payments";
import { readPaydunyaConfig } from "@/lib/paydunya/config";
import BandeauTest from "../../BandeauTest";

export const dynamic = "force-dynamic";

type View = { title: string; text: string; retry: boolean };

function describe(status: string | null): View {
  switch (status) {
    case "SUCCESS":
      return { title: "Paiement confirmé", text: "Votre facture a été réglée.", retry: false };
    case "PENDING":
    case "INITIATED":
      return {
        title: "En attente de confirmation",
        text: "PayDunya n'a pas encore confirmé le paiement. Rechargez cette page dans quelques minutes.",
        retry: false,
      };
    case "TO_REVIEW":
      return {
        title: "Paiement en cours de vérification",
        text: "Manguifi vérifie ce paiement avant de l'enregistrer. Aucune facture n'a été modifiée.",
        retry: false,
      };
    default:
      return {
        title: "Paiement non abouti",
        text: "Le paiement n'a pas été effectué. Aucune facture n'a été modifiée.",
        retry: true,
      };
  }
}

/**
 * Retour du navigateur après PayDunya. Le paramètre d'URL ne sert qu'à retrouver
 * la tentative ; le résultat affiché vient du statut vérifié côté serveur.
 */
export default async function RetourPaiementPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await requireUser(["ADMIN"]);
  const { token } = await searchParams;

  const attempt =
    token && token.length <= 200
      ? await prisma.paymentAttempt.findFirst({ where: { providerToken: token, orgId: user.orgId } })
      : null;

  let status: string | null = null;
  if (attempt) {
    try {
      status = (await reconcileAttempt(attempt.id)).status;
    } catch {
      // Vérification impossible pour l'instant : on affiche l'état connu, le rattrapage traitera la suite.
      status = (await prisma.paymentAttempt.findUnique({ where: { id: attempt.id } }))?.status ?? null;
    }
  }

  let isTest = false;
  try {
    isTest = readPaydunyaConfig()?.isTest ?? false;
  } catch {
    isTest = false;
  }

  const view = describe(status);

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:py-8">
      {isTest && <BandeauTest />}
      <h1 className="mt-4 text-xl font-bold text-navy-950">{view.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{view.text}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {view.retry && (
          <Link href="/abonnement" className="rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-semibold text-white">
            Réessayer
          </Link>
        )}
        <Link href="/abonnement" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-navy-950">
          Retour à mon abonnement
        </Link>
      </div>
    </div>
  );
}
