import { describe, expect, it } from "vitest";
import {
  dureeSeance,
  joursEntre,
  materielSeance,
  modificationSeanceSchema,
  proposerSeance,
  realisationsPrevues,
  resultatsBons,
  resumeMaison,
  type ExercicePropose,
  type ResultatRealisation,
} from "./seance.ts";

// Règles de la préparation de séance : proposition (pathologie, âge, résultats),
// résumé de la maison et matériel. Données fictives.

const ex = (id: string, slug: string, ageMin = 4, ageMax = 10): ExercicePropose => ({
  id,
  categorie: { slug },
  ageMin,
  ageMax,
});

const bibliotheque = [
  ex("rimes", "langage-ecrit"),
  ex("syllabes", "langage-ecrit"),
  ex("lecture", "langage-ecrit", 6, 11),
  ex("histoire", "langage-oral"),
  ex("devinettes", "langage-oral", 5, 11),
  ex("voix", "voix", 12, 99),
  ex("petits", "langage-oral", 2, 4),
];
const lea = { age: 7, pathologies: ["langage-ecrit", "langage-oral"] };

function resultats(
  exerciceId: string,
  valeurs: Partial<ResultatRealisation>[],
): ResultatRealisation[] {
  return valeurs.map((v, i) => ({
    exerciceId,
    date: `2026-11-${String(10 + i).padStart(2, "0")}T18:00:00Z`,
    fait: true,
    ressenti: "FACILE",
    score: null,
    scoreMax: null,
    ...v,
  }));
}

describe("resultatsBons", () => {
  it("bons : 3 dernières faites, sans « difficile », score moyen ≥ 80 %", () => {
    expect(
      resultatsBons(
        resultats("a", [
          { score: 8, scoreMax: 10 },
          { score: 9, scoreMax: 10 },
          { score: 8, scoreMax: 10, ressenti: "MOYEN" },
        ]),
      ),
    ).toBe(true);
  });

  it("pas bons : score moyen sous 80 %", () => {
    expect(
      resultatsBons(
        resultats("a", [
          { score: 7, scoreMax: 10 },
          { score: 8, scoreMax: 10 },
          { score: 8, scoreMax: 10 },
        ]),
      ),
    ).toBe(false);
  });

  it("pas bons : une des 3 dernières non faite, ou ressentie difficile", () => {
    expect(resultatsBons(resultats("a", [{}, { fait: false, ressenti: null }, {}]))).toBe(false);
    expect(resultatsBons(resultats("a", [{}, { ressenti: "DIFFICILE" }, {}]))).toBe(false);
  });

  it("sans score : au moins 2 ressentis « facile » sur les 3 dernières", () => {
    expect(resultatsBons(resultats("a", [{}, {}, { ressenti: "MOYEN" }]))).toBe(true);
    expect(resultatsBons(resultats("a", [{}, { ressenti: "MOYEN" }, { ressenti: "MOYEN" }]))).toBe(
      false,
    );
  });

  it("ne regarde que les 3 plus récentes (un vieux raté ne compte plus)", () => {
    const liste = resultats("a", [{ fait: false, ressenti: null }, {}, {}, {}]);
    expect(resultatsBons(liste)).toBe(true);
    // Dans le désordre : même résultat (tri par date).
    expect(resultatsBons([...liste].reverse())).toBe(true);
  });

  it("moins de 3 réalisations : on ne sait pas, donc pas bons", () => {
    expect(resultatsBons(resultats("a", [{}, {}]))).toBe(false);
  });
});

