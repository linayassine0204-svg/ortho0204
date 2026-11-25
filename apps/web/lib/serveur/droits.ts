import type { Role } from "@app/db";

// Fonction centrale des droits : toutes les routes passent par `can()`.
// Pure et synchrone (aucun accès à la base) : la route charge la ressource avec
// les informations nécessaires, puis demande `can()`. Par défaut : refus.

export interface Acteur {
  id: string;
  role: Role;
  cabinetId: string;
}

export type Action = "lire" | "modifier" | "supprimer" | "inviter";

/** Sous-parties du dossier patient (/patients/[id]/[section]). */
export const SECTIONS_PATIENT = [
  "fiche",
  "preparation",
  "bilans",
  "programme",
  "conseils",
  "messagerie",
  "suivi",
] as const;
export type SectionPatient = (typeof SECTIONS_PATIENT)[number];

/** Sections visibles dans l'application mobile, selon le rôle. */
const SECTIONS_FAMILLE: Record<"PARENT" | "PATIENT_ADULT", readonly SectionPatient[]> = {
  PARENT: ["programme", "conseils", "messagerie", "suivi"],
  PATIENT_ADULT: ["programme", "messagerie"],
};

export interface RessourcePatient {
  type: "patient";
  cabinetId: string;
  /** Compte du patient adulte (null pour un enfant). */
  compteUserId: string | null;
  /** Comptes parents liés à ce patient. */
  tuteurIds: readonly string[];
  /** Messagerie activée pour ce patient (réglage patient, sinon réglage du cabinet). */
  messagerieActivee: boolean;
  /** Partie du dossier visée. Absente = identité minimale (prénom, âge). */
  section?: SectionPatient;
}

export interface RessourceCabinet {
  type: "cabinet";
  id: string;
}

export type Ressource = RessourcePatient | RessourceCabinet;

export function can(acteur: Acteur, action: Action, ressource: Ressource): boolean {
  switch (ressource.type) {
    case "patient":
      return peutSurPatient(acteur, action, ressource);
    case "cabinet":
      return peutSurCabinet(acteur, action, ressource);
    default:
      return false;
  }
}

function peutSurPatient(acteur: Acteur, action: Action, patient: RessourcePatient): boolean {
  // Cloison entre cabinets, pour tous les rôles.
  if (patient.cabinetId !== acteur.cabinetId) return false;
  // Messagerie désactivée : personne n'y accède, même l'orthophoniste.
  if (patient.section === "messagerie" && !patient.messagerieActivee) return false;

  switch (acteur.role) {
    case "ORTHO":
      return true;
    case "PARENT": {
      if (action !== "lire") return false;
      if (!patient.tuteurIds.includes(acteur.id)) return false;
      return patient.section === undefined || SECTIONS_FAMILLE.PARENT.includes(patient.section);
    }
    case "PATIENT_ADULT": {
      if (action !== "lire") return false;
      if (patient.compteUserId !== acteur.id) return false;
      return (
        patient.section === undefined || SECTIONS_FAMILLE.PATIENT_ADULT.includes(patient.section)
      );
    }
    default:
      return false;
  }
}

function peutSurCabinet(acteur: Acteur, action: Action, cabinet: RessourceCabinet): boolean {
  if (cabinet.id !== acteur.cabinetId) return false;
  if (acteur.role !== "ORTHO") return false;
  return action === "lire" || action === "modifier" || action === "inviter";
}
