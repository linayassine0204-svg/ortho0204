import { describe, expect, it } from "vitest";
import { colors, contrastRatio } from "./theme";

describe("contrastes", () => {
  it("le texte blanc sur bleu nuit respecte WCAG AA (≥ 4,5)", () => {
    expect(contrastRatio(colors.blanc, colors.bleuNuit)).toBeGreaterThanOrEqual(4.5);
  });

  it("le texte bleu nuit sur jaune respecte WCAG AA (≥ 4,5)", () => {
    expect(contrastRatio(colors.bleuNuit, colors.jaune)).toBeGreaterThanOrEqual(4.5);
  });

  it("le texte blanc sur vert respecte WCAG AA (≥ 4,5)", () => {
    expect(contrastRatio(colors.blanc, colors.vert)).toBeGreaterThanOrEqual(4.5);
  });
});
