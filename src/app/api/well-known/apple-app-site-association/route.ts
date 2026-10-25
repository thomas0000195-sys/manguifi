import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Fichier de liens universels iOS (apple-app-site-association). Servi via une réécriture
 * de /.well-known/apple-app-site-association, sans redirection.
 * Sans APPLE_TEAM_ID, renvoie une configuration vide (JSON valide, aucun lien ouvert dans l'app).
 */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const bundleId = (process.env.APPLE_BUNDLE_ID ?? "tech.manguifi.app").trim();

  const body = teamId
    ? {
        applinks: {
          apps: [],
          details: [{ appID: `${teamId}.${bundleId}`, paths: ["/", "/espace/*", "/dashboard*"] }],
        },
      }
    : { applinks: { apps: [], details: [] } };

  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
