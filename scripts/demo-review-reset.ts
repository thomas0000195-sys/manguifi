/**
 * Entreprise de démonstration pour la revue des stores (lot 4).
 *
 * - Touche UNIQUEMENT l'entreprise marquée `isDemo` et portant le nom ci-dessous.
 *   Aucune autre entreprise n'est lue ni modifiée ni supprimée.
 * - Idempotent : relancer la commande recrée les pointages de démo et renouvelle les mots de passe.
 * - Les mots de passe sont générés ici, affichés UNE fois dans le terminal, et jamais écrits dans le dépôt.
 *
 * Usage : npm run demo:reset
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { hashEmail } from "../src/lib/crypto";

const DEMO_ORG_NAME = "Démonstration Manguifi";
const DEMO_ADMIN_EMAIL = "demo.admin@example.com";
const DEMO_EMPLOYEE_EMAIL = "demo.employe@example.com";
const SITE = { name: "Siège de démonstration", address: "Plateau, Dakar, Sénégal", latitude: 14.6937, longitude: -17.4441, radiusMeters: 150 };
const EMPLOYEES = [
  { firstName: "Awa", lastName: "Diop", position: "Serveuse", matricule: "MGF-DEMO-001", login: false },
  { firstName: "Moussa", lastName: "Ndiaye", position: "Cuisinier", matricule: "MGF-DEMO-002", login: false },
  { firstName: "Fatou", lastName: "Sow", position: "Caissière", matricule: "MGF-DEMO-003", login: true },
];

function randomPassword() {
  return crypto.randomBytes(12).toString("base64url");
}

async function main() {
  let org = await prisma.organization.findFirst({ where: { name: DEMO_ORG_NAME, isDemo: true } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: DEMO_ORG_NAME, isDemo: true, onboardingCompleted: true, matriculePrefix: "MGF", toleranceMinutes: 10 },
    });
    console.log("Entreprise de démonstration créée.");
  }

  const site = (await prisma.site.findFirst({ where: { orgId: org.id, name: SITE.name } })) ??
    (await prisma.site.create({ data: { orgId: org.id, ...SITE } }));

  const team = (await prisma.team.findFirst({ where: { orgId: org.id, siteId: site.id, name: "Équipe service" } })) ??
    (await prisma.team.create({ data: { orgId: org.id, siteId: site.id, name: "Équipe service" } }));

  const employees = [];
  for (const e of EMPLOYEES) {
    const emp =
      (await prisma.employee.findFirst({ where: { orgId: org.id, matricule: e.matricule } })) ??
      (await prisma.employee.create({
        data: { orgId: org.id, teamId: team.id, firstName: e.firstName, lastName: e.lastName, position: e.position, matricule: e.matricule, status: "ACTIF" },
      }));
    employees.push(emp);
  }

  // Compte admin de démo : e-mail fictif (domaine réservé), mot de passe renouvelé à chaque lancement.
  const adminPassword = randomPassword();
  const employeePassword = randomPassword();
  await prisma.user.upsert({
    where: { emailHash: hashEmail(DEMO_ADMIN_EMAIL) },
    update: { orgId: org.id, role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 10), blockedAt: null },
    create: { orgId: org.id, role: "ADMIN", emailHash: hashEmail(DEMO_ADMIN_EMAIL), passwordHash: await bcrypt.hash(adminPassword, 10) },
  });

  // Compte employé de démo, relié à une fiche employé de l'entreprise de démo uniquement.
  const loginEmployee = employees.find((_, i) => EMPLOYEES[i].login)!;
  await prisma.user.upsert({
    where: { emailHash: hashEmail(DEMO_EMPLOYEE_EMAIL) },
    update: { orgId: org.id, role: "EMPLOYEE", employeeId: loginEmployee.id, passwordHash: await bcrypt.hash(employeePassword, 10), blockedAt: null },
    create: { orgId: org.id, role: "EMPLOYEE", emailHash: hashEmail(DEMO_EMPLOYEE_EMAIL), passwordHash: await bcrypt.hash(employeePassword, 10), employeeId: loginEmployee.id },
  });

  // Pointages de démo des 30 derniers jours (jours ouvrés), recréés à chaque lancement.
  await prisma.attendance.deleteMany({ where: { orgId: org.id } });
  const rows = [];
  const today = new Date();
  for (let d = 30; d >= 0; d--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d);
    if (day.getDay() === 0) continue;
    for (const emp of employees) {
      const arrival = new Date(day.getTime() + 8 * 3600e3 + (emp.matricule.endsWith("2") && d % 4 === 0 ? 17 * 60e3 : 0));
      const departure = new Date(day.getTime() + 17 * 3600e3);
      rows.push(
        { orgId: org.id, employeeId: emp.id, siteId: site.id, type: "ARRIVEE" as const, timestamp: arrival },
        { orgId: org.id, employeeId: emp.id, siteId: site.id, type: "DEPART" as const, timestamp: departure }
      );
    }
  }
  await prisma.attendance.createMany({ data: rows });

  console.log("\nDémonstration prête. Notez ces identifiants dans Bitwarden (ils ne seront pas réaffichés) :");
  console.log(`  Admin     : ${DEMO_ADMIN_EMAIL}  /  ${adminPassword}`);
  console.log(`  Employé   : ${DEMO_EMPLOYEE_EMAIL}  /  ${employeePassword}`);
  console.log(`  Pointages : ${rows.length} créés sur 30 jours.`);
}

main()
  .catch((err) => {
    console.error("Échec :", err instanceof Error ? err.name : "erreur");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
