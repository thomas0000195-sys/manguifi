/**
 * Paiement des factures via PayDunya (mode test) : configuration, hash IPN,
 * création de la tentative, rapprochement, idempotence, rattrapage, route IPN.
 *
 * Aucun appel réseau : fetch est remplacé par un faux transport, et la base
 * par une base en mémoire. Lancer avec : npm run test:auth
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = "c".repeat(40) + "-paydunya-test";
process.env.ENCRYPTION_KEY = "d".repeat(40) + "-paydunya-test";
process.env.PAYDUNYA_MODE = "test";
process.env.PAYDUNYA_MASTER_KEY = "master-test-key-0123456789";
process.env.PAYDUNYA_PRIVATE_KEY = "test_private_fake_key";
process.env.PAYDUNYA_TOKEN = "fake-app-token";
process.env.APP_URL = "http://localhost:3000";
process.env.PAYDUNYA_ENABLED_COMPANY_IDS = "org-1";

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

/** Base en mémoire : seules les opérations utilisées par le code de paiement sont gérées. */
function createFakeDb() {
  const tables: Record<string, Row[]> = {
    invoice: [],
    paymentAttempt: [],
    payment: [],
    auditLog: [],
    featureFlag: [],
    user: [],
    errorLog: [],
  };
  let seq = 0;
  const nextId = () => `id-${++seq}`;

  function matches(row: Row, where: Where = {}): boolean {
    return Object.entries(where).every(([key, cond]) => {
      const value = row[key];
      if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
        const c = cond as Record<string, unknown>;
        if ("in" in c) return (c.in as unknown[]).includes(value);
        if ("not" in c) return c.not === null ? value !== null && value !== undefined : value !== c.not;
        if ("gt" in c) return toTime(value) > toTime(c.gt);
        if ("lt" in c) return toTime(value) < toTime(c.lt);
        if ("gte" in c) return toTime(value) >= toTime(c.gte);
        if ("startsWith" in c) return String(value ?? "").startsWith(String(c.startsWith));
        return false;
      }
      if (cond instanceof Date) return toTime(value) === cond.getTime();
      return value === cond;
    });
  }

  function toTime(v: unknown) {
    return v instanceof Date ? v.getTime() : Number(v);
  }

  function table(name: string) {
    return {
      findUnique: async ({ where, include }: { where: Where; include?: Record<string, boolean> }) => {
        const row = tables[name].find((r) => matches(r, where)) ?? null;
        return row ? withIncludes(row, include) : null;
      },
      findFirst: async ({ where, orderBy }: { where?: Where; orderBy?: Record<string, string> } = {}) => {
        let rows = tables[name].filter((r) => matches(r, where));
        if (orderBy) {
          const [key, dir] = Object.entries(orderBy)[0];
          rows = rows.sort((a, b) => (toTime(a[key]) - toTime(b[key])) * (dir === "desc" ? -1 : 1));
        }
        return rows[0] ?? null;
      },
      findMany: async ({ where, take }: { where?: Where; take?: number } = {}) =>
        tables[name].filter((r) => matches(r, where)).slice(0, take ?? Infinity),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = {
          id: nextId(),
          status: "INITIATED",
          createdAt: new Date(NOW),
          ...data,
        } as Row;
        if (name === "invoice") Object.assign(row, { status: data.status ?? "EMISE", paidAt: null });
        tables[name].push(row);
        return row;
      },
      update: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const row = tables[name].find((r) => matches(r, where));
        if (!row) throw new Error("introuvable");
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const rows = tables[name].filter((r) => matches(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      count: async ({ where }: { where?: Where } = {}) => tables[name].filter((r) => matches(r, where)).length,
      aggregate: async ({ where }: { where?: Where }) => {
        const rows = tables[name].filter((r) => matches(r, where));
        return { _sum: { amountXof: rows.reduce((s, r) => s + Number(r.amountXof ?? 0), 0) }, _count: rows.length };
      },
    };
  }

  function withIncludes(row: Row, include?: Record<string, boolean>) {
    if (!include) return row;
    const out: Record<string, unknown> = { ...row };
    if (include.invoice) out.invoice = tables.invoice.find((i) => i.id === row.invoiceId) ?? null;
    if (include.createdBy) out.createdBy = tables.user.find((u) => u.id === row.createdByUserId) ?? null;
    return out;
  }

  const db: Record<string, unknown> & { _tables: Record<string, Row[]>; _reset: () => void } = {
    invoice: table("invoice"),
    paymentAttempt: table("paymentAttempt"),
    payment: table("payment"),
    featureFlag: table("featureFlag"),
    auditLog: table("auditLog"),
    errorLog: table("errorLog"),
    user: table("user"),
    $transaction: async (fn: (tx: typeof db) => Promise<unknown>) => fn(db),
    /** Remise à zéro entre deux tests. */
    _reset() {
      Object.values(tables).forEach((t) => (t.length = 0));
      seq = 0;
    },
    _tables: tables,
  };
  return db;
}

