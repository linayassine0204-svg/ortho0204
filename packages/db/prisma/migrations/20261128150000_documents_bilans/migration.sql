-- Documents du dossier : bilans, comptes rendus de séance et courriers types.
ALTER TYPE "TypeBilan" ADD VALUE 'COMPTE_RENDU_SEANCE';
ALTER TYPE "TypeBilan" ADD VALUE 'COURRIER_MEDECIN';
ALTER TYPE "TypeBilan" ADD VALUE 'COURRIER_ECOLE';
ALTER TYPE "TypeBilan" ADD VALUE 'COURRIER_ASSURANCE';

-- Un document est découpé en parties (JSON) ; partage avec la famille désactivé par défaut.
ALTER TABLE "bilan"
ADD COLUMN     "dateDebut" DATE,
ADD COLUMN     "destinataire" TEXT,
ADD COLUMN     "modele" TEXT,
ADD COLUMN     "partage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partageLe" TIMESTAMP(3),
ADD COLUMN     "partageParId" TEXT,
ADD COLUMN     "seanceId" TEXT,
ADD COLUMN     "sections" JSONB,
ADD COLUMN     "titre" TEXT;

-- Les bilans déjà en base gardent leur texte, dans une seule partie déjà écrite (« Rempli »).
UPDATE "bilan" SET
  "titre" = CASE "type"
    WHEN 'INITIAL' THEN 'Bilan initial'
    WHEN 'EVOLUTION' THEN 'Bilan d''évolution'
    WHEN 'RENOUVELLEMENT' THEN 'Bilan de renouvellement'
    ELSE 'Bilan de fin de prise en charge'
  END,
  "sections" = jsonb_build_array(jsonb_build_object(
    'cle', 'texte', 'titre', 'Compte rendu', 'type', 'LIBRE',
    'contenu', "contenu", 'relu', true, 'aide', null, 'source', null
  ));

ALTER TABLE "bilan" ALTER COLUMN "sections" SET NOT NULL,
ALTER COLUMN "titre" SET NOT NULL,
DROP COLUMN "contenu",
DROP COLUMN "statut";

DROP TYPE "StatutBilan";

ALTER TABLE "bilan" ADD CONSTRAINT "bilan_seanceId_fkey" FOREIGN KEY ("seanceId") REFERENCES "seance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bilan" ADD CONSTRAINT "bilan_partageParId_fkey" FOREIGN KEY ("partageParId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partagé = date de partage connue ; parties = tableau JSON ; période dans l'ordre.
ALTER TABLE "bilan" ADD CONSTRAINT "bilan_partage_check" CHECK (NOT "partage" OR "partageLe" IS NOT NULL);
ALTER TABLE "bilan" ADD CONSTRAINT "bilan_sections_check" CHECK (jsonb_typeof("sections") = 'array');
ALTER TABLE "bilan" ADD CONSTRAINT "bilan_periode_check" CHECK ("dateDebut" IS NULL OR "dateDebut" <= "date");

-- Niveau de l'exercice au moment de la réalisation (scores par niveau).
ALTER TABLE "realisation" ADD COLUMN "niveau" INTEGER;
UPDATE "realisation" r SET "niveau" = e."niveau" FROM "element_programme" e WHERE e."id" = r."elementProgrammeId";
ALTER TABLE "realisation" ADD CONSTRAINT "realisation_niveau_check" CHECK ("niveau" IS NULL OR "niveau" BETWEEN 1 AND 3);
