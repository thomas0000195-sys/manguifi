/**
 * Limitation de débit partagée (src/lib/rate-limit.ts).
 *
 * Les tests utilisent PGlite, un Postgres réel embarqué (WebAssembly), avec
 * le SQL exact de la migration RateLimitBucket. Ils ne demandent donc ni
 * serveur de base ni variable d'environnement de production.
 *
 * Lancer avec : npm run test:auth
 */
import { test, mock, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

mock.module("next/headers", { namedExports: { headers: async () => new Headers() } });
mock.module("@/lib/prisma", { namedExports: { prisma: {} } });

type RateLimit = typeof import("../src/lib/rate-limit");
let rl: RateLimit;
let db: PGlite;

const MIGRATION = path.resolve(
  __dirname,
  "../prisma/migrations/20261021120000_add_rate_limit_bucket/migration.sql"
);

before(async () => {
  rl = await import("../src/lib/rate-limit");
  db = new PGlite();
  await db.exec(fs.readFileSync(MIGRATION, "utf8"));
});

after(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec('DELETE FROM "RateLimitBucket"');
  delete process.env.TRUST_PROXY;
  delete process.env.CLIENT_IP_HEADER;
});

/** Exécuteur SQL pointant vers la base de test ; plusieurs exécuteurs = plusieurs « instances ». */
function executorFor(conn: PGlite) {
  return async (sql: string, params: unknown[]) => {
    const res = await conn.query<{ count: number }>(sql, params);
    return res.rows;
  };
}

const noHeaders = new Headers();
const POLICY = { limit: 3, windowMs: 60_000 };

async function attempt(
  scope: string,
  identifier: string,
  policy = POLICY,
  requestHeaders: Headers = noHeaders,
  exec = executorFor(db)
) {
  return rl.evaluateRateLimit(exec, requestHeaders, scope, identifier, policy);
}

// ---------------------------------------------------------------------------
// Limite par identifiant
// ---------------------------------------------------------------------------

test("limite atteinte : les tentatives au-delà de la limite sont refusées", async () => {
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await attempt("login", "a@x.test"));
  assert.deepEqual(results, [true, true, true, false, false]);
});

test("identifiants distincts : compteurs indépendants", async () => {
  for (let i = 0; i < 3; i++) await attempt("login", "a@x.test");
  assert.equal(await attempt("login", "a@x.test"), false);
  assert.equal(await attempt("login", "b@x.test"), true);
});

test("scopes distincts : compteurs indépendants pour un même identifiant", async () => {
  for (let i = 0; i < 3; i++) await attempt("login", "a@x.test");
  assert.equal(await attempt("login", "a@x.test"), false);
  assert.equal(await attempt("password-reset", "a@x.test"), true);
});

test("fenêtre expirée : le compteur repart de zéro", async () => {
  const short = { limit: 1, windowMs: 50 };
  assert.equal(await attempt("otp", "+221770000000", short), true);
  assert.equal(await attempt("otp", "+221770000000", short), false);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(await attempt("otp", "+221770000000", short), true);
});

test("concurrence : 20 requêtes simultanées, exactement 5 acceptées", async () => {
  const policy = { limit: 5, windowMs: 60_000 };
  const results = await Promise.all(
    Array.from({ length: 20 }, () => attempt("burst", "cible@x.test", policy))
  );
  assert.equal(results.filter(Boolean).length, 5);
});

test("partage entre instances : deux exécuteurs voient le même compteur", async () => {
  const instanceA = executorFor(db);
  const instanceB = executorFor(db);
  assert.equal(await attempt("login", "shared@x.test", POLICY, noHeaders, instanceA), true);
  assert.equal(await attempt("login", "shared@x.test", POLICY, noHeaders, instanceB), true);
  assert.equal(await attempt("login", "shared@x.test", POLICY, noHeaders, instanceA), true);
  assert.equal(await attempt("login", "shared@x.test", POLICY, noHeaders, instanceB), false);
});

// ---------------------------------------------------------------------------
// Adresse IP
// ---------------------------------------------------------------------------