const fakeDb = createFakeDb();

mock.module("@/lib/prisma", { namedExports: { prisma: fakeDb } });
mock.module("next/headers", {
  namedExports: { cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }), headers: async () => new Headers() },
});
const logs: Array<{ message: string }> = [];
mock.module("@/lib/console/errors", {
  namedExports: { logError: async (input: { message: string }) => void logs.push(input) },
});
mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true } });
mock.module("@/lib/crypto", { namedExports: { decryptDataUrlForDisplay: () => null } });

type Billing = typeof import("../src/lib/billing/paydunya-payments");
type Config = typeof import("../src/lib/paydunya/config");
type Client = typeof import("../src/lib/paydunya/client");
type Ipn = typeof import("../src/app/api/billing/paydunya/ipn/route");
let billing: Billing, config: Config, client: Client, ipnRoute: Ipn;

before(async () => {
  billing = await import("../src/lib/billing/paydunya-payments");
  config = await import("../src/lib/paydunya/config");
  client = await import("../src/lib/paydunya/client");
  ipnRoute = await import("../src/app/api/billing/paydunya/ipn/route");
});

const MASTER = process.env.PAYDUNYA_MASTER_KEY!;
const ADMIN = { id: "user-admin", orgId: "org-1", role: "ADMIN" };
const NOW = new Date("2026-11-03T10:00:00Z");
// Horloge figée : les dates des lignes créées pendant un test sont celles de NOW.

function seedBase({ flag = true, invoiceOverrides = {} }: { flag?: boolean; invoiceOverrides?: Record<string, unknown> } = {}) {
  fakeDb._tables.featureFlag.push({ id: "flag", key: "billing.paydunya", enabled: flag });
  fakeDb._tables.user.push({ id: "user-admin", email: null });
  fakeDb._tables.invoice.push({
    id: "inv-1",
    orgId: "org-1",
    number: "F-2026-001",
    amountXof: 25000,
    currency: "XOF",
    status: "EMISE",
    isProforma: false,
    issuedAt: NOW,
    ...invoiceOverrides,
  });
  fakeDb._tables.invoice.push({ id: "inv-other", orgId: "org-2", number: "X-1", amountXof: 1000, currency: "XOF", status: "EMISE", isProforma: false, issuedAt: NOW });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Faux transport PayDunya : création (create) et confirmation (confirm). Ne touche jamais au réseau. */
function fakePaydunya(opts: {
  status?: string;
  mode?: string;
  total?: number;
  hash?: string;
  createFails?: boolean;
  confirmFails?: boolean;
} = {}) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];
  let counter = 0;
  const fetchImpl = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", headers: init.headers as Record<string, string>, body: init.body as string });
    if (url.endsWith("/checkout-invoice/create")) {
      if (opts.createFails) return jsonResponse({ response_code: "1001", response_text: "refus" }, 400);
      counter += 1;
      const token = `test_tok_${counter}`;
      return jsonResponse({ response_code: "00", response_text: `https://app.paydunya.com/sandbox-checkout/invoice/${token}`, token });
    }
    if (url.includes("/checkout-invoice/confirm/")) {
      if (opts.confirmFails) throw new TypeError("réseau coupé");
      const token = decodeURIComponent(url.split("/").pop()!);
      return jsonResponse({
        response_code: "00",
        response_text: "Transaction Found",
        hash: opts.hash ?? client.expectedPaydunyaHash(MASTER),
        invoice: { token, total_amount: opts.total ?? 25000 },
        status: opts.status ?? "completed",
        mode: opts.mode ?? "test",
        receipt_url: "https://paydunya.com/sandbox-checkout/receipt/pdf/x.pdf",
      });
    }
    return jsonResponse({}, 404);
  };
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

