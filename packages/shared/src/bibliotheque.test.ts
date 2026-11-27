import { describe, expect, it } from "vitest";
import {
  FILTRES_VIDES,
  filtresBibliothequeSchema,
  filtresPourPatient,
  filtrerExercices,
  exerciceSchema,
  motsNormalises,
  type ExerciceBibliotheque,
} from "./bibliotheque";

function exercice(partiel: Partial<ExerciceBibliotheque> & { id: string }): ExerciceBibliotheque {
  return {
    titre: "Titre",
    description: "Description",
    apercuConsigne: "Consigne courte",
    apercuImage: null,
    materiel: [],
    dureeMinutes: 10,
    scoreMax: null,
    ageMin: 4,
    ageMax: 10,
    categorie: { id: "c1", nom: "Articulation et parole", slug: "articulation" },
    niveaux: [
      { niveau: 1, consigne: "Consigne niveau un" },
      { niveau: 2, consigne: "Consigne niveau deux" },
      { niveau: 3, consigne: "Consigne niveau trois" },
    ],
    perso: false,
    aValider: true,
    favori: false,
    ...partiel,
  };
}

const chJ = exercice({
  id: "ch-j",
  titre: "Sons ch / j : le train et l'abeille",
  niveaux: [
    { niveau: 1, consigne: "Écoute et montre." },
    { niveau: 2, consigne: "Répète des syllabes : cha, ja." },
    { niveau: 3, consigne: "Nomme les images." },
  ],
});
const voix = exercice({
  id: "voix",
  titre: "La sirène",
  categorie: { id: "c2", nom: "Voix", slug: "voix" },
  ageMin: 8,
  ageMax: 99,
  dureeMinutes: 5,
  materiel: ["Paille"],
});
const lecture = exercice({
  id: "lecture",
  titre: "Lecture flash",
  categorie: { id: "c3", nom: "Langage écrit", slug: "langage-ecrit" },
  ageMin: 6,
  ageMax: 11,
  dureeMinutes: 15,
  perso: true,
  favori: true,
});
const tous = [chJ, voix, lecture];
const ids = (liste: ExerciceBibliotheque[]) => liste.map((e) => e.id);
const avec = (f: Partial<typeof FILTRES_VIDES>) => ({ ...FILTRES_VIDES, ...f });

describe("recherche", () => {
  it("trouve « sons ch / j »", () => {
    expect(ids(filtrerExercices(tous, avec({ q: "sons ch / j" })))).toEqual(["ch-j"]);
  });

  it("ignore majuscules et accents", () => {
    expect(ids(filtrerExercices(tous, avec({ q: "SIRENE" })))).toEqual(["voix"]);
    expect(ids(filtrerExercices(tous, avec({ q: "écrit" })))).toEqual(["lecture"]);
    expect(ids(filtrerExercices(tous, avec({ q: "ecrit" })))).toEqual(["lecture"]);
  });

  it("cherche aussi dans le matériel, la catégorie et les consignes des niveaux", () => {
    expect(ids(filtrerExercices(tous, avec({ q: "paille" })))).toEqual(["voix"]);
    expect(ids(filtrerExercices(tous, avec({ q: "syllabes" })))).toEqual(["ch-j"]);
  });

  it("exige tous les mots (début de mot)", () => {
    expect(ids(filtrerExercices(tous, avec({ q: "lecture sirène" })))).toEqual([]);
    expect(ids(filtrerExercices(tous, avec({ q: "lect" })))).toEqual(["lecture"]);
  });

  it("une recherche vide garde tout, dans l'ordre", () => {
    expect(ids(filtrerExercices(tous, FILTRES_VIDES))).toEqual(["ch-j", "voix", "lecture"]);
  });

  it("découpe les mots sans accents", () => {
    expect(motsNormalises("Sons ch / j : l'abeille")).toEqual(["sons", "ch", "j", "l", "abeille"]);
  });
});

