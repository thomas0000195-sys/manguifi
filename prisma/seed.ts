import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { toE164, hashPhone } from "../src/lib/phone";

const prisma = new PrismaClient();

const PREFIX = "enc:v1:";
function getKey() {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? "manguifi-dev-fallback-key";
  return crypto.createHash("sha256").update(secret).digest();
}
function encryptDataUrl(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

const PLACEHOLDER_DOC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFN0lEQVR4nO3dsW3jQBRF0acsHqYAFuASWICLcAsuwSU4ZAmuwCW4hCFwCU7cAtLAt8DPBmFICR6dU8+Pi/9AXo0EDSaEEEIIIYQQQoi/6QW8gDfwAb6BH/ANfIA38A18gW/gA/wD/oGf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+An+Al+gp/gJ/gJfoKf4Cf4CX6Cn+AH+AV+AoY6AV/xTVMAAAAAElFTkSuQmCC";

function at(date: Date, h: number, m: number) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  // This script wipes every table before reseeding — running it against a
  // real deployment would destroy real customer data. It refuses to run
  // whenever NODE_ENV=production, no matter how it's invoked.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Refus d'exécuter le seed : NODE_ENV=production. Ce script efface toutes les données existantes et ne doit jamais tourner sur un déploiement réel."
    );
    process.exit(1);
  }

  console.log("Nettoyage des données existantes...");
  await prisma.auditLog.deleteMany();
  await prisma.overtimeRecord.deleteMany();
  await prisma.justificatif.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.responsableTeam.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.team.deleteMany();
  await prisma.site.deleteMany();
  await prisma.organization.deleteMany();

  console.log("Création de l'organisation démo...");
  const org = await prisma.organization.create({
    data: {
      name: "Restaurant Le Baobab",
      onboardingCompleted: true,
      isDemo: true,
      photoOnPunchEnabled: true,
      hapticFeedbackEnabled: true,
      toleranceMinutes: 10,
      justificationDelayDays: 3,
      matriculePrefix: "MGF",
    },
  });

  const site = await prisma.site.create({
    data: {
      orgId: org.id,
      name: "Siège principal",
      address: "Plateau, Dakar, Sénégal",
      latitude: 14.6937,
      longitude: -17.4441,
      radiusMeters: 150,
    },
  });

  const teamsData = [
    { name: "Cuisine", start: "07:00", end: "15:00" },
    { name: "Salle", start: "10:00", end: "19:00" },
    { name: "Sécurité", start: "14:00", end: "22:00" },
  ];

  const teams = [];
  for (const t of teamsData) {
    const team = await prisma.team.create({
      data: { orgId: org.id, siteId: site.id, name: t.name },
    });
    await prisma.schedule.create({
      data: {
        orgId: org.id,
        teamId: team.id,
        daysOfWeek: "1,2,3,4,5,6",
        startTime: t.start,
        endTime: t.end,
        toleranceMinutes: 10,
      },
    });
    teams.push({ ...team, start: t.start, end: t.end });
  }

  const passwordHash = await bcrypt.hash("manguifi123", 10);

  await prisma.user.create({
    data: {
      orgId: org.id,
      email: "admin@baobab.mg",
      passwordHash,
      role: "ADMIN",
    },
  });

  const responsable = await prisma.user.create({
    data: {
      orgId: org.id,
      email: "responsable@baobab.mg",
      passwordHash,
      role: "RESPONSABLE",
    },
  });
  await prisma.responsableTeam.create({
    data: { userId: responsable.id, teamId: teams[1].id },
  });

  const employeeNames = [
    ["Aïcha", "Traoré", "Cuisine"],
    ["Moussa", "Diallo", "Cuisine"],
    ["Fatou", "Ndiaye", "Cuisine"],
    ["Ibrahima", "Sow", "Salle"],
    ["Aminata", "Cissé", "Salle"],
    ["Ousmane", "Ba", "Salle"],
    ["Mariam", "Koné", "Salle"],
    ["Cheikh", "Faye", "Sécurité"],
    ["Awa", "Diop", "Sécurité"],
    ["Modou", "Sarr", "Cuisine"],
  ] as const;

  const usedPhones = new Set<string>();
  function nextPhone(): string {
    let e164: string | null = null;
    while (!e164 || usedPhones.has(e164)) {
      e164 = toE164(`77${rand(1000000, 9999999)}`);
    }
    usedPhones.add(e164);
    return e164;
  }

  const employees = [];
  let seq = 0;
  for (const [firstName, lastName, teamName] of employeeNames) {
    seq++;
    const team = teams.find((t) => t.name === teamName)!;
    const phoneE164 = nextPhone();
    const emp = await prisma.employee.create({
      data: {
        orgId: org.id,
        teamId: team.id,
        firstName,
        lastName,
        phone: encryptDataUrl(phoneE164),
        phoneHash: hashPhone(phoneE164),
        position: teamName === "Cuisine" ? "Cuisinier·ère" : teamName === "Salle" ? "Serveur·se" : "Agent de sécurité",
        matricule: `MGF-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`,
        photoUrl: encryptDataUrl(PLACEHOLDER_DOC),
      },
    });
    employees.push({ ...emp, phone: phoneE164, teamStart: team.start, teamEnd: team.end });
  }
  await prisma.organization.update({ where: { id: org.id }, data: { employeeSequence: seq } });

  // Employees no longer get a password — their account is created lazily the
  // first time they verify their WhatsApp number via /connexion-employe.
  const demoEmployee = employees[0];

  console.log("Génération de 21 jours de pointages...");
  const today = new Date();
  for (let dayOffset = 21; dayOffset >= 1; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);
    const weekday = day.getDay();
    if (weekday === 0) continue;

    for (const emp of employees) {
      const [sh, sm] = emp.teamStart.split(":").map(Number);
      const [eh, em] = emp.teamEnd.split(":").map(Number);

      const roll = Math.random();
      if (roll < 0.06) continue;

      const isLate = roll > 0.06 && roll < 0.18;
      const isOvertime = roll > 0.8 && roll < 0.93;
      const isMissingDeparture = roll > 0.93 && roll < 0.97;
      const lowConfidence = Math.random() < 0.08;

      const arriveeMin = isLate ? sm + rand(15, 40) : sm + rand(-5, 5);
      const arrivee = at(day, sh + Math.floor(arriveeMin / 60), ((arriveeMin % 60) + 60) % 60);

      await prisma.attendance.create({
        data: {
          orgId: org.id,
          employeeId: emp.id,
          siteId: site.id,
          type: "ARRIVEE",
          timestamp: arrivee,
          confidence: lowConfidence ? "A_VERIFIER" : "ELEVE",
          isAnomaly: lowConfidence,
          anomalyType: lowConfidence ? "CONFIANCE_FAIBLE" : null,
          deviceFingerprint: `demo-device-${emp.id.slice(0, 6)}`,
        },
      });

      if (!isMissingDeparture || dayOffset > 1) {
        const departMin = isOvertime ? em + rand(35, 90) : em + rand(-10, 5);
        const depart = at(day, eh + Math.floor(departMin / 60), ((departMin % 60) + 60) % 60);

        await prisma.attendance.create({
          data: {
            orgId: org.id,
            employeeId: emp.id,
            siteId: site.id,
            type: "DEPART",
            timestamp: depart,
            confidence: "ELEVE",
            deviceFingerprint: `demo-device-${emp.id.slice(0, 6)}`,
          },
        });

        const workedMinutes = Math.round((depart.getTime() - arrivee.getTime()) / 60000);
        const plannedMinutes = eh * 60 + em - (sh * 60 + sm);
        const overtimeMinutes = Math.max(0, workedMinutes - plannedMinutes - 10);

        if (overtimeMinutes > 0) {
          const statusRoll = Math.random();
          const status =
            statusRoll < 0.4 ? "NON_PLANIFIEE" : statusRoll < 0.7 ? "VALIDEE" : statusRoll < 0.85 ? "REJETEE" : "PLANIFIEE_A_L_AVANCE";
          await prisma.overtimeRecord.create({
            data: {
              orgId: org.id,
              employeeId: emp.id,
              date: at(day, 0, 0),
              plannedMinutes,
              workedMinutes,
              overtimeMinutes,
              status,
              plannedInAdvance: status === "PLANIFIEE_A_L_AVANCE",
              validatedById: status === "VALIDEE" || status === "REJETEE" ? responsable.id : null,
              validatedAt: status === "VALIDEE" || status === "REJETEE" ? new Date() : null,
            },
          });
        }
      }
    }
  }

  console.log("Génération des pointages du jour...");
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const emp of employees) {
    const [sh, sm] = emp.teamStart.split(":").map(Number);
    const [eh, em] = emp.teamEnd.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (nowMin < startMin - 30) continue;

    const roll = Math.random();
    if (roll < 0.08) continue;

    const isLate = roll > 0.08 && roll < 0.22;
    const lowConfidence = Math.random() < 0.06;
    const arriveeMin = Math.min(nowMin, isLate ? startMin + rand(15, 35) : startMin + rand(-5, 5));
    const arrivee = at(today, Math.floor(arriveeMin / 60), ((arriveeMin % 60) + 60) % 60);

    await prisma.attendance.create({
      data: {
        orgId: org.id,
        employeeId: emp.id,
        siteId: site.id,
        type: "ARRIVEE",
        timestamp: arrivee,
        confidence: lowConfidence ? "A_VERIFIER" : "ELEVE",
        isAnomaly: lowConfidence,
        anomalyType: lowConfidence ? "CONFIANCE_FAIBLE" : null,
        deviceFingerprint: `demo-device-${emp.id.slice(0, 6)}`,
      },
    });

    if (nowMin > endMin + 5 && Math.random() > 0.15) {
      const departMin = Math.min(nowMin, endMin + rand(-10, 20));
      if (departMin > arriveeMin) {
        const depart = at(today, Math.floor(departMin / 60), ((departMin % 60) + 60) % 60);
        await prisma.attendance.create({
          data: {
            orgId: org.id,
            employeeId: emp.id,
            siteId: site.id,
            type: "DEPART",
            timestamp: depart,
            confidence: "ELEVE",
            deviceFingerprint: `demo-device-${emp.id.slice(0, 6)}`,
          },
        });

        const workedMinutes = departMin - arriveeMin;
        const plannedMinutes = endMin - startMin;
        const overtimeMinutes = Math.max(0, workedMinutes - plannedMinutes - 10);
        if (overtimeMinutes > 0) {
          await prisma.overtimeRecord.upsert({
            where: { employeeId_date: { employeeId: emp.id, date: at(today, 0, 0) } },
            create: {
              orgId: org.id,
              employeeId: emp.id,
              date: at(today, 0, 0),
              plannedMinutes,
              workedMinutes,
              overtimeMinutes,
              status: "NON_PLANIFIEE",
            },
            update: { workedMinutes, overtimeMinutes },
          });
        }
      }
    }
  }

  console.log("Création de justificatifs de démonstration...");
  const justifData = [
    { emp: employees[2], status: "JUSTIFIE" as const, motif: "MALADIE" as const, daysAgo: 10, payType: "PAYE" as const },
    { emp: employees[4], status: "EN_ATTENTE" as const, motif: "CONGE_PAYE" as const, daysAgo: 2, payType: "PAYE" as const },
    { emp: employees[6], status: "REFUSE" as const, motif: "AUTRE" as const, daysAgo: 6, payType: "NON_PAYE" as const },
    { emp: employees[8], status: "EN_ATTENTE" as const, motif: "DEUIL" as const, daysAgo: 1, payType: "PAYE" as const },
    { emp: employees[1], status: "JUSTIFIE" as const, motif: "CONGE_SANS_SOLDE" as const, daysAgo: 15, payType: "NON_PAYE" as const },
  ];

  for (const j of justifData) {
    const start = new Date(today);
    start.setDate(start.getDate() - j.daysAgo);
    await prisma.justificatif.create({
      data: {
        orgId: org.id,
        employeeId: j.emp.id,
        dateStart: start,
        dateEnd: start,
        motif: j.motif,
        payType: j.payType,
        documentDataUrl: PLACEHOLDER_DOC,
        status: j.status,
        comment: j.status === "REFUSE" ? "Document illisible, merci de renvoyer un justificatif plus clair." : j.status === "JUSTIFIE" ? "Justificatif conforme." : null,
        reviewedById: j.status === "EN_ATTENTE" ? null : responsable.id,
        reviewedAt: j.status === "EN_ATTENTE" ? null : new Date(),
      },
    });
  }

  console.log("✅ Données démo créées avec succès.");
  console.log("");
  console.log("Comptes de démonstration :");
  console.log("  Admin        → admin@baobab.mg (mot de passe: manguifi123)");
  console.log("  Responsable  → responsable@baobab.mg (mot de passe: manguifi123)");
  console.log(
    `  Employé      → ${demoEmployee.firstName} ${demoEmployee.lastName}, connexion via /connexion-employe avec le numéro ${demoEmployee.phone}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
