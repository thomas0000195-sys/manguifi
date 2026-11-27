import { prisma } from "./prisma";
import { PLANS, type PlanCodeValue } from "./console/pricing";

/** Sous-ensemble des champs d'abonnement utiles aux règles d'accès. */
export type SubscriptionFacts = {
  plan: PlanCodeValue;
  status: "ESSAI" | "ACTIF" | "IMPAYE" | "SUSPENDU" | "RESILIE" | "EXPIRE";
  trialEndDate: Date | null;
  currentPeriodEnd: Date | null;
  customMaxEmployees: number | null;
  customMaxSites: number | null;
};

export type AccessState = {
  /** false = aucune ligne d'abonnement : entreprise non configurée, accès d'origine. */
  configured: boolean;
  /** true = accès très limité : l'admin peut se connecter et voir ses données, rien d'autre. */
  limited: boolean;
  maxEmployees: number | null;
  maxSites: number | null;
};

const FULL_ACCESS: AccessState = { configured: false, limited: false, maxEmployees: null, maxSites: null };

/**
 * Règles d'accès, pures et testables. `now` est injecté pour les tests.
 * - essai dépassé, impayé, suspendu, résilié ou expiré : accès très limité ;
 * - période payée dépassée : accès très limité (pas d'attente silencieuse) ;
 * - limites : celles de la formule, ou les valeurs saisies pour Entreprise.
 */
export function computeAccess(sub: SubscriptionFacts | null, now: Date): AccessState {
  if (!sub) return FULL_ACCESS;

  const trialOver = sub.status === "ESSAI" && !!sub.trialEndDate && sub.trialEndDate < now;
  const periodOver = sub.status === "ACTIF" && !!sub.currentPeriodEnd && sub.currentPeriodEnd < now;
  const blockedStatus = sub.status === "IMPAYE" || sub.status === "SUSPENDU" || sub.status === "RESILIE" || sub.status === "EXPIRE";

  const def = PLANS[sub.plan];
  return {
    configured: true,
    limited: trialOver || periodOver || blockedStatus,
    maxEmployees: sub.customMaxEmployees ?? def.maxEmployees,
    maxSites: sub.customMaxSites ?? def.maxSites,
  };
}

/** État d'accès d'une entreprise, lu en base. */
export async function getAccessState(orgId: string, now: Date = new Date()): Promise<AccessState> {
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    select: {
      plan: true,
      status: true,
      trialEndDate: true,
      currentPeriodEnd: true,
      customMaxEmployees: true,
      customMaxSites: true,
    },
  });
  return computeAccess(sub, now);
}

/** Refuse un ajout d'employé ou de site si l'entreprise est en accès limité ou au plafond. */
export function checkCanAdd(access: AccessState, kind: "employee" | "site", currentCount: number): string | null {
  if (access.limited) {
    return "Votre abonnement n'est plus actif. Contactez Manguifi pour le renouveler avant d'ajouter des éléments.";
  }
  const max = kind === "employee" ? access.maxEmployees : access.maxSites;
  if (max !== null && currentCount >= max) {
    return kind === "employee"
      ? `Limite de ${max} employés atteinte pour votre formule. Passez à une formule supérieure pour en ajouter.`
      : `Limite de ${max} site(s) atteinte pour votre formule. Passez à une formule supérieure pour en ajouter.`;
  }
  return null;
}

/** Vérifie qu'un pointage peut être enregistré (accès limité = pas de pointage). */
export function checkCanPunch(access: AccessState): string | null {
  return access.limited ? "Le pointage est suspendu : l'abonnement de votre entreprise n'est plus actif." : null;
}
