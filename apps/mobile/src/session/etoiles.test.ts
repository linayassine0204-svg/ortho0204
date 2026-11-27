import { describe, expect, it } from "vitest";
import { RESSENTIS } from "@app/shared";
import { ETOILES_PAR_EXERCICE, etoilesGagnees, messageEncourageant } from "./etoiles";

describe("étoiles du mode enfant : jamais de pression", () => {
  it("toujours le même nombre d'étoiles, quels que soient le ressenti et le score", () => {
    for (const ressenti of RESSENTIS) {
      for (const score of [null, 0, 3, 10]) {
        expect(etoilesGagnees({ ressenti, score })).toBe(ETOILES_PAR_EXERCICE);
      }
    }
  });

  it("un message encourageant pour chaque ressenti, même « difficile »", () => {
    for (const ressenti of RESSENTIS) {
      const message = messageEncourageant(ressenti);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/raté|échec|dommage|nul|perdu/i);
    }
  });
});
