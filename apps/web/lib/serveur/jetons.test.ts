import { describe, expect, it } from "vitest";
import { empreinteAvecCle, empreinteJeton, genererJeton } from "./jetons";

describe("jetons", () => {
  it("génère des jetons longs et tous différents", () => {
    const jetons = new Set(Array.from({ length: 100 }, genererJeton));
    expect(jetons.size).toBe(100);
    for (const j of jetons) expect(j.length).toBeGreaterThanOrEqual(43);
  });

  it("stocke une empreinte différente du jeton, stable", () => {
    const jeton = genererJeton();
    expect(empreinteJeton(jeton)).not.toBe(jeton);
    expect(empreinteJeton(jeton)).toBe(empreinteJeton(jeton));
  });

  it("l'empreinte à clé dépend du secret (e-mail jamais stocké en clair)", () => {
    const a = empreinteAvecCle("secret-a".repeat(4), "camille@exemple.test");
    const b = empreinteAvecCle("secret-b".repeat(4), "camille@exemple.test");
    expect(a).not.toBe(b);
    expect(a).not.toContain("camille");
  });
});
