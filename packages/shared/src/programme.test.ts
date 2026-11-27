import { describe, expect, it } from "vitest";
import {
  ajoutElementSchema,
  contenuProgramme,
  jourDeDate,
  jourLocal,
  modificationElementSchema,
  planJour,
  planSemaine,
  rythme,
  type ElementSource,
} from "./programme";

function source(p: Partial<ElementSource> & { id: string; ordre: number }): ElementSource {
  return {
    niveau: 2,
    foisParSemaine: 3,
    jours: [],
    motFamille: null,
    exercice: {
      id: `ex-${p.id}`,
      titre: `Exercice ${p.id}`,
      description: "Description fictive",
      apercuConsigne: "Consigne courte",
      apercuImage: null,
      materiel: ["Miroir"],
      dureeMinutes: 10,
      scoreMax: 10,
      aValider: true,
      categorie: { nom: "Articulation", slug: "articulation" },
      niveaux: [
        { niveau: 1, consigne: "C1" },
        { niveau: 2, consigne: "C2" },
        { niveau: 3, consigne: "C3" },
      ],
    },
    ...p,
  };
}

describe("contenu envoyé", () => {
  it("garde l'ordre du programme, le niveau et la consigne de CE niveau", () => {
    const c = contenuProgramme([
      source({ id: "b", ordre: 2, niveau: 3 }),
      source({ id: "a", ordre: 1, niveau: 1, jours: ["VENDREDI", "LUNDI"], motFamille: "Bravo" }),
    ]);
    expect(c.map((e) => e.elementId)).toEqual(["a", "b"]);
    expect(c[0]).toMatchObject({
      niveau: 1,
      consigne: "C1",
      jours: ["LUNDI", "VENDREDI"],
      motFamille: "Bravo",
      aValider: true,
      materiel: ["Miroir"],
    });
    expect(c[1]?.consigne).toBe("C3");
  });
});

describe("jours et fuseau", () => {
  it("donne le jour de la semaine d'une date", () => {
    expect(jourDeDate("2026-11-23")).toBe("LUNDI");
    expect(jourDeDate("2026-11-29")).toBe("DIMANCHE");
  });

  it("utilise l'heure de Paris : 23 h 30 UTC un dimanche = déjà lundi à Paris", () => {
    expect(jourLocal(new Date("2026-11-29T23:30:00Z"))).toEqual({
      date: "2026-11-30",
      jour: "LUNDI",
    });
    expect(jourLocal(new Date("2026-11-29T22:30:00Z"))).toEqual({
      date: "2026-11-29",
      jour: "DIMANCHE",
    });
  });
});

describe("plan de la semaine et du jour", () => {
  const elements = contenuProgramme([
    source({ id: "fixe", ordre: 1, jours: ["LUNDI", "JEUDI"] }),
    source({ id: "libre", ordre: 2, jours: [] }),
  ]);

  it("semaine du lundi au dimanche, exercices placés sur leurs jours", () => {
    const p = planSemaine(elements, "2026-11-26"); // jeudi
    expect(p.debut).toBe("2026-11-23");
    expect(p.fin).toBe("2026-11-29");
    expect(p.jours.map((j) => j.jour)).toEqual([
      "LUNDI",
      "MARDI",
      "MERCREDI",
      "JEUDI",
      "VENDREDI",
      "SAMEDI",
      "DIMANCHE",
    ]);
    expect(p.jours[0]?.elements.map((e) => e.elementId)).toEqual(["fixe"]);
    expect(p.jours[1]?.elements).toEqual([]);
    expect(p.jours[3]?.elements.map((e) => e.elementId)).toEqual(["fixe"]);
    expect(p.sansJourFixe.map((e) => e.elementId)).toEqual(["libre"]);
  });

  it("jour : exercices du jour + exercices sans jour fixé", () => {
    expect(planJour(elements, "2026-11-26").elements.map((e) => e.elementId)).toEqual(["fixe"]);
    expect(planJour(elements, "2026-11-25").elements).toEqual([]);
    expect(planJour(elements, "2026-11-25").sansJourFixe.map((e) => e.elementId)).toEqual([
      "libre",
    ]);
  });
});

describe("règles et formats", () => {
  it("rythme : jours choisis = autant de fois par semaine", () => {
    expect(rythme(5, ["LUNDI", "JEUDI"])).toBe(2);
    expect(rythme(4, [])).toBe(4);
  });

  it("ajout : niveau 1 à 3, jours dédoublonnés et rangés", () => {
    expect(ajoutElementSchema.parse({ exerciceId: "e", niveau: 2 })).toEqual({
      exerciceId: "e",
      niveau: 2,
      foisParSemaine: 3,
      jours: [],
      motFamille: null,
    });
    expect(ajoutElementSchema.safeParse({ exerciceId: "e", niveau: 4 }).success).toBe(false);
    expect(
      ajoutElementSchema.parse({ exerciceId: "e", niveau: 1, jours: ["JEUDI", "LUNDI", "JEUDI"] })
        .jours,
    ).toEqual(["LUNDI", "JEUDI"]);
  });

  it("modification : au moins un champ ; mot vide = effacé", () => {
    expect(modificationElementSchema.safeParse({}).success).toBe(false);
    expect(modificationElementSchema.parse({ motFamille: "  " })).toEqual({ motFamille: null });
  });
});
