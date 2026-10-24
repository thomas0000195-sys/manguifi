/**
 * Tests de la connexion employé par code email (src/app/actions/email-auth.ts
 * et src/lib/email-otp.ts). La base, l'envoi d'email, la session et les
 * redirections sont remplacés par des doubles en mémoire, donc ces tests
 * tournent sans Postgres ni clé Resend.
 *
 * Lancer avec :
 *   node --experimental-test-module-mocks --import tsx --test tests/employee-email-otp.test.ts
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

process.env.ENCRYPTION_KEY = "test-encryption-key-for-otp-tests-0000";
process.env.RESEND_API_KEY = "re_test_key";

// ---------------------------------------------------------------------------
// Doubles en mémoire
// ---------------------------------------------------------------------------

type Employee = {
  id: string;
  orgId: string;
  emailHash: string;
  status: string;
  invitationStatus: string;
};
type User = {
  id: string;
  orgId: string;
  role: string;
  employeeId: string | null;
  emailHash: string | null;
  email: string | null;
};
type OtpRow = {
  id: string;
  emailHash: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

const db = {
  employees: [] as Employee[],
  users: [] as User[],
  otps: [] as OtpRow[],
  sessions: [] as Array<{ userId: string; employeeId: string | null; email: string | null }>,
  audits: [] as string[],
  sentCodes: [] as Array<{ to: string; code: string }>,
  sendFails: false,
};
let seq = 0;
const nextId = (p: string) => `${p}_${++seq}`;

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("gt" in c) return (value as Date) > (c.gt as Date);
      if ("not" in c) return value !== c.not;
      if ("increment" in c) return value;
    }
    return value === cond;
  });
}

const fakePrisma = {
  employee: {
    async findFirst({ where, include }: { where: Record<string, unknown>; include?: { user?: boolean } }) {
      const emp = db.employees.find((e) => matches(e as never, where));
      if (!emp) return null;
      const user = include?.user ? db.users.find((u) => u.employeeId === emp.id) ?? null : undefined;
      return { ...emp, ...(include?.user ? { user } : {}) };
    },
    async update({ where, data }: { where: { id: string }; data: Partial<Employee> }) {
      const emp = db.employees.find((e) => e.id === where.id)!;
      Object.assign(emp, data);
      return emp;
    },
  },
  user: {
    async findUnique({ where }: { where: { emailHash: string } }) {
      return db.users.find((u) => u.emailHash === where.emailHash) ?? null;
    },
    async create({ data }: { data: Partial<User> & { orgId: string; role: string } }) {
      const user: User = {
        id: nextId("user"),
        employeeId: null,
        emailHash: null,
        email: null,
        ...data,
      };
      db.users.push(user);
      return user;
    },
  },
  emailOtpCode: {
    async create({ data }: { data: { emailHash: string; codeHash: string; expiresAt: Date } }) {
      const row: OtpRow = { id: nextId("otp"), attempts: 0, consumedAt: null, ...data };
      db.otps.push(row);
      return row;
    },
    async findFirst({ where }: { where: Record<string, unknown> }) {
      // Le dernier inséré correspond au plus récent (orderBy createdAt desc).
      const matching = db.otps.filter((r) => matches(r as never, where));
      return matching[matching.length - 1] ?? null;
    },
    async update({ where, data }: { where: { id: string }; data: { attempts?: { increment: number } } }) {
      const row = db.otps.find((r) => r.id === where.id)!;
      if (data.attempts) row.attempts += data.attempts.increment;
      return row;
    },
    async updateMany({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: { consumedAt: Date };
    }) {
      const rows = db.otps.filter((r) => matches(r as never, where));
      rows.forEach((r) => (r.consumedAt = data.consumedAt));
      return { count: rows.length };
    },
  },
};

// ---------------------------------------------------------------------------
// Remplacement des modules externes (avant l'import des modules testés)
// ---------------------------------------------------------------------------

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma } });
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    },
  },
});
mock.module("next/headers", {
  namedExports: { headers: async () => new Headers() },
});
mock.module("@/lib/auth", {
  namedExports: {
    createSession: async (payload: { userId: string; employeeId: string | null; email: string | null }) => {
      db.sessions.push(payload);
    },
  },
});
mock.module("@/lib/audit", {
  namedExports: {
    logAudit: async (params: { action: string }) => {
      db.audits.push(params.action);
    },
  },
});
// La limitation de débit est testée dans rate-limit.test.ts (PGlite). Ici on
// isole la logique OTP avec un compteur en mémoire respectant la même limite par identifiant.
const counters = new Map<string, number>();
mock.module("@/lib/rate-limit", {
  namedExports: {
    checkRateLimit: async (scope: string, identifier: string, policy: { limit: number }) => {
      const key = scope + ":" + identifier;
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next <= policy.limit;
    },
  },
});
mock.module("@/lib/email", {
  namedExports: {
    sendEmployeeOtpEmail: async (to: string, code: string) => {
      if (db.sendFails) return false;
      db.sentCodes.push({ to, code });
      return true;
    },
  },
});

type EmailAuth = typeof import("../src/app/actions/email-auth");
let actions: EmailAuth;
let hashEmail: (email: string) => string;

before(async () => {
  actions = await import("../src/app/actions/email-auth");
  ({ hashEmail } = await import("../src/lib/crypto"));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let caseCounter = 0;
/** Chaque test utilise sa propre adresse pour que les limites de débit ne se croisent pas. */
function freshEmail(label: string) {
  caseCounter += 1;
  return `${label}.${caseCounter}@entreprise.test`;
}

