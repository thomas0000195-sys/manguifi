/**
 * Données insérées dans les emails (src/lib/email.ts) : échappement HTML et
 * validation des destinataires.
 *
 * Lancer avec : npm run test:auth
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, isPlausibleEmail } from "../src/lib/email";

test("les caractères HTML sont neutralisés", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')"> & fin`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; fin"
  );
});

test("un nom d'organisation malveillant reste du texte", () => {
  const payload = `<a href="https://evil.test">Cliquez ici</a>`;
  const escaped = escapeHtml(payload);
  assert.equal(escaped.includes("<a"), false);
  assert.equal(escaped.includes('"https'), false);
});

test("adresses valides acceptées", () => {
  assert.equal(isPlausibleEmail("fatou.diop@entreprise.sn"), true);
  assert.equal(isPlausibleEmail("a+tag@sub.domaine.test"), true);
});

test("adresses invalides ou dangereuses refusées", () => {
  for (const bad of [
    "",
    "pas-un-email",
    "a@b",
    "a b@c.test",
    'x"@c.test',
    "x@c.test>",
    "x@c.test\r\nBcc: attaquant@evil.test",
    "x@" + "a".repeat(260) + ".test",
  ]) {
    assert.equal(isPlausibleEmail(bad), false, `doit être refusée : ${JSON.stringify(bad)}`);
  }
});
