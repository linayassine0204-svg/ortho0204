import { ErreurReseau, type ClientApi } from "../api/client";
import type { PatientFamille, Utilisateur } from "../session/types";
import type { Cache } from "./cache";

/** Compte connecté et patients reliés (copie chiffrée pour démarrer sans réseau). */
export interface InfosSession {
  utilisateur: Utilisateur;
  patients: PatientFamille[];
}

const CLE = "session.infos";

/** Lit le compte et ses patients ; sans réseau, reprend la dernière copie. */
export async function chargerInfosSession(
  client: ClientApi,
  cache: Cache,
): Promise<InfosSession & { horsLigne: boolean }> {
  try {
    const { utilisateur } = await client.get<{ utilisateur: Utilisateur }>("/auth/moi");
    // Compte orthophoniste : application réservée aux familles, on ne charge aucun dossier.
    const patients =
      utilisateur.role === "ORTHO"
        ? []
        : (await client.get<{ patients: PatientFamille[] }>("/patients")).patients;
    const infos: InfosSession = {
      utilisateur: { id: utilisateur.id, prenom: utilisateur.prenom, role: utilisateur.role },
      patients: patients.map((p) =>
        p.consentementRequis
          ? { id: p.id, prenom: p.prenom, consentementRequis: true }
          : { id: p.id, prenom: p.prenom, messagerieActivee: p.messagerieActivee },
      ),
    };
    await cache.enregistrer(CLE, infos);
    return { ...infos, horsLigne: false };
  } catch (erreur) {
    if (erreur instanceof ErreurReseau) {
      const copie = await cache.lire<InfosSession>(CLE);
      if (copie) return { ...copie, horsLigne: true };
    }
    throw erreur;
  }
}
