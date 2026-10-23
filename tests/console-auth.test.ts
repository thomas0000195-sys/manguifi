/**
 * Console super admin, étape 1 : accès, session séparée, second facteur TOTP.
 *
 * Lancer avec : npm run test:auth
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { generate } from "otplib";

process.env.AUTH_SECRET = "a".repeat(40) + "-console-test-secret";
process.env.ENCRYPTION_KEY = "e".repeat(40) + "-console-test-encryption";
process.env.RESEND_API_KEY = "re_test";

type Row = Record<string, unknown>;
const db = {
  users: [] as Row[],
  sentOtp: [] as string[],
  sessions: [] as string[],
  audits: [] as string[],
};
let cookies: Record<string, string> = {};
const jar = {
  get: (n: string) => (cookies[n] === undefined ? undefined : { name: n, value: cookies[n] }),
  set: (n: string, v: string) => { cookies[n] = v; },
  delete: (n: string) => { delete cookies[n]; },
};

const fakePrisma = {
  user: {
    async findUnique({ where }: { where: Row }) {
      return db.users.find((u) => Object.entries(where).every(([k, v]) => u[k] === v)) ?? null;
    },
    async update({ where, data }: { where: Row; data: Row }) {
      const u = db.users.find((x) => x.id === where.id)!;
      Object.assign(u, data);
      return u;
    },
  },
  organization: {
    async findFirst() { return { id: "org_platform" }; },
    async create() { return { id: "org_platform" }; },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma } });
mock.module("next/headers", { namedExports: { cookies: async () => jar } });
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => { db.sessions.push("redirect:" + url); throw new Error("NEXT_REDIRECT:" + url); },
  },
});
mock.module("@/lib/audit", {
  namedExports: { logAudit: async (p: { action: string }) => { db.audits.push(p.action); } },
});
mock.module("@/lib/rate-limit", {
  namedExports: { checkRateLimit: async () => true },
});
mock.module("@/lib/email-otp", {
  namedExports: {
    sendEmailOtp: async (email: string) => { db.sentOtp.push(email); return { sent: true }; },
    checkEmailOtp: async (_email: string, code: string) =>
      code === "123456" ? { approved: true } : { approved: false, error: "Code invalide ou expiré." },
  },
});

type Session = typeof import("../src/lib/console/session");
type Totp = typeof import("../src/lib/console/totp");
type Actions = typeof import("../src/app/actions/console-auth");
let session: Session, totp: Totp, actions: Actions, crypto: typeof import("../src/lib/crypto");

before(async () => {
  session = await import("../src/lib/console/session");
  totp = await import("../src/lib/console/totp");
  actions = await import("../src/app/actions/console-auth");
  crypto = await import("../src/lib/crypto");
});

beforeEach(() => {
  cookies = {};
  db.users.length = 0;
  db.sentOtp.length = 0;
  db.sessions.length = 0;
  db.audits.length = 0;
});

const SECRET_KEY = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

function superAdmin(extra: Row = {}) {
  const secret = totp.newTotpSecret();
  return {
    id: "sa_1",
    orgId: "org_platform",
    role: "SUPER_ADMIN",
    email: null,
    emailHash: crypto.hashEmail("boss@exemple.com"),
    totpSecret: crypto.encryptDataUrl(secret),
    totpEnabledAt: new Date(),
    _secret: secret,
    ...extra,
  };
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// ---------------------------------------------------------------------------

test("sans cookie de console : aucun accès", async () => {
  db.users.push(superAdmin());
  assert.equal(await session.getConsoleUser(), null);
});

test("super admin avec TOTP activé et session valide : accès", async () => {
  const u = superAdmin();
  db.users.push(u);
  await session.setConsoleSession("sa_1");
  const got = await session.getConsoleUser();
  assert.equal(got?.id, "sa_1");
});

test("un utilisateur ordinaire ne peut pas ouvrir la console, même avec une session valide", async () => {
  db.users.push(superAdmin({ id: "admin_1", role: "ADMIN" }));
  await session.setConsoleSession("admin_1");
  assert.equal(await session.getConsoleUser(), null);
});

test("retrait du rôle : accès coupé immédiatement malgré le cookie", async () => {
  const u = superAdmin();
  db.users.push(u);
  await session.setConsoleSession("sa_1");
  u.role = "EMPLOYEE";
  assert.equal(await session.getConsoleUser(), null);
});

test("second facteur non activé : pas d'accès à la console", async () => {
  const u = superAdmin({ totpEnabledAt: null });
  db.users.push(u);
  await session.setConsoleSession("sa_1");
  assert.equal(await session.getConsoleUser(), null);
});

test("cookie de l'application signé avec la même clé : refusé (mauvaise audience)", async () => {
  db.users.push(superAdmin());
  const token = await new SignJWT({ userId: "sa_1" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(SECRET_KEY());
  cookies["manguifi_console"] = token;
  assert.equal(await session.getConsoleUser(), null);
});

test("cookie de pré-authentification : n'ouvre pas la console", async () => {
  db.users.push(superAdmin());
  await session.setPreAuth("sa_1");
  cookies["manguifi_console"] = cookies["manguifi_console_pre"];
  assert.equal(await session.getConsoleUser(), null);
});

test("demande de code : aucun envoi pour un compte qui n'est pas super admin", async () => {
  db.users.push(superAdmin({ id: "emp_1", role: "EMPLOYEE", emailHash: crypto.hashEmail("emp@exemple.com") }));
  const res = await actions.requestConsoleCodeAction({}, form({ email: "emp@exemple.com" }));
  assert.equal(res.step, "code");
  assert.equal(db.sentOtp.length, 0);
});

test("demande de code : envoi uniquement pour un super admin", async () => {
  db.users.push(superAdmin());
  await actions.requestConsoleCodeAction({}, form({ email: "boss@exemple.com" }));
  assert.deepEqual(db.sentOtp, ["boss@exemple.com"]);
});

test("TOTP : code exact accepté, faux code refusé", async () => {
  const u = superAdmin();
  db.users.push(u);
  const good = await generate({ secret: u._secret as string });
  assert.equal(await totp.checkTotp(u._secret as string, good), true);
  assert.equal(await totp.checkTotp(u._secret as string, good === "000000" ? "111111" : "000000"), false);
  assert.equal(await totp.checkTotp(u._secret as string, "12ab"), false);
});

test("connexion complète : code e-mail puis TOTP ouvrent la session", async () => {
  const u = superAdmin();
  db.users.push(u);
  await actions.verifyConsoleCodeAction({}, form({ email: "boss@exemple.com", code: "123456" }));
  const token = await generate({ secret: u._secret as string });
  await assert.rejects(() => actions.verifyConsoleTotpAction({}, form({ totp: token })), /NEXT_REDIRECT:\/console/);
  assert.ok(cookies["manguifi_console"]);
  assert.ok(db.audits.includes("console.login"));
});

test("TOTP faux : aucune session ouverte, tentative journalisée", async () => {
  const u = superAdmin();
  db.users.push(u);
  await actions.verifyConsoleCodeAction({}, form({ email: "boss@exemple.com", code: "123456" }));
  const res = await actions.verifyConsoleTotpAction({}, form({ totp: "000000" }));
  assert.equal(res.error, "Code invalide.");
  assert.equal(cookies["manguifi_console"], undefined);
  assert.ok(db.audits.includes("console.login_failed"));
});

test("premier accès : le secret TOTP est créé et le QR code est fourni", async () => {
  db.users.push(superAdmin({ totpSecret: null, totpEnabledAt: null }));
  const res = await actions.verifyConsoleCodeAction({}, form({ email: "boss@exemple.com", code: "123456" }));
  assert.equal(res.step, "enroll");
  assert.ok(res.secret && res.qr?.startsWith("data:image/"));
});

test("code e-mail faux : pas de passage à l'étape TOTP", async () => {
  db.users.push(superAdmin());
  const res = await actions.verifyConsoleCodeAction({}, form({ email: "boss@exemple.com", code: "000000" }));
  assert.equal(res.step, "code");
  assert.equal(cookies["manguifi_console_pre"], undefined);
});
