-- Console V1 (étapes 2 à 7) : statut de suspension, blocage de compte,
-- journal d'erreurs, dernier passage des tâches planifiées.
-- Migration additive uniquement : aucune table ni colonne existante n'est supprimée ou renommée.

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "blockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "route" TEXT,
    "stack" TEXT,
    "companyId" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_severity_status_idx" ON "ErrorLog"("createdAt", "severity", "status");

-- CreateTable
CREATE TABLE "SystemHeartbeat" (
    "jobName" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "lastStatus" TEXT NOT NULL,
    "lastDurationMs" INTEGER NOT NULL,
    "lastError" TEXT,

    CONSTRAINT "SystemHeartbeat_pkey" PRIMARY KEY ("jobName")
);
