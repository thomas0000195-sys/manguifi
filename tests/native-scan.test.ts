/**
 * Validation du contenu scanné (src/lib/qr.ts), commune au web et à l'application iPhone.
 * Une URL ou un texte quelconque ne doit jamais être accepté comme site.
 *
 * Lancer avec : npm run test:auth
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSiteQrPayload, siteQrPayload } from "../src/lib/qr";

test("un QR de site généré est accepté et renvoie son jeton", () => {
  assert.equal(parseSiteQrPayload(siteQrPayload("abc123")), "abc123");
});

test("une URL n'est jamais acceptée comme site", () => {
  assert.equal(parseSiteQrPayload("https://www.manguifi.tech/?source=ios"), null);
  assert.equal(parseSiteQrPayload("https://evil.example/MANGUIFI_SITE:abc"), null);
});

test("un texte sans le préfixe exact est refusé", () => {
  assert.equal(parseSiteQrPayload("manguifi_site:abc"), null);
  assert.equal(parseSiteQrPayload(""), null);
});
