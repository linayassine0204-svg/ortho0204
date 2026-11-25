-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ORTHO', 'PARENT', 'PATIENT_ADULT');

-- CreateEnum
CREATE TYPE "TypeConsentement" AS ENUM ('CONDITIONS_UTILISATION', 'DONNEES_SANTE', 'MESSAGERIE', 'ENREGISTREMENT_AUDIO');

-- CreateEnum
CREATE TYPE "JourSemaine" AS ENUM ('LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE');

-- CreateEnum
CREATE TYPE "Ressenti" AS ENUM ('FACILE', 'MOYEN', 'DIFFICILE');

-- CreateEnum
CREATE TYPE "Repetition" AS ENUM ('UNE_FOIS', 'QUOTIDIENNE', 'HEBDOMADAIRE', 'MENSUELLE');

-- CreateEnum
CREATE TYPE "TypeBilan" AS ENUM ('INITIAL', 'EVOLUTION', 'RENOUVELLEMENT', 'FIN_DE_PRISE_EN_CHARGE');

-- CreateEnum
CREATE TYPE "StatutBilan" AS ENUM ('BROUILLON', 'FINALISE', 'ENVOYE');

-- CreateEnum
CREATE TYPE "ActionAcces" AS ENUM ('LECTURE', 'MODIFICATION', 'EXPORT');

