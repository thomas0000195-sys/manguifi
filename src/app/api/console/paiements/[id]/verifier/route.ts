import { NextResponse } from "next/server";
import { requireConsoleUser } from "@/lib/console/guard";
import { BillingError, reconcileAttempt } from "@/lib/billing/paydunya-payments";

export const dynamic = "force-dynamic";

/** POST /api/console/paiements/:id/verifier — revérifie une tentative auprès de PayDunya (super admin uniquement). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireConsoleUser();
  } catch {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await reconcileAttempt(id);
    return NextResponse.json({ status: result.status, credited: result.credited });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "not_found" ? 404 : 502 });
    }
    return NextResponse.json({ error: "Vérification impossible pour le moment." }, { status: 502 });
  }
}
