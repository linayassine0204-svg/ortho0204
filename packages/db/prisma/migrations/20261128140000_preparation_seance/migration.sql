-- CreateEnum
CREATE TYPE "OrigineElement" AS ENUM ('PROPOSITION', 'BIBLIOTHEQUE', 'COPIE');

-- CreateEnum
CREATE TYPE "RaisonProposition" AS ENUM ('NIVEAU_SUIVANT', 'NIVEAU_EN_COURS', 'NOUVEAU');

-- AlterTable
ALTER TABLE "seance" ADD COLUMN     "pointsAReprendre" TEXT,
ADD COLUMN     "termineeLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "element_seance" (
    "id" TEXT NOT NULL,
    "seanceId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "niveau" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "origine" "OrigineElement" NOT NULL,
    "raison" "RaisonProposition",
    "retenu" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "element_seance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "element_seance_exerciceId_idx" ON "element_seance"("exerciceId");

-- CreateIndex
CREATE UNIQUE INDEX "element_seance_seanceId_exerciceId_key" ON "element_seance"("seanceId", "exerciceId");

-- AddForeignKey
ALTER TABLE "element_seance" ADD CONSTRAINT "element_seance_seanceId_fkey" FOREIGN KEY ("seanceId") REFERENCES "seance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_seance" ADD CONSTRAINT "element_seance_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Les séances déjà en base sont des séances passées : elles sont terminées.
UPDATE "seance" SET "termineeLe" = "date" WHERE "termineeLe" IS NULL;

-- Une seule séance en préparation par patient.
CREATE UNIQUE INDEX "seance_une_en_preparation_par_patient" ON "seance"("patientId") WHERE "termineeLe" IS NULL;
-- Niveau d'un exercice de séance : 1 à 3 ; une raison seulement pour une proposition.
ALTER TABLE "element_seance" ADD CONSTRAINT "element_seance_niveau_check" CHECK ("niveau" BETWEEN 1 AND 3);
ALTER TABLE "element_seance" ADD CONSTRAINT "element_seance_raison_check" CHECK (("origine" = 'PROPOSITION') = ("raison" IS NOT NULL));
-- Seule une proposition peut être en attente (non retenue).
ALTER TABLE "element_seance" ADD CONSTRAINT "element_seance_retenu_check" CHECK ("retenu" OR "origine" = 'PROPOSITION');
