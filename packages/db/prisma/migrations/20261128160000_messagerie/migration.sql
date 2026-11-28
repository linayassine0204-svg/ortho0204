-- Messagerie : horaires de réponse du cabinet, réponses rapides, une conversation par patient.

ALTER TABLE "cabinet" ADD COLUMN "horairesReponse" TEXT;
ALTER TABLE "piece_jointe" ADD COLUMN "dureeSecondes" INTEGER;
ALTER TABLE "piece_jointe" ADD CONSTRAINT "piece_jointe_duree_check" CHECK ("dureeSecondes" IS NULL OR "dureeSecondes" >= 0);

-- Une conversation par patient. Si un patient avait plusieurs fils, leurs messages sont
-- regroupés dans le plus ancien (aucun message n'est supprimé), puis les fils vides retirés.
WITH premier AS (
  SELECT DISTINCT ON ("patientId") "patientId", "id"
  FROM "fil_messages"
  ORDER BY "patientId", "createdAt", "id"
)
UPDATE "message" m SET "filId" = p."id"
FROM "fil_messages" f JOIN premier p ON p."patientId" = f."patientId"
WHERE m."filId" = f."id" AND f."id" <> p."id";

DELETE FROM "fil_messages" f
WHERE NOT EXISTS (SELECT 1 FROM "message" m WHERE m."filId" = f."id")
  AND EXISTS (
    SELECT 1 FROM "fil_messages" autre
    WHERE autre."patientId" = f."patientId" AND autre."id" <> f."id"
  );

DROP INDEX "fil_messages_patientId_idx";
CREATE UNIQUE INDEX "fil_messages_patientId_key" ON "fil_messages"("patientId");

-- Réponses rapides du cabinet.
CREATE TABLE "reponse_rapide" (
    "id" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reponse_rapide_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reponse_rapide_cabinetId_ordre_idx" ON "reponse_rapide"("cabinetId", "ordre");
ALTER TABLE "reponse_rapide" ADD CONSTRAINT "reponse_rapide_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
