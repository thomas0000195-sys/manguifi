-- Create EmployeeAccessCode table
CREATE TABLE "EmployeeAccessCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeAccessCode_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE,
    CONSTRAINT "EmployeeAccessCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "EmployeeAccessCode_codeHash_key" ON "EmployeeAccessCode"("codeHash");

-- Create EmployeeSession table
CREATE TABLE "EmployeeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL UNIQUE,
    "token" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE
);

CREATE INDEX "EmployeeSession_token_key" ON "EmployeeSession"("token");

-- Create EmployeeLoginAttempt table
CREATE TABLE "EmployeeLoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneHash" TEXT NOT NULL,
    "code" TEXT,
    "outcome" TEXT NOT NULL,
    "employeeId" TEXT,
    "ipAddress" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeLoginAttempt_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL
);

CREATE INDEX "EmployeeLoginAttempt_phoneHash_attemptedAt_idx" ON "EmployeeLoginAttempt"("phoneHash", "attemptedAt");
CREATE INDEX "EmployeeLoginAttempt_ipAddress_attemptedAt_idx" ON "EmployeeLoginAttempt"("ipAddress", "attemptedAt");
CREATE INDEX "EmployeeLoginAttempt_employeeId_idx" ON "EmployeeLoginAttempt"("employeeId");
