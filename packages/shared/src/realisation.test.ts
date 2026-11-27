import { describe, expect, it } from "vitest";
import { nouvelleRealisationSchema } from "./realisation";

const base = {
  idClient: "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b",
  elementId: "el-1",
  faitLe: "2026-11-27T17:30:00.000+01:00",
};

describe("format d'une réalisation envoyée par l'application", () => {
  it("accepte une réalisation complète ou minimale", () => {
    expect(
      nouvelleRealisationSchema.parse({ ...base, ressenti: "FACILE", score: 7 }),
    ).toMatchObject({ ressenti: "FACILE", score: 7 });
    expect(nouvelleRealisationSchema.parse(base)).toMatchObject({ ressenti: null, score: null });
  });

  it("refuse un identifiant du téléphone mal formé, un ressenti inconnu, une date invalide", () => {
    expect(nouvelleRealisationSchema.safeParse({ ...base, idClient: "court" }).success).toBe(false);
    expect(nouvelleRealisationSchema.safeParse({ ...base, idClient: "../../x" }).success).toBe(
      false,
    );
    expect(nouvelleRealisationSchema.safeParse({ ...base, ressenti: "SUPER" }).success).toBe(false);
    expect(nouvelleRealisationSchema.safeParse({ ...base, faitLe: "hier" }).success).toBe(false);
    expect(nouvelleRealisationSchema.safeParse({ ...base, score: -1 }).success).toBe(false);
  });
});