describe("proposerSeance", () => {
  it("ne propose que la pathologie et l'âge du patient", () => {
    const p = proposerSeance({
      patient: lea,
      exercices: bibliotheque,
      travailles: [],
      resultats: [],
      nombre: 10,
    });
    const ids = p.map((x) => x.exerciceId);
    expect(ids).not.toContain("voix"); // autre pathologie
    expect(ids).not.toContain("petits"); // pas de l'âge
    expect(ids.sort()).toEqual(["devinettes", "histoire", "lecture", "rimes", "syllabes"]);
  });

  it("exercice travaillé avec de bons résultats : niveau suivant", () => {
    const [p] = proposerSeance({
      patient: lea,
      exercices: bibliotheque,
      travailles: [{ exerciceId: "rimes", niveau: 1 }],
      resultats: resultats("rimes", [{}, {}, {}]),
    });
    expect(p).toEqual({ exerciceId: "rimes", niveau: 2, raison: "NIVEAU_SUIVANT" });
  });

  it("exercice travaillé sans bons résultats : niveau en cours", () => {
    const [p] = proposerSeance({
      patient: lea,
      exercices: bibliotheque,
      travailles: [{ exerciceId: "rimes", niveau: 2 }],
      resultats: resultats("rimes", [{}, { ressenti: "DIFFICILE" }, {}]),
    });
    expect(p).toEqual({ exerciceId: "rimes", niveau: 2, raison: "NIVEAU_EN_COURS" });
  });

  it("jamais au-delà du niveau 3", () => {
    const [p] = proposerSeance({
      patient: lea,
      exercices: bibliotheque,
      travailles: [{ exerciceId: "rimes", niveau: 3 }],
      resultats: resultats("rimes", [{}, {}, {}]),
    });
    expect(p).toEqual({ exerciceId: "rimes", niveau: 3, raison: "NIVEAU_EN_COURS" });
  });

  it("le niveau en cours est le plus récent (dernière séance avant programme)", () => {
    const [p] = proposerSeance({
      patient: lea,
      exercices: bibliotheque,
      travailles: [
        { exerciceId: "syllabes", niveau: 3 },
        { exerciceId: "syllabes", niveau: 1 },
      ],
      resultats: [],
    });
    expect(p).toMatchObject({ exerciceId: "syllabes", niveau: 3 });
  });

  it("les résultats d'un autre exercice ne comptent pas", () => {
    const [p] = proposerSeance({
      patient: lea,
      exercices: bibliotheque,
      travailles: [{ exerciceId: "rimes", niveau: 1 }],
      resultats: resultats("syllabes", [{}, {}, {}]),
    });
    expect(p?.raison).toBe("NIVEAU_EN_COURS");
  });

  it("complète avec des nouveaux au niveau 1, en alternant les pathologies", () => {
    const p = proposerSeance({
      patient: lea,
      exercices: bibliotheque,
      travailles: [{ exerciceId: "rimes", niveau: 1 }],
      resultats: [],
    });
    expect(p).toEqual([
      { exerciceId: "rimes", niveau: 1, raison: "NIVEAU_EN_COURS" },
      { exerciceId: "syllabes", niveau: 1, raison: "NOUVEAU" },
      { exerciceId: "histoire", niveau: 1, raison: "NOUVEAU" },
      { exerciceId: "lecture", niveau: 1, raison: "NOUVEAU" },
    ]);
  });

  it("un exercice travaillé hors pathologie ou hors âge n'est pas proposé", () => {
    const p = proposerSeance({
      patient: lea,
      exercices: bibliotheque,
      travailles: [
        { exerciceId: "voix", niveau: 2 },
        { exerciceId: "petits", niveau: 1 },
      ],
      resultats: [],
    });
    expect(p.map((x) => x.exerciceId)).not.toContain("voix");
    expect(p.map((x) => x.exerciceId)).not.toContain("petits");
  });

  it("ne propose pas les exercices déjà dans la séance", () => {
    const p = proposerSeance({
      patient: lea,
      exercices: bibliotheque,
      travailles: [{ exerciceId: "rimes", niveau: 1 }],
      resultats: [],
      exclus: ["rimes", "syllabes"],
    });
    expect(p.map((x) => x.exerciceId)).toEqual(["lecture", "histoire", "devinettes"]);
  });

  it("4 exercices au plus par défaut ; aucun sans pathologie renseignée", () => {
    expect(
      proposerSeance({ patient: lea, exercices: bibliotheque, travailles: [], resultats: [] }),
    ).toHaveLength(4);
    expect(
      proposerSeance({
        patient: { age: 7, pathologies: [] },
        exercices: bibliotheque,
        travailles: [],
        resultats: [],
      }),
    ).toEqual([]);
  });
});

