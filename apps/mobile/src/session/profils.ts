import type { PatientFamille, Profil, Role } from "./types";

/** Où aller après la connexion (ou au démarrage). */
export type Destination =
  | { ecran: "reserveeFamilles" }
  | { ecran: "choixProfil" }
  | { ecran: "programme"; profil: Profil }
  | { ecran: "aucunDossier" };

export function profilDe(patient: PatientFamille): Profil | null {
  if (patient.consentementRequis) return null;
  return {
    patientId: patient.id,
    prenom: patient.prenom,
    messagerieActivee: patient.messagerieActivee,
  };
}

/**
 * - Parent : toujours l'écran « Qui fait les exercices ? » (il peut avoir plusieurs
 *   enfants, et c'est l'entrée du mode enfant).
 * - Patient adulte : directement son programme.
 * - Orthophoniste : l'application est réservée aux familles.
 */
export function destinationApresConnexion(
  role: Role,
  patients: readonly PatientFamille[],
): Destination {
  if (role === "PARENT") return { ecran: "choixProfil" };
  if (role === "PATIENT_ADULT") {
    const premier = patients[0];
    if (!premier) return { ecran: "aucunDossier" };
    const profil = profilDe(premier);
    return profil ? { ecran: "programme", profil } : { ecran: "aucunDossier" };
  }
  return { ecran: "reserveeFamilles" };
}
