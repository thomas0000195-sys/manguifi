-- Optional automatic purge of old attendance/justificatif data. NULL means
-- disabled (default) — an admin must explicitly opt in, since legal payroll
-- retention requirements vary by country.
ALTER TABLE "Organization" ADD COLUMN "attendanceRetentionMonths" INTEGER;
