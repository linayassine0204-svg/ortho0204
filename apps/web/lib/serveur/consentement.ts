import type { PrismaClient } from "@app/db";
import { CONSENTEMENT_DONNEES_SANTE } from "@app/shared";
import type { Acteur } from "./droits";
import { patientAutorise } from "./patients";

// Consentement « données de santé » d'un compte famille pour un patient.
// - Enfant de moins de 15 ans : donné par le parent (son compte).
// - Patient de 15 ans et plus avec son compte : donné par lui-même.
// Chaque compte famille consent pour lui-même ; sans consentement, l'API ne lui
// envoie aucune donnée du patient (voir `can()`).

/** Enregistre le consentement (texte versionné, date). Sans effet s'il existe déjà. */
export async function donnerConsentement(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  await patientAutorise(prisma, acteur, patientId, "consentir");
  const existant = await prisma.consentement.findFirst({
    where: { userId: acteur.id, patientId, type: "DONNEES_SANTE", retire: false },
    orderBy: { accordeLe: "desc" },
  });
  const consentement =
    existant ??
    (await prisma.consentement.create({
      data: {
        userId: acteur.id,
        patientId,
        type: CONSENTEMENT_DONNEES_SANTE.type,
        versionTexte: CONSENTEMENT_DONNEES_SANTE.version,
      },
    }));
  return { accordeLe: consentement.accordeLe, version: consentement.versionTexte };
}

/** Retire le consentement : la preuve est conservée, marquée retirée avec sa date. */
export async function retirerConsentement(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  maintenant = new Date(),
) {
  await patientAutorise(prisma, acteur, patientId, "consentir");
  await prisma.consentement.updateMany({
    where: { userId: acteur.id, patientId, type: "DONNEES_SANTE", retire: false },
    data: { retire: true, retireLe: maintenant },
  });
}
