-- CreateTable
CREATE TABLE "ResponsableSite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "ResponsableSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponsableSite_userId_siteId_key" ON "ResponsableSite"("userId", "siteId");

-- AddForeignKey
ALTER TABLE "ResponsableSite" ADD CONSTRAINT "ResponsableSite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsableSite" ADD CONSTRAINT "ResponsableSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
