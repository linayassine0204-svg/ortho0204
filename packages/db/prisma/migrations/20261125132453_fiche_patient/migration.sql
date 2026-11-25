-- AlterTable
ALTER TABLE "patient" ADD COLUMN     "medecinContact" TEXT,
ADD COLUMN     "medecinNom" TEXT,
ADD COLUMN     "nom" TEXT NOT NULL DEFAULT '';

-- Les patients existants reçoivent un nom vide (à compléter dans la Fiche) ;
-- les nouveaux patients doivent fournir un nom.
ALTER TABLE "patient" ALTER COLUMN "nom" DROP DEFAULT;

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "tailleOctets" INTEGER NOT NULL,
    "cleStockage" TEXT NOT NULL,
    "ajouteParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_cleStockage_key" ON "document"("cleStockage");

-- CreateIndex
CREATE INDEX "document_patientId_createdAt_idx" ON "document"("patientId", "createdAt");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_ajouteParId_fkey" FOREIGN KEY ("ajouteParId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un document a une taille positive.
ALTER TABLE "document" ADD CONSTRAINT "document_taille_check" CHECK ("tailleOctets" > 0);
