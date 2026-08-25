/**
 * One-off load test for the duplicate-punch race condition fixed in
 * recordPunchAction (src/app/actions/attendance.ts): the "is there a punch
 * in the last 2 minutes" check and the insert now happen inside a single
 * Prisma $transaction so two near-simultaneous scans can't both slip past
 * the check. This script fires N concurrent "punches" for the same
 * employee and asserts exactly one Attendance row was created.
 *
 * Run with: npx tsx scripts/concurrency-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPhone } from "../src/lib/phone";

const prisma = new PrismaClient();

async function attemptPunch(employeeId: string, orgId: string, siteId: string) {
  const now = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const last = await tx.attendance.findFirst({
        where: { employeeId },
        orderBy: { timestamp: "desc" },
      });
      if (last && now.getTime() - last.timestamp.getTime() < 2 * 60 * 1000) {
        throw new Error("DUPLICATE_PUNCH");
      }
      return tx.attendance.create({
        data: {
          orgId,
          employeeId,
          siteId,
          type: "ARRIVEE",
          timestamp: now,
          confidence: "ELEVE",
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE_PUNCH") return null;
    throw err;
  }
}

async function main() {
  const org = await prisma.organization.findFirst({ where: { isDemo: true } });
  if (!org) throw new Error("Run `npm run db:seed` first — no demo org found.");

  const team = await prisma.team.findFirst({ where: { orgId: org.id } });
  if (!team) throw new Error("No team found on the demo org.");

  // Use a disposable employee so this test never touches real seeded data.
  const employee = await prisma.employee.create({
    data: {
      orgId: org.id,
      teamId: team.id,
      firstName: "Test",
      lastName: "Concurrence",
      phone: `000000000-${Date.now()}`,
      phoneHash: hashPhone(`TEST-${Date.now()}`),
      matricule: `TEST-${Date.now()}`,
    },
  });

  const CONCURRENCY = 8;
  console.log(`Firing ${CONCURRENCY} simultaneous scans for ${employee.firstName} ${employee.lastName}...`);

  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => attemptPunch(employee.id, org.id, team.siteId))
  );

  const created = results.filter(Boolean);
  const rowCount = await prisma.attendance.count({ where: { employeeId: employee.id } });

  console.log(`Accepted: ${created.length} / ${CONCURRENCY}`);
  console.log(`Rows actually in DB for this employee: ${rowCount}`);

  if (created.length === 1 && rowCount === 1) {
    console.log("PASS — exactly one punch was recorded, the rest were correctly rejected as duplicates.");
  } else {
    console.log("FAIL — race condition allowed more than one punch through.");
    process.exitCode = 1;
  }

  // Leave the DB as we found it — deleting the employee cascades its attendances.
  await prisma.employee.delete({ where: { id: employee.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
