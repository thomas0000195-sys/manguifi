/**
 * Règles du profil employé (src/lib/profile.ts) : format du téléphone sénégalais,
 * affichage et masquage pour le journal.
 *
 * Lancer avec : npm run test:auth
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSenegalMobile, formatSenegalMobile, maskPhone } from "../src/lib/profile";

test("numéros valides normalisés en +221XXXXXXXXX", () => {
  assert.equal(normalizeSenegalMobile("771234567"), "+221771234567");
  assert.equal(normalizeSenegalMobile("77 123 45 67"), "+221771234567");
  assert.equal(normalizeSenegalMobile("+221 70 123 45 67"), "+221701234567");
  assert.equal(normalizeSenegalMobile("+221781234567"), "+221781234567");
  assert.equal(normalizeSenegalMobile("00221761234567"), "+221761234567");
});

test("préfixes non autorisés refusés (fixe, 71, 73, 79)", () => {
  for (const bad of ["331234567", "711234567", "731234567", "791234567", "+22133123456"]) {
    assert.equal(normalizeSenegalMobile(bad), null, bad);
  }
});

test("longueur incorrecte refusée", () => {
  for (const bad of ["7712345", "77123456789", "", "abc"]) {
    assert.equal(normalizeSenegalMobile(bad), null, JSON.stringify(bad));
  }
});

test("affichage lisible", () => {
  assert.equal(formatSenegalMobile("+221771234567"), "+221 77 123 45 67");
});

test("masquage pour le journal : seuls les 3 derniers chiffres restent", () => {
  assert.equal(maskPhone("+221771234567"), "+221 ** *** 567");
  assert.equal(maskPhone("+221771234567").includes("1234"), false);
});
