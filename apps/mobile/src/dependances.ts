import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { getRandomBytes, randomUUID } from "expo-crypto";
import { creerClientApi, type ClientApi } from "./api/client";
import type { EnregistreurVoix } from "./audio/types";
import { supprimerFichierVoix, supprimerToutesLesVoix, useEnregistreurVoix } from "./audio/voix";
import { API_URL } from "./config";
import { creerCacheChiffre, type Cache } from "./donnees/cache";
import { coffreTelephone } from "./donnees/coffre";
import { creerServiceRealisations, type ServiceRealisations } from "./donnees/realisations";

export interface Dependances {
  client: ClientApi;
  cache: Cache;
  maintenant: () => Date;
  realisations: ServiceRealisations;
  /** Hook React : enregistreur de la voix (micro). */
  useEnregistreurVoix: () => EnregistreurVoix;
  supprimerVoix: (uri: string) => Promise<void>;
  /** Supprime toutes les voix gardées sur le téléphone (déconnexion). */
  effacerVoix: () => Promise<void>;
  /** Appelle `rappel` quand le réseau revient. Renvoie de quoi se désabonner. */
  surRetourReseau: (rappel: () => void) => () => void;
}

/** Dépendances réelles de l'application (les tests passent les leurs). */
export function dependancesTelephone(): Dependances {
  const client = creerClientApi({ baseUrl: API_URL, coffre: coffreTelephone });
  const cache = creerCacheChiffre({
    coffre: coffreTelephone,
    stockage: AsyncStorage,
    aleatoire: getRandomBytes,
  });
  return {
    client,
    cache,
    maintenant: () => new Date(),
    realisations: creerServiceRealisations({
      client,
      cache,
      uuid: randomUUID,
      supprimerFichier: supprimerFichierVoix,
    }),
    useEnregistreurVoix,
    supprimerVoix: supprimerFichierVoix,
    effacerVoix: supprimerToutesLesVoix,
    surRetourReseau: (rappel) => {
      let connecte: boolean | null = null;
      return NetInfo.addEventListener((etat) => {
        const maintenant = etat.isConnected === true && etat.isInternetReachable !== false;
        if (maintenant && connecte === false) rappel();
        connecte = maintenant;
      });
    },
  };
}
