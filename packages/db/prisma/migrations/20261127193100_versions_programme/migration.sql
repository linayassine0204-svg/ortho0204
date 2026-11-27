-- AlterTable
ALTER TABLE "programme" ADD COLUMN     "modifieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "version_programme" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoyeParId" TEXT,
    "contenu" JSONB NOT NULL,

    CONSTRAINT "version_programme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "version_programme_programmeId_numero_key" ON "version_programme"("programmeId", "numero");

-- AddForeignKey
ALTER TABLE "version_programme" ADD CONSTRAINT "version_programme_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_programme" ADD CONSTRAINT "version_programme_envoyeParId_fkey" FOREIGN KEY ("envoyeParId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un seul programme actif par patient (celui que l'on compose et envoie).
CREATE UNIQUE INDEX "programme_un_actif_par_patient" ON "programme"("patientId") WHERE "actif" = true;
-- Numéro de version à partir de 1.
ALTER TABLE "version_programme" ADD CONSTRAINT "version_programme_numero_check" CHECK ("numero" >= 1);
