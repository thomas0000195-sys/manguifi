/**
 * Paiement en ligne des factures via PayDunya (mode test par défaut).
 *
 * Principes (cahier des charges PayDunya, §5 et §6) :
 * - le montant est lu dans la base, jamais envoyé par le navigateur ;
 * - le contenu d'une notification n'est jamais cru : on redemande le statut
 *   réel à PayDunya avant toute écriture ;
 * - une facture n'est marquée payée que si le montant et le mode correspondent ;
 * - une seule transaction base de données crédite le paiement, et une
 *   deuxième notification identique ne crée rien (idempotence).
 *
 * Les dépendances (base, transport HTTP, configuration, horloge, emails) sont
 * injectables via `deps` : les tests s'exécutent sans base ni réseau.
 */
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/console/errors";
import { decryptDataUrlForDisplay } from "@/lib/crypto";
import { readPaydunyaConfig, type PaydunyaConfig } from "@/lib/paydunya/config";
import { confirmCheckoutInvoice, createCheckoutInvoice, type FetchLike } from "@/lib/paydunya/client";
import { sendBillingAlertEmail, sendPaymentReceivedEmail } from "./emails";

export const BILLING_FLAG_KEY = "billing.paydunya";

/** Une tentative ouverte depuis moins de ce délai est réutilisée plutôt que recréée. */
const OPEN_ATTEMPT_REUSE_MS = 30 * 60 * 1000;
/** Délai avant de revérifier une tentative restée en attente. */
const RECONCILE_AFTER_MS = 15 * 60 * 1000;
/** Au-delà, une tentative sans paiement passe en EXPIRED. */
const EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000;
const RECONCILE_BATCH_SIZE = 50;

/** Filtre à appliquer à toute donnée d'encaissement réel (indicateurs, exports). */
export const NON_TEST_PAYMENT_FILTER = { isTest: false } as const;

export class BillingError extends Error {
  constructor(
    readonly code: "forbidden" | "disabled" | "not_found" | "not_payable" | "provider" | "signature",
    message: string
  ) {
    super(message);
  }
}

type Db = typeof prisma;

export type BillingDeps = {
  db?: Db;
  /** null = intégration non configurée. Par défaut : lu depuis l'environnement. */
  cfg?: PaydunyaConfig | null;
  fetch?: FetchLike;
  now?: () => Date;
  notifyPaymentReceived?: (attemptId: string) => Promise<void>;
  alert?: (subject: string, lines: string[]) => Promise<void>;
  log?: (message: string, route: string) => Promise<void>;
};

type ResolvedDeps = Required<Omit<BillingDeps, "cfg">> & { cfg: PaydunyaConfig | null };

function resolveDeps(deps: BillingDeps): ResolvedDeps {
  return {
    db: deps.db ?? prisma,
    cfg: deps.cfg !== undefined ? deps.cfg : readPaydunyaConfig(),
    fetch: deps.fetch ?? fetch,
    now: deps.now ?? (() => new Date()),
    notifyPaymentReceived: deps.notifyPaymentReceived ?? notifyPaymentReceivedByEmail,
    alert:
      deps.alert ??
      (async (subject, lines) => {
        await sendBillingAlertEmail(subject, lines);
      }),
    log:
      deps.log ??
      (async (message, route) => {
        await logError({ severity: "warning", source: "api", message, route });
      }),
  };
}

async function notifyPaymentReceivedByEmail(attemptId: string) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: attemptId },
    include: { invoice: true, createdBy: true },
  });
  if (!attempt || !attempt.createdBy.email) return;
  await sendPaymentReceivedEmail(decryptDataUrlForDisplay(attempt.createdBy.email) ?? "", {
    invoiceNumber: attempt.invoice.number,
    amountXof: attempt.amountXof,
    paidAt: attempt.confirmedAt ?? new Date(),
    reference: attempt.providerReference ?? attempt.id,
    isTest: attempt.isTest,
  });
}

/**
 * Le paiement en ligne est-il ouvert à cette entreprise ? Deux verrous :
 * le flag Console billing.paydunya (désactivé par défaut) ET la liste blanche.
 */
