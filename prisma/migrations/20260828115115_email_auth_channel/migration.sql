-- Adds an optional email login channel per organization (WHATSAPP stays
-- the default and production target). Employee.phone/phoneHash become
-- nullable — an EMAIL-channel employee has no phone at all — and
-- Employee.emailHash is added as the email equivalent of phoneHash.

-- CreateTable
CREATE TABLE "EmailOtpCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EmailOtpCode_emailHash_createdAt_idx" ON "EmailOtpCode"("emailHash", "createdAt");

-- AlterTable: Organization gains authChannel
ALTER TABLE "Organization" ADD COLUMN "authChannel" TEXT NOT NULL DEFAULT 'WHATSAPP';

-- RedefineTable: Employee — phone/phoneHash become nullable, emailHash added
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "phoneHash" TEXT,
    "email" TEXT,
    "emailHash" TEXT,
    "position" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIF',
    "photoUrl" TEXT,
    "matricule" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "idNumber" TEXT,
    "invitationStatus" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "phoneVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Employee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("id", "orgId", "teamId", "firstName", "lastName", "phone", "phoneHash", "email", "position", "status", "photoUrl", "matricule", "dateOfBirth", "idNumber", "invitationStatus", "phoneVerifiedAt", "createdAt")
SELECT "id", "orgId", "teamId", "firstName", "lastName", "phone", "phoneHash", "email", "position", "status", "photoUrl", "matricule", "dateOfBirth", "idNumber", "invitationStatus", "phoneVerifiedAt", "createdAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_phoneHash_key" ON "Employee"("phoneHash");
CREATE UNIQUE INDEX "Employee_emailHash_key" ON "Employee"("emailHash");
CREATE UNIQUE INDEX "Employee_matricule_key" ON "Employee"("matricule");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
