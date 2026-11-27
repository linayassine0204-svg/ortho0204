/**
 * Consentement « données de santé » demandé aux familles avant tout envoi de
 * données vers l'application (mobile ou espace famille du web).
 *
 * Le texte est dans i18n/fr.json (consentement.donneesSante.texte). Toute
 * modification du texte impose une NOUVELLE version : un test compare
 * l'empreinte du texte à `empreinteTexte` et échoue si on oublie.
 */
export const CONSENTEMENT_DONNEES_SANTE = {
  type: "DONNEES_SANTE",
  version: "2026-11-v1",
  /** SHA-256 (hex, 16 premiers caractères) du texte de cette version. */
  empreinteTexte: "9ee708855c5d97e5",
} as const;

/**
 * Accord facultatif pour enregistrer la voix pendant les exercices (texte :
 * consentement.enregistrementAudio.texte). Même règle de version que ci-dessus.
 */
export const CONSENTEMENT_ENREGISTREMENT_AUDIO = {
  type: "ENREGISTREMENT_AUDIO",
  version: "2026-11-v1",
  /** SHA-256 (hex, 16 premiers caractères) du texte de cette version. */
  empreinteTexte: "680d5b09599af938",
} as const;