test("sans TRUST_PROXY : l'IP n'est pas utilisée, même si l'en-tête est présent", () => {
  const h = new Headers({ "x-forwarded-for": "203.0.113.9" });
  assert.equal(rl.getTrustedClientIp(h), null);
});

test("TRUST_PROXY=true : la dernière valeur de X-Forwarded-For (ajoutée par le proxy) est utilisée", () => {
  process.env.TRUST_PROXY = "true";
  const h = new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.9" });
  assert.equal(rl.getTrustedClientIp(h), "203.0.113.9");
});

test("CLIENT_IP_HEADER : utilise l'en-tête indiqué, valeur complète", () => {
  process.env.TRUST_PROXY = "true";
  process.env.CLIENT_IP_HEADER = "x-real-ip";
  const h = new Headers({ "x-real-ip": "198.51.100.7" });
  assert.equal(rl.getTrustedClientIp(h), "198.51.100.7");
});

test("falsification de X-Forwarded-For derrière un proxy : le contournement échoue", async () => {
  process.env.TRUST_PROXY = "true";
  const policy = { limit: 100, windowMs: 60_000, ipLimit: 2 };
  // Le client change la première valeur à chaque requête ; le proxy ajoute la vraie IP.
  const results = [];
  for (let i = 0; i < 4; i++) {
    const h = new Headers({ "x-forwarded-for": `10.0.0.${i}, 198.51.100.50` });
    results.push(await attempt("login", `victime${i}@x.test`, policy, h));
  }
  assert.deepEqual(results, [true, true, false, false]);
});

test("une autre IP réelle n'est pas pénalisée par l'attaquant", async () => {
  process.env.TRUST_PROXY = "true";
  const policy = { limit: 100, windowMs: 60_000, ipLimit: 2 };
  const attacker = new Headers({ "x-forwarded-for": "198.51.100.66" });
  for (let i = 0; i < 3; i++) await attempt("login", `cible${i}@x.test`, policy, attacker);
  const legit = new Headers({ "x-forwarded-for": "198.51.100.67" });
  assert.equal(await attempt("login", "legit@x.test", policy, legit), true);
});

test("sans proxy de confiance : pas de limite par IP, les utilisateurs légitimes ne sont pas bloqués", async () => {
  const policy = { limit: 100, windowMs: 60_000, ipLimit: 2 };
  // Tous les clients partagent un en-tête fourni par le client : aucune clé IP ne doit être créée.
  const shared = new Headers({ "x-forwarded-for": "203.0.113.1" });
  for (let i = 0; i < 5; i++) {
    assert.equal(await attempt("login", `user${i}@x.test`, policy, shared), true);
  }
});

// ---------------------------------------------------------------------------
// Erreurs de stockage et confidentialité
// ---------------------------------------------------------------------------

test("erreur de stockage : refus (fail closed), sans propager l'erreur", async () => {
  const broken = async () => {
    throw new Error('relation "RateLimitBucket" does not exist');
  };
  const originalError = console.error;
  const logged: unknown[] = [];
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    assert.equal(await attempt("login", "x@x.test", POLICY, noHeaders, broken), false);
  } finally {
    console.error = originalError;
  }
  // Seul le type d'erreur est journalisé, jamais le message SQL.
  assert.equal(logged.length, 1);
  assert.equal(JSON.stringify(logged).includes("RateLimitBucket"), false);
});

test("aucune donnée personnelle en clair dans la table", async () => {
  process.env.TRUST_PROXY = "true";
  const email = "jean.dupont@entreprise.test";
  const ip = "198.51.100.77";
  await attempt("login", email, POLICY, new Headers({ "x-forwarded-for": ip }));

  const rows = (await db.query<{ key: string }>('SELECT "key" FROM "RateLimitBucket"')).rows;
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(row.key.includes(email), false);
    assert.equal(row.key.includes(ip), false);
    assert.match(row.key, /^login:(id|ip):[0-9a-f]{64}$/);
  }
  assert.equal(
    rows.some((r) => r.key === `login:id:${crypto.createHash("sha256").update(email).digest("hex")}`),
    true
  );
});