export async function getPaydunyaAccess(
  orgId: string,
  deps: BillingDeps = {}
): Promise<{ allowed: true } | { allowed: false; reason: "non_configure" | "flag_desactive" | "entreprise_non_autorisee" }> {
  const d = resolveDeps(deps);
  if (!d.cfg) return { allowed: false, reason: "non_configure" };

  const flag = await d.db.featureFlag.findUnique({ where: { key: BILLING_FLAG_KEY } });
  if (!flag?.enabled) return { allowed: false, reason: "flag_desactive" };

  if (!d.cfg.enabledCompanyIds.includes(orgId)) return { allowed: false, reason: "entreprise_non_autorisee" };
  return { allowed: true };
}

export type PayerContext = { id: string; orgId: string; role: string };

/**
 * Crée (ou réutilise) la tentative et la facture PayDunya, puis renvoie
 * l'URL vers laquelle rediriger le navigateur.
 */
export async function startInvoicePayment(
  payer: PayerContext,
  invoiceId: string,
  deps: BillingDeps = {}
): Promise<{ attemptId: string; checkoutUrl: string }> {
  const d = resolveDeps(deps);
  if (payer.role !== "ADMIN") {
    throw new BillingError("forbidden", "Seul l'administrateur de l'entreprise peut payer une facture en ligne.");
  }

  const access = await getPaydunyaAccess(payer.orgId, { ...deps, db: d.db, cfg: d.cfg });
  if (!access.allowed || !d.cfg) {
    throw new BillingError("disabled", "Le paiement en ligne n'est pas disponible pour votre entreprise.");
  }
  const cfg = d.cfg;

  // La facture doit appartenir à l'entreprise de l'admin : filtre sur orgId, pas seulement sur l'id.
  const invoice = await d.db.invoice.findFirst({ where: { id: invoiceId, orgId: payer.orgId } });
  if (!invoice) throw new BillingError("not_found", "Facture introuvable.");
  if (invoice.status !== "EMISE") {
    throw new BillingError("not_payable", "Cette facture n'est pas payable (déjà payée ou annulée).");
  }
  if (cfg.mode === "live" && invoice.isProforma) {
    throw new BillingError("not_payable", "Une proforma ne peut pas être payée en ligne : une facture valide est nécessaire.");
  }
  if (!Number.isInteger(invoice.amountXof) || invoice.amountXof <= 0) {
    throw new BillingError("not_payable", "Montant de facture invalide.");
  }

  const reusable = await d.db.paymentAttempt.findFirst({
    where: {
      invoiceId: invoice.id,
      orgId: payer.orgId,
      status: { in: ["INITIATED", "PENDING"] },
      checkoutUrl: { not: null },
      createdAt: { gt: new Date(d.now().getTime() - OPEN_ATTEMPT_REUSE_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (reusable?.checkoutUrl) return { attemptId: reusable.id, checkoutUrl: reusable.checkoutUrl };

  const attempt = await d.db.paymentAttempt.create({
    data: {
      orgId: payer.orgId,
      invoiceId: invoice.id,
      amountXof: invoice.amountXof,
      currency: invoice.currency,
      status: "INITIATED",
      isTest: cfg.isTest,
      createdByUserId: payer.id,
    },
  });

  try {
    const created = await createCheckoutInvoice(
      cfg,
      {
        amountXof: invoice.amountXof,
        description: `Abonnement Manguifi — ${invoice.number}`,
        storeName: "Manguifi",
        // Seul l'identifiant de la tentative est transmis : aucune donnée personnelle.
        customData: { attemptId: attempt.id },
        returnUrl: `${cfg.appUrl}/abonnement/paiement/retour`,
        cancelUrl: `${cfg.appUrl}/abonnement?paiement=annule`,
        callbackUrl: `${cfg.appUrl}/api/billing/paydunya/ipn`,
      },
      d.fetch
    );
    await d.db.paymentAttempt.update({
      where: { id: attempt.id },
      data: { providerToken: created.token, checkoutUrl: created.checkoutUrl, status: "PENDING" },
    });
    return { attemptId: attempt.id, checkoutUrl: created.checkoutUrl };
  } catch (err) {
    await d.db.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "FAILED", statusDetail: "creation_refusee" },
    });
    await d.log(`Création de la facture PayDunya impossible : ${err instanceof Error ? err.name : "erreur"}`, "/api/billing/invoices/pay");
    throw new BillingError("provider", "Le service de paiement est indisponible. Réessayez dans quelques minutes.");
  }
}

export type ReconcileResult = {
  status: string;
  /** Vrai seulement si cet appel vient de créditer le paiement. */
  credited: boolean;
};

const OPEN_STATUSES = ["INITIATED", "PENDING"] as const;

/**
 * Rapproche une tentative avec le statut réel chez PayDunya. Idempotent : une
 * tentative déjà réussie n'est jamais recréditée. Une erreur réseau remonte
 * (l'IPN répond alors 500, et PayDunya rejouera la notification).
 */
export async function reconcileAttempt(attemptId: string, deps: BillingDeps = {}): Promise<ReconcileResult> {
  const d = resolveDeps(deps);
  const attempt = await d.db.paymentAttempt.findUnique({
    where: { id: attemptId },
    include: { invoice: true },
  });
  if (!attempt) throw new BillingError("not_found", "Tentative de paiement introuvable.");
  if (attempt.status === "SUCCESS") return { status: "SUCCESS", credited: false };
  if (!(OPEN_STATUSES as readonly string[]).includes(attempt.status)) return { status: attempt.status, credited: false };
  if (!attempt.providerToken) return { status: attempt.status, credited: false };
  if (!d.cfg) throw new BillingError("disabled", "Le paiement en ligne n'est pas configuré.");

  const confirmed = await confirmCheckoutInvoice(d.cfg, attempt.providerToken, d.fetch);

  if (!confirmed.hashValid) {
    await d.log("Réponse PayDunya non vérifiable (hash incorrect) : aucune écriture.", "/api/billing/paydunya/ipn");
    throw new BillingError("signature", "Réponse PayDunya non vérifiable.");
  }

  if (confirmed.mode !== d.cfg.mode) {
    return { status: await markToReview(d, attempt.id, "mode_incoherent"), credited: false };
  }

  switch (confirmed.status) {
    case "completed":
      return settleSuccess(d, attempt, confirmed.totalAmount);
    case "cancelled":
      return { status: await setOpenStatus(d, attempt.id, "CANCELED", confirmed.failReason), credited: false };
    case "failed":
      return { status: await setOpenStatus(d, attempt.id, "FAILED", confirmed.failReason), credited: false };
    case "pending":
      return { status: await setOpenStatus(d, attempt.id, "PENDING", null), credited: false };
    default:
      return { status: attempt.status, credited: false };
  }
}

async function setOpenStatus(
  d: ResolvedDeps,
  attemptId: string,
  status: "PENDING" | "CANCELED" | "FAILED",
  detail: string | null
): Promise<string> {
  await d.db.paymentAttempt.updateMany({
    where: { id: attemptId, status: { in: [...OPEN_STATUSES] } },
    data: { status, statusDetail: detail, ...(status === "PENDING" ? {} : { confirmedAt: d.now() }) },
  });
  return status;
}

async function markToReview(d: ResolvedDeps, attemptId: string, reason: string): Promise<string> {
  await d.db.paymentAttempt.updateMany({
    where: { id: attemptId, status: { in: [...OPEN_STATUSES] } },
    data: { status: "TO_REVIEW", statusDetail: reason },
  });
  await d.alert("Paiement en ligne à examiner", [
    `Tentative ${attemptId} : ${reason}.`,
    "Aucune facture n'a été marquée payée. Vérifier dans la Console (Paiements).",
  ]);
  return "TO_REVIEW";
}

type AttemptWithInvoice = {
  id: string;
  orgId: string;
  invoiceId: string;
  amountXof: number;
  currency: string;
  isTest: boolean;
  createdByUserId: string;
  invoice: { amountXof: number; currency: string; status: string };
};

async function settleSuccess(d: ResolvedDeps, attempt: AttemptWithInvoice, paidAmount: number | null): Promise<ReconcileResult> {
  // PayDunya ne renvoie pas de devise dans la confirmation : la devise est contrôlée côté Manguifi.
  const amountMatches = paidAmount !== null && paidAmount === attempt.amountXof && attempt.amountXof === attempt.invoice.amountXof;
  const currencyMatches = attempt.currency === "XOF" && attempt.invoice.currency === "XOF";
  if (!amountMatches || !currencyMatches) {
    const status = await markToReview(d, attempt.id, "montant_ou_devise_differents");
    return { status, credited: false };
  }
  if (attempt.invoice.status !== "EMISE") {
    const status = await markToReview(d, attempt.id, "facture_deja_reglee_ou_annulee");
    return { status, credited: false };
  }

  const now = d.now();
  const credited = await d.db.$transaction(async (tx) => {
    const claim = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: [...OPEN_STATUSES] } },
      data: { status: "SUCCESS", confirmedAt: now, statusDetail: null },
    });
    if (claim.count === 0) return false;

    await tx.payment.create({
      data: {
        orgId: attempt.orgId,
        invoiceId: attempt.invoiceId,
        amountXof: attempt.amountXof,
        currency: attempt.currency,
        source: "PAYDUNYA",
        isTest: attempt.isTest,
        paymentAttemptId: attempt.id,
        paidAt: now,
      },
    });

    const sum = await tx.payment.aggregate({ where: { invoiceId: attempt.invoiceId }, _sum: { amountXof: true } });
    if ((sum._sum.amountXof ?? 0) >= attempt.invoice.amountXof) {
      await tx.invoice.update({ where: { id: attempt.invoiceId }, data: { status: "PAYEE", paidAt: now } });
    }

    await tx.auditLog.create({
      data: {
        orgId: attempt.orgId,
        userId: attempt.createdByUserId,
        action: "billing.payment_confirmed",
        entityType: "PaymentAttempt",
        entityId: attempt.id,
        details: `montant=${attempt.amountXof} XOF, test=${attempt.isTest}`,
      },
    });
    return true;
  });

  if (!credited) return { status: "SUCCESS", credited: false };

  try {
    await d.notifyPaymentReceived(attempt.id);
  } catch {
    // L'email ne doit jamais annuler un paiement déjà enregistré.
  }
  return { status: "SUCCESS", credited: true };
}

