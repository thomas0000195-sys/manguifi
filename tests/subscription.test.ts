/**
 * Règles d'abonnement pures : grille tarifaire, accès limité, plafonds de
 * formule et pointage. Aucune base : les fonctions reçoivent `now` et les
 * compteurs en paramètre.
 *
 * Lancer avec : npm run test:auth
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { priceFor, PLANS, TRIAL_DAYS, CONSOLE_SESSION_MINUTES } from "../src/lib/console/pricing";
import { computeAccess, checkCanAdd, checkCanPunch, type SubscriptionFacts } from "../src/lib/subscription";

const NOW = new Date("2026-11-27T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

function sub(overrides: Partial<SubscriptionFacts> = {}): SubscriptionFacts {
  return {
    plan: "BASIC",
    status: "ESSAI",
    trialEndDate: days(TRIAL_DAYS),
    currentPeriodEnd: null,
    customMaxEmployees: null,
    customMaxSites: null,
    ...overrides,
  };
}

test("grille : prix catalogue, offre fondateurs et annuel conformes au tarif", () => {
  assert.equal(priceFor("BASIC", { cycle: "MENSUEL", founder: false }), 30000);
  assert.equal(priceFor("BASIC", { cycle: "MENSUEL", founder: true }), 21000);
  assert.equal(priceFor("EQUIPE", { cycle: "MENSUEL", founder: true }), 38500);
  assert.equal(priceFor("ESSENTIEL", { cycle: "MENSUEL", founder: true }), 70000);
  assert.equal(priceFor("PREMIUM", { cycle: "MENSUEL", founder: true }), 105000);
  assert.equal(priceFor("BASIC", { cycle: "ANNUEL", founder: false }), 300000);
  assert.equal(priceFor("EQUIPE", { cycle: "ANNUEL", founder: false }), 550000);
  assert.equal(priceFor("ESSENTIEL", { cycle: "ANNUEL", founder: false }), 1000000);
  assert.equal(priceFor("PREMIUM", { cycle: "ANNUEL", founder: false }), 1500000);
});

test("grille : Entreprise (sur devis) n'a pas de prix catalogue", () => {
  assert.throws(() => priceFor("ENTREPRISE", { cycle: "MENSUEL", founder: false }));
  assert.equal(PLANS.ENTREPRISE.maxEmployees, null);
});

test("grille : limites de formule", () => {
  assert.deepEqual(
    [PLANS.BASIC.maxEmployees, PLANS.BASIC.maxSites, PLANS.PREMIUM.maxEmployees, PLANS.PREMIUM.maxSites],
    [10, 1, 120, 10]
  );
});

test("entreprise sans abonnement : accès d'origine, aucune limite", () => {
  const a = computeAccess(null, NOW);
  assert.equal(a.configured, false);
  assert.equal(a.limited, false);
  assert.equal(checkCanAdd(a, "employee", 999), null);
  assert.equal(checkCanPunch(a), null);
});

test("essai en cours : accès normal", () => {
  const a = computeAccess(sub(), NOW);
  assert.equal(a.limited, false);
});

test("essai dépassé : accès très limité, pointage et ajout bloqués", () => {
  const a = computeAccess(sub({ trialEndDate: days(-1) }), NOW);
  assert.equal(a.limited, true);
  assert.notEqual(checkCanPunch(a), null);
  assert.notEqual(checkCanAdd(a, "employee", 0), null);
  assert.notEqual(checkCanAdd(a, "site", 0), null);
});

test("statuts bloquants : impayé, suspendu, résilié, expiré", () => {
  for (const status of ["IMPAYE", "SUSPENDU", "RESILIE", "EXPIRE"] as const) {
    assert.equal(computeAccess(sub({ status }), NOW).limited, true, status);
  }
});

test("période payée dépassée : accès très limité", () => {
  const a = computeAccess(sub({ status: "ACTIF", trialEndDate: null, currentPeriodEnd: days(-2) }), NOW);
  assert.equal(a.limited, true);
});

test("plafond d'employés : refus à la limite, accepté en dessous", () => {
  const a = computeAccess(sub({ plan: "BASIC" }), NOW);
  assert.equal(checkCanAdd(a, "employee", 9), null);
  assert.notEqual(checkCanAdd(a, "employee", 10), null);
});

test("plafond de sites : Basic = 1 site", () => {
  const a = computeAccess(sub({ plan: "BASIC" }), NOW);
  assert.equal(checkCanAdd(a, "site", 0), null);
  assert.notEqual(checkCanAdd(a, "site", 1), null);
});

test("formule Entreprise : limites saisies à la main", () => {
  const a = computeAccess(sub({ plan: "ENTREPRISE", customMaxEmployees: 200, customMaxSites: 15 }), NOW);
  assert.equal(a.maxEmployees, 200);
  assert.equal(a.maxSites, 15);
  assert.equal(checkCanAdd(a, "employee", 199), null);
  assert.notEqual(checkCanAdd(a, "employee", 200), null);
});

test("session console : 2 heures", () => {
  assert.equal(CONSOLE_SESSION_MINUTES, 120);
});
