/**
 * Grille tarifaire unique de Manguifi (FCFA / mois). Source de vérité : tout
 * prix ou limite de formule se lit ici, jamais dans un composant.
 *
 * Offre fondateurs : −30 % pendant 12 mois, arrondi au franc.
 * Annuel : 10 mois payés pour 12 (une année = 10 × le prix catalogue mensuel).
 */

export const PLAN_CODES = ["BASIC", "EQUIPE", "ESSENTIEL", "PREMIUM", "ENTREPRISE"] as const;
export type PlanCodeValue = (typeof PLAN_CODES)[number];

export type PlanDefinition = {
  code: PlanCodeValue;
  label: string;
  /** Prix mensuel catalogue, en FCFA. null = sur devis. */
  monthlyPrice: number | null;
  maxEmployees: number | null;
  maxSites: number | null;
};

export const PLANS: Record<PlanCodeValue, PlanDefinition> = {
  BASIC: { code: "BASIC", label: "Basic", monthlyPrice: 30000, maxEmployees: 10, maxSites: 1 },
  EQUIPE: { code: "EQUIPE", label: "Équipe", monthlyPrice: 55000, maxEmployees: 25, maxSites: 2 },
  ESSENTIEL: { code: "ESSENTIEL", label: "Essentiel", monthlyPrice: 100000, maxEmployees: 55, maxSites: 4 },
  PREMIUM: { code: "PREMIUM", label: "Premium", monthlyPrice: 150000, maxEmployees: 120, maxSites: 10 },
  // Formule Entreprise : prix, employés et sites saisis à la main (custom*).
  ENTREPRISE: { code: "ENTREPRISE", label: "Entreprise", monthlyPrice: null, maxEmployees: null, maxSites: null },
};

export const FOUNDER_DISCOUNT_RATE = 0.3;
export const FOUNDER_OFFER_MONTHS = 12;
export const TRIAL_DAYS = 30;
/** Durée de la session de la console super admin. */
export const CONSOLE_SESSION_MINUTES = 120;

export type BillingCycleValue = "MENSUEL" | "ANNUEL";

/**
 * Prix à facturer pour une formule. Lève une erreur pour Entreprise (sur devis)
 * et pour une formule inconnue : on ne devine jamais un prix.
 */
export function priceFor(plan: PlanCodeValue, options: { cycle: BillingCycleValue; founder: boolean }): number {
  const def = PLANS[plan];
  if (!def || def.monthlyPrice === null) {
    throw new Error(`Pas de prix catalogue pour la formule ${plan}.`);
  }
  if (options.cycle === "ANNUEL") {
    // L'offre fondateurs ne s'applique qu'au mensuel : décision à confirmer.
    return def.monthlyPrice * 10;
  }
  if (options.founder) {
    return Math.round(def.monthlyPrice * (1 - FOUNDER_DISCOUNT_RATE));
  }
  return def.monthlyPrice;
}
