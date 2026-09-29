-- CreateTable OTPCode
CREATE TABLE "OTPCode" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EMAIL',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OTPCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OTPCode_employeeId_createdAt_idx" ON "OTPCode"("employeeId", "createdAt");

-- AddForeignKey
ALTER TABLE "OTPCode" ADD CONSTRAINT "OTPCode_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;
