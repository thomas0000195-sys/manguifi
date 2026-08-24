/*
  Warnings:

  - You are about to drop the column `geolocationEnabled` on the `Organization` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoOnPunchEnabled" BOOLEAN NOT NULL DEFAULT true,
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
INSERT INTO "new_Organization" ("allowedTimeWindowEnabled", "allowedTimeWindowEnd", "allowedTimeWindowStart", "createdAt", "employeeSequence", "hapticFeedbackEnabled", "id", "idNumberEnabled", "isDemo", "justificationDelayDays", "matriculePrefix", "name", "onboardingCompleted", "photoOnPunchEnabled", "toleranceMinutes") SELECT "allowedTimeWindowEnabled", "allowedTimeWindowEnd", "allowedTimeWindowStart", "createdAt", "employeeSequence", "hapticFeedbackEnabled", "id", "idNumberEnabled", "isDemo", "justificationDelayDays", "matriculePrefix", "name", "onboardingCompleted", "photoOnPunchEnabled", "toleranceMinutes" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
