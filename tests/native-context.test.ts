/**
 * Détection du contexte natif (src/lib/native-context.ts).
 * Lancer avec : npm run test:auth
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNativeContext } from "../src/lib/native-context";

test("navigateur web normal : aucun contexte natif", () => {
  assert.deepEqual(resolveNativeContext({ source: null, referrer: "https://www.google.com/", capacitor: false }), {
    isTwa: false,
    isCapacitor: false,
    isStoreApp: false,
  });
});

test("source=twa : application Android", () => {
  const ctx = resolveNativeContext({ source: "twa", referrer: "", capacitor: false });
  assert.equal(ctx.isTwa, true);
  assert.equal(ctx.isStoreApp, true);
});

test("référent android-app:// : application Android même sans paramètre", () => {
  assert.equal(resolveNativeContext({ source: null, referrer: "android-app://tech.manguifi.app/", capacitor: false }).isTwa, true);
});

test("Capacitor ou source=ios : application iPhone", () => {
  assert.equal(resolveNativeContext({ source: null, referrer: "", capacitor: true }).isCapacitor, true);
  assert.equal(resolveNativeContext({ source: "ios", referrer: "", capacitor: false }).isStoreApp, true);
});

test("un référent quelconque ne fait pas passer pour une application", () => {
  assert.equal(resolveNativeContext({ source: "autre", referrer: "https://exemple.test/", capacitor: false }).isStoreApp, false);
});
