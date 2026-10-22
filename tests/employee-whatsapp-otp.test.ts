/**
 * Parcours OTP employé par numéro (src/app/actions/whatsapp-auth.ts). Le code
 * est désormais envoyé et vérifié par src/lib/email-otp.ts : haché, à usage
 * unique, limité en essais. L'ancien stockage en clair (src/lib/otp.ts) est
 * supprimé.
 *
 * Lancer avec : npm run test:auth
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.ENCRYPTION_KEY = "w".repeat(40) + "-whatsapp-otp-test-key";
process.env.RESEND_API_KEY = "re_test_key";

const PHONE = "+221771234567";
const EMAIL = "fatou.diop@entreprise.test";

type Row = Record<string, unknown>;
const db = {
  employees: [] as Row[],
  users: [] as Row[],
  otps: [] as Array<{ id: string; emailHash: string; codeHash: string; attempts: number; expiresAt: Date; consumedAt: Date | null }>,
  attempts: [] as Array<{ outcome: string }>,
  sessions: [] as Array<{ userId: string }>,
  sent: [] as Array<{ to: string; code: string }>,
};
let seq = 0;

const fakePrisma = {
  employee: {
    async findFirst({ where, include }: { where: Row; include?: { user?: boolean } }) {
      const emp = db.employees.find((e) => e.phoneHash === where.phoneHash && e.status === where.status);
      if (!emp) return null;
      return { ...emp, user: include?.user ? db.users.find((u) => u.employeeId === emp.id) ?? null : undefined };
    },
    async update({ where, data }: { where: { id: string }; data: Row }) {
      Object.assign(db.employees.find((e) => e.id === where.id)!, data);
      return null;
    },
  },
  user: {
    async create({ data }: { data: Row }) {
      const row = { id: `user_${++seq}`, ...data };
      db.users.push(row);
      return row;
    },
    async findUnique({ where }: { where: Row }) {
      return db.users.find((u) => Object.entries(where).every(([k, v]) => u[k] === v)) ?? null;
    },
    async update({ where, data }: { where: { id: string }; data: Row }) {
      Object.assign(db.users.find((u) => u.id === where.id)!, data);
      return null;
    },
  },
  phoneVerificationAttempt: {
    async create({ data }: { data: { outcome: string } }) {
      db.attempts.push({ outcome: data.outcome });
      return data;
    },
  },
  emailOtpCode: {
    async create({ data }: { data: { emailHash: string; codeHash: string; expiresAt: Date } }) {
      const row = { id: `otp_${++seq}`, attempts: 0, consumedAt: null, ...data };
      db.otps.push(row);
      return row;
    },
    async findFirst({ where }: { where: Row }) {
      const matches = db.otps.filter(
        (r) => r.emailHash === where.emailHash && r.consumedAt === null && r.expiresAt > (where.expiresAt as { gt: Date }).gt
      );
      return matches[matches.length - 1] ?? null;
    },
    async update({ where, data }: { where: { id: string }; data: { attempts?: { increment: number } } }) {
      const row = db.otps.find((r) => r.id === where.id)!;
      if (data.attempts) row.attempts += data.attempts.increment;
      return row;
    },
    async updateMany({ where, data }: { where: Row; data: { consumedAt: Date } }) {
      const rows = db.otps.filter((r) => r.consumedAt === null && (where.emailHash === undefined || r.emailHash === where.emailHash) && (where.id === undefined || r.id === where.id));
      rows.forEach((r) => (r.consumedAt = data.consumedAt));
      return { count: rows.length };
    },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma } });
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    },
  },
});
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("@/lib/twilio", { namedExports: { sendOtp: async () => ({ sent: true }), checkOtp: async () => ({ approved: false }) } });
mock.module("@/lib/auth", {
  namedExports: {
    createSession: async (p: { userId: string }) => {
      db.sessions.push({ userId: p.userId });
    },
    requireSession: async () => {
      throw new Error("UNAUTHENTICATED");
    },
  },
});
mock.module("@/lib/audit", { namedExports: { logAudit: async () => {} } });
mock.module("@/lib/email", {
  namedExports: {
    sendEmployeeOtpEmail: async (to: string, code: string) => {
      db.sent.push({ to, code });
      return true;
    },
  },
});
const counters = new Map<string, number>();
mock.module("@/lib/rate-limit", {
  namedExports: {
    checkRateLimit: async (scope: string, id: string, policy: { limit: number }) => {
      const key = scope + ":" + id;
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next <= policy.limit;
    },
  },
});

type WhatsApp = typeof import("../src/app/actions/whatsapp-auth");
let actions: WhatsApp;
let hashPhone: (p: string) => string;
let encryptDataUrl: (s: string) => string;

before(async () => {
  actions = await import("../src/app/actions/whatsapp-auth");
  ({ hashPhone } = await import("../src/lib/phone"));
  ({ encryptDataUrl } = await import("../src/lib/crypto"));
});


beforeEach(() => {
  counters.clear();
  db.employees.length = 0;
  db.users.length = 0;
  db.otps.length = 0;
  db.attempts.length = 0;
  db.sessions.length = 0;
  db.sent.length = 0;
  db.employees.push({
    id: "emp_1",
    orgId: "org_1",
    phoneHash: hashPhone(PHONE),
    email: encryptDataUrl(EMAIL),
    status: "ACTIF",
    invitationStatus: "INVITED",
  });
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function requestCode(phone = "771234567") {
  return actions.requestEmployeeOtpAction({}, form({ phone }));
}

async function verify(code: string, phone = PHONE): Promise<{ error?: string; redirected?: string }> {
  try {
    return await actions.verifyEmployeeOtpAction({}, form({ phone, code }));
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.startsWith("NEXT_REDIRECT:")) return { redirected: msg.slice("NEXT_REDIRECT:".length) };
    throw err;
  }
}

function sentCode(): string {
  assert.ok(db.sent.length > 0, "aucun code envoyé");
  return db.sent[db.sent.length - 1].code;
}

test("le code est envoyé à l'email de l'employé, jamais stocké en clair", async () => {
  await requestCode();
  assert.equal(db.sent[0].to, EMAIL);
  const code = sentCode();
  assert.equal(db.otps.length, 1);
  assert.notEqual(db.otps[0].codeHash, code);
  assert.equal(db.otps[0].codeHash, crypto.createHash("sha256").update(code).digest("hex"));
});

test("connexion légitime : bon code, session ouverte", async () => {
  await requestCode();
  const code = sentCode();
  assert.deepEqual(await verify(code), { redirected: "/espace" });
  assert.equal(db.sessions.length, 1);
  assert.equal(db.attempts.at(-1)?.outcome, "SUCCESS");
});

test("code incorrect : rejeté, tentative journalisée sans le code", async () => {
  await requestCode();
  const code = sentCode();
  const wrong = code === "000000" ? "111111" : "000000";
  assert.deepEqual(await verify(wrong), { error: "Code invalide ou expiré." });
  assert.equal(db.sessions.length, 0);
  assert.equal(db.attempts.at(-1)?.outcome, "OTP_INVALID");
  assert.equal(JSON.stringify(db.attempts).includes(wrong), false);
});

test("code déjà utilisé : rejeté", async () => {
  await requestCode();
  const code = sentCode();
  await verify(code);
  assert.deepEqual(await verify(code), { error: "Code invalide ou expiré." });
  assert.equal(db.sessions.length, 1);
});

test("nombre maximal d'essais respecté", async () => {
  await requestCode();
  const code = sentCode();
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await verify(wrong);
  assert.deepEqual(await verify(code), { error: "Trop de tentatives pour ce code. Demandez-en un nouveau." });
  assert.equal(db.sessions.length, 0);
});

test("numéro inconnu : même réponse qu'un envoi réussi, aucun code envoyé", async () => {
  const res = await requestCode("701234567");
  assert.deepEqual(res, { submitted: true, phone: "+221701234567" });
  assert.equal(db.sent.length, 0);
});

test("numéro inconnu à la vérification : refus générique, aucune session", async () => {
  assert.deepEqual(await verify("123456", "+221701234567"), { error: "Code invalide ou expiré." });
  assert.equal(db.sessions.length, 0);
});

test("employé sans email : aucun code, aucune session", async () => {
  db.employees[0].email = null;
  assert.deepEqual(await requestCode(), { submitted: true, phone: PHONE });
  assert.equal(db.sent.length, 0);
});
