import { NextRequest, NextResponse } from "next/server";
import { requireConsoleUser } from "@/lib/console/guard";
import { auditCsv } from "@/lib/console/auditCsv";

export const dynamic = "force-dynamic";

/** Export CSV du journal. Réservé au super admin, vérifié côté serveur à chaque appel. */
export async function GET(req: NextRequest) {
  try {
    await requireConsoleUser();
  } catch {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ? new Date(sp.get("from") as string) : undefined;
  const to = sp.get("to") ? new Date(sp.get("to") as string) : undefined;
  const csv = await auditCsv({ action: sp.get("action") ?? undefined, orgId: sp.get("orgId") ?? undefined, from, to });

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"journal-audit.csv\"",
      "Cache-Control": "no-store",
    },
  });
}
