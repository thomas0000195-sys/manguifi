/*
  Warnings:

  - You are about to drop the column `qrToken` on the `Employee` table. All the data in the column will be lost.
  - Added the required column `matricule` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - The required column `qrToken` was added to the `Site` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "position" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIF',
    "photoUrl" TEXT,
    "matricule" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "idNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Employee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("createdAt", "email", "firstName", "id", "lastName", "orgId", "phone", "photoUrl", "position", "status", "teamId") SELECT "createdAt", "email", "firstName", "id", "lastName", "orgId", "phone", "photoUrl", "position", "status", "teamId" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_matricule_key" ON "Employee"("matricule");
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoOnPunchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "geolocationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedTimeWindowEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedTimeWindowStart" TEXT,
    "allowedTimeWindowEnd" TEXT,
    "hapticFeedbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 10,
    "justificationDelayDays" INTEGER NOT NULL DEFAULT 3,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "matriculePrefix" TEXT NOT NULL DEFAULT 'MGF',
    "employeeSequence" INTEGER NOT NULL DEFAULT 0,
    "idNumberEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Organization" ("allowedTimeWindowEnabled", "allowedTimeWindowEnd", "allowedTimeWindowStart", "createdAt", "geolocationEnabled", "hapticFeedbackEnabled", "id", "isDemo", "justificationDelayDays", "name", "onboardingCompleted", "photoOnPunchEnabled", "toleranceMinutes") SELECT "allowedTimeWindowEnabled", "allowedTimeWindowEnd", "allowedTimeWindowStart", "createdAt", "geolocationEnabled", "hapticFeedbackEnabled", "id", "isDemo", "justificationDelayDays", "name", "onboardingCompleted", "photoOnPunchEnabled", "toleranceMinutes" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE TABLE "new_Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 150,
    "qrToken" TEXT NOT NULL,
    "qrRegeneratedAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Site_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Site" ("address", "createdAt", "id", "name", "orgId") SELECT "address", "createdAt", "id", "name", "orgId" FROM "Site";
DROP TABLE "Site";
ALTER TABLE "new_Site" RENAME TO "Site";
CREATE UNIQUE INDEX "Site_qrToken_key" ON "Site"("qrToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
