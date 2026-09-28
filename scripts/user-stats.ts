#!/usr/bin/env node
/**
 * Affiche les statistiques utilisateurs de Manguifi
 * Usage: node --import tsx scripts/user-stats.ts
 */

import { prisma } from "@/lib/prisma";

async function getUserStats() {
  console.log("\n📊 STATISTIQUES UTILISATEURS MANGUIFI\n");
  console.log("━".repeat(60));

  try {
    // Utilisateurs totaux
    const totalUsers = await prisma.user.count();
    console.log(`\n👥 Total utilisateurs: ${totalUsers}`);

    // Utilisateurs par rôle
    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });
    console.log("\n📋 Par rôle:");
    usersByRole.forEach((group) => {
      console.log(`   - ${group.role}: ${group._count}`);
    });

    // Employés actifs
    const activeEmployees = await prisma.employee.count({
      where: { status: "ACTIF" },
    });
    console.log(`\n🟢 Employés actifs: ${activeEmployees}`);

    // Utilisateurs qui se sont connectés aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const loginsToday = await prisma.auditLog.count({
      where: {
        action: "LOGIN",
        createdAt: { gte: today },
      },
    });
    console.log(`\n🔐 Connexions aujourd'hui: ${loginsToday}`);

    // Derniers utilisateurs
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, role: true, createdAt: true, employee: { select: { name: true } } },
    });
    console.log("\n⏰ Derniers utilisateurs:");
    recentUsers.forEach((user) => {
      const name = user.employee?.name || "N/A";
      console.log(`   - ${name} (${user.role}) - ${user.createdAt.toLocaleDateString("fr-FR")}`);
    });

    console.log("\n" + "━".repeat(60) + "\n");
  } catch (error) {
    console.error("Erreur:", error);
  } finally {
    await prisma.$disconnect();
  }
}

getUserStats();
