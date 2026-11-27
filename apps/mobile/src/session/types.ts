import type { ElementEnvoye } from "@app/shared";

export type Role = "ORTHO" | "PARENT" | "PATIENT_ADULT";

export interface Utilisateur {
  id: string;
  prenom: string;
  role: Role;
}

/** Patient tel que la liste GET /api/patients le renvoie à une famille. */
export type PatientApi =
  | {
      id: string;
      prenom: string;
      dateNaissance: string;
      messagerieActivee: boolean;
      accordAudio?: boolean;
      consentementRequis?: undefined;
    }
  | { id: string; prenom: string; consentementRequis: true };

/** Patient gardé par l'application (sans date de naissance : seulement ce qui sert). */
export type PatientFamille =
  | {
      id: string;
      prenom: string;
      messagerieActivee: boolean;
      /** Accord de CE compte pour enregistrer la voix pendant les exercices. */
      accordAudio: boolean;
      /** Enfant de moins de 15 ans utilisé avec le compte du parent : mode enfant. */
      modeEnfant: boolean;
      consentementRequis?: undefined;
    }
  | { id: string; prenom: string; consentementRequis: true };

/** Profil choisi : la personne qui fait les exercices. */
export interface Profil {
  patientId: string;
  prenom: string;
  messagerieActivee: boolean;
  accordAudio: boolean;
  modeEnfant: boolean;
}

/** Programme envoyé (GET /api/patients/:id/programme/semaine). */
export interface ProgrammeEnvoye {
  titre: string;
  version: number;
  envoyeLe: string;
  elements: ElementEnvoye[];
}
