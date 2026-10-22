/**
 * Non-régression des règles métier pures : géolocalisation du pointage, QR
 * de site, dates locales, durées, heures supplémentaires, téléphones.
 *
 * Ces tests ne touchent pas la base. Les actions qui combinent plusieurs
 * tables (pointage complet, rapports) ne sont pas couvertes ici.
 *
 * Lancer avec : npm run test:auth
 */
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

mock.module("@/lib/prisma", { namedExports: { prisma: {} } });

type Geo = typeof import("../src/lib/geo");
type Qr = typeof import("../src/lib/qr");
type Overtime = typeof import("../src/lib/overtime-severity");
type Logic = typeof import("../src/lib/attendance-logic");
type Phone = typeof import("../src/lib/phone");
type Terms = typeof import("../src/lib/terms");

let geo: Geo, qr: Qr, overtime: Overtime, logic: Logic, phone: Phone, terms: Terms;

before(async () => {
  geo = await import("../src/lib/geo");
  qr = await import("../src/lib/qr");
  overtime = await import("../src/lib/overtime-severity");
  logic = await import("../src/lib/attendance-logic");
  phone = await import("../src/lib/phone");
  terms = await import("../src/lib/terms");
});

// ---------------------------------------------------------------------------
// Géolocalisation du pointage
// ---------------------------------------------------------------------------

test("distance : deux points identiques valent zéro", () => {
  assert.equal(geo.distanceInMeters(14.6928, -17.4467, 14.6928, -17.4467), 0);
});

test("distance : Dakar vers Thiès, environ 56 km à vol d'oiseau, dans les deux sens", () => {
  const ab = geo.distanceInMeters(14.6928, -17.4467, 14.7910, -16.9359);
  const ba = geo.distanceInMeters(14.7910, -16.9359, 14.6928, -17.4467);
  assert.ok(ab > 55_000 && ab < 57_000, `distance inattendue : ${ab}`);
  assert.ok(Math.abs(ab - ba) < 1e-6);
});

test("distance : un pointage à 50 m reste dans un rayon de 100 m", () => {
  // 0.00045 degré de latitude ≈ 50 m
  const d = geo.distanceInMeters(14.6928, -17.4467, 14.69325, -17.4467);
  assert.ok(d > 45 && d < 55, `distance inattendue : ${d}`);
});

// ---------------------------------------------------------------------------
// QR code de site
// ---------------------------------------------------------------------------

test("QR de site : aller-retour du jeton", () => {
  const token = "tok_9f2a1c";
  assert.equal(qr.parseSiteQrPayload(qr.siteQrPayload(token)), token);
});

test("QR de site : un contenu étranger est refusé", () => {
  assert.equal(qr.parseSiteQrPayload("https://evil.test/MANGUIFI_SITE:abc"), null);
  assert.equal(qr.parseSiteQrPayload("texte libre"), null);
});

// ---------------------------------------------------------------------------
// Dates et durées
// ---------------------------------------------------------------------------

test("dates locales : aller-retour sans décalage de jour", () => {
  for (const iso of ["2026-08-01", "2026-12-31", "2026-02-28"]) {
    assert.equal(logic.toLocalDateString(logic.parseLocalDate(iso)), iso);
  }
});

test("début et fin de journée couvrent la journée locale", () => {
  const noon = new Date(2026, 7, 1, 12, 0, 0);
  assert.equal(logic.startOfDay(noon).getHours(), 0);
  assert.equal(logic.endOfDay(noon).getDate(), 1);
  assert.equal(logic.endOfDay(noon).getHours(), 23);
});

test("durées affichées au format HhMM, signe et zéros inclus", () => {
  assert.equal(logic.minutesToLabel(0), "0h00");
  assert.equal(logic.minutesToLabel(65), "1h05");
  assert.equal(logic.minutesToLabel(-90), "-1h30");
  assert.equal(logic.minutesToLabel(600), "10h00");
});

// ---------------------------------------------------------------------------
// Heures supplémentaires
// ---------------------------------------------------------------------------

test("heures sup : 60 minutes exactement reste modéré, au-delà devient important", () => {
  assert.equal(overtime.classifyOvertimeSeverity(60, 0), "modere");
  assert.equal(overtime.classifyOvertimeSeverity(61, 0), "important");
});

test("heures sup : trois dépassements en attente deviennent répétés", () => {
  assert.equal(overtime.classifyOvertimeSeverity(20, 2), "modere");
  assert.equal(overtime.classifyOvertimeSeverity(20, 3), "repete");
  assert.equal(overtime.classifyOvertimeSeverity(20, 3), "repete");
});

// ---------------------------------------------------------------------------
// Téléphones et conditions
// ---------------------------------------------------------------------------

test("téléphones sénégalais normalisés en E.164", () => {
  assert.equal(phone.toE164("77 123 45 67"), "+221771234567");
  assert.equal(phone.toE164("+221 77 123 45 67"), "+221771234567");
});

test("numéro invalide refusé", () => {
  assert.equal(phone.toE164(""), null);
  assert.equal(phone.toE164("12"), null);
});

test("version des CGU au format date ISO", () => {
  assert.match(terms.CURRENT_TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});
