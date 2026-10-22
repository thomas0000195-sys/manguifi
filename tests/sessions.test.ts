/**
 * Sessions et révocation (src/lib/auth.ts, src/app/actions/auth.ts).
 *
 * Vérifie qu'une session cesse d'être acceptée dès que le compte est
 * désactivé, supprimé, ou que son mot de passe est réinitialisé, et que
 * la vérification se fait côté serveur à chaque accès.
 *
 * Lancer avec : npm run test:auth
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { SignJWT } from "jose";

const AUTH_SECRET = "s".repeat(40) + "-session-test-secret";
const ENCRYPTION_KEY = "k".repeat(40) + "-session-test-encryption";

// ---------------------------------------------------------------------------
// Doubles en mémoire
// ---------------------------------------------------------------------------

type Employee = { id: string; orgId: string; status: string };
type User = {
  id: string;
  orgId: string;
  role: string;
  passwordHash: string | null;
  employeeId: string | null;
  email: string | null;
  emailHash: string | null;
};
type ResetToken = { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null };

const db = {
  users: [] as User[],
  employees: [] as Employee[],
  resetTokens: [] as ResetToken[],
  audits: [] as string[],
};
let cookieValue: string | undefined;
let seq = 0;

const fakePrisma = {
  user: {
    async findUnique({ where }: { where: { id?: string; emailHash?: string } }) {
      const user = db.users.find((u) =>
        where.id !== undefined ? u.id === where.id : u.emailHash === where.emailHash
      );
      if (!user) return null;
      const employee = db.employees.find((e) => e.id === user.employeeId) ?? null;
      return { ...user, org: { id: user.orgId }, employee, responsableTeams: [] };
    },
    async update({ where, data }: { where: { id: string }; data: Partial<User> }) {
      const user = db.users.find((u) => u.id === where.id)!;
      Object.assign(user, data);
      return user;
    },
  },
  employee: {
    async update({ where, data }: { where: { id: string }; data: Partial<Employee> }) {
      const emp = db.employees.find((e) => e.id === where.id)!;
      Object.assign(emp, data);
      return emp;
    },
  },
  passwordResetToken: {
    async updateMany({ where, data }: { where: { userId: string; usedAt: null }; data: { usedAt: Date } }) {
      db.resetTokens
        .filter((t) => t.userId === where.userId && t.usedAt === null)
        .forEach((t) => (t.usedAt = data.usedAt));
      return { count: 1 };
    },
    async create({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) {
      const row: ResetToken = { id: `rt_${++seq}`, usedAt: null, ...data };
      db.resetTokens.push(row);
      return row;
    },
    async findUnique({ where }: { where: { tokenHash: string } }) {
      const row = db.resetTokens.find((t) => t.tokenHash === where.tokenHash);
      if (!row) return null;
      const user = db.users.find((u) => u.id === row.userId)!;
      return { ...row, user };
    },
    async update({ where, data }: { where: { id: string }; data: { usedAt: Date } }) {
      const row = db.resetTokens.find((t) => t.id === where.id)!;
      row.usedAt = data.usedAt;
      return row;
    },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma } });
mock.module("next/headers", {
  namedExports: {
    headers: async () => new Headers(),
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
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
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
mock.module("@/lib/email", {
  namedExports: { sendPasswordResetEmail: async () => true },
});

type Auth = typeof import("../src/lib/auth");
type AuthActions = typeof import("../src/app/actions/auth");
let auth: Auth;
let actions: AuthActions;

before(async () => {
  auth = await import("../src/lib/auth");
  actions = await import("../src/app/actions/auth");
});

beforeEach(async () => {
  process.env.AUTH_SECRET = AUTH_SECRET;
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
  cookieValue = undefined;
  db.users.length = 0;
  db.employees.length = 0;
  db.resetTokens.length = 0;
  db.audits.length = 0;
});

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

const PASSWORD = "mot-de-passe-initial";
let caseSeq = 0;

async function addAdmin(): Promise<User> {
  const user: User = {
    id: `admin_${++caseSeq}`,
    orgId: "org_1",
    role: "ADMIN",
    passwordHash: await auth.hashPassword(PASSWORD),
    employeeId: null,
    email: null,
    emailHash: `hash_admin_${caseSeq}`,
  };
  db.users.push(user);
  return user;
}

function addEmployee(status = "ACTIF"): { user: User; employee: Employee } {
  const employee: Employee = { id: `emp_${++caseSeq}`, orgId: "org_1", status };
  db.employees.push(employee);
  const user: User = {
    id: `emp_user_${caseSeq}`,
    orgId: "org_1",
    role: "EMPLOYEE",
    passwordHash: null,
    employeeId: employee.id,
    email: null,
    emailHash: null,
  };
  db.users.push(user);
  return { user, employee };
}

async function loginAs(user: User) {
  await auth.createSession({
    userId: user.id,
    orgId: user.orgId,
    role: user.role as "ADMIN" | "EMPLOYEE",
    email: null,
    employeeId: user.employeeId,
  });
}

async function forgeToken(payload: Record<string, unknown>, secret = AUTH_SECRET) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

async function resetPasswordWith(rawToken: string, password: string) {
  try {
    await actions.resetPasswordAction({}, formOf({ token: rawToken, password }));
    return "ok";
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.startsWith("NEXT_REDIRECT:")) return "ok";
    throw err;
  }
}

function formOf(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("session valide : acceptée", async () => {
  const admin = await addAdmin();
  await loginAs(admin);
  const session = await auth.getSession();
  assert.ok(session);
  assert.equal(session.userId, admin.id);
  assert.ok(await auth.getCurrentUser());
});

test("déconnexion : le cookie supprimé ne donne plus de session", async () => {
  const admin = await addAdmin();
  await loginAs(admin);
  await auth.destroySession();
  assert.equal(await auth.getSession(), null);
});

test("réinitialisation du mot de passe : les sessions existantes sont révoquées", async () => {
  const admin = await addAdmin();
  await loginAs(admin);
  const oldCookie = cookieValue;
  assert.ok(await auth.getSession(), "précondition : session valide avant reset");

  const rawToken = await auth.createPasswordResetToken(admin.id);
  assert.equal(await resetPasswordWith(rawToken, "nouveau-mot-de-passe-9"), "ok");

  // Réutilise le cookie d'avant la réinitialisation (autre appareil).
  cookieValue = oldCookie;
  assert.equal(await auth.getSession(), null);
  assert.equal(await auth.getCurrentUser(), null);
});

test("employé désactivé : accès refusé immédiatement (session et utilisateur)", async () => {
  const { user, employee } = addEmployee("ACTIF");
  await loginAs(user);
  assert.ok(await auth.getSession(), "précondition : employé actif connecté");

  employee.status = "INACTIF";
  assert.equal(await auth.getSession(), null);
  assert.equal(await auth.requireSession().catch(() => "refusé"), "refusé");
  assert.equal(await auth.getCurrentUser(), null);
});

test("employé réactivé : la session redevient valide", async () => {
  const { user, employee } = addEmployee("ACTIF");
  await loginAs(user);
  employee.status = "INACTIF";
  assert.equal(await auth.getSession(), null);
  employee.status = "ACTIF";
  assert.ok(await auth.getSession());
});

test("employé supprimé : session refusée", async () => {
  const { user, employee } = addEmployee("ACTIF");
  await loginAs(user);
  // Équivalent du onDelete: SetNull de Prisma.
  user.employeeId = null;
  db.employees.splice(db.employees.indexOf(employee), 1);
  assert.equal(await auth.getSession(), null);
});

test("compte utilisateur supprimé : session refusée", async () => {
  const admin = await addAdmin();
  await loginAs(admin);
  db.users.splice(db.users.indexOf(admin), 1);
  assert.equal(await auth.getSession(), null);
});

test("session sans empreinte (format antérieur) : refusée", async () => {
  const admin = await addAdmin();
  const legacy = await forgeToken({
    userId: admin.id,
    orgId: admin.orgId,
    role: "ADMIN",
    email: null,
    employeeId: null,
  });
  cookieValue = legacy;
  assert.equal(await auth.getSession(), null);
});

test("session signée avec une autre clé : refusée", async () => {
  const admin = await addAdmin();
  cookieValue = await forgeToken(
    { userId: admin.id, orgId: admin.orgId, role: "ADMIN", email: null, employeeId: null, cv: "x" },
    "clé-différente-de-test-000000000000000000"
  );
  assert.equal(await auth.getSession(), null);
});

test("session avec une mauvaise empreinte : refusée", async () => {
  const admin = await addAdmin();
  cookieValue = await forgeToken({
    userId: admin.id,
    orgId: admin.orgId,
    role: "ADMIN",
    email: null,
    employeeId: null,
    cv: crypto.createHash("sha256").update("autre").digest("hex").slice(0, 32),
  }, AUTH_SECRET);
  assert.equal(await auth.getSession(), null);
});

test("createSession pour un compte inconnu : erreur, aucun cookie", async () => {
  await assert.rejects(
    () =>
      auth.createSession({
        userId: "inexistant",
        orgId: "org_1",
        role: "ADMIN",
        email: null,
        employeeId: null,
      }),
    /Compte introuvable/
  );
  assert.equal(cookieValue, undefined);
});
