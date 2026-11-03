import { prisma } from "@/lib/prisma";
import { NON_TEST_PAYMENT_FILTER } from "@/lib/billing/paydunya-payments";

export const ONLINE_PAYMENT_STATUSES = ["", "INITIATED", "PENDING", "SUCCESS", "FAILED", "CANCELED", "EXPIRED", "TO_REVIEW"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Données de la page Console « Paiements en ligne ». Les encaissements réels
 * excluent les paiements de test (NON_TEST_PAYMENT_FILTER) ; les tests sont
 * affichés à part.
 */
export async function loadOnlinePayments(filter: { status: string; mode: "" | "test" | "reel" }) {
  const where = {
    ...(filter.status ? { status: filter.status as "SUCCESS" } : {}),
    ...(filter.mode === "test" ? { isTest: true } : filter.mode === "reel" ? { isTest: false } : {}),
  };
  const since = new Date(Date.now() - DAY_MS);

  const [attempts, toReview, rejectedSignatures, realPayments, testPayments] = await Promise.all([
    prisma.paymentAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { invoice: true, org: { select: { name: true } } },
    }),
    prisma.paymentAttempt.count({ where: { status: "TO_REVIEW" } }),
    prisma.errorLog.count({ where: { message: { startsWith: "billing.ipn_rejected" }, createdAt: { gte: since } } }),
    prisma.payment.aggregate({ where: { source: "PAYDUNYA", ...NON_TEST_PAYMENT_FILTER }, _sum: { amountXof: true }, _count: true }),
    prisma.payment.aggregate({ where: { source: "PAYDUNYA", isTest: true }, _sum: { amountXof: true }, _count: true }),
  ]);

  return { attempts, toReview, rejectedSignatures, realPayments, testPayments };
}
