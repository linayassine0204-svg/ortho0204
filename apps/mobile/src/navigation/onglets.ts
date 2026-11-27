import type { TranslationKey } from "@app/shared";

export type Onglet = "aujourdhui" | "conseils" | "messages";

export const LIBELLES_ONGLETS: Record<Onglet, TranslationKey> = {
  aujourdhui: "mobile.onglets.aujourdhui",
  conseils: "mobile.onglets.conseils",
  messages: "mobile.onglets.messages",
};

/**
 * Onglets de la barre du bas.
 * - « Conseils » : pour les parents seulement (le patient adolescent ou adulte voit le
 *   programme et la messagerie ; l'API lui refuse les conseils).
 * - « Messages » n'existe que si la messagerie est activée pour ce patient (réglage du
 *   patient, sinon du cabinet, calculé par le serveur). Désactivée : l'onglet est absent
 *   (pas grisé) ; l'API la refuse de toute façon.
 */
export function ongletsVisibles(profil: {
  messagerieActivee: boolean;
  role?: "PARENT" | "PATIENT_ADULT";
}): Onglet[] {
  const onglets: Onglet[] = ["aujourdhui"];
  if ((profil.role ?? "PARENT") === "PARENT") onglets.push("conseils");
  if (profil.messagerieActivee) onglets.push("messages");
  return onglets;
}

/** Onglet à afficher : retour sur « Aujourd'hui » si l'onglet courant a disparu. */
export function ongletActif(courant: Onglet, visibles: readonly Onglet[]): Onglet {
  return visibles.includes(courant) ? courant : "aujourdhui";
}
