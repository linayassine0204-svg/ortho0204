import type { ElementEnvoye } from "@app/shared";

export type Role = "ORTHO" | "PARENT" | "PATIENT_ADULT";

export interface Utilisateur {
  id: string;
  prenom: string;
  role: Role;
}

/** Patient tel que la liste GET /api/patients le renvoie à une famille. */
export type PatientFamille =
  | { id: string; prenom: string; messagerieActivee: boolean; consentementRequis?: undefined }
  | { id: string; prenom: string; consentementRequis: true };

/** Profil choisi : la personne qui fait les exercices. */
export interface Profil {
  patientId: string;
  prenom: string;
  messagerieActivee: boolean;
}

/** Programme envoyé (GET /api/patients/:id/programme/semaine). */
export interface ProgrammeEnvoye {
  titre: string;
  version: number;
  envoyeLe: string;
  elements: ElementEnvoye[];
}