describe("filtres", () => {
  it("par pathologie", () => {
    expect(ids(filtrerExercices(tous, avec({ pathologie: "voix" })))).toEqual(["voix"]);
  });

  it("par âge : l'exercice doit convenir à l'âge donné", () => {
    expect(ids(filtrerExercices(tous, avec({ age: 5 })))).toEqual(["ch-j"]);
    expect(ids(filtrerExercices(tous, avec({ age: 30 })))).toEqual(["voix"]);
    expect(ids(filtrerExercices(tous, avec({ age: 10 })))).toEqual(["ch-j", "voix", "lecture"]);
  });

  it("par durée maximale", () => {
    expect(ids(filtrerExercices(tous, avec({ dureeMax: 5 })))).toEqual(["voix"]);
    expect(ids(filtrerExercices(tous, avec({ dureeMax: 10 })))).toEqual(["ch-j", "voix"]);
  });

  it("par niveau : aucun exercice retiré, la recherche porte sur la consigne de ce niveau", () => {
    expect(ids(filtrerExercices(tous, avec({ niveau: 2 })))).toHaveLength(3);
    expect(ids(filtrerExercices(tous, avec({ niveau: 2, q: "syllabes" })))).toEqual(["ch-j"]);
    expect(ids(filtrerExercices(tous, avec({ niveau: 1, q: "syllabes" })))).toEqual([]);
  });

  it("« Mes exercices » et favoris", () => {
    expect(ids(filtrerExercices(tous, avec({ mesExercices: true })))).toEqual(["lecture"]);
    expect(ids(filtrerExercices(tous, avec({ favoris: true })))).toEqual(["lecture"]);
  });

  it("combine les filtres", () => {
    expect(ids(filtrerExercices(tous, avec({ q: "sons ch / j", niveau: 2, age: 7 })))).toEqual([
      "ch-j",
    ]);
    expect(ids(filtrerExercices(tous, avec({ q: "sons ch / j", pathologie: "voix" })))).toEqual([]);
  });
});

describe("pré-réglage selon le patient", () => {
  it("règle la pathologie (la première du patient) et l'âge", () => {
    const f = filtresPourPatient({ id: "p", prenom: "Léa", age: 7, pathologies: ["voix", "x"] });
    expect(f).toEqual({ ...FILTRES_VIDES, pathologie: "voix", age: 7 });
  });

  it("patient sans pathologie : seulement l'âge", () => {
    expect(filtresPourPatient({ id: "p", prenom: "A", age: 30, pathologies: [] })).toEqual({
      ...FILTRES_VIDES,
      age: 30,
    });
  });

  it("sans patient (mode complet) : aucun filtre", () => {
    expect(filtresPourPatient(undefined)).toEqual(FILTRES_VIDES);
  });
});

describe("formats", () => {
  it("lit les filtres depuis l'URL", () => {
    const f = filtresBibliothequeSchema.parse({ q: "ch", niveau: "2", age: "7", favoris: "1" });
    expect(f).toEqual({ ...FILTRES_VIDES, q: "ch", niveau: 2, age: 7, favoris: true });
    expect(filtresBibliothequeSchema.safeParse({ niveau: "4" }).success).toBe(false);
  });

  it("un exercice perso a exactement 3 niveaux et des âges cohérents", () => {
    const base = {
      titre: "T",
      description: "D",
      categorieId: "c",
      ageMin: 4,
      ageMax: 8,
      dureeMinutes: 10,
      apercuConsigne: "C",
    };
    expect(exerciceSchema.safeParse({ ...base, niveaux: ["a", "b", "c"] }).success).toBe(true);
    expect(exerciceSchema.safeParse({ ...base, niveaux: ["a", "b"] }).success).toBe(false);
    expect(exerciceSchema.safeParse({ ...base, niveaux: ["a", "b", ""] }).success).toBe(false);
    expect(exerciceSchema.safeParse({ ...base, ageMin: 9, niveaux: ["a", "b", "c"] }).success).toBe(
      false,
    );
  });
});
