import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { recordHeartbeat } from "@/lib/console/heartbeat";
import { reconcileStaleAttempts } from "@/lib/billing/paydunya-payments";

export const dynamic = "force-dynamic";

const JOB_NAME = "paydunya-reconcile";

/**
 * Rattrapage des paiements PayDunya restés en attente (à appeler toutes les 15 à 30 minutes).
 * Authentification : `Authorization: Bearer <CRON_SECRET>`, jamais dans l'URL.
 */
export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req.headers.get("authorization"));
  if (auth === "unconfigured") return NextResponse.json({ error: "Non configuré." }, { status: 503 });
  if (auth !== "ok") return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const started = Date.now();
  try {
    const summary = await reconcileStaleAttempts();
    await recordHeartbeat(JOB_NAME, "ok", Date.now() - started);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    await recordHeartbeat(JOB_NAME, "error", Date.now() - started, err instanceof Error ? err.name : "erreur");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
