import type { AudioLocal } from "../donnees/realisations";

/** Enregistreur de la voix utilisé par l'écran d'un exercice (remplaçable en test). */
export interface EnregistreurVoix {
  enCours: boolean;
  /** Durée de l'enregistrement en cours, en millisecondes. */
  dureeMs: number;
  /** Démarre ; `false` si le micro est refusé. */
  demarrer(): Promise<boolean>;
  /** Arrête et renvoie le fichier gardé dans l'application. */
  arreter(): Promise<AudioLocal | null>;
}
