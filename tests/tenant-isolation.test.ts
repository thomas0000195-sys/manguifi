/**
 * Isolation entre entreprises et périmètre des responsables
 * (src/lib/guard.ts). Chaque accès à une ressource identifiée par son id doit
 * refuser une ressource d'une autre entreprise, et un responsable ne doit voir
 * que les équipes de son périmètre.
 *
 * Lancer avec : npm run test:auth
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

type Row = Record<string, unknown>;
const db = {
  employees: [] as Row[],
  teams: [] as Row[],
  responsableTeams: [] as Row[],
  responsableSites: [] as Row[],
  justificatifs: [] as Row[],
  attendances: [] as Row[],
  overtimes: [] as Row[],
};

function pick<T extends Row>(rows: T[], where: Row): T[] {
  return rows.filter((r) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "in" in (v as Row)) return ((v as { in: unknown[] }).in).includes(r[k]);
      return r[k] === v;
    })
  );
}

const fakePrisma = {
  employee: {
    async findFirst({ where }: { where: Row }) {
      return pick(db.employees, where)[0] ?? null;
    },
  },
  team: {
    async findMany({ where }: { where: Row }) {
      return pick(db.teams, where);
    },
  },
  responsableTeam: {
    async findMany({ where }: { where: Row }) {
      return pick(db.responsableTeams, where);
    },
  },
  responsableSite: {
    async findMany({ where }: { where: Row }) {
      return pick(db.responsableSites, where);
    },
  },
  justificatif: {
    async findFirst({ where, include }: { where: Row; include?: Row }) {
      const row = pick(db.justificatifs, where)[0];
      if (!row) return null;
      const emp = db.employees.find((e) => e.id === row.employeeId)!;
      const team = db.teams.find((t) => t.id === emp.teamId)!;
      return include ? { ...row, employee: { ...emp, team }, reviewedBy: null } : row;
    },
  },
  attendance: {
    async findFirst({ where }: { where: Row }) {
      const row = pick(db.attendances, where)[0];
      if (!row) return null;
      const emp = db.employees.find((e) => e.id === row.employeeId)!;
      return { ...row, employee: { ...emp, team: db.teams.find((t) => t.id === emp.teamId)! } };
    },
  },
  overtimeRecord: {
    async findFirst({ where }: { where: Row }) {
      const row = pick(db.overtimes, where)[0];
      if (!row) return null;
      return { ...row, employee: db.employees.find((e) => e.id === row.employeeId)! };
    },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma } });
mock.module("next/navigation", {
  namedExports: {
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
    redirect: (url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    },
  },
});
mock.module("next/headers", { namedExports: { cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) } });

type Guard = typeof import("../src/lib/guard");
let guard: Guard;

before(async () => {
  guard = await import("../src/lib/guard");
});

// Deux entreprises, deux équipes chacune. Les responsables sont rattachés à une équipe.
beforeEach(() => {
  db.employees.length = 0;
  db.teams.length = 0;
  db.responsableTeams.length = 0;
  db.responsableSites.length = 0;
  db.justificatifs.length = 0;
  db.attendances.length = 0;
  db.overtimes.length = 0;

  db.teams.push(
    { id: "teamA1", orgId: "orgA", siteId: "siteA1" },
    { id: "teamA2", orgId: "orgA", siteId: "siteA2" },
    { id: "teamB1", orgId: "orgB", siteId: "siteB1" }
  );
  db.employees.push(
    { id: "empA1", orgId: "orgA", teamId: "teamA1" },
    { id: "empA2", orgId: "orgA", teamId: "teamA2" },
    { id: "empB1", orgId: "orgB", teamId: "teamB1" }
  );
  db.justificatifs.push({ id: "justA1", orgId: "orgA", employeeId: "empA1" }, { id: "justB1", orgId: "orgB", employeeId: "empB1" });
  db.attendances.push({ id: "attA1", orgId: "orgA", employeeId: "empA1" }, { id: "attB1", orgId: "orgB", employeeId: "empB1" });
  db.overtimes.push({ id: "otA1", orgId: "orgA", employeeId: "empA1" }, { id: "otB1", orgId: "orgB", employeeId: "empB1" });
});

const adminA = { id: "userAdminA", orgId: "orgA", role: "ADMIN" as const };
const respoA1 = { id: "userRespoA1", orgId: "orgA", role: "RESPONSABLE" as const };

async function rejects(fn: () => Promise<unknown>) {
  await assert.rejects(fn, /NEXT_NOT_FOUND/);
}

// ---------------------------------------------------------------------------

test("ADMIN : un employé d'une autre entreprise est introuvable", async () => {
  await rejects(() => guard.assertEmployeeInScope(adminA, "empB1"));
  const own = await guard.assertEmployeeInScope(adminA, "empA2");
  assert.equal(own.id, "empA2");
});

test("ADMIN : justificatif, pointage et heures sup d'une autre entreprise refusés", async () => {
  await rejects(() => guard.assertJustificatifInScope(adminA, "justB1"));
  assert.equal(await guard.assertAttendanceInScope(adminA, "attB1"), null);
  assert.equal(await guard.assertOvertimeInScope(adminA, "otB1"), null);
  assert.ok(await guard.assertAttendanceInScope(adminA, "attA1"));
});

test("RESPONSABLE : employé d'une équipe hors périmètre introuvable", async () => {
  db.responsableTeams.push({ userId: "userRespoA1", teamId: "teamA1" });
  const ok = await guard.assertEmployeeInScope(respoA1, "empA1");
  assert.equal(ok.id, "empA1");
  await rejects(() => guard.assertEmployeeInScope(respoA1, "empA2"));
  await rejects(() => guard.assertEmployeeInScope(respoA1, "empB1"));
});

test("RESPONSABLE : le périmètre par site couvre toutes les équipes du site", async () => {
  db.responsableSites.push({ userId: "userRespoA1", siteId: "siteA2" });
  const teams = await guard.getScopedTeamIds("orgA", "RESPONSABLE", "userRespoA1");
  assert.deepEqual(teams?.sort(), ["teamA2"]);
  const emp = await guard.assertEmployeeInScope(respoA1, "empA2");
  assert.equal(emp.id, "empA2");
});

test("RESPONSABLE : justificatif et pointage hors périmètre refusés", async () => {
  db.responsableTeams.push({ userId: "userRespoA1", teamId: "teamA1" });
  assert.equal((await guard.assertJustificatifInScope(respoA1, "justA1")).id, "justA1");
  await rejects(() => guard.assertJustificatifInScope(respoA1, "justB1"));
  assert.ok(await guard.assertAttendanceInScope(respoA1, "attA1"));

  db.responsableTeams.length = 0;
  db.responsableTeams.push({ userId: "userRespoA1", teamId: "teamA2" });
  assert.equal(await guard.assertAttendanceInScope(respoA1, "attA1"), null);
  await rejects(() => guard.assertJustificatifInScope(respoA1, "justA1"));
});

test("ADMIN : périmètre non restreint (null), tout le périmètre de son entreprise", async () => {
  assert.equal(await guard.getScopedTeamIds("orgA", "ADMIN", "userAdminA"), null);
});
