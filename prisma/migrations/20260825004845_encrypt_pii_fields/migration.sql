-- Encrypts identifying fields at rest (phone, dateOfBirth, idNumber) and
-- introduces phoneHash columns (deterministic HMAC-SHA256) so exact-match
-- phone lookups (WhatsApp login) keep working without the phone column
-- itself being queryable in plaintext. See src/lib/phone.ts (hashPhone)
-- and src/lib/crypto.ts (encryptDataUrl/decryptDataUrl).
--
-- No production deployment of this project has ever happened, so there is
-- no real user data to migrate — any pre-existing rows get an empty/NULL
-- phoneHash placeholder, which is only safe because none are expected.

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
    "phoneHash" TEXT NOT NULL,
    "email" TEXT,
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
SELECT "id", "orgId", "teamId", "firstName", "lastName", "phone", '', "email", "position", "status", "photoUrl", "matricule", "dateOfBirth", "idNumber", "invitationStatus", "phoneVerifiedAt", "createdAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_phoneHash_key" ON "Employee"("phoneHash");
CREATE UNIQUE INDEX "Employee_matricule_key" ON "Employee"("matricule");

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "phoneHash" TEXT,
    "phoneVerifiedAt" DATETIME,
    "role" TEXT NOT NULL,
    "employeeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("id", "orgId", "email", "passwordHash", "phone", "phoneHash", "phoneVerifiedAt", "role", "employeeId", "createdAt")
SELECT "id", "orgId", "email", "passwordHash", "phone", NULL, "phoneVerifiedAt", "role", "employeeId", "createdAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
