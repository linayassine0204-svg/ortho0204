import { jourLocal, type Ressenti } from "@app/shared";
import { ErreurApi, ErreurReseau, type ClientApi } from "../api/client";
import type { Cache } from "./cache";

// Réalisations faites dans l'application. Toujours rangées D'ABORD sur le téléphone
// (cache chiffré), puis envoyées au serveur : sans réseau, rien n'est perdu, et tout
// part dès le retour du réseau. Chaque réalisation a un identifiant créé par le
// téléphone (`idClient`) : le serveur ne l'enregistre jamais deux fois.

/** Voix enregistrée pendant l'exercice, en attente d'envoi (fichier privé de l'appli). */
export interface AudioLocal {
  uri: string;
  dureeSecondes: number;
}

export interface SaisieRealisation {
  patientId: string;
  elementId: string;
  ressenti: Ressenti;
  score: number | null;
  audio: AudioLocal | null;
}

export interface RealisationEnAttente extends SaisieRealisation {
  idClient: string;
  /** Moment où l'exercice a été fait (ISO). */
  faitLe: string;
  /** Identifiant donné par le serveur, une fois la réalisation acceptée. */
  realisationId: string | null;
}

/** Trace locale : ce qui a été fait cette semaine (pour l'écran « Aujourd'hui »). */
export interface FaitLocal {
  elementId: string;
  /** Jour (AAAA-MM-JJ, heure de Paris). */
  date: string;
}

export interface ResultatSynchro {
  envoyees: number;
  /** Abandonnées car refusées définitivement par le serveur (droits retirés…). */
  abandonnees: number;
  restantes: number;
  /** Raison de l'arrêt avant la fin de la file, s'il y en a une. */
  arret: null | "reseau" | "session" | "serveur";
}

export interface ServiceRealisations {
  /** Range la réalisation sur le téléphone puis tente de l'envoyer. */
  enregistrer(saisie: SaisieRealisation): Promise<{ envoyee: boolean }>;
  faits(patientId: string): Promise<FaitLocal[]>;
  enAttente(): Promise<number>;
  synchroniser(): Promise<ResultatSynchro>;
}

const CLE_ATTENTE = "realisations.attente";
const cleFaits = (patientId: string) => `realisations.faits.${patientId}`;
/** On garde la trace locale des 8 derniers jours (la semaine en cours). */
const JOURS_GARDES = 8;

/** Refus définitif : inutile de réessayer (sauf session expirée ou serveur surchargé). */
export function refusDefinitif(erreur: unknown): boolean {
  return (
    erreur instanceof ErreurApi &&
    erreur.status >= 400 &&
    erreur.status < 500 &&
    ![401, 408, 429].includes(erreur.status)
  );
}

function formulaireAudio(audio: AudioLocal): FormData {
  const formulaire = new FormData();
  // Format de React Native pour joindre un fichier local (lu et envoyé par le système).
  formulaire.append("audio", {
    uri: audio.uri,
    name: "voix.m4a",
    type: "audio/mp4",
  } as unknown as Blob);
  formulaire.append("dureeSecondes", String(audio.dureeSecondes));
  return formulaire;
}

