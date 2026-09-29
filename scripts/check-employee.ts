#!/usr/bin/env node
/**
 * Vérifie si un employé existe dans la base de données avec un numéro donné
 * Usage: node --import tsx scripts/check-employee.ts +221775337626
 */

import { prisma } from "@/lib/prisma";
import { toE164, hashPhone } from "@/lib/phone";

async function checkEmployee() {
  const rawPhone = process.argv[2];

  if (!rawPhone) {
    console.error("Usage: node --import tsx scripts/check-employee.ts <phone>");
    console.error("Example: node --import tsx scripts/check-employee.ts 775337626");
    console.error("Example: node --import tsx scripts/check-employee.ts +221775337626");
    process.exit(1);
  }

  console.log(`\n🔍 Vérification employé avec: "${rawPhone}"\n`);

  const e164 = toE164(rawPhone);
  console.log(`✅ Normalisé en E.164: ${e164 || "ERREUR - format invalide"}\n`);

  if (!e164) {
    console.log("❌ Le numéro n'est pas au bon format pour le Sénégal.");
    console.log("   Formats acceptés:");
    console.log("   - 775337626 (sans code pays)");
    console.log("   - +221775337626 (avec code pays)");
    await prisma.$disconnect();
    process.exit(1);
  }

  const hash = hashPhone(e164);
  console.log(`🔐 Hash calculé: ${hash.substring(0, 16)}...\n`);

  // Chercher par hash
  const employee = await prisma.employee.findFirst({
    where: { phoneHash: hash },
    select: { id: true, name: true, status: true, orgId: true, org: { select: { name: true } } },
  });

  if (employee) {
    console.log(`✅ EMPLOYÉ TROUVÉ!`);
    console.log(`   Nom: ${employee.name}`);
    console.log(`   Entreprise: ${employee.org.name}`);
    console.log(`   Statut: ${employee.status}`);
    console.log(`   ID: ${employee.id}\n`);
  } else {
    console.log(`❌ EMPLOYÉ NON TROUVÉ avec ce hash!\n`);

    console.log("📊 Employés existants dans la base:");
    const allEmployees = await prisma.employee.findMany({
      select: { id: true, name: true, status: true, org: { select: { name: true } } },
      take: 10,
    });

    if (allEmployees.length === 0) {
      console.log("   (Aucun employé trouvé)");
    } else {
      allEmployees.forEach((emp) => {
        console.log(`   - ${emp.name} (${emp.org.name}, ${emp.status})`);
      });
    }
  }

  await prisma.$disconnect();
}

checkEmployee().catch(console.error);