function deps(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  const alerts: string[] = [];
  return {
    db: fakeDb as never,
    cfg: config.readPaydunyaConfig(),
    fetch: fetchImpl,
    now: () => NOW,
    notifyPaymentReceived: async () => {},
    alert: async (subject: string) => void alerts.push(subject),
    log: async () => {},
    alerts,
    ...extra,
  };
}

async function openAttempt(fetchImpl: typeof fetch) {
  return billing.startInvoicePayment(ADMIN, "inv-1", deps(fetchImpl) as never);
}

beforeEach(() => {
  fakeDb._reset();
  logs.length = 0;
});

// --- Configuration ---

test("configuration : intégration absente si PAYDUNYA_MODE est vide", () => {
  assert.equal(config.readPaydunyaConfig({} as NodeJS.ProcessEnv), null);
});

test("configuration : clés manquantes → erreur qui nomme la variable, jamais sa valeur", () => {
  const env = { PAYDUNYA_MODE: "test", APP_URL: "http://localhost:3000", PAYDUNYA_PRIVATE_KEY: "secret-visible" } as unknown as NodeJS.ProcessEnv;
  assert.throws(
    () => config.readPaydunyaConfig(env),
    (err: Error) => err.message.includes("PAYDUNYA_MASTER_KEY") && !err.message.includes("secret-visible")
  );
});

test("configuration : mode live exige une APP_URL en https", () => {
  const env = {
    PAYDUNYA_MODE: "live",
    PAYDUNYA_MASTER_KEY: "m",
    PAYDUNYA_PRIVATE_KEY: "p",
    PAYDUNYA_TOKEN: "t",
    APP_URL: "http://www.manguifi.tech",
  } as unknown as NodeJS.ProcessEnv;
  assert.throws(() => config.readPaydunyaConfig(env), /https/);
});

test("configuration : URL de test (sandbox-api) et liste blanche lues correctement", () => {
  const cfg = config.readPaydunyaConfig({
    ...process.env,
    PAYDUNYA_ENABLED_COMPANY_IDS: " org-1 , org-2 ",
  } as NodeJS.ProcessEnv)!;
  assert.equal(cfg.apiBaseUrl, "https://app.paydunya.com/sandbox-api/v1");
  assert.equal(cfg.isTest, true);
  assert.deepEqual(cfg.enabledCompanyIds, ["org-1", "org-2"]);
});

// --- Hash IPN ---

test("hash : valeur correcte acceptée, falsifiée, absente ou de mauvaise longueur refusées", () => {
  const good = client.expectedPaydunyaHash(MASTER);
  assert.equal(client.isValidPaydunyaHash(good, MASTER), true);
  const tampered = good.slice(0, -1) + (good.endsWith("0") ? "1" : "0");
  assert.equal(client.isValidPaydunyaHash(tampered, MASTER), false);
  assert.equal(client.isValidPaydunyaHash("abc", MASTER), false);
  assert.equal(client.isValidPaydunyaHash(null, MASTER), false);
  assert.equal(client.isValidPaydunyaHash(client.expectedPaydunyaHash("autre-cle"), MASTER), false);
});

// --- Accès et création ---

test("accès : refusé si le flag billing.paydunya est désactivé", async () => {
  seedBase({ flag: false });
  const access = await billing.getPaydunyaAccess("org-1", deps(fakePaydunya().fetchImpl) as never);
  assert.deepEqual(access, { allowed: false, reason: "flag_desactive" });
});

test("accès : refusé si l'entreprise n'est pas sur la liste blanche", async () => {
  seedBase();
  const access = await billing.getPaydunyaAccess("org-9", deps(fakePaydunya().fetchImpl) as never);
  assert.deepEqual(access, { allowed: false, reason: "entreprise_non_autorisee" });
});

test("paiement : seul un ADMIN peut payer", async () => {
  seedBase();
  await assert.rejects(
    billing.startInvoicePayment({ id: "u2", orgId: "org-1", role: "RESPONSABLE" }, "inv-1", deps(fakePaydunya().fetchImpl) as never),
    (err: Error) => err instanceof billing.BillingError && err.code === "forbidden"
  );
});