export function creerServiceRealisations(dependances: {
  client: ClientApi;
  cache: Cache;
  /** Identifiant aléatoire (UUID) : expo-crypto. */
  uuid: () => string;
  /** Supprime un fichier audio local une fois envoyé (ou abandonné). */
  supprimerFichier: (uri: string) => Promise<void>;
  maintenant?: () => Date;
}): ServiceRealisations {
  const { client, cache, uuid, supprimerFichier } = dependances;
  const maintenant = dependances.maintenant ?? (() => new Date());

  // Les modifications de la file passent l'une après l'autre (lecture → écriture).
  let verrou: Promise<unknown> = Promise.resolve();
  function enSerie<T>(fn: () => Promise<T>): Promise<T> {
    const suite = verrou.then(fn, fn);
    verrou = suite.catch(() => undefined);
    return suite;
  }
  const lireFile = async () => (await cache.lire<RealisationEnAttente[]>(CLE_ATTENTE)) ?? [];
  const modifierFile = (fn: (file: RealisationEnAttente[]) => RealisationEnAttente[]) =>
    enSerie(async () => {
      await cache.enregistrer(CLE_ATTENTE, fn(await lireFile()));
    });

  async function noterFait(patientId: string, elementId: string, faitLe: Date) {
    await enSerie(async () => {
      const limite = new Date(faitLe.getTime() - JOURS_GARDES * 24 * 3600 * 1000);
      const dateLimite = jourLocal(limite).date;
      const faits = ((await cache.lire<FaitLocal[]>(cleFaits(patientId))) ?? []).filter(
        (f) => f.date >= dateLimite,
      );
      faits.push({ elementId, date: jourLocal(faitLe).date });
      await cache.enregistrer(cleFaits(patientId), faits);
    });
  }

  async function oublierAudio(item: RealisationEnAttente) {
    if (item.audio) await supprimerFichier(item.audio.uri).catch(() => undefined);
  }

  /** Envoie UNE réalisation (et sa voix). Lève l'erreur si l'envoi doit être retenté. */
  async function envoyer(item: RealisationEnAttente): Promise<"envoyee" | "abandonnee"> {
    const base = `/patients/${encodeURIComponent(item.patientId)}/realisations`;
    let realisationId = item.realisationId;
    if (!realisationId) {
      try {
        const r = await client.post<{ realisation: { id: string } }>(base, {
          idClient: item.idClient,
          elementId: item.elementId,
          faitLe: item.faitLe,
          ressenti: item.ressenti,
          score: item.score,
        });
        realisationId = r.realisation.id;
      } catch (erreur) {
        if (!refusDefinitif(erreur)) throw erreur;
        await oublierAudio(item);
        return "abandonnee";
      }
      const id = realisationId;
      await modifierFile((file) =>
        file.map((x) => (x.idClient === item.idClient ? { ...x, realisationId: id } : x)),
      );
    }
    if (item.audio) {
      try {
        await client.postFormulaire(
          `${base}/${encodeURIComponent(realisationId)}/enregistrement`,
          formulaireAudio(item.audio),
        );
      } catch (erreur) {
        // Voix refusée (accord retiré, fichier invalide) : la réalisation reste enregistrée.
        if (!refusDefinitif(erreur)) throw erreur;
      }
      await oublierAudio(item);
    }
    return "envoyee";
  }

  let synchroEnCours: Promise<ResultatSynchro> | null = null;

  function synchroniser(): Promise<ResultatSynchro> {
    synchroEnCours ??= (async () => {
      const resultat: ResultatSynchro = { envoyees: 0, abandonnees: 0, restantes: 0, arret: null };
      const vus = new Set<string>();
      try {
        for (;;) {
          const item = (await enSerie(lireFile)).find((x) => !vus.has(x.idClient));
          if (!item) break;
          vus.add(item.idClient);
          try {
            const issue = await envoyer(item);
            resultat[issue === "envoyee" ? "envoyees" : "abandonnees"] += 1;
            await modifierFile((file) => file.filter((x) => x.idClient !== item.idClient));
          } catch (erreur) {
            resultat.arret =
              erreur instanceof ErreurReseau
                ? "reseau"
                : erreur instanceof ErreurApi && erreur.status === 401
                  ? "session"
                  : "serveur";
            break;
          }
        }
        resultat.restantes = (await enSerie(lireFile)).length;
        return resultat;
      } finally {
        synchroEnCours = null;
      }
    })();
    return synchroEnCours;
  }

  return {
    async enregistrer(saisie) {
      const faitLe = maintenant();
      const item: RealisationEnAttente = {
        ...saisie,
        idClient: uuid(),
        faitLe: faitLe.toISOString(),
        realisationId: null,
      };
      await modifierFile((file) => [...file, item]);
      await noterFait(saisie.patientId, saisie.elementId, faitLe);
      // Une synchronisation déjà lancée pourrait ne pas voir la nouvelle : on attend
      // qu'elle finisse puis on en lance une qui la prendra.
      if (synchroEnCours) await synchroEnCours.catch(() => undefined);
      await synchroniser();
      const restante = (await enSerie(lireFile)).some((x) => x.idClient === item.idClient);
      return { envoyee: !restante };
    },

    async faits(patientId) {
      return (await cache.lire<FaitLocal[]>(cleFaits(patientId))) ?? [];
    },

    async enAttente() {
      return (await enSerie(lireFile)).length;
    },

    synchroniser,
  };
}
