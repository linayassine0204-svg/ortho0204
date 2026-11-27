-- Conseils : deux blocs « À faire » / « À éviter » (une idée par ligne) au lieu d'un texte unique.
-- Le texte existant devient la première ligne de « À faire » (aucune perte).
ALTER TABLE "conseil" ADD COLUMN     "aEviter" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "aFaire" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "aValider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modifie" BOOLEAN NOT NULL DEFAULT false;
UPDATE "conseil" SET "aFaire" = ARRAY["contenu"];
UPDATE "conseil" SET "aValider" = true WHERE "estModele";
ALTER TABLE "conseil" DROP COLUMN "contenu",
ALTER COLUMN "aEviter" DROP DEFAULT,
ALTER COLUMN "aFaire" DROP DEFAULT;

-- AlterTable
ALTER TABLE "envoi_conseil" ADD COLUMN     "luParId" TEXT,
ADD COLUMN     "planId" TEXT;

-- CreateTable
CREATE TABLE "plan_conseil" (
    "id" TEXT NOT NULL,
    "conseilId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "creeParId" TEXT,
    "repetition" "Repetition" NOT NULL,
    "prochainEnvoi" TIMESTAMP(3),
    "arreteLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_conseil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_conseil_patientId_prochainEnvoi_idx" ON "plan_conseil"("patientId", "prochainEnvoi");

-- CreateIndex
CREATE INDEX "plan_conseil_conseilId_idx" ON "plan_conseil"("conseilId");

-- CreateIndex
CREATE UNIQUE INDEX "envoi_conseil_planId_envoyeLe_key" ON "envoi_conseil"("planId", "envoyeLe");

-- AddForeignKey
ALTER TABLE "plan_conseil" ADD CONSTRAINT "plan_conseil_conseilId_fkey" FOREIGN KEY ("conseilId") REFERENCES "conseil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_conseil" ADD CONSTRAINT "plan_conseil_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_conseil" ADD CONSTRAINT "plan_conseil_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envoi_conseil" ADD CONSTRAINT "envoi_conseil_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plan_conseil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envoi_conseil" ADD CONSTRAINT "envoi_conseil_luParId_fkey" FOREIGN KEY ("luParId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Règles métier garanties par la base.
ALTER TABLE "conseil" ADD CONSTRAINT "conseil_blocs_check" CHECK (cardinality("aFaire") + cardinality("aEviter") > 0);
ALTER TABLE "plan_conseil" ADD CONSTRAINT "plan_conseil_repetition_check" CHECK ("repetition" IN ('UNE_FOIS', 'HEBDOMADAIRE'));
ALTER TABLE "envoi_conseil" ADD CONSTRAINT "envoi_conseil_lu_check" CHECK ("luParId" IS NULL OR "luLe" IS NOT NULL);