function addEmployee(email: string, extra: Partial<Employee> = {}) {
  const emp: Employee = {
    id: nextId("emp"),
    orgId: "org_1",
    emailHash: hashEmail(email),
    status: "ACTIF",
    invitationStatus: "INVITED",
    ...extra,
  };
  db.employees.push(emp);
  return emp;
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function requestCode(email: string) {
  return actions.requestEmployeeEmailOtpAction({}, form({ email }));
}

async function verify(email: string, code: string): Promise<{ error?: string; redirected?: string }> {
  try {
    const res = await actions.verifyEmployeeEmailOtpAction({}, form({ email, code }));
    return res;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.startsWith("NEXT_REDIRECT:")) return { redirected: msg.slice("NEXT_REDIRECT:".length) };
    throw err;
  }
}

function lastSentCode(email: string): string {
  const sent = db.sentCodes.filter((s) => s.to === email);
  assert.ok(sent.length > 0, "aucun code envoyé");
  return sent[sent.length - 1].code;
}

beforeEach(() => {
  counters.clear();
  db.employees.length = 0;
  db.users.length = 0;
  db.otps.length = 0;
  db.sessions.length = 0;
  db.audits.length = 0;
  db.sentCodes.length = 0;
  db.sendFails = false;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("le chemin matricule a été retiré", () => {
  const root = path.resolve(__dirname, "..");
  assert.equal(fs.existsSync(path.join(root, "src/app/actions/matricule-auth.ts")), false);
  assert.equal(fs.existsSync(path.join(root, "src/app/connexion/MatriculeLoginForm.tsx")), false);
  assert.equal("matriculeLoginAction" in actions, false);
});

test("email inconnu : même réponse, aucun code envoyé", async () => {
  const email = freshEmail("inconnu");
  const res = await requestCode(email);
  assert.deepEqual(res, { submitted: true, email });
  assert.equal(db.sentCodes.length, 0);
  assert.equal(db.otps.length, 0);
});

test("employé actif : un code à 6 chiffres est envoyé, stocké haché", async () => {
  const email = freshEmail("actif");
  addEmployee(email);
  const res = await requestCode(email);
  assert.deepEqual(res, { submitted: true, email });

  const code = lastSentCode(email);
  assert.match(code, /^\d{6}$/);
  assert.equal(db.otps.length, 1);
  assert.notEqual(db.otps[0].codeHash, code);
  // HMAC avec clé dérivée : le hash n'est plus un SHA-256 simple du code (retrouvable hors ligne).
  assert.match(db.otps[0].codeHash, /^[0-9a-f]{64}$/);
  assert.notEqual(db.otps[0].codeHash, crypto.createHash("sha256").update(code).digest("hex"));
});

test("connexion légitime : bon code ouvre la session employé", async () => {
  const email = freshEmail("legit");
  const emp = addEmployee(email);
  await requestCode(email);
  const code = lastSentCode(email);

  const res = await verify(email, code);
  assert.deepEqual(res, { redirected: "/espace" });
  assert.equal(db.sessions.length, 1);
  assert.equal(db.sessions[0].employeeId, emp.id);
  assert.equal(db.sessions[0].email, email);
  assert.equal(emp.invitationStatus, "ACTIVE");
  assert.deepEqual(db.audits, ["EMPLOYEE_LOGIN_EMAIL_OTP"]);
});

test("code incorrect rejeté sans session", async () => {
  const email = freshEmail("faux");
  addEmployee(email);
  await requestCode(email);
  const code = lastSentCode(email);
  const wrong = code === "000000" ? "111111" : "000000";
  assert.deepEqual(await verify(email, wrong), { error: "Code invalide ou expiré." });
  assert.equal(db.sessions.length, 0);
});

test("code expiré rejeté", async () => {
  const email = freshEmail("expire");
  addEmployee(email);
  await requestCode(email);
  const code = lastSentCode(email);
  db.otps[0].expiresAt = new Date(Date.now() - 1000);

  assert.deepEqual(await verify(email, code), { error: "Code invalide ou expiré." });
  assert.equal(db.sessions.length, 0);
});

test("code déjà utilisé rejeté (usage unique)", async () => {
  const email = freshEmail("reuse");
  addEmployee(email);
  await requestCode(email);
  const code = lastSentCode(email);

  assert.deepEqual(await verify(email, code), { redirected: "/espace" });
  assert.deepEqual(await verify(email, code), { error: "Code invalide ou expiré." });
  assert.equal(db.sessions.length, 1);
});

test("nombre maximal d'essais respecté : le bon code est refusé après 5 erreurs", async () => {
  const email = freshEmail("essais");
  addEmployee(email);
  await requestCode(email);
  const code = lastSentCode(email);
  const wrong = code === "000000" ? "111111" : "000000";

  for (let i = 0; i < 5; i++) {
    await verify(email, wrong);
  }
  assert.deepEqual(await verify(email, code), {
    error: "Trop de tentatives pour ce code. Demandez-en un nouveau.",
  });
  assert.equal(db.sessions.length, 0);
});

test("un nouveau code invalide le précédent", async () => {
  const email = freshEmail("nouveau");
  addEmployee(email);
  await requestCode(email);
  const first = lastSentCode(email);
  await requestCode(email);
  const second = lastSentCode(email);
  assert.notEqual(first, second);

  assert.deepEqual(await verify(email, first), { error: "Code invalide ou expiré." });
  assert.deepEqual(await verify(email, second), { redirected: "/espace" });
});

test("usurpation : le code d'un employé ne donne pas accès au compte d'un autre", async () => {
  const alice = freshEmail("alice");
  const bob = freshEmail("bob");
  addEmployee(alice);
  addEmployee(bob);

  await requestCode(alice);
  const aliceCode = lastSentCode(alice);

  // Bob n'a demandé aucun code : le code d'Alice ne doit pas ouvrir sa session.
  assert.deepEqual(await verify(bob, aliceCode), { error: "Code invalide ou expiré." });
  assert.equal(db.sessions.length, 0);
});

test("email inconnu à la vérification : message générique, aucune session", async () => {
  const res = await verify(freshEmail("nexistepas"), "123456");
  assert.deepEqual(res, { error: "Code invalide ou expiré." });
  assert.equal(db.sessions.length, 0);
});

test("format de code invalide rejeté avant toute requête base", async () => {
  const email = freshEmail("format");
  addEmployee(email);
  assert.deepEqual(await verify(email, "12ab"), { error: "Saisissez le code à 6 chiffres." });
  assert.deepEqual(await verify(email, "12345"), { error: "Saisissez le code à 6 chiffres." });
  assert.equal(db.sessions.length, 0);
});

test("limitation des demandes de code par email", async () => {
  const email = freshEmail("debit");
  addEmployee(email);
  for (let i = 0; i < 5; i++) {
    await requestCode(email);
  }
  assert.deepEqual(await requestCode(email), {
    error: "Trop de demandes. Réessayez dans quelques minutes.",
  });
});

test("limitation des vérifications par email : le 9e essai est bloqué", async () => {
  const email = freshEmail("debitverif");
  addEmployee(email);
  await requestCode(email);
  for (let i = 0; i < 8; i++) {
    await verify(email, "000000");
  }
  assert.deepEqual(await verify(email, "000000"), {
    error: "Trop de tentatives. Réessayez dans quelques minutes.",
  });
});

test("échec d'envoi : erreur explicite, aucune session", async () => {
  const email = freshEmail("envoi");
  addEmployee(email);
  db.sendFails = true;
  const res = await requestCode(email);
  assert.equal(res.submitted, undefined);
  assert.equal(typeof res.error, "string");
});

test("compte inactif : aucun code, aucune session", async () => {
  const email = freshEmail("inactif");
  addEmployee(email, { status: "INACTIF" });
  assert.deepEqual(await requestCode(email), { submitted: true, email });
  assert.equal(db.sentCodes.length, 0);
});
