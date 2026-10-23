-- Console Manguifi, étape 1 : rôle super_admin et second facteur TOTP.
-- Migration purement additive : aucune table, colonne ou donnée existante n'est modifiée.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
