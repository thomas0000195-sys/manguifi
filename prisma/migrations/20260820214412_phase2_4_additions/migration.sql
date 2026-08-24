-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "isDemo" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Organization" ("allowedTimeWindowEnabled", "allowedTimeWindowEnd", "allowedTimeWindowStart", "createdAt", "geolocationEnabled", "hapticFeedbackEnabled", "id", "justificationDelayDays", "name", "onboardingCompleted", "photoOnPunchEnabled", "toleranceMinutes") SELECT "allowedTimeWindowEnabled", "allowedTimeWindowEnd", "allowedTimeWindowStart", "createdAt", "geolocationEnabled", "hapticFeedbackEnabled", "id", "justificationDelayDays", "name", "onboardingCompleted", "photoOnPunchEnabled", "toleranceMinutes" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
