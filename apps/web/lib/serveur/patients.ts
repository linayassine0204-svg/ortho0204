import type { Prisma, PrismaClient } from "@app/db";
import {
  can,
  type Acteur,
  type Action,
  type RessourcePatient,
  type SectionPatient,
} from "./droits";
import { erreurs } from "./erreurs";
import { journaliserAcces } from "./journal";

const inclusionDroits = {
  tuteurs: { select: { parentId: true } },
  reglage: { select: { messagerieActivee: true } },
  cabinet: { select: { messagerieActivee: true } },
} satisfies Prisma.PatientInclude;

type PatientAvecDroits = Prisma.PatientGetPayload<{ include: typeof inclusionDroits }>;

/** Construit la ressource passée à `can()` à partir du patient chargé en base. */
export function ressourcePatient(
  patient: PatientAvecDroits,
  section?: SectionPatient,
): RessourcePatient {
  return {
    type: "patient",
    cabinetId: patient.cabinetId,
    compteUserId: patient.compteUserId,
    tuteurIds: patient.tuteurs.map((l) => l.parentId),
    messagerieActivee: patient.reglage?.messagerieActivee ?? patient.cabinet.messagerieActivee,
    ...(section ? { section } : {}),
  };
}

/**
 * Charge un patient et vérifie le droit demandé. Patient absent ou droit refusé :
 * même erreur 404, pour ne pas révéler l'existence du dossier.
 * Toute lecture autorisée est écrite dans le journal d'accès.
 */
export async function patientAutorise(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  action: Action,
  section?: SectionPatient,
): Promise<PatientAvecDroits> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: inclusionDroits,
  });
  if (!patient || !can(acteur, action, ressourcePatient(patient, section))) {
    throw erreurs.introuvable();
  }
  if (action === "lire") {
    await journaliserAcces(prisma, { userId: acteur.id, patientId, section: section ?? "resume" });
  }
  return patient;
}

/** Filtre de requête : patients qu'un acteur peut voir (premier filtre, en base). */
function filtreVisibles(acteur: Acteur): Prisma.PatientWhereInput {
  switch (acteur.role) {
    case "ORTHO":
      return { cabinetId: acteur.cabinetId };
    case "PARENT":
      return { cabinetId: acteur.cabinetId, tuteurs: { some: { parentId: acteur.id } } };
    case "PATIENT_ADULT":
      return { cabinetId: acteur.cabinetId, compteUserId: acteur.id };
    default:
      return { id: { in: [] } };
  }
}

/**
 * Liste des patients visibles (prénom et date de naissance seulement).
 * Double contrôle : filtre en base, puis `can()` sur chaque ligne.
 */
export async function listerPatientsVisibles(prisma: PrismaClient, acteur: Acteur) {
  const patients = await prisma.patient.findMany({
    where: filtreVisibles(acteur),
    include: inclusionDroits,
    orderBy: { prenom: "asc" },
  });
  return patients
    .filter((p) => can(acteur, "lire", ressourcePatient(p)))
    .map((p) => ({ id: p.id, prenom: p.prenom, dateNaissance: p.dateNaissance }));
}

/** Âge en années révolues. */
export function ageEnAnnees(naissance: Date, aujourdhui = new Date()): number {
  let ans = aujourdhui.getUTCFullYear() - naissance.getUTCFullYear();
  const avantAnniversaire =
    aujourdhui.getUTCMonth() < naissance.getUTCMonth() ||
    (aujourdhui.getUTCMonth() === naissance.getUTCMonth() &&
      aujourdhui.getUTCDate() < naissance.getUTCDate());
  if (avantAnniversaire) ans -= 1;
  return ans;
}
