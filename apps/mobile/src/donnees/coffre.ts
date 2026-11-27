import * as SecureStore from "expo-secure-store";

/**
 * Coffre-fort du téléphone (Keychain sur iPhone, Keystore sur Android).
 * Seul endroit où sont rangés les jetons et la clé du cache : jamais en clair ailleurs.
 */
export interface Coffre {
  lire(cle: string): Promise<string | null>;
  ecrire(cle: string, valeur: string): Promise<void>;
  effacer(cle: string): Promise<void>;
}

const options: SecureStore.SecureStoreOptions = {
  // Lisible seulement téléphone déverrouillé, jamais copié dans une sauvegarde ou un autre appareil.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const coffreTelephone: Coffre = {
  lire: (cle) => SecureStore.getItemAsync(cle, options),
  ecrire: (cle, valeur) => SecureStore.setItemAsync(cle, valeur, options),
  effacer: (cle) => SecureStore.deleteItemAsync(cle, options),
};

/** Coffre en mémoire, pour les tests. */
export function coffreMemoire(): Coffre & { contenu: Map<string, string> } {
  const contenu = new Map<string, string>();
  return {
    contenu,
    lire: async (cle) => contenu.get(cle) ?? null,
    ecrire: async (cle, valeur) => {
      contenu.set(cle, valeur);
    },
    effacer: async (cle) => {
      contenu.delete(cle);
    },
  };
}
