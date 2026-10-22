/**
 * Authentification des routes cron (src/lib/cron-auth.ts).
 *
 * Lancer avec : npm run test:auth
 */
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { checkCronAuth } from "../src/lib/cron-auth";

const SECRET = "c".repeat(40) + "-cron-test-secret";
const original = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
});

after(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

test("appel légitime accepté", () => {
  assert.equal(checkCronAuth(`Bearer ${SECRET}`), "ok");
  assert.equal(checkCronAuth(`bearer ${SECRET}`), "ok");
});

test("appel sans authentification refusé", () => {
  assert.equal(checkCronAuth(null), "unauthorized");
  assert.equal(checkCronAuth(""), "unauthorized");
});

test("secret incorrect refusé, y compris un préfixe ou une longueur différente", () => {
  assert.equal(checkCronAuth(`Bearer ${SECRET.slice(0, 20)}`), "unauthorized");
  assert.equal(checkCronAuth(`Bearer ${SECRET}x`), "unauthorized");
  assert.equal(checkCronAuth("Bearer "), "unauthorized");
  assert.equal(checkCronAuth(`Basic ${SECRET}`), "unauthorized");
});

test("secret absent de l'environnement : accès refusé (503 côté route)", () => {
  delete process.env.CRON_SECRET;
  assert.equal(checkCronAuth(`Bearer ${SECRET}`), "unconfigured");
});
