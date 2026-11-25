/** Couleurs de l'interface (voir CLAUDE.md). */
export const colors = {
  vert: "#2E7D6B",
  jaune: "#E0A33A",
  bleuNuit: "#1B2A41",
  blanc: "#FFFFFF",
} as const;

/** Taille de texte minimale sur mobile, en pixels. */
export const MIN_MOBILE_FONT_SIZE = 16;

function channel(hex: string, start: number): number {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  return 0.2126 * channel(clean, 0) + 0.7152 * channel(clean, 2) + 0.0722 * channel(clean, 4);
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales (#RRGGBB). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
