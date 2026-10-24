-- Guide de premier lancement (lot 1.8). Migration additive.
ALTER TABLE "User" ADD COLUMN "guideSeenAt" TIMESTAMP(3);
