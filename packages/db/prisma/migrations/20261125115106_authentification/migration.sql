-- CreateEnum
CREATE TYPE "TypeSession" AS ENUM ('WEB', 'MOBILE_ACCES', 'MOBILE_RENOUVELLEMENT');

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TypeSession" NOT NULL,
    "jetonHash" TEXT NOT NULL,
    "familleId" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "revoqueLe" TIMESTAMP(3),
    "deuxiemeFacteurLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "jetonHash" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "utiliseeLe" TIMESTAMP(3),
    "creeParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentative_connexion" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentative_connexion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_jetonHash_key" ON "session"("jetonHash");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_familleId_idx" ON "session"("familleId");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_jetonHash_key" ON "invitation"("jetonHash");

-- CreateIndex
CREATE INDEX "invitation_patientId_idx" ON "invitation"("patientId");

-- CreateIndex
CREATE INDEX "tentative_connexion_cle_createdAt_idx" ON "tentative_connexion"("cle", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Règle métier : on n'invite jamais un orthophoniste par ce lien (seulement parent ou patient adulte).
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_role_check" CHECK ("role" IN ('PARENT', 'PATIENT_ADULT'));
