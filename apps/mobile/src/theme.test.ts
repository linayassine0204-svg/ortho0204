import { describe, expect, it } from "vitest";
import { MIN_MOBILE_FONT_SIZE } from "@app/shared";
import { fontSizes } from "./theme";

describe("thème mobile", () => {
  it("aucune taille de texte n'est inférieure à 16 px", () => {
    for (const size of Object.values(fontSizes)) {
      expect(size).toBeGreaterThanOrEqual(MIN_MOBILE_FONT_SIZE);
    }
  });
});
