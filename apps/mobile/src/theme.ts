import { colors, MIN_MOBILE_FONT_SIZE } from "@app/shared";

export const palette = {
  fond: colors.blanc,
  texte: colors.bleuNuit,
  titre: colors.vert,
  accent: colors.jaune,
} as const;

/** Tailles de texte (px). Aucune n'est sous le minimum de 16 px. */
export const fontSizes = {
  corps: MIN_MOBILE_FONT_SIZE,
  intermediaire: 20,
  titre: 28,
} as const;
