/**
 * Centre de notifications (src/lib/notifications.ts).
 * Vérifie : troncature des textes, aucun blocage de l'action appelante en cas d'erreur,
 * et canaux e-mail / WhatsApp désactivés.
 *
 * Lancer avec : npm run test:auth
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

type Created = { data: Record<string, unknown> };
const created: Created[] = [];
let failNext = false;
const logged: unknown[] = [];

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      notification: {
        async create({ data }: Created) {
          if (failNext) throw new Error("base indisponible");
          created.push({ data });
          return data;
        },
      },
    },
  },
});
mock.module("@/lib/console/errors", {
  namedExports: {
    logError: async (entry: unknown) => {
      logged.push(entry);
    },
  },
});

type Notifications = typeof import("../src/lib/notifications");
let svc: Notifications;

before(async () => {
  svc = await import("../src/lib/notifications");
});

beforeEach(() => {
  created.length = 0;
  logged.length = 0;
  failNext = false;
});

test("canaux : seule l'application est active, e-mail et WhatsApp désactivés", () => {
  assert.deepEqual(svc.NOTIFICATION_CHANNELS, { inApp: true, email: false, whatsapp: false });
});

test("titre et corps sont tronqués à leur longueur maximale", async () => {
  await svc.sendNotification({
    orgId: "org_1",
    userId: "u_1",
    type: "correction",
    title: "t".repeat(500),
    body: "b".repeat(1000),
    link: "/x",
  });
  assert.equal(created.length, 1);
  assert.equal((created[0].data.title as string).length, 120);
  assert.equal((created[0].data.body as string).length, 300);
  assert.equal(created[0].data.link, "/x");
});

test("sans corps ni lien, les champs facultatifs valent null", async () => {
  await svc.sendNotification({ orgId: "org_1", userId: "u_1", type: "info", title: "Bonjour" });
  assert.equal(created[0].data.body, null);
  assert.equal(created[0].data.link, null);
});

test("erreur de base : l'appel ne lève pas, seule une trace sans contenu est journalisée", async () => {
  failNext = true;
  await assert.doesNotReject(() =>
    svc.sendNotification({ orgId: "org_1", userId: "u_1", type: "info", title: "Secret de test" })
  );
  assert.equal(logged.length, 1);
  assert.equal(JSON.stringify(logged).includes("Secret de test"), false);
});
