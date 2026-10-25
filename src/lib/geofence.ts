import { distanceInMeters } from "@/lib/geo";

export type GeofenceSite = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
};

/**
 * Contrôle de la position au pointage. Renvoie l'anomalie à enregistrer, ou null.
 *
 * Le contournement n'existe que pour l'entreprise de démonstration (`isDemo`), décidé ici,
 * côté serveur. Une entreprise réelle est toujours contrôlée, sans exception.
 */
export function geofenceAnomaly(input: {
  isDemo: boolean;
  site: GeofenceSite;
  latitude: number;
  longitude: number;
}): { type: string; message: string } | null {
  if (input.isDemo) return null;

  if (input.site.latitude == null || input.site.longitude == null) {
    return {
      type: "SITE_NON_GEOLOCALISE",
      message: "Ce site n'a pas encore de coordonnées GPS configurées — demandez à votre administrateur de les renseigner.",
    };
  }

  const distance = distanceInMeters(input.latitude, input.longitude, input.site.latitude, input.site.longitude);
  if (distance > input.site.radiusMeters) {
    return {
      type: "HORS_ZONE_GEOGRAPHIQUE",
      message: `Pointage à ${Math.round(distance)} m du site (zone autorisée : ${input.site.radiusMeters} m).`,
    };
  }

  return null;
}
