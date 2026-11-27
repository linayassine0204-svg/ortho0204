import { t, type Ressenti, type TranslationKey } from "@app/shared";

// Mode enfant : les étoiles récompensent l'EFFORT (avoir fait l'exercice), jamais le
// résultat. Difficile ou score bas : autant d'étoiles. Aucune comparaison avec
// d'autres enfants, aucun classement.

export const ETOILES_PAR_EXERCICE = 3;

/** Étoiles gagnées pour un exercice fait : toujours le même nombre. */
export function etoilesGagnees(_realisation: { ressenti: Ressenti; score: number | null }): number {
  return ETOILES_PAR_EXERCICE;
}

const MESSAGES: Record<Ressenti, TranslationKey> = {
  FACILE: "mobile.enfant.bravoFacile",
  MOYEN: "mobile.enfant.bravoMoyen",
  DIFFICILE: "mobile.enfant.bravoDifficile",
};

/** Message encourageant, quel que soit le ressenti. */
export function messageEncourageant(ressenti: Ressenti): string {
  return t(MESSAGES[ressenti]);
}
