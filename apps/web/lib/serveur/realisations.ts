import type { PrismaClient } from "@app/db";
import {
  AUDIO,
  AVANCE_MAX_REALISATION_MS,
  RETARD_MAX_REALISATION_JOURS,
  type NouvelleRealisation,
} from "@app/shared";
import type { Acteur } from "./droits";
import { erreurs } from "./erreurs";
import { journaliserAcces } from "./journal";
import { patientAutorise } from "./patients";
import { stockage } from "./stockage";

// Réalisations saisies dans l'application mobile (parent relié ou patient adulte,
// avec consentement). Droits : `can(acteur, "realiser", patient section programme)`.

const JOUR_MS = 24 * 60 * 60 * 1000;

const selection = {
  id: true,
  idClient: true,
  elementProgrammeId: true,
  date: true,
  fait: true,
  ressenti: true,
  score: true,
  scoreMax: true,
} as const;

function estDoublon(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code: unknown }).code === "P2002"
  );
}

/**
 * Enregistre qu'un exercice du programme a été fait.
 * Idempotent : la même réalisation renvoyée (même `idClient`, synchronisation après une
 * coupure réseau) renvoie celle qui existe déjà (`cree: false`), sans doublon.
 */
export async function enregistrerRealisation(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  donnees: NouvelleRealisation,
  maintenant = new Date(),
) {
  await patientAutorise(prisma, acteur, patientId, "realiser", "programme");

  // L'exercice doit appartenir à un programme de CE patient (même retiré depuis :
  // la famille a pu le faire hors ligne avant le retrait).
  const element = await prisma.elementProgramme.findFirst({
    where: { id: donnees.elementId, programme: { patientId } },
    select: { id: true, niveau: true, exercice: { select: { scoreMax: true } } },
  });
  if (!element) throw erreurs.introuvable();

  const existante = await prisma.realisation.findUnique({
    where: {
      elementProgrammeId_idClient: { elementProgrammeId: element.id, idClient: donnees.idClient },
    },
    select: selection,
  });
  if (existante) return { realisation: existante, cree: false };

  const faitLe = new Date(donnees.faitLe);
  const ecart = faitLe.getTime() - maintenant.getTime();
  if (ecart > AVANCE_MAX_REALISATION_MS || ecart < -RETARD_MAX_REALISATION_JOURS * JOUR_MS) {
    throw erreurs.donneesInvalides();
  }

  // Score seulement si l'exercice en prévoit un, et jamais au-delà du « sur N ».
  const scoreMax = element.exercice.scoreMax;
  if (donnees.score !== null && (scoreMax === null || donnees.score > scoreMax)) {
    throw erreurs.donneesInvalides();
  }

  try {
    const realisation = await prisma.realisation.create({
      data: {
        elementProgrammeId: element.id,
        idClient: donnees.idClient,
        saisieParId: acteur.id,
        date: faitLe,
        fait: true,
        ressenti: donnees.ressenti,
        score: donnees.score,
        scoreMax: donnees.score === null ? null : scoreMax,
        // Niveau du moment : les bilans donnent les scores par niveau.
        niveau: element.niveau,
      },
      select: selection,
    });
    await journaliserAcces(prisma, {
      userId: acteur.id,
      patientId,
      section: "programme",
      action: "MODIFICATION",
    });
    return { realisation, cree: true };
  } catch (erreur) {
    // Deux envois simultanés de la même réalisation : la base garantit l'unicité.
    if (!estDoublon(erreur)) throw erreur;
    const deja = await prisma.realisation.findUniqueOrThrow({
      where: {
        elementProgrammeId_idClient: { elementProgrammeId: element.id, idClient: donnees.idClient },
      },
      select: selection,
    });
    return { realisation: deja, cree: false };
  }
}

/** Le compte a-t-il donné son accord (actif) pour l'enregistrement de la voix ? */
export async function accordAudio(prisma: PrismaClient, userId: string, patientId: string) {
  const n = await prisma.consentement.count({
    where: { userId, patientId, type: "ENREGISTREMENT_AUDIO", retire: false },
  });
  return n > 0;
}

/** Fichier audio .m4a / .mp4 : la boîte « ftyp » est à l'octet 4. */
export function estAudioMp4(octets: Uint8Array): boolean {
  return (
    octets.length > 12 &&
    octets[4] === 0x66 && // f
    octets[5] === 0x74 && // t
    octets[6] === 0x79 && // y
    octets[7] === 0x70 // p
  );
}

/**
 * Ajoute l'enregistrement de la voix à une réalisation saisie par ce compte.
 * Une seule voix par réalisation : un renvoi (synchronisation) renvoie l'existante.
 */
export async function ajouterEnregistrement(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  realisationId: string,
  fichier: { size: number; arrayBuffer(): Promise<ArrayBuffer> },
  dureeSecondes: number,
) {
  await patientAutorise(prisma, acteur, patientId, "realiser", "programme");
  if (!(await accordAudio(prisma, acteur.id, patientId))) throw erreurs.consentementAudioRequis();

  const realisation = await prisma.realisation.findFirst({
    where: {
      id: realisationId,
      saisieParId: acteur.id,
      element: { programme: { patientId } },
    },
    select: { id: true, enregistrements: { select: { id: true, dureeSecondes: true } } },
  });
  if (!realisation) throw erreurs.introuvable();
  const deja = realisation.enregistrements[0];
  if (deja) return { enregistrement: deja, cree: false };

  if (!Number.isInteger(dureeSecondes) || dureeSecondes < 1) throw erreurs.donneesInvalides();
  if (dureeSecondes > AUDIO.dureeMaxSecondes) throw erreurs.audioTropGros();
  if (fichier.size <= 0) throw erreurs.donneesInvalides();
  if (fichier.size > AUDIO.tailleMaxOctets) throw erreurs.audioTropGros();
  const octets = new Uint8Array(await fichier.arrayBuffer());
  if (octets.length > AUDIO.tailleMaxOctets) throw erreurs.audioTropGros();
  if (!estAudioMp4(octets)) throw erreurs.audioTypeRefuse();

  const cleStockage = await stockage().ecrire(octets);
  try {
    const enregistrement = await prisma.enregistrement.create({
      data: { realisationId: realisation.id, cleStockage, typeMime: AUDIO.typeMime, dureeSecondes },
      select: { id: true, dureeSecondes: true },
    });
    await journaliserAcces(prisma, {
      userId: acteur.id,
      patientId,
      section: "enregistrement",
      action: "MODIFICATION",
    });
    return { enregistrement, cree: true };
  } catch (erreur) {
    await stockage().supprimer(cleStockage);
    throw erreur;
  }
}
