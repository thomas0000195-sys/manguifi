-- Matricule was globally unique, but every organization defaults to the
-- same "MGF" prefix — two different companies both on the default WILL
-- collide on their first employee's matricule. Scope uniqueness to
-- (orgId, matricule) instead.
DROP INDEX IF EXISTS "Employee_matricule_key";
CREATE UNIQUE INDEX "Employee_orgId_matricule_key" ON "Employee"("orgId", "matricule");
