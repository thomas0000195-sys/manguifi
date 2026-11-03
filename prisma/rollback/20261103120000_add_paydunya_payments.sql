-- RETOUR ARRIÈRE de 20261103120000_add_paydunya_payments.
-- À n'exécuter qu'à la main, dans l'éditeur SQL Neon, et seulement si aucun
-- paiement en ligne n'a été encaissé (sinon, exporter les données avant).
-- Ordre inverse de création : les clés étrangères dépendent des tables.

DROP TABLE IF EXISTS "Payment";
DROP TABLE IF EXISTS "PaymentAttempt";
DROP TABLE IF EXISTS "Invoice";
DROP TABLE IF EXISTS "FeatureFlag";

DROP TYPE IF EXISTS "PaymentAttemptStatus";
DROP TYPE IF EXISTS "PaymentSource";
DROP TYPE IF EXISTS "InvoiceStatus";