-- CreateTable
CREATE TABLE "cabinet" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "messagerieActivee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabinet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient" (
    "id" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" DATE NOT NULL,
    "notes" TEXT,
    "compteUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_pathologie" (
    "patientId" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,

    CONSTRAINT "patient_pathologie_pkey" PRIMARY KEY ("patientId","categorieId")
);

-- CreateTable
CREATE TABLE "lien_tuteur" (
    "parentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lien_tuteur_pkey" PRIMARY KEY ("parentId","patientId")
);

-- CreateTable
CREATE TABLE "consentement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT,
    "type" "TypeConsentement" NOT NULL,
    "versionTexte" TEXT NOT NULL,
    "accordeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retire" BOOLEAN NOT NULL DEFAULT false,
    "retireLe" TIMESTAMP(3),

    CONSTRAINT "consentement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglage_patient" (
    "patientId" TEXT NOT NULL,
    "messagerieActivee" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglage_patient_pkey" PRIMARY KEY ("patientId")
);

-- CreateTable
CREATE TABLE "categorie" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercice" (
    "id" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "cabinetId" TEXT,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "dureeMinutes" INTEGER NOT NULL,
    "materiel" TEXT[],
    "apercuImage" TEXT,
    "apercuConsigne" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niveau_exercice" (
    "id" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "niveau" INTEGER NOT NULL,
    "consigne" TEXT NOT NULL,

    CONSTRAINT "niveau_exercice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programme" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "auteurId" TEXT,
    "titre" TEXT NOT NULL,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "element_programme" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "exerciceId" TEXT NOT NULL,
    "niveau" INTEGER NOT NULL,
    "foisParSemaine" INTEGER NOT NULL,
    "jours" "JourSemaine"[],
    "motFamille" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "element_programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realisation" (
    "id" TEXT NOT NULL,
    "elementProgrammeId" TEXT NOT NULL,
    "saisieParId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "fait" BOOLEAN NOT NULL,
    "ressenti" "Ressenti",
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enregistrement" (
    "id" TEXT NOT NULL,
    "realisationId" TEXT NOT NULL,
    "cleStockage" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "dureeSecondes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enregistrement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conseil" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "estModele" BOOLEAN NOT NULL DEFAULT false,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "cabinetId" TEXT,
    "patientId" TEXT,
    "modeleSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conseil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conseil_etiquette" (
    "conseilId" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,

    CONSTRAINT "conseil_etiquette_pkey" PRIMARY KEY ("conseilId","categorieId")
);

-- CreateTable
CREATE TABLE "envoi_conseil" (
    "id" TEXT NOT NULL,
    "conseilId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "envoyeParId" TEXT,
    "repetition" "Repetition" NOT NULL DEFAULT 'UNE_FOIS',
    "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "luLe" TIMESTAMP(3),

    CONSTRAINT "envoi_conseil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seance" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orthoId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "objectifs" TEXT,
    "materiel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bilan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "auteurId" TEXT,
    "type" "TypeBilan" NOT NULL,
    "date" DATE NOT NULL,
    "contenu" TEXT NOT NULL,
    "statut" "StatutBilan" NOT NULL DEFAULT 'BROUILLON',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bilan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fil_messages" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sujet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fil_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "filId" TEXT NOT NULL,
    "auteurId" TEXT,
    "contenu" TEXT NOT NULL,
    "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "luLe" TIMESTAMP(3),

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "piece_jointe" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "tailleOctets" INTEGER NOT NULL,
    "cleStockage" TEXT NOT NULL,

    CONSTRAINT "piece_jointe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_acces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "action" "ActionAcces" NOT NULL DEFAULT 'LECTURE',
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_acces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "utilisateur_cabinetId_role_idx" ON "utilisateur"("cabinetId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "patient_compteUserId_key" ON "patient"("compteUserId");

-- CreateIndex
CREATE INDEX "patient_cabinetId_idx" ON "patient"("cabinetId");

-- CreateIndex
CREATE INDEX "patient_pathologie_categorieId_idx" ON "patient_pathologie"("categorieId");

-- CreateIndex
CREATE INDEX "lien_tuteur_patientId_idx" ON "lien_tuteur"("patientId");

-- CreateIndex
CREATE INDEX "consentement_userId_type_idx" ON "consentement"("userId", "type");

-- CreateIndex
CREATE INDEX "consentement_patientId_idx" ON "consentement"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "categorie_nom_key" ON "categorie"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "categorie_slug_key" ON "categorie"("slug");

-- CreateIndex
CREATE INDEX "exercice_categorieId_idx" ON "exercice"("categorieId");

-- CreateIndex
CREATE INDEX "exercice_cabinetId_idx" ON "exercice"("cabinetId");

-- CreateIndex
CREATE UNIQUE INDEX "niveau_exercice_exerciceId_niveau_key" ON "niveau_exercice"("exerciceId", "niveau");

-- CreateIndex
CREATE INDEX "programme_patientId_actif_idx" ON "programme"("patientId", "actif");

-- CreateIndex
CREATE INDEX "element_programme_programmeId_ordre_idx" ON "element_programme"("programmeId", "ordre");

-- CreateIndex
CREATE INDEX "element_programme_exerciceId_idx" ON "element_programme"("exerciceId");

-- CreateIndex
CREATE INDEX "realisation_elementProgrammeId_date_idx" ON "realisation"("elementProgrammeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "enregistrement_cleStockage_key" ON "enregistrement"("cleStockage");

-- CreateIndex
CREATE INDEX "enregistrement_realisationId_idx" ON "enregistrement"("realisationId");

-- CreateIndex
CREATE INDEX "conseil_estModele_idx" ON "conseil"("estModele");

-- CreateIndex
CREATE INDEX "conseil_patientId_idx" ON "conseil"("patientId");

-- CreateIndex
CREATE INDEX "conseil_cabinetId_idx" ON "conseil"("cabinetId");

-- CreateIndex
CREATE INDEX "conseil_etiquette_categorieId_idx" ON "conseil_etiquette"("categorieId");

-- CreateIndex
CREATE INDEX "envoi_conseil_patientId_envoyeLe_idx" ON "envoi_conseil"("patientId", "envoyeLe");

-- CreateIndex
CREATE INDEX "envoi_conseil_conseilId_idx" ON "envoi_conseil"("conseilId");

-- CreateIndex
CREATE INDEX "seance_patientId_date_idx" ON "seance"("patientId", "date");

-- CreateIndex
CREATE INDEX "bilan_patientId_date_idx" ON "bilan"("patientId", "date");

-- CreateIndex
CREATE INDEX "fil_messages_patientId_idx" ON "fil_messages"("patientId");

-- CreateIndex
CREATE INDEX "message_filId_envoyeLe_idx" ON "message"("filId", "envoyeLe");

-- CreateIndex
CREATE UNIQUE INDEX "piece_jointe_cleStockage_key" ON "piece_jointe"("cleStockage");

-- CreateIndex
CREATE INDEX "piece_jointe_messageId_idx" ON "piece_jointe"("messageId");

-- CreateIndex
CREATE INDEX "journal_acces_patientId_createdAt_idx" ON "journal_acces"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "journal_acces_userId_createdAt_idx" ON "journal_acces"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "patient_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "patient_compteUserId_fkey" FOREIGN KEY ("compteUserId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_pathologie" ADD CONSTRAINT "patient_pathologie_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_pathologie" ADD CONSTRAINT "patient_pathologie_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lien_tuteur" ADD CONSTRAINT "lien_tuteur_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lien_tuteur" ADD CONSTRAINT "lien_tuteur_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentement" ADD CONSTRAINT "consentement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentement" ADD CONSTRAINT "consentement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglage_patient" ADD CONSTRAINT "reglage_patient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercice" ADD CONSTRAINT "exercice_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercice" ADD CONSTRAINT "exercice_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveau_exercice" ADD CONSTRAINT "niveau_exercice_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme" ADD CONSTRAINT "programme_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme" ADD CONSTRAINT "programme_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_programme" ADD CONSTRAINT "element_programme_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_programme" ADD CONSTRAINT "element_programme_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "exercice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realisation" ADD CONSTRAINT "realisation_elementProgrammeId_fkey" FOREIGN KEY ("elementProgrammeId") REFERENCES "element_programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realisation" ADD CONSTRAINT "realisation_saisieParId_fkey" FOREIGN KEY ("saisieParId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enregistrement" ADD CONSTRAINT "enregistrement_realisationId_fkey" FOREIGN KEY ("realisationId") REFERENCES "realisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conseil" ADD CONSTRAINT "conseil_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conseil" ADD CONSTRAINT "conseil_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conseil" ADD CONSTRAINT "conseil_modeleSourceId_fkey" FOREIGN KEY ("modeleSourceId") REFERENCES "conseil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conseil_etiquette" ADD CONSTRAINT "conseil_etiquette_conseilId_fkey" FOREIGN KEY ("conseilId") REFERENCES "conseil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conseil_etiquette" ADD CONSTRAINT "conseil_etiquette_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categorie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envoi_conseil" ADD CONSTRAINT "envoi_conseil_conseilId_fkey" FOREIGN KEY ("conseilId") REFERENCES "conseil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envoi_conseil" ADD CONSTRAINT "envoi_conseil_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envoi_conseil" ADD CONSTRAINT "envoi_conseil_envoyeParId_fkey" FOREIGN KEY ("envoyeParId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seance" ADD CONSTRAINT "seance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seance" ADD CONSTRAINT "seance_orthoId_fkey" FOREIGN KEY ("orthoId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bilan" ADD CONSTRAINT "bilan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bilan" ADD CONSTRAINT "bilan_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fil_messages" ADD CONSTRAINT "fil_messages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_filId_fkey" FOREIGN KEY ("filId") REFERENCES "fil_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piece_jointe" ADD CONSTRAINT "piece_jointe_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Contraintes métier (ajoutées à la main : Prisma ne les exprime pas) ───

-- Niveaux d'exercice : 1, 2 ou 3.
ALTER TABLE "niveau_exercice" ADD CONSTRAINT "niveau_exercice_niveau_check" CHECK ("niveau" BETWEEN 1 AND 3);
ALTER TABLE "element_programme" ADD CONSTRAINT "element_programme_niveau_check" CHECK ("niveau" BETWEEN 1 AND 3);

-- Fréquence : de 1 à 7 fois par semaine.
ALTER TABLE "element_programme" ADD CONSTRAINT "element_programme_frequence_check" CHECK ("foisParSemaine" BETWEEN 1 AND 7);

-- Âges cohérents.
ALTER TABLE "exercice" ADD CONSTRAINT "exercice_ages_check" CHECK ("ageMin" >= 0 AND "ageMax" >= "ageMin");
ALTER TABLE "exercice" ADD CONSTRAINT "exercice_duree_check" CHECK ("dureeMinutes" > 0);
ALTER TABLE "conseil" ADD CONSTRAINT "conseil_ages_check" CHECK ("ageMin" IS NULL OR "ageMax" IS NULL OR "ageMax" >= "ageMin");

-- Score de 0 à 100.
ALTER TABLE "realisation" ADD CONSTRAINT "realisation_score_check" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100);

-- Un retrait de consentement a une date.
ALTER TABLE "consentement" ADD CONSTRAINT "consentement_retrait_check" CHECK ("retire" = false OR "retireLe" IS NOT NULL);