describe("résumé de la maison", () => {
  // Du mercredi 18 au mardi 24 novembre 2026 inclus (préparation le mercredi 25).
  const periode = { depuis: "2026-11-18", aujourdhui: "2026-11-25" };
  const elements = [
    {
      elementId: "e1",
      titre: "Rimes",
      foisParSemaine: 3,
      jours: ["LUNDI", "MERCREDI", "VENDREDI"] as const,
    },
    { elementId: "e2", titre: "Syllabes", foisParSemaine: 2, jours: [] as const },
  ];

  it("compte les jours de la période, aujourd'hui exclu", () => {
    expect(joursEntre("2026-11-18", "2026-11-25")).toHaveLength(7);
    expect(joursEntre("2026-11-25", "2026-11-25")).toEqual([]);
  });

  it("prévues : jours fixés dans la période, sinon N fois par semaine au prorata", () => {
    const jours = joursEntre(periode.depuis, periode.aujourdhui);
    // Mer 18, Ven 20, Lun 23.
    expect(
      realisationsPrevues({ foisParSemaine: 3, jours: ["LUNDI", "MERCREDI", "VENDREDI"] }, jours),
    ).toBe(3);
    expect(realisationsPrevues({ foisParSemaine: 2, jours: [] }, jours)).toBe(2);
    expect(realisationsPrevues({ foisParSemaine: 2, jours: [] }, jours.slice(0, 3))).toBe(1);
    expect(realisationsPrevues({ foisParSemaine: 3, jours: [] }, [...jours, ...jours])).toBe(6);
  });

  it("taux de réalisation, ressentis et scores", () => {
    const r = resumeMaison({
      ...periode,
      elements,
      realisations: [
        {
          elementId: "e1",
          jour: "2026-11-18",
          fait: true,
          ressenti: "FACILE",
          score: 6,
          scoreMax: 10,
        },
        {
          elementId: "e1",
          jour: "2026-11-20",
          fait: false,
          ressenti: null,
          score: null,
          scoreMax: null,
        },
        {
          elementId: "e1",
          jour: "2026-11-23",
          fait: true,
          ressenti: "MOYEN",
          score: 8,
          scoreMax: 10,
        },
        {
          elementId: "e2",
          jour: "2026-11-21",
          fait: true,
          ressenti: "DIFFICILE",
          score: null,
          scoreMax: null,
        },
        // Hors période : avant la dernière séance, et aujourd'hui.
        {
          elementId: "e2",
          jour: "2026-11-17",
          fait: true,
          ressenti: "FACILE",
          score: null,
          scoreMax: null,
        },
        {
          elementId: "e2",
          jour: "2026-11-25",
          fait: true,
          ressenti: "FACILE",
          score: null,
          scoreMax: null,
        },
      ],
    });
    expect(r).toMatchObject({ depuis: "2026-11-18", jusqua: "2026-11-24", prevues: 5, faites: 3 });
    expect(r.taux).toBeCloseTo(0.6);
    expect(r.ressentis).toEqual({ FACILE: 1, MOYEN: 1, DIFFICILE: 1 });
    const [rimes, syllabes] = r.lignes;
    expect(rimes).toMatchObject({
      prevues: 3,
      faites: 2,
      dernierScore: { score: 8, scoreMax: 10 },
    });
    expect(rimes?.scoreMoyen).toBeCloseTo(0.7);
    expect(syllabes).toMatchObject({ prevues: 2, faites: 1, taux: 0.5, scoreMoyen: null });
  });

  it("jamais plus de 100 % ; rien de prévu : taux inconnu", () => {
    const fait = { fait: true, ressenti: null, score: null, scoreMax: null };
    const r = resumeMaison({
      depuis: "2026-11-23",
      aujourdhui: "2026-11-24",
      elements: elements.slice(0, 1),
      realisations: [
        { elementId: "e1", jour: "2026-11-23", ...fait },
        { elementId: "e1", jour: "2026-11-23", ...fait },
      ],
    });
    expect(r.lignes[0]?.taux).toBe(1);
    expect(r.taux).toBe(1);
    expect(resumeMaison({ ...periode, elements: [], realisations: [] }).taux).toBeNull();
  });
});

describe("matériel à préparer", () => {
  it("réunit le matériel des exercices sans doublon, trié", () => {
    expect(
      materielSeance([
        { titre: "Sons ch / j", materiel: ["Miroir", "Cartes images"] },
        { titre: "Sons r", materiel: ["miroir "] },
        { titre: "Rimes", materiel: ["Cartes  images", "Ardoise"] },
        { titre: "Respiration", materiel: [] },
      ]),
    ).toEqual([
      { nom: "Ardoise", exercices: ["Rimes"] },
      { nom: "Cartes images", exercices: ["Sons ch / j", "Rimes"] },
      { nom: "Miroir", exercices: ["Sons ch / j", "Sons r"] },
    ]);
  });

  it("accents et majuscules ignorés pour repérer les doublons", () => {
    expect(
      materielSeance([
        { titre: "A", materiel: ["Images séquentielles"] },
        { titre: "B", materiel: ["images sequentielles"] },
      ]),
    ).toEqual([{ nom: "Images séquentielles", exercices: ["A", "B"] }]);
  });

  it("aucun exercice : rien à préparer ; durée totale additionnée", () => {
    expect(materielSeance([])).toEqual([]);
    expect(dureeSeance([{ dureeMinutes: 10 }, { dureeMinutes: 15 }])).toBe(25);
  });
});

describe("formats de l'API", () => {
  it("notes vides enregistrées comme absentes", () => {
    expect(modificationSeanceSchema.parse({ notes: "  " })).toEqual({ notes: null });
    expect(modificationSeanceSchema.safeParse({}).success).toBe(false);
  });
});
