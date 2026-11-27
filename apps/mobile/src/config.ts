// Adresse de l'API (apps/web). Valeur publique, pas un secret : EXPO_PUBLIC_API_URL.

/**
 * En production, seule une adresse https est acceptée : programme, réalisations et
 * voix ne circulent que par une connexion chiffrée. (http reste possible en
 * développement, sur le réseau local, avec des données fictives.)
 */
export function verifierAdresseApi(adresse: string, developpement: boolean): string {
  const propre = adresse.replace(/\/+$/, "");
  if (!developpement && !propre.startsWith("https://")) {
    throw new Error("EXPO_PUBLIC_API_URL doit commencer par https:// en production.");
  }
  return propre;
}

const developpement = typeof __DEV__ === "undefined" ? true : __DEV__;

export const API_URL = verifierAdresseApi(
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api",
  developpement,
);
