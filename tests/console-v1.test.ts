/**
 * Console V1 (étapes 2 à 7) : nettoyage du journal d'erreurs, export CSV,
 * périodes du tableau de bord, et refus d'accès sans session super admin.
 *
 * Lancer avec : npm run test:auth
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = "c".repeat(40) + "-console-v1-test";
process.env.ENCRYPTION_KEY = "d".repeat(40) + "-console-v1-test";

mock.module("@/lib/prisma", { namedExports: { prisma: {} } });
mock.module("next/headers", { namedExports: { cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) } });

type Errors = typeof import("../src/lib/console/errors");
type Mask = typeof import("../src/lib/console/mask");
type Dash = typeof import("../src/lib/console/dashboard");
type Guard = typeof import("../src/lib/console/guard");
let errors: Errors, mask: Mask, dash: Dash, guard: Guard;

before(async () => {
  errors = await import("../src/lib/console/errors");
  mask = await import("../src/lib/console/mask");
  dash = await import("../src/lib/console/dashboard");
  guard = await import("../src/lib/console/guard");
});

test("journal d'erreurs : e-mails, téléphones, codes et jetons supprimés du message", () => {
  const raw = "Échec pour jean.dupont@entreprise.sn au +221 77 123 45 67, code 482913, jeton abcdefghijklmnopqrstuvwxyz0123456789";
  const clean = errors.scrubErrorText(raw);
  assert.equal(clean.includes("jean.dupont"), false);
  assert.equal(clean.includes("77 123"), false);
  assert.equal(clean.includes("482913"), false);
  assert.equal(clean.includes("abcdefghijklmnop"), false);
  assert.ok(clean.includes("[email]") && clean.includes("[code]"));
});

test("journal d'erreurs : message tronqué à 1000 caractères", () => {
  assert.equal(errors.scrubErrorText("ab ".repeat(2000)).length, 1000);
});

test("export CSV : cellule protégée contre les formules Excel", () => {
  assert.equal(mask.csvCell("=HYPERLINK(\"http://evil\")"), "\"'=HYPERLINK(\"\"http://evil\"\")\"");
  assert.equal(mask.csvCell("+1"), "\"'+1\"");
  assert.equal(mask.csvCell("normal"), "\"normal\"");
});

test("export CSV : guillemets doublés, valeurs vides acceptées", () => {
  assert.equal(mask.csvCell("dit \"oui\""), "\"dit \"\"oui\"\"\"");
  assert.equal(mask.csvCell(null), "\"\"");
});

test("e-mail masqué pour la console : première lettre et domaine partiel", () => {
  assert.equal(mask.maskEmailAddress("jean.dupont@entreprise.sn"), "j***@e***.sn");
  assert.equal(mask.maskEmailAddress(null), "—");
});

test("périodes du tableau de bord : aujourd'hui commence à minuit", () => {
  const now = new Date(2026, 9, 24, 15, 30);
  const start = dash.periodStart("today", now);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getDate(), 24);
});

test("périodes du tableau de bord : 7 et 30 jours en arrière", () => {
  const now = new Date(2026, 9, 24, 15, 30);
  assert.equal(dash.periodStart("7", now).getDate(), 17);
  assert.equal(dash.periodStart("30", now).getMonth(), 8);
});

test("garde console : sans session, accès refusé", async () => {
  await assert.rejects(() => guard.requireConsoleUser(), /FORBIDDEN/);
});
