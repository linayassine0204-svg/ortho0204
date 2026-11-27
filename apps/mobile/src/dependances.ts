import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRandomBytes } from "expo-crypto";
import { creerClientApi, type ClientApi } from "./api/client";
import { API_URL } from "./config";
import { creerCacheChiffre, type Cache } from "./donnees/cache";
import { coffreTelephone } from "./donnees/coffre";

export interface Dependances {
  client: ClientApi;
  cache: Cache;
  maintenant: () => Date;
}

/** Dépendances réelles de l'application (les tests passent les leurs). */
export function dependancesTelephone(): Dependances {
  return {
    client: creerClientApi({ baseUrl: API_URL, coffre: coffreTelephone }),
    cache: creerCacheChiffre({
      coffre: coffreTelephone,
      stockage: AsyncStorage,
      aleatoire: getRandomBytes,
    }),
    maintenant: () => new Date(),
  };
}
