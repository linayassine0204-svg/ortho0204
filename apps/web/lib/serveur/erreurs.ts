import { t, type TranslationKey } from "@app/shared";

/** Erreur prévue, renvoyée au client avec un message du fichier de traduction. */
export class ErreurApi extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly cleMessage: TranslationKey,
  ) {
    super(code);
  }
}

export const erreurs = {
  donneesInvalides: () => new ErreurApi(400, "donnees_invalides", "erreurs.donneesInvalides"),
  nonConnecte: () => new ErreurApi(401, "non_connecte", "erreurs.nonConnecte"),
  identifiantsIncorrects: () =>
    new ErreurApi(401, "identifiants_incorrects", "erreurs.identifiantsIncorrects"),
  requeteRefusee: () => new ErreurApi(403, "requete_refusee", "erreurs.requeteRefusee"),
  /** Refus de droits OU ressource absente : même réponse, pour ne rien révéler. */
  introuvable: () => new ErreurApi(404, "introuvable", "erreurs.introuvable"),
  tropDeTentatives: () => new ErreurApi(429, "trop_de_tentatives", "erreurs.tropDeTentatives"),
  invitationInvalide: () => new ErreurApi(400, "invitation_invalide", "erreurs.invitationInvalide"),
  /** Compte famille relié au patient, mais sans consentement actif. */
  consentementRequis: () => new ErreurApi(403, "consentement_requis", "erreurs.consentementRequis"),
  pathologieInconnue: () => new ErreurApi(400, "pathologie_inconnue", "erreurs.pathologieInconnue"),
  documentTypeRefuse: () =>
    new ErreurApi(415, "document_type_refuse", "erreurs.documentTypeRefuse"),
  documentTropGros: () => new ErreurApi(413, "document_trop_gros", "erreurs.documentTropGros"),
};

export function corpsErreur(erreur: ErreurApi) {
  return { erreur: { code: erreur.code, message: t(erreur.cleMessage) } };
}
