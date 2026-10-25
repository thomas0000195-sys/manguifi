import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Fichier de liaison Android (Digital Asset Links). Servi via une réécriture
 * de /.well-known/assetlinks.json, sans redirection.
 * Sans configuration, renvoie une liste vide (JSON valide, aucune délégation).
 */
export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const body =
    packageName && fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: packageName,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [];

  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
