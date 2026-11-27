import { gcm } from "@noble/ciphers/aes.js";
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from "@noble/ciphers/utils.js";
import type { Coffre } from "./coffre";

// Cache hors ligne CHIFFRÉ. Le programme est une donnée de santé : il n'est jamais
// écrit en clair sur le téléphone. Chiffrement AES-256-GCM ; la clé (aléatoire, propre
// à l'appareil) est rangée dans le coffre-fort du téléphone, le contenu chiffré dans
// le stockage de l'application. Tout est effacé à la déconnexion.

/** Stockage clé → texte (AsyncStorage dans l'application). */
export interface StockageTexte {
  getItem(cle: string): Promise<string | null>;
  setItem(cle: string, valeur: string): Promise<void>;
  removeItem(cle: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export interface Cache {
  enregistrer<T>(cle: string, valeur: T): Promise<void>;
  lire<T>(cle: string): Promise<T | null>;
  effacer(cle: string): Promise<void>;
  toutEffacer(): Promise<void>;
}

const CLE_COFFRE = "cache.cle";
const PREFIXE = "cache.v1.";
const TAILLE_CLE = 32;
const TAILLE_NONCE = 12;

export function creerCacheChiffre(dependances: {
  coffre: Coffre;
  stockage: StockageTexte;
  /** Octets aléatoires cryptographiques (expo-crypto). */
  aleatoire: (n: number) => Uint8Array;
}): Cache {
  const { coffre, stockage, aleatoire } = dependances;

  async function cle(creerSiAbsente: boolean): Promise<Uint8Array | null> {
    const existante = await coffre.lire(CLE_COFFRE);
    if (existante) return hexToBytes(existante);
    if (!creerSiAbsente) return null;
    const nouvelle = aleatoire(TAILLE_CLE);
    await coffre.ecrire(CLE_COFFRE, bytesToHex(nouvelle));
    return nouvelle;
  }

  return {
    async enregistrer(nom, valeur) {
      const k = (await cle(true)) as Uint8Array;
      const nonce = aleatoire(TAILLE_NONCE);
      // Le nom sert de donnée associée : un contenu déplacé sous un autre nom est rejeté.
      const chiffre = gcm(k, nonce, utf8ToBytes(nom)).encrypt(utf8ToBytes(JSON.stringify(valeur)));
      await stockage.setItem(PREFIXE + nom, `${bytesToHex(nonce)}.${bytesToHex(chiffre)}`);
    },

    async lire<T>(nom: string): Promise<T | null> {
      const brut = await stockage.getItem(PREFIXE + nom);
      const k = await cle(false);
      if (!brut || !k) return null;
      try {
        const [nonce, chiffre] = brut.split(".");
        if (!nonce || !chiffre) return null;
        const clair = gcm(k, hexToBytes(nonce), utf8ToBytes(nom)).decrypt(hexToBytes(chiffre));
        return JSON.parse(bytesToUtf8(clair)) as T;
      } catch {
        // Contenu abîmé ou clé changée : on l'ignore et on le supprime.
        await stockage.removeItem(PREFIXE + nom);
        return null;
      }
    },

    async effacer(nom) {
      await stockage.removeItem(PREFIXE + nom);
    },

    async toutEffacer() {
      const cles = (await stockage.getAllKeys()).filter((c) => c.startsWith(PREFIXE));
      await Promise.all(cles.map((c) => stockage.removeItem(c)));
      // Nouvelle clé au prochain enregistrement : l'ancien contenu devient illisible.
      await coffre.effacer(CLE_COFFRE);
    },
  };
}

/** Stockage en mémoire, pour les tests. */
export function stockageMemoire(): StockageTexte & { contenu: Map<string, string> } {
  const contenu = new Map<string, string>();
  return {
    contenu,
    getItem: async (c) => contenu.get(c) ?? null,
    setItem: async (c, v) => {
      contenu.set(c, v);
    },
    removeItem: async (c) => {
      contenu.delete(c);
    },
    getAllKeys: async () => [...contenu.keys()],
  };
}
