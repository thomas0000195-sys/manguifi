/**
 * Contrôle GPS au pointage (src/lib/geofence.ts).
 * Garde-fou du lot 4 : le contournement n'existe que pour l'entreprise de démonstration.
 *
 * Lancer avec : npm run test:auth
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { geofenceAnomaly } from "../src/lib/geofence";

const SITE = { latitude: 14.6937, longitude: -17.4441, radiusMeters: 150 };
const FAR = { latitude: 14.7917, longitude: -16.9256 }; // Thiès, à plusieurs dizaines de kilomètres
const ON_SITE = { latitude: 14.6938, longitude: -17.4442 };

test("entreprise réelle hors zone : anomalie enregistrée, pas de contournement", () => {
  const res = geofenceAnomaly({ isDemo: false, site: SITE, ...FAR });
  assert.equal(res?.type, "HORS_ZONE_GEOGRAPHIQUE");
});

test("entreprise réelle sur le site : aucune anomalie", () => {
  assert.equal(geofenceAnomaly({ isDemo: false, site: SITE, ...ON_SITE }), null);
});

test("entreprise réelle sans coordonnées de site : anomalie SITE_NON_GEOLOCALISE", () => {
  const res = geofenceAnomaly({ isDemo: false, site: { latitude: null, longitude: null, radiusMeters: 150 }, ...ON_SITE });
  assert.equal(res?.type, "SITE_NON_GEOLOCALISE");
});

test("entreprise de démonstration hors zone : aucune anomalie (contournement serveur)", () => {
  assert.equal(geofenceAnomaly({ isDemo: true, site: SITE, ...FAR }), null);
});

test("entreprise de démonstration sans coordonnées : aucune anomalie", () => {
  assert.equal(geofenceAnomaly({ isDemo: true, site: { latitude: null, longitude: null, radiusMeters: 150 }, ...FAR }), null);
});
