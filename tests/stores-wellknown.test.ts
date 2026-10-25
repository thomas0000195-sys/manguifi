/**
 * Fichiers de liaison de domaine pour les stores (src/app/api/well-known/*).
 * Vérifie le contenu, le JSON valide et le comportement sans configuration.
 *
 * Lancer avec : npm run test:auth
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const ENV_KEYS = ["ANDROID_PACKAGE_NAME", "ANDROID_SHA256_FINGERPRINTS", "APPLE_TEAM_ID", "APPLE_BUNDLE_ID"] as const;

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

async function assetlinks() {
  const mod = await import("../src/app/api/well-known/assetlinks/route");
  return mod.GET();
}

async function aasa() {
  const mod = await import("../src/app/api/well-known/apple-app-site-association/route");
  return mod.GET();
}

test("assetlinks sans configuration : 200, JSON valide, liste vide", async () => {
  const res = await assetlinks();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await res.json(), []);
});

test("assetlinks configuré : plusieurs empreintes séparées par des virgules", async () => {
  process.env.ANDROID_PACKAGE_NAME = "tech.manguifi.app";
  process.env.ANDROID_SHA256_FINGERPRINTS = "AA:BB, CC:DD ,EE:FF";
  const body = (await (await assetlinks()).json()) as Array<{
    relation: string[];
    target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
  }>;
  assert.equal(body.length, 1);
  assert.deepEqual(body[0].relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(body[0].target.namespace, "android_app");
  assert.equal(body[0].target.package_name, "tech.manguifi.app");
  assert.deepEqual(body[0].target.sha256_cert_fingerprints, ["AA:BB", "CC:DD", "EE:FF"]);
});

test("assetlinks : sans empreinte, aucune délégation n'est publiée", async () => {
  process.env.ANDROID_PACKAGE_NAME = "tech.manguifi.app";
  assert.deepEqual(await (await assetlinks()).json(), []);
});

test("apple-app-site-association sans équipe : configuration vide, JSON valide", async () => {
  const res = await aasa();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { applinks: { apps: [], details: [] } });
});

test("apple-app-site-association configuré : identifiant Team.bundle", async () => {
  process.env.APPLE_TEAM_ID = "ABCDE12345";
  const body = (await (await aasa()).json()) as { applinks: { details: Array<{ appID: string }> } };
  assert.equal(body.applinks.details[0].appID, "ABCDE12345.tech.manguifi.app");
});
