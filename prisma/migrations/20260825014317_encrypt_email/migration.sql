-- Encrypts User.email at rest (AES-256-GCM) — same pattern as the previous
-- migration for phone: emailHash is a deterministic HMAC-SHA256 used for
-- the login lookup, since the encrypted column itself isn't queryable.
-- See src/lib/crypto.ts (hashEmail/encryptDataUrl/decryptDataUrl).
--
-- Employee.email needs no schema change — it was already a plain nullable
-- column with no unique constraint, so it stays TEXT and just starts
-- holding ciphertext instead of plaintext going forward.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "email" TEXT,
    "emailHash" TEXT,
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
INSERT INTO "new_User" ("id", "orgId", "email", "emailHash", "passwordHash", "phone", "phoneHash", "phoneVerifiedAt", "role", "employeeId", "createdAt")
SELECT "id", "orgId", "email", NULL, "passwordHash", "phone", "phoneHash", "phoneVerifiedAt", "role", "employeeId", "createdAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
