import type { PrismaClient } from "@app/db";
import { CONSENTEMENT_DONNEES_SANTE, CONSENTEMENT_ENREGISTREMENT_AUDIO } from "@app/shared";
import type { Acteur } from "./droits";
import { patientAutorise } from "./patients";

// Consentements d'un compte famille pour un patient.
// - Enfant de moins de 15 ans : donné par le parent (son compte).
// - Patient de 15 ans et plus avec son compte : donné par lui-même.
// Chaque compte famille consent pour lui-même.
// - « Données de santé » : sans lui, l'API n'envoie aucune donnée du patient (`can()`).
// - « Enregistrement de la voix » : facultatif ; sans lui, pas d'enregistrement audio.

const TEXTES = {
  DONNEES_SANTE: CONSENTEMENT_DONNEES_SANTE,
  ENREGISTREMENT_AUDIO: CONSENTEMENT_ENREGISTREMENT_AUDIO,
} as const;
export type TypeConsentementFamille = keyof typeof TEXTES;

/** Enregistre le consentement (texte versionné, date). Sans effet s'il existe déjà. */
export async function donnerConsentement(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  type: TypeConsentementFamille = "DONNEES_SANTE",
) {
  await patientAutorise(prisma, acteur, patientId, "consentir");
  const existant = await prisma.consentement.findFirst({
    where: { userId: acteur.id, patientId, type, retire: false },
    orderBy: { accordeLe: "desc" },
  });
  const consentement =
    existant ??
    (await prisma.consentement.create({
      data: { userId: acteur.id, patientId, type, versionTexte: TEXTES[type].version },
    }));
  return { accordeLe: consentement.accordeLe, version: consentement.versionTexte };
}

/** Retire le consentement : la preuve est conservée, marquée retirée avec sa date. */
export async function retirerConsentement(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  type: TypeConsentementFamille = "DONNEES_SANTE",
  maintenant = new Date(),
) {
  await patientAutorise(prisma, acteur, patientId, "consentir");
  await prisma.consentement.updateMany({
    where: { userId: acteur.id, patientId, type, retire: false },
    data: { retire: true, retireLe: maintenant },
  });
}