/**
 * Rattrapage (tâche cron) : revérifie les tentatives restées ouvertes, et
 * passe en EXPIRED celles qui n'ont jamais été payées au bout de 24 h.
 */
export async function reconcileStaleAttempts(deps: BillingDeps = {}) {
  const d = resolveDeps(deps);
  const now = d.now();
  const stale = await d.db.paymentAttempt.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, createdAt: { lt: new Date(now.getTime() - RECONCILE_AFTER_MS) } },
    orderBy: { createdAt: "asc" },
    take: RECONCILE_BATCH_SIZE,
  });

  const summary = { checked: 0, credited: 0, expired: 0, errors: 0 };
  for (const attempt of stale) {
    summary.checked += 1;
    try {
      if (!attempt.providerToken) {
        // Création interrompue avant l'appel à PayDunya : rien n'a pu être payé.
        await d.db.paymentAttempt.updateMany({
          where: { id: attempt.id, status: { in: [...OPEN_STATUSES] } },
          data: { status: "EXPIRED", statusDetail: "creation_interrompue" },
        });
        summary.expired += 1;
        continue;
      }
      const result = await reconcileAttempt(attempt.id, { ...deps, db: d.db, cfg: d.cfg, fetch: d.fetch, now: d.now });
      if (result.credited) summary.credited += 1;

      const tooOld = attempt.createdAt.getTime() < now.getTime() - EXPIRE_AFTER_MS;
      if (tooOld && (OPEN_STATUSES as readonly string[]).includes(result.status)) {
        await d.db.paymentAttempt.updateMany({
          where: { id: attempt.id, status: { in: [...OPEN_STATUSES] } },
          data: { status: "EXPIRED", statusDetail: "sans_paiement_24h" },
        });
        summary.expired += 1;
      }
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}
