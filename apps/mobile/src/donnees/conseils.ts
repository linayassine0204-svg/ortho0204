import type { ConseilRecu } from "@app/shared";
import { ErreurApi, ErreurReseau, type ClientApi } from "../api/client";

export type ChargementConseils =
  | { etat: "ok"; conseils: ConseilRecu[] }
  | { etat: "horsLigne" }
  | { etat: "consentementRequis" }
  | { etat: "erreur"; message: string };

const base = (patientId: string) => `/patients/${encodeURIComponent(patientId)}/conseils`;

/**
 * Conseils reçus (dernier envoi de chaque conseil, à lire d'abord).
 * Rien n'est gardé sur le téléphone : sans réseau, on le dit simplement.
 * Session expirée (401) : l'erreur remonte (retour à la connexion).
 */
export async function chargerConseils(
  client: ClientApi,
  patientId: string,
): Promise<ChargementConseils> {
  try {
    const r = await client.get<{ conseils: ConseilRecu[] }>(`${base(patientId)}/recus`);
    return { etat: "ok", conseils: r.conseils };
  } catch (erreur) {
    if (erreur instanceof ErreurReseau) return { etat: "horsLigne" };
    if (erreur instanceof ErreurApi) {
      if (erreur.status === 401) throw erreur;
      if (erreur.code === "consentement_requis") return { etat: "consentementRequis" };
      return { etat: "erreur", message: erreur.message };
    }
    throw erreur;
  }
}

/** « J'ai compris » : renvoie la date de lecture enregistrée par le serveur. */
export async function marquerConseilLu(
  client: ClientApi,
  patientId: string,
  envoiId: string,
): Promise<string> {
  const r = await client.post<{ luLe: string }>(
    `${base(patientId)}/envois/${encodeURIComponent(envoiId)}/lu`,
  );
  return r.luLe;
}
