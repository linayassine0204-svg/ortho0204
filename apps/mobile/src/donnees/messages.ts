import type { FilVue, MessageVue } from "@app/shared";
import { ErreurApi, ErreurReseau, type ClientApi } from "../api/client";
import type { AudioLocal } from "./realisations";

// Messagerie (famille) : rien n'est gardé sur le téléphone. Messages et pièces jointes ne
// vont qu'à notre serveur (connexion chiffrée en production), jamais à un autre service.

export type ChargementMessages =
  | { etat: "ok"; fil: FilVue }
  | { etat: "horsLigne" }
  | { etat: "desactivee" }
  | { etat: "consentementRequis" }
  | { etat: "erreur"; message: string };

/** Photo choisie sur le téléphone (envoyée telle quelle ; le serveur contrôle son type). */
export interface PhotoLocale {
  uri: string;
  type: string;
  nom: string;
}

const base = (patientId: string) => `/patients/${encodeURIComponent(patientId)}/messagerie`;

export const cheminPieceJointe = (patientId: string, pieceId: string) =>
  `${base(patientId)}/pieces-jointes/${encodeURIComponent(pieceId)}`;

/** Fil du patient. Session expirée (401) : l'erreur remonte (retour à la connexion). */
export async function chargerMessages(
  client: ClientApi,
  patientId: string,
): Promise<ChargementMessages> {
  try {
    return { etat: "ok", fil: await client.get<FilVue>(base(patientId)) };
  } catch (erreur) {
    if (erreur instanceof ErreurReseau) return { etat: "horsLigne" };
    if (erreur instanceof ErreurApi) {
      if (erreur.status === 401) throw erreur;
      if (erreur.code === "messagerie_desactivee") return { etat: "desactivee" };
      if (erreur.code === "consentement_requis") return { etat: "consentementRequis" };
      return { etat: "erreur", message: erreur.message };
    }
    throw erreur;
  }
}

/** Envoie un message : texte, et éventuellement une photo OU un message vocal. */
export async function envoyerMessage(
  client: ClientApi,
  patientId: string,
  envoi: { contenu: string; photo?: PhotoLocale | null; vocal?: AudioLocal | null },
): Promise<MessageVue> {
  const chemin = `${base(patientId)}/messages`;
  if (!envoi.photo && !envoi.vocal) {
    return (await client.post<{ message: MessageVue }>(chemin, { contenu: envoi.contenu })).message;
  }
  const formulaire = new FormData();
  formulaire.append("contenu", envoi.contenu);
  // Format de React Native pour joindre un fichier local (lu et envoyé par le système).
  const fichier = envoi.vocal
    ? { uri: envoi.vocal.uri, name: "vocal.m4a", type: "audio/mp4" }
    : { uri: envoi.photo?.uri, name: envoi.photo?.nom, type: envoi.photo?.type };
  formulaire.append("fichier", fichier as unknown as Blob);
  if (envoi.vocal) formulaire.append("dureeSecondes", String(envoi.vocal.dureeSecondes));
  return (await client.postFormulaire<{ message: MessageVue }>(chemin, formulaire)).message;
}