test("paiement : facture d'une autre entreprise introuvable (pas de fuite)", async () => {
  seedBase();
  await assert.rejects(
    billing.startInvoicePayment(ADMIN, "inv-other", deps(fakePaydunya().fetchImpl) as never),
    (err: Error) => err instanceof billing.BillingError && err.code === "not_found"
  );
});

test("paiement : facture déjà payée refusée", async () => {
  seedBase({ invoiceOverrides: { status: "PAYEE" } });
  await assert.rejects(openAttempt(fakePaydunya().fetchImpl), (err: Error) => err instanceof billing.BillingError && err.code === "not_payable");
});

test("paiement : proforma refusée en mode live", async () => {
  seedBase({ invoiceOverrides: { isProforma: true } });
  const cfgLive = { ...config.readPaydunyaConfig()!, mode: "live" as const, isTest: false, apiBaseUrl: "https://app.paydunya.com/api/v1" };
  await assert.rejects(
    billing.startInvoicePayment(ADMIN, "inv-1", deps(fakePaydunya().fetchImpl, { cfg: cfgLive }) as never),
    (err: Error) => err instanceof billing.BillingError && err.code === "not_payable"
  );
});

test("paiement : le montant envoyé vient de la base et la tentative est créée une seule fois", async () => {
  seedBase();
  const fake = fakePaydunya();
  const first = await openAttempt(fake.fetchImpl);
  const second = await openAttempt(fake.fetchImpl);

  assert.equal(first.attemptId, second.attemptId, "une tentative ouverte est réutilisée");
  assert.equal(fake.calls.filter((c) => c.url.endsWith("/checkout-invoice/create")).length, 1);

  const create = fake.calls[0];
  assert.equal(create.url, "https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create");
  assert.equal(create.headers["PAYDUNYA-MASTER-KEY"], MASTER);
  const body = JSON.parse(create.body!);
  assert.equal(body.invoice.total_amount, 25000);
  assert.deepEqual(body.custom_data, { attemptId: first.attemptId }, "seul l'identifiant de tentative est transmis");
  assert.equal(body.actions.callback_url, "http://localhost:3000/api/billing/paydunya/ipn");
  assert.equal(fakeDb._tables.paymentAttempt[0].status, "PENDING");
  assert.equal(fakeDb._tables.paymentAttempt[0].isTest, true);
});

test("paiement : échec de création → tentative FAILED, message générique", async () => {
  seedBase();
  await assert.rejects(
    openAttempt(fakePaydunya({ createFails: true }).fetchImpl),
    (err: Error) => err instanceof billing.BillingError && err.code === "provider" && !err.message.includes("MASTER")
  );
  assert.equal(fakeDb._tables.paymentAttempt[0].status, "FAILED");
});

// --- Rapprochement et idempotence ---

async function pay(fetchImpl: typeof fetch) {
  const { attemptId } = await openAttempt(fetchImpl);
  return attemptId;
}

test("confirmation « payé » : un seul paiement, facture payée, puis rejeu sans doublon", async () => {
  seedBase();
  const fake = fakePaydunya({ status: "completed" });
  const attemptId = await pay(fake.fetchImpl);

  const first = await billing.reconcileAttempt(attemptId, deps(fake.fetchImpl) as never);
  assert.deepEqual(first, { status: "SUCCESS", credited: true });
  assert.equal(fakeDb._tables.payment.length, 1);
  assert.equal(fakeDb._tables.payment[0].source, "PAYDUNYA");
  assert.equal(fakeDb._tables.payment[0].isTest, true);
  assert.equal(fakeDb._tables.invoice[0].status, "PAYEE");

  const replay = await billing.reconcileAttempt(attemptId, deps(fake.fetchImpl) as never);
  assert.deepEqual(replay, { status: "SUCCESS", credited: false });
  assert.equal(fakeDb._tables.payment.length, 1, "la notification rejouée ne crée aucun doublon");
});

test("montant différent → aucun crédit, facture non payée, alerte", async () => {
  seedBase();
  const fake = fakePaydunya({ status: "completed", total: 1000 });
  const attemptId = await pay(fake.fetchImpl);
  const d = deps(fake.fetchImpl);
  const result = await billing.reconcileAttempt(attemptId, d as never);

  assert.equal(result.status, "TO_REVIEW");
  assert.equal(result.credited, false);
  assert.equal(fakeDb._tables.payment.length, 0);
  assert.equal(fakeDb._tables.invoice[0].status, "EMISE");
  assert.equal(d.alerts.length, 1);
});

