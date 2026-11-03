import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/console/errors";
import { readPaydunyaConfig } from "@/lib/paydunya/config";
import { isValidPaydunyaHash } from "@/lib/paydunya/client";
import { reconcileAttempt } from "@/lib/billing/paydunya-payments";

export const dynamic = "force-dynamic";

/** Une notification PayDunya fait quelques centaines d'octets : au-delà, c'est suspect. */
const MAX_BODY_BYTES = 16 * 1024;
const MAX_TOKEN_LENGTH = 200;

/**
 * Notification instantanée (IPN) de PayDunya, au format application/x-www-form-urlencoded.
 *
 * 1. signature (hash SHA-512 de la clé principale) vérifiée avant toute autre chose ;
 * 2. le statut n'est jamais repris de la notification : il est redemandé à PayDunya ;
 * 3. 200 seulement quand le traitement est terminé ou volontairement ignoré,
 *    500 sinon, pour que PayDunya rejoue la notification.
 */
export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit("paydunya-ipn", "global", { limit: 300, windowMs: 60_000 });
  if (!allowed) return new NextResponse(null, { status: 429 });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  let cfg;
  try {
    cfg = readPaydunyaConfig();
  } catch {
    return new NextResponse(null, { status: 500 });
  }
  if (!cfg) return new NextResponse(null, { status: 404 });

  const params = new URLSearchParams(raw);
  const hash = params.get("data[hash]");
  if (!isValidPaydunyaHash(hash, cfg.masterKey)) {
    await logError({
      severity: "warning",
      source: "api",
      message: "billing.ipn_rejected : signature PayDunya invalide",
      route: "/api/billing/paydunya/ipn",
    });
    return new NextResponse(null, { status: 400 });
  }

  const token = params.get("data[invoice][token]");
  if (!token || token.length > MAX_TOKEN_LENGTH) return new NextResponse(null, { status: 200 });

  const attempt = await prisma.paymentAttempt.findUnique({ where: { providerToken: token }, select: { id: true } });
  if (!attempt) return new NextResponse(null, { status: 200 });

  try {
    await reconcileAttempt(attempt.id);
  } catch (err) {
    await logError({
      severity: "error",
      source: "api",
      message: `billing.ipn_retry : ${err instanceof Error ? err.name : "erreur"}`,
      route: "/api/billing/paydunya/ipn",
    });
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}
