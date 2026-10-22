/**
 * Secrets obligatoires : AUTH_SECRET et ENCRYPTION_KEY (src/lib/secrets.ts,
 * src/lib/auth.ts, src/lib/crypto.ts, src/lib/phone.ts).
 *
 * Vérifie qu'aucune valeur de repli prévisible n'est utilisée, que l'absence
 * de secret échoue explicitement, et que le chiffrement existant reste lisible.
 *
 * Lancer avec : npm run test:auth
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { SignJWT } from "jose";

// Ancienne clé publique de repli, codée en dur dans src/lib/auth.ts avant la correction.
const OLD_JWT_FALLBACK = "manguifi-dev-secret-change-in-production-please-1234567890";
const OLD_CRYPTO_FALLBACK = "manguifi-dev-fallback-key";

const AUTH_SECRET = "a".repeat(40) + "-auth-test-secret";
const ENCRYPTION_KEY = "e".repeat(40) + "-encryption-test-key";

let cookieValue: string | undefined;

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => (cookieValue === undefined ? undefined : { name, value: cookieValue }),
      set: (name: string, value: string) => {
        if (name === "manguifi_session") cookieValue = value;
      },
      delete: () => {
        cookieValue = undefined;
      },
    }),
  },
});
// createSession et getSession interrogent le compte : on renvoie un compte sans mot de passe.
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: { findUnique: async () => ({ passwordHash: null, employee: null }) },
    },
  },
});

type Auth = typeof import("../src/lib/auth");
type Secrets = typeof import("../src/lib/secrets");
type Crypto = typeof import("../src/lib/crypto");
type Phone = typeof import("../src/lib/phone");

let auth: Auth;
let secrets: Secrets;
let cryptoLib: Crypto;
let phone: Phone;

before(async () => {
  auth = await import("../src/lib/auth");
  secrets = await import("../src/lib/secrets");
  cryptoLib = await import("../src/lib/crypto");
  phone = await import("../src/lib/phone");
});

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET;
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
  cookieValue = undefined;
});

const PAYLOAD = {
  userId: "user_1",
  orgId: "org_1",
  role: "ADMIN" as const,
  email: "admin@entreprise.test",
  employeeId: null,
};

async function forgeToken(secret: string, payload: Record<string, unknown> = PAYLOAD) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

// ---------------------------------------------------------------------------
// Validation du secret
// ---------------------------------------------------------------------------

test("secret absent : échec explicite", () => {
  assert.throws(() => secrets.readRequiredSecret("AUTH_SECRET", undefined), /AUTH_SECRET est absent/);
});

test("secret trop court : échec, et la valeur n'apparaît pas dans le message", () => {
  const short = "courte-valeur-secrete";
  assert.throws(
    () => secrets.readRequiredSecret("ENCRYPTION_KEY", short),
    (err: Error) => {
      assert.match(err.message, /ENCRYPTION_KEY/);
      assert.equal(err.message.includes(short), false);
      return true;
    }
  );
});

test("valeur placeholder du .env.example : refusée", () => {
  assert.throws(
    () => secrets.readRequiredSecret("AUTH_SECRET", "change-me-with-unique-prod-value"),
    /non remplacé/
  );
});

test("secret valide : retourné tel quel", () => {
  assert.equal(secrets.readRequiredSecret("AUTH_SECRET", AUTH_SECRET), AUTH_SECRET);
});

test("getAuthSecret échoue sans AUTH_SECRET, même si une session est présente", async () => {
  cookieValue = await forgeToken(OLD_JWT_FALLBACK);
  delete process.env.AUTH_SECRET;
  await assert.rejects(() => auth.getSession(), /AUTH_SECRET est absent/);
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

test("session signée avec l'ancienne clé publique : rejetée quand AUTH_SECRET est défini", async () => {
  cookieValue = await forgeToken(OLD_JWT_FALLBACK, { ...PAYLOAD, role: "ADMIN" });
  assert.equal(await auth.getSession(), null);
});

test("session signée avec la vraie clé : acceptée (contrôle positif)", async () => {
  cookieValue = await forgeToken(AUTH_SECRET, {
    ...PAYLOAD,
    cv: crypto.createHash("sha256").update("no-password").digest("hex").slice(0, 32),
  });
  const session = await auth.getSession();
  assert.ok(session);
  assert.equal(session.userId, PAYLOAD.userId);
  assert.equal(session.role, "ADMIN");
});

test("createSession avec secret valide : cookie vérifiable avec la vraie clé", async () => {
  await auth.createSession(PAYLOAD);
  assert.ok(cookieValue);
  const session = await auth.getSession();
  assert.equal(session?.orgId, PAYLOAD.orgId);
});

test("createSession sans secret : aucun cookie émis", async () => {
  delete process.env.AUTH_SECRET;
  await assert.rejects(() => auth.createSession(PAYLOAD), /AUTH_SECRET est absent/);
  assert.equal(cookieValue, undefined);
});

// ---------------------------------------------------------------------------
// Chiffrement et empreintes
// ---------------------------------------------------------------------------

test("sans ENCRYPTION_KEY ni AUTH_SECRET : chiffrement impossible (pas de clé de repli)", () => {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.AUTH_SECRET;
  assert.throws(() => cryptoLib.encryptDataUrl("donnée"), /AUTH_SECRET est absent/);
  assert.throws(() => cryptoLib.hashEmail("a@b.test"), /AUTH_SECRET est absent/);
  assert.throws(() => phone.hashPhone("+221771234567"), /AUTH_SECRET est absent/);
});

test("le chiffrement n'utilise pas l'ancienne clé de repli", () => {
  const plain = "justificatif-confidentiel";
  const encrypted = cryptoLib.encryptDataUrl(plain);

  // Déchiffrer avec la clé de repli historique doit échouer : decryptDataUrl
  // renvoie alors le texte chiffré tel quel.
  delete process.env.ENCRYPTION_KEY;
  process.env.AUTH_SECRET = OLD_CRYPTO_FALLBACK;
  assert.throws(() => cryptoLib.decryptDataUrl(encrypted), /illisible/);
});

test("aller-retour chiffrement / déchiffrement", () => {
  const plain = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(cryptoLib.decryptDataUrl(cryptoLib.encryptDataUrl(plain)), plain);
});

test("compatibilité : données chiffrées avec AUTH_SECRET restent lisibles quand ENCRYPTION_KEY est absente", () => {
  const plain = "téléphone-employé";
  delete process.env.ENCRYPTION_KEY;
  const encrypted = cryptoLib.encryptDataUrl(plain);

  // Même chaîne de clé : ENCRYPTION_KEY = valeur de l'ancien AUTH_SECRET.
  process.env.ENCRYPTION_KEY = AUTH_SECRET;
  assert.equal(cryptoLib.decryptDataUrl(encrypted), plain);
});

test("empreinte email : HMAC avec le vrai secret, insensible à la casse", () => {
  const expected = crypto
    .createHmac("sha256", ENCRYPTION_KEY)
    .update("jean.dupont@entreprise.test")
    .digest("hex");
  assert.equal(cryptoLib.hashEmail("  Jean.Dupont@Entreprise.test "), expected);
  assert.notEqual(
    cryptoLib.hashEmail("jean.dupont@entreprise.test"),
    crypto.createHmac("sha256", OLD_CRYPTO_FALLBACK).update("jean.dupont@entreprise.test").digest("hex")
  );
});

test("empreinte téléphone : HMAC avec le vrai secret", () => {
  const expected = crypto.createHmac("sha256", ENCRYPTION_KEY).update("+221771234567").digest("hex");
  assert.equal(phone.hashPhone("+221771234567"), expected);
});
