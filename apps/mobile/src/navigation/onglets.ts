import type { TranslationKey } from "@app/shared";

export type Onglet = "aujourdhui" | "conseils" | "messages";

export const LIBELLES_ONGLETS: Record<Onglet, TranslationKey> = {
  aujourdhui: "mobile.onglets.aujourdhui",
  conseils: "mobile.onglets.conseils",
  messages: "mobile.onglets.messages",
};

/**
 * Onglets de la barre du bas. « Messages » n'existe que si la messagerie est activée
 * pour ce patient (réglage du patient, sinon du cabinet, calculé par le serveur).
 * Désactivée : l'onglet est absent (pas grisé) ; l'API la refuse de toute façon.
 */
export function ongletsVisibles(profil: { messagerieActivee: boolean }): Onglet[] {
  return profil.messagerieActivee
    ? ["aujourdhui", "conseils", "messages"]
    : ["aujourdhui", "conseils"];
}

/** Onglet à afficher : retour sur « Aujourd'hui » si l'onglet courant a disparu. */
export function ongletActif(courant: Onglet, visibles: readonly Onglet[]): Onglet {
  return visibles.includes(courant) ? courant : "aujourdhui";
}
