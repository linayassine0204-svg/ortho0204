-- Score « sur N » prévu par l'exercice (ex. 7 sur 10).
ALTER TABLE "exercice" ADD COLUMN     "scoreMax" INTEGER;

-- Réalisations saisies dans l'application : score sur N et identifiant anti-doublon.
ALTER TABLE "realisation" ADD COLUMN     "idClient" TEXT,
ADD COLUMN     "scoreMax" INTEGER;

CREATE UNIQUE INDEX "realisation_elementProgrammeId_idClient_key" ON "realisation"("elementProgrammeId", "idClient");

-- Règles métier garanties par la base.
ALTER TABLE "exercice" ADD CONSTRAINT "exercice_scoreMax_check" CHECK ("scoreMax" IS NULL OR "scoreMax" BETWEEN 1 AND 100);
ALTER TABLE "realisation" ADD CONSTRAINT "realisation_scoreMax_check" CHECK ("scoreMax" IS NULL OR "scoreMax" BETWEEN 1 AND 100);
ALTER TABLE "realisation" ADD CONSTRAINT "realisation_score_sur_max_check" CHECK ("score" IS NULL OR "scoreMax" IS NULL OR "score" <= "scoreMax");
ALTER TABLE "realisation" ADD CONSTRAINT "realisation_idClient_check" CHECK ("idClient" IS NULL OR char_length("idClient") BETWEEN 8 AND 64);
