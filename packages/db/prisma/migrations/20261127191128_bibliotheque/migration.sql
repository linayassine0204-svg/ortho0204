-- AlterTable
ALTER TABLE "exercice" ADD COLUMN     "aValider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auteurId" TEXT;

-- CreateTable
CREATE TABLE "favori" (
    "userId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favori_pkey" PRIMARY KEY ("userId","exerciceId")
);

-- CreateIndex
CREATE INDEX "favori_exerciceId_idx" ON "favori"("exerciceId");

-- AddForeignKey
ALTER TABLE "exercice" ADD CONSTRAINT "exercice_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favori" ADD CONSTRAINT "favori_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favori" ADD CONSTRAINT "favori_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un exercice d'exemple « à valider » est toujours un exercice commun (jamais celui d'un cabinet).
ALTER TABLE "exercice" ADD CONSTRAINT "exercice_a_valider_commun_check" CHECK ("aValider" = false OR "cabinetId" IS NULL);
