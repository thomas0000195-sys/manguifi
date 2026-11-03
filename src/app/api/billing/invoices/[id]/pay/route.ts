import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { BillingError, startInvoicePayment } from "@/lib/billing/paydunya-payments";

export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<BillingError["code"], number> = {
  forbidden: 403,
  disabled: 403,
  not_found: 404,
  not_payable: 409,
  provider: 503,
  signature: 502,
};

/** Protection CSRF simple : l'origine de la requête doit être celle de l'application. */
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const appUrl = process.env.APP_URL;
  if (!origin || !appUrl) return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

/** POST /api/billing/invoices/:id/pay — crée la tentative et renvoie l'URL de paiement PayDunya. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  try {
    const result = await startInvoicePayment({ id: user.id, orgId: user.orgId, role: user.role }, id);
    return NextResponse.json({ checkoutUrl: result.checkoutUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: STATUS_BY_CODE[err.code] });
    }
    return NextResponse.json({ error: "Erreur inattendue. Réessayez plus tard." }, { status: 500 });
  }
}