test("mode incohérent (live annoncé pour une tentative test) → à examiner, rien crédité", async () => {
  seedBase();
  const fake = fakePaydunya({ status: "completed", mode: "live" });
  const attemptId = await pay(fake.fetchImpl);
  const result = await billing.reconcileAttempt(attemptId, deps(fake.fetchImpl) as never);
  assert.equal(result.status, "TO_REVIEW");
  assert.equal(fakeDb._tables.payment.length, 0);
});

test("réponse avec hash falsifié → aucune écriture, erreur de signature", async () => {
  seedBase();
  const good = fakePaydunya({ status: "completed" });
  const attemptId = await pay(good.fetchImpl);
  const forged = fakePaydunya({ status: "completed", hash: "f".repeat(128) });
  await assert.rejects(
    billing.reconcileAttempt(attemptId, deps(forged.fetchImpl) as never),
    (err: Error) => err instanceof billing.BillingError && err.code === "signature"
  );
  assert.equal(fakeDb._tables.payment.length, 0);
  assert.equal(fakeDb._tables.paymentAttempt[0].status, "PENDING");
});

test("annulation et échec côté PayDunya : rien n'est crédité", async () => {
  seedBase();
  const cancelled = fakePaydunya({ status: "cancelled" });
  const attemptId = await pay(cancelled.fetchImpl);
  assert.equal((await billing.reconcileAttempt(attemptId, deps(cancelled.fetchImpl) as never)).status, "CANCELED");

  fakeDb._reset();
  seedBase();
  const failed = fakePaydunya({ status: "failed" });
  const id2 = await pay(failed.fetchImpl);
  assert.equal((await billing.reconcileAttempt(id2, deps(failed.fetchImpl) as never)).status, "FAILED");
  assert.equal(fakeDb._tables.payment.length, 0);
});

test("erreur réseau pendant la confirmation : l'erreur remonte (l'IPN répondra 500 et sera rejouée)", async () => {
  seedBase();
  const ok = fakePaydunya({ status: "completed" });
  const attemptId = await pay(ok.fetchImpl);
  const down = fakePaydunya({ confirmFails: true });
  await assert.rejects(billing.reconcileAttempt(attemptId, deps(down.fetchImpl) as never));
  assert.equal(fakeDb._tables.paymentAttempt[0].status, "PENDING");
});

// --- Rattrapage ---

test("rattrapage : tentative ancienne encore en attente reconfirmée, tentative de plus de 24 h expirée", async () => {
  seedBase();
  const oldDate = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);
  const recent = new Date(NOW.getTime() - 30 * 60 * 1000);
  fakeDb._tables.paymentAttempt.push(
    { id: "a-old", orgId: "org-1", invoiceId: "inv-1", providerToken: "tok-old", amountXof: 25000, currency: "XOF", status: "PENDING", isTest: true, createdByUserId: "user-admin", createdAt: oldDate },
    { id: "a-recent", orgId: "org-1", invoiceId: "inv-1", providerToken: "tok-recent", amountXof: 25000, currency: "XOF", status: "PENDING", isTest: true, createdByUserId: "user-admin", createdAt: recent },
    { id: "a-noToken", orgId: "org-1", invoiceId: "inv-1", amountXof: 25000, currency: "XOF", status: "INITIATED", isTest: true, createdByUserId: "user-admin", createdAt: oldDate }
  );
  // Les trois tentatives ont plus de 15 min : toutes sont revérifiées. Celle de 30 min reste en attente chez PayDunya.
  const pending = fakePaydunya({ status: "pending" });
  const summary = await billing.reconcileStaleAttempts(deps(pending.fetchImpl) as never);

  assert.equal(summary.checked, 3);
  assert.equal(summary.errors, 0);
  assert.equal(fakeDb._tables.paymentAttempt.find((a) => a.id === "a-old")!.status, "EXPIRED");
  assert.equal(fakeDb._tables.paymentAttempt.find((a) => a.id === "a-noToken")!.status, "EXPIRED");
  assert.equal(fakeDb._tables.paymentAttempt.find((a) => a.id === "a-recent")!.status, "PENDING");
});

