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
  niveauLimite: () => new ErreurApi(409, "niveau_limite", "erreurs.niveauLimite"),
  programmeVide: () => new ErreurApi(400, "programme_vide", "erreurs.programmeVide"),
  exerciceUtilise: () => new ErreurApi(409, "exercice_utilise", "erreurs.exerciceUtilise"),
  documentTropGros: () => new ErreurApi(413, "document_trop_gros", "erreurs.documentTropGros"),
  /** Enregistrement de la voix sans l'accord facultatif du compte. */
  consentementAudioRequis: () =>
    new ErreurApi(403, "consentement_audio_requis", "erreurs.consentementAudioRequis"),
  audioTypeRefuse: () => new ErreurApi(415, "audio_type_refuse", "erreurs.audioTypeRefuse"),
  /** Date d'envoi d'un conseil avant aujourd'hui. */
  datePassee: () => new ErreurApi(400, "date_passee", "erreurs.datePassee"),
  audioTropGros: () => new ErreurApi(413, "audio_trop_gros", "erreurs.audioTropGros"),
  dejaDansSeance: () => new ErreurApi(409, "deja_dans_seance", "erreurs.dejaDansSeance"),
  /** Une séance terminée ne se modifie plus (ses notes restent consultables). */
  seanceTerminee: () => new ErreurApi(409, "seance_terminee", "erreurs.seanceTerminee"),
  /** Partage refusé : des parties ne sont pas encore relues. */
  documentARelire: () => new ErreurApi(409, "document_a_relire", "erreurs.documentARelire"),
  partieInconnue: () => new ErreurApi(404, "partie_inconnue", "erreurs.partieInconnue"),
  /** Messagerie coupée pour ce patient (cabinet ou exception) : l'API refuse tout. */
  messagerieDesactivee: () =>
    new ErreurApi(403, "messagerie_desactivee", "erreurs.messagerieDesactivee"),
  pieceJointeTypeRefuse: () =>
    new ErreurApi(415, "piece_jointe_type_refuse", "erreurs.pieceJointeTypeRefuse"),
  pieceJointeTropGrosse: () =>
    new ErreurApi(413, "piece_jointe_trop_grosse", "erreurs.pieceJointeTropGrosse"),
  messageVide: () => new ErreurApi(400, "message_vide", "erreurs.messageVide"),
};

export function corpsErreur(erreur: ErreurApi) {
  return { erreur: { code: erreur.code, message: t(erreur.cleMessage) } };
}
