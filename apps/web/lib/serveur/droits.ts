import type { Role } from "@app/db";

// Fonction centrale des droits : toutes les routes passent par `can()`.
// Pure et synchrone (aucun accès à la base) : la route charge la ressource avec
// les informations nécessaires, puis demande `can()`. Par défaut : refus.

export interface Acteur {
  id: string;
  role: Role;
  cabinetId: string;
}

/**
 * - lire, modifier, supprimer : sur un patient ;
 * - inviter : envoyer un lien d'invitation pour un patient ;
 * - consentir : donner ou retirer son propre consentement pour un patient ;
 * - creer : créer un patient dans un cabinet ;
 * - realiser : enregistrer qu'un exercice du programme a été fait (famille seulement) ;
 * - confirmerLecture : « J'ai compris » sur un conseil reçu (famille seulement) ;
 * - ecrire : envoyer un message dans la messagerie du patient.
 */
export type Action =
  | "lire"
  | "modifier"
  | "supprimer"
  | "inviter"
  | "consentir"
  | "creer"
  | "realiser"
  | "confirmerLecture"
  | "ecrire";

/** Actions propres à la famille : l'orthophoniste ne les fait jamais à sa place. */
const ACTIONS_FAMILLE: readonly Action[] = ["consentir", "realiser", "confirmerLecture"];

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

/**
 * Parties lisibles par la famille qui ne sont pas des sous-parties du dossier :
 * - documentsPartages : les bilans et courriers que l'orthophoniste a cochés « partager »
 *   (la section « bilans », elle, reste réservée à l'orthophoniste).
 */
export type PartieFamille = "documentsPartages";
export type SectionRessource = SectionPatient | PartieFamille;

/** Sections visibles dans l'application mobile, selon le rôle. */
const SECTIONS_FAMILLE: Record<"PARENT" | "PATIENT_ADULT", readonly SectionRessource[]> = {
  PARENT: ["programme", "conseils", "messagerie", "suivi", "documentsPartages"],
  PATIENT_ADULT: ["programme", "messagerie", "documentsPartages"],
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
  /**
   * Comptes famille ayant un consentement « données de santé » actif pour ce patient.
   * Sans consentement, aucune donnée n'est envoyée à la famille (règle produit).
   */
  consentementIds: readonly string[];
  /** Partie du dossier visée. Absente = identité minimale (prénom, âge). */
  section?: SectionRessource;
}

export interface RessourceCabinet {
  type: "cabinet";
  id: string;
}

/** Exercice de la bibliothèque : commun (cabinetId null) ou propre à un cabinet. */
export interface RessourceExercice {
  type: "exercice";
  cabinetId: string | null;
}

export type Ressource = RessourcePatient | RessourceCabinet | RessourceExercice;

export function can(acteur: Acteur, action: Action, ressource: Ressource): boolean {
  switch (ressource.type) {
    case "patient":
      return peutSurPatient(acteur, action, ressource);
    case "cabinet":
      return peutSurCabinet(acteur, action, ressource);
    case "exercice":
      return peutSurExercice(acteur, action, ressource);
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
      // L'orthophoniste ne consent pas, ne fait pas les exercices et ne marque pas un
      // conseil comme lu à la place de la famille.
      return action !== "creer" && !ACTIONS_FAMILLE.includes(action);
    case "PARENT":
    case "PATIENT_ADULT": {
      const lie =
        acteur.role === "PARENT"
          ? patient.tuteurIds.includes(acteur.id)
          : patient.compteUserId === acteur.id;
      if (!lie) return false;
      if (action === "consentir") return true;
      if (!patient.consentementIds.includes(acteur.id)) return false;
      // Faire un exercice : seulement sur le programme, avec le consentement.
      if (action === "realiser") return patient.section === "programme";
      const sectionVisible =
        patient.section === undefined || SECTIONS_FAMILLE[acteur.role].includes(patient.section);
      // « J'ai compris » : sur les conseils, si la famille peut les voir (parents seulement).
      if (action === "confirmerLecture") return patient.section === "conseils" && sectionVisible;
      // Écrire : seulement dans la messagerie (activée), à son orthophoniste.
      if (action === "ecrire") return patient.section === "messagerie" && sectionVisible;
      if (action !== "lire") return false;
      return sectionVisible;
    }
    default:
      return false;
  }
}

function peutSurCabinet(acteur: Acteur, action: Action, cabinet: RessourceCabinet): boolean {
  if (cabinet.id !== acteur.cabinetId) return false;
  if (acteur.role !== "ORTHO") return false;
  return action === "lire" || action === "modifier" || action === "creer";
}

/**
 * Bibliothèque (orthophonistes) : on lit les exercices communs et ceux de son
 * cabinet ; on ne modifie que ceux de son cabinet. Les exercices communs (dont
 * les exemples « à valider ») ne sont modifiables par personne depuis le logiciel.
 * Les familles verront les exercices à travers le programme du patient (tâche 9).
 */
function peutSurExercice(acteur: Acteur, action: Action, exercice: RessourceExercice): boolean {
  if (acteur.role !== "ORTHO") return false;
  const duCabinet = exercice.cabinetId === acteur.cabinetId;
  if (action === "lire") return exercice.cabinetId === null || duCabinet;
  if (action === "modifier" || action === "supprimer") return duCabinet;
  return false;
}