test("rattrapage : une tentative confirmée par PayDunya pendant le rattrapage est créditée une fois", async () => {
  seedBase();
  fakeDb._tables.paymentAttempt.push({
    id: "a-late",
    orgId: "org-1",
    invoiceId: "inv-1",
    providerToken: "tok-late",
    amountXof: 25000,
    currency: "XOF",
    status: "PENDING",
    isTest: true,
    createdByUserId: "user-admin",
    createdAt: new Date(NOW.getTime() - 60 * 60 * 1000),
  });
  const done = fakePaydunya({ status: "completed" });
  const first = await billing.reconcileStaleAttempts(deps(done.fetchImpl) as never);
  const second = await billing.reconcileStaleAttempts(deps(done.fetchImpl) as never);
  assert.equal(first.credited, 1);
  assert.equal(second.credited, 0);
  assert.equal(fakeDb._tables.payment.length, 1);
});

// --- Test et réel séparés ---

test("indicateurs : le filtre exclut les paiements de test", () => {
  assert.deepEqual(billing.NON_TEST_PAYMENT_FILTER, { isTest: false });
  const rows = [{ amountXof: 25000, isTest: true }, { amountXof: 10000, isTest: false }];
  const real = rows.filter((r) => r.isTest === billing.NON_TEST_PAYMENT_FILTER.isTest);
  assert.equal(real.reduce((s, r) => s + r.amountXof, 0), 10000);
});

// --- Route IPN ---

function ipnRequest(body: string) {
  return new Request("http://localhost:3000/api/billing/paydunya/ipn", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": String(body.length) },
    body,
  }) as unknown as import("next/server").NextRequest;
}

test("IPN : signature falsifiée → 400, aucune écriture", async () => {
  seedBase();
  const body = new URLSearchParams({ "data[hash]": "0".repeat(128), "data[invoice][token]": "tok" }).toString();
  const res = await ipnRoute.POST(ipnRequest(body));
  assert.equal(res.status, 400);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].message.startsWith("billing.ipn_rejected"));
  assert.equal(fakeDb._tables.payment.length, 0);
});

test("IPN : corps trop volumineux → 413", async () => {
  const body = "x=" + "a".repeat(20_000);
  const res = await ipnRoute.POST(ipnRequest(body));
  assert.equal(res.status, 413);
});

test("IPN : signature valide et jeton inconnu → 200 sans information", async () => {
  seedBase();
  const body = new URLSearchParams({ "data[hash]": client.expectedPaydunyaHash(MASTER), "data[invoice][token]": "inconnu" }).toString();
  const res = await ipnRoute.POST(ipnRequest(body));
  assert.equal(res.status, 200);
});

test("IPN : signature valide + tentative connue → statut relu chez PayDunya, un seul paiement après rejeu", async () => {
  seedBase();
  const fake = fakePaydunya({ status: "completed" });
  const attemptId = await pay(fake.fetchImpl);
  const token = fakeDb._tables.paymentAttempt.find((a) => a.id === attemptId)!.providerToken as string;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fake.fetchImpl;
  try {
    const body = new URLSearchParams({ "data[hash]": client.expectedPaydunyaHash(MASTER), "data[invoice][token]": token, "data[status]": "completed" }).toString();
    assert.equal((await ipnRoute.POST(ipnRequest(body))).status, 200);
    assert.equal((await ipnRoute.POST(ipnRequest(body))).status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fakeDb._tables.payment.length, 1);
  assert.equal(fakeDb._tables.invoice[0].status, "PAYEE");
});

test("IPN : PayDunya indisponible → 500 pour que la notification soit rejouée", async () => {
  seedBase();
  const ok = fakePaydunya({ status: "completed" });
  const attemptId = await pay(ok.fetchImpl);
  const token = fakeDb._tables.paymentAttempt.find((a) => a.id === attemptId)!.providerToken as string;
  const down = fakePaydunya({ confirmFails: true });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = down.fetchImpl;
  try {
    const body = new URLSearchParams({ "data[hash]": client.expectedPaydunyaHash(MASTER), "data[invoice][token]": token }).toString();
    assert.equal((await ipnRoute.POST(ipnRequest(body))).status, 500);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
