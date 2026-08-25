import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Optional automatic purge of old attendance/justificatif/overtime data,
 * per organization. Disabled by default (Organization.attendanceRetentionMonths
 * is null) — an admin must explicitly set a retention period in Paramètres,
 * since legal payroll record-keeping requirements vary by country and we
 * have no way to know what applies to a given organization.
 *
 * Not wired to any UI trigger — meant to be called by an external scheduler
 * on whatever cadence you want (daily/weekly is plenty, this only matters
 * at the scale of months). Same auth pattern as /api/cron/backup.
 *
 * Example (Windows Task Scheduler, weekly):
 *   curl -H "Authorization: Bearer %CRON_SECRET%" https://your-domain/api/cron/retention
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET n'est pas configuré — purge désactivée par sécurité." },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const provided = authHeader?.replace(/^Bearer\s+/i, "") ?? querySecret;

  if (provided !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    where: { attendanceRetentionMonths: { not: null } },
  });

  const results = [];
  for (const org of orgs) {
    const months = org.attendanceRetentionMonths!;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const [attendances, justificatifs, overtimes] = await Promise.all([
      prisma.attendance.deleteMany({ where: { orgId: org.id, timestamp: { lt: cutoff } } }),
      prisma.justificatif.deleteMany({ where: { orgId: org.id, dateEnd: { lt: cutoff } } }),
      prisma.overtimeRecord.deleteMany({ where: { orgId: org.id, date: { lt: cutoff } } }),
    ]);

    results.push({
      orgId: org.id,
      orgName: org.name,
      retentionMonths: months,
      cutoff: cutoff.toISOString(),
      deletedAttendances: attendances.count,
      deletedJustificatifs: justificatifs.count,
      deletedOvertimes: overtimes.count,
    });
  }

  return NextResponse.json({ ok: true, processedOrgs: results.length, results });
}
