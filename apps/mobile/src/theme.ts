import { colors, MIN_MOBILE_FONT_SIZE } from "@app/shared";

// Mêmes couleurs que le logiciel web (apps/web/app/globals.css).
export const palette = {
  fond: colors.blanc,
  texte: colors.bleuNuit,
  titre: colors.vert,
  accent: colors.jaune,
  vert: colors.vert,
  vertFonce: "#225F51",
  menthe: "#EAF4F1",
  bordure: "#C9D6D2",
  texteDiscret: "#4A5A6E",
  ambreClair: "#FBF1DF",
  erreur: "#A3261B",
} as const;

/** Tailles de texte (px). Aucune n'est sous le minimum de 16 px. */
export const fontSizes = {
  corps: MIN_MOBILE_FONT_SIZE,
  intermediaire: 20,
  titre: 28,
} as const;

/**
 * Police : celle du système (San Francisco sur iPhone, Roboto sur Android), comme le
 * logiciel web (`system-ui`). Pas de police téléchargée : rien n'est chargé depuis un
 * service externe.
 */
export const police = undefined;

/** Hauteur minimale d'une zone tactile (gros boutons). */
export const TAILLE_TACTILE = 56;

export const espace = { s: 8, m: 16, l: 24 } as const;
export const rayon = 12;
