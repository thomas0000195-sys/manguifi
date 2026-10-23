-- Index pour l'historique par employé (lecture seule). Migration additive.
CREATE INDEX "AuditLog_orgId_entityType_entityId_createdAt_idx" ON "AuditLog"("orgId", "entityType", "entityId", "createdAt");
