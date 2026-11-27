-- Console lot 1 : abonnements, paiements, identité légale, archivage, journal enrichi.
-- Non destructive : uniquement des ajouts (colonnes nullables, nouvelles tables).
-- Retour arrière : DROP TABLE "Payment", "Subscription"; DROP TYPE ...; colonnes ajoutées supprimables.

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('BASIC', 'EQUIPE', 'ESSENTIEL', 'PREMIUM', 'ENTREPRISE');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MENSUEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ESSAI', 'ACTIF', 'IMPAYE', 'SUSPENDU', 'RESILIE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WAVE', 'ORANGE_MONEY', 'VIREMENT', 'ESPECES', 'PAYDUNYA');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "ninea" TEXT,
ADD COLUMN     "rccm" TEXT,
ADD COLUMN     "sector" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "after" TEXT,
ADD COLUMN     "before" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "plan" "PlanCode" NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MENSUEL',
    "priceApplied" INTEGER NOT NULL,
    "isFounderOffer" BOOLEAN NOT NULL DEFAULT false,
    "founderOfferEndDate" TIMESTAMP(3),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ESSAI',
    "trialEndDate" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "customMaxEmployees" INTEGER,
    "customMaxSites" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodCoveredStart" TIMESTAMP(3) NOT NULL,
    "periodCoveredEnd" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orgId_key" ON "Subscription"("orgId");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_paidAt_idx" ON "Payment"("subscriptionId", "paidAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

