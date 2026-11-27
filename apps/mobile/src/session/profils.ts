import type { PatientFamille, Profil, Role } from "./types";

/** Âge de l'enfant sans compte propre en dessous duquel l'application passe en mode enfant. */
export const AGE_MODE_ENFANT = 15;

/** Âge en années révolues à une date donnée (date de naissance AAAA-MM-JJ…). */
export function ageEnAnnees(dateNaissance: string, maintenant: Date): number {
  const [a, m, j] = dateNaissance.slice(0, 10).split("-").map(Number) as [number, number, number];
  let age = maintenant.getUTCFullYear() - a;
  const anniversairePasse =
    maintenant.getUTCMonth() + 1 > m ||
    (maintenant.getUTCMonth() + 1 === m && maintenant.getUTCDate() >= j);
  if (!anniversairePasse) age -= 1;
  return age;
}

/**
 * Mode enfant : un enfant de moins de 15 ans, qui utilise le compte de son parent.
 * Le patient qui a son propre compte (15 ans et plus) a toujours la vue adulte.
 */
export function estModeEnfant(role: Role, dateNaissance: string, maintenant: Date): boolean {
  return role === "PARENT" && ageEnAnnees(dateNaissance, maintenant) < AGE_MODE_ENFANT;
}

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
    accordAudio: patient.accordAudio,
    modeEnfant: patient.modeEnfant,
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
