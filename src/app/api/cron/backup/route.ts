import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptDataUrl } from "@/lib/crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Scheduled backup endpoint. Not wired to any UI — meant to be called by an
 * external scheduler (Vercel Cron, Windows Task Scheduler + curl, a cron
 * job on a VPS) on whatever cadence you want. Writes one JSON file per org
 * per run under ./backups, named with a timestamp so runs never collide.
 *
 * Protect it: set CRON_SECRET in the environment and call with either
 * `Authorization: Bearer <secret>` or `?secret=<secret>`. Without a secret
 * configured the route refuses to run (fails closed, not open).
 *
 * Example (Windows Task Scheduler, daily):
 *   curl -H "Authorization: Bearer %CRON_SECRET%" https://your-domain/api/cron/backup
 *
 * Example (Vercel Cron, in vercel.json):
 *   { "crons": [{ "path": "/api/cron/backup?secret=YOUR_SECRET", "schedule": "0 3 * * *" }] }
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET n'est pas configuré — sauvegarde désactivée par sécurité." },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const provided = authHeader?.replace(/^Bearer\s+/i, "") ?? querySecret;

  if (provided !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany();
  const backupDir = path.join(process.cwd(), "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const results: { orgId: string; file: string }[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (const org of orgs) {
    const [sites, teams, employees, users, responsableTeams, attendances, justificatifs, overtimes, schedules] =
      await Promise.all([
        prisma.site.findMany({ where: { orgId: org.id } }),
        prisma.team.findMany({ where: { orgId: org.id } }),
        prisma.employee.findMany({ where: { orgId: org.id } }),
        // passwordHash is already a one-way bcrypt hash — safe to include so
        // a restore doesn't leave every account locked out.
        prisma.user.findMany({ where: { orgId: org.id } }),
        prisma.responsableTeam.findMany({ where: { user: { orgId: org.id } } }),
        prisma.attendance.findMany({ where: { orgId: org.id } }),
        prisma.justificatif.findMany({ where: { orgId: org.id } }),
        prisma.overtimeRecord.findMany({ where: { orgId: org.id } }),
        prisma.schedule.findMany({ where: { orgId: org.id } }),
      ]);

    const payload = {
      backedUpAt: new Date().toISOString(),
      org,
      sites,
      teams,
      employees,
      users,
      responsableTeams,
      schedules,
      attendances: attendances.map((a) => ({
        ...a,
        photoDataUrl: a.photoDataUrl ? decryptDataUrl(a.photoDataUrl) : null,
      })),
      justificatifs: justificatifs.map((j) => ({
        ...j,
        documentDataUrl: decryptDataUrl(j.documentDataUrl),
      })),
      overtimes,
    };

    const safeName = org.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const file = `${timestamp}_${safeName}_${org.id}.json`;
    await fs.writeFile(path.join(backupDir, file), JSON.stringify(payload, null, 2), "utf8");
    results.push({ orgId: org.id, file });
  }

  return NextResponse.json({ ok: true, backedUpOrgs: results.length, files: results });
}
