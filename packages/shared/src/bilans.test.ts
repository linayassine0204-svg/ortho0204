import { describe, expect, it } from "vitest";
import {
  actualiserSections,
  compterStatuts,
  creationDocumentSchema,
  exercicesTravailles,
  remplirSource,
  scoresParNiveau,
  statutDocument,
  statutSection,
  type DonneesBilan,
  type SectionDocument,
} from "./bilans.ts";
import { messagesFr } from "./i18n.ts";
import { PATHOLOGIES_MODELES, cleModele, creerSections } from "./modeles-bilans.ts";
import { TYPES_CREABLES } from "./bilans.ts";

// Bilans : statuts des parties, remplissage automatique par règles et modèles.
// Données fictives.

const donnees: DonneesBilan = {
  patient: {
    prenom: "Léa",
    nom: "Exemple",
    dateNaissance: "2019-09-28",
    age: 7,
    pathologies: ["Langage écrit", "Langage oral"],
    medecinNom: "Dr Martin (fictif)",
    medecinContact: "01 00 00 00 00",
  },
  periode: { debut: "2026-10-01", fin: "2026-11-27" },
  seances: [
    {
      jour: "2026-10-23",
      exercices: [
        { titre: "Rimes", niveau: 1 },
        { titre: "Syllabes", niveau: 2 },
      ],
      notes: null,
      pointsAReprendre: null,
    },
    {
      jour: "2026-11-20",
      exercices: [{ titre: "Rimes", niveau: 2 }],
      notes: "Notes fictives.",
      pointsAReprendre: "Point fictif.",
    },
  ],
  maison: {
    depuis: "2026-10-01",
    jusqua: "2026-11-27",
    prevues: 20,
    faites: 15,
    taux: 0.75,
    ressentis: { FACILE: 8, MOYEN: 5, DIFFICILE: 2 },
    lignes: [
      {
        elementId: "e1",
        titre: "Rimes",
        prevues: 12,
        faites: 9,
        taux: 0.75,
        ressentis: { FACILE: 5, MOYEN: 3, DIFFICILE: 1 },
        scoreMoyen: 0.7,
        dernierScore: { score: 8, scoreMax: 10 },
      },
    ],
  },
  scores: [
    { titre: "Rimes", niveau: 1, score: 6, scoreMax: 10 },
    { titre: "Rimes", niveau: 1, score: 8, scoreMax: 10 },
    { titre: "Rimes", niveau: 2, score: 9, scoreMax: 10 },
    { titre: "Lecture", niveau: 1, score: 3, scoreMax: 5 },
  ],
  programme: [{ titre: "Rimes", niveau: 2, foisParSemaine: 3, jours: ["LUNDI"] }],
  seance: null,
};

const section = (s: Partial<SectionDocument>): SectionDocument => ({
  cle: "x",
  titre: "X",
  type: "LIBRE",
  source: null,
  aide: null,
  contenu: "",
  relu: false,
  ...s,
});

describe("statuts", () => {
  it("statut de chaque partie", () => {
    expect(statutSection(section({ type: "LIBRE", contenu: "  " }))).toBe("A_ECRIRE");
    expect(statutSection(section({ type: "LIBRE", contenu: "Exemple", relu: false }))).toBe(
      "A_RELIRE",
    );
    expect(statutSection(section({ type: "LIBRE", contenu: "Écrit", relu: true }))).toBe("REMPLI");
    expect(statutSection(section({ type: "AUTO", contenu: "3 séances", relu: false }))).toBe(
      "AUTOMATIQUE",
    );
    expect(statutSection(section({ type: "AUTO", contenu: "3 séances", relu: true }))).toBe(
      "REMPLI",
    );
  });

  it("statut du document : la partie la plus en retard l'emporte", () => {
    const rempli = section({ contenu: "a", relu: true });
    const auto = section({ type: "AUTO", contenu: "a" });
    const relire = section({ contenu: "a" });
    const ecrire = section({ contenu: "" });
    expect(statutDocument([rempli, rempli])).toBe("REMPLI");
    expect(statutDocument([rempli, auto])).toBe("AUTOMATIQUE");
    expect(statutDocument([auto, relire, rempli])).toBe("A_RELIRE");
    expect(statutDocument([rempli, auto, relire, ecrire])).toBe("A_ECRIRE");
    expect(statutDocument([])).toBe("A_ECRIRE");
    expect(compterStatuts([rempli, auto, auto, ecrire])).toEqual({
      A_ECRIRE: 1,
      A_RELIRE: 0,
      AUTOMATIQUE: 2,
      REMPLI: 1,
    });
  });
});

describe("remplissage automatique", () => {
  it("identité et prescripteur depuis la fiche", () => {
    expect(remplirSource("IDENTITE", donnees)).toBe(
      "Léa Exemple, né(e) le 28/09/2019 (7 ans).\nPrise en charge : Langage écrit, Langage oral.",
    );
    expect(remplirSource("PRESCRIPTEUR", donnees)).toBe(
      "Médecin prescripteur : Dr Martin (fictif) (01 00 00 00 00).",
    );
    expect(
      remplirSource("PRESCRIPTEUR", {
        ...donnees,
        patient: { ...donnees.patient, medecinNom: null },
      }),
    ).toBe("Médecin prescripteur : non renseigné.");
  });

  it("nombre de séances et exercices travaillés (progression de niveau)", () => {
    expect(remplirSource("SEANCES", donnees)).toBe("2 séances, du 23/10/2026 au 20/11/2026.");
    expect(remplirSource("SEANCES", { ...donnees, seances: [] })).toBe(
      "Aucune séance terminée sur la période.",
    );
    expect(exercicesTravailles(donnees.seances)).toEqual([
      { titre: "Rimes", premier: 1, dernier: 2, seances: 2 },
      { titre: "Syllabes", premier: 2, dernier: 2, seances: 1 },
    ]);
    expect(remplirSource("EXERCICES_SEANCES", donnees)).toBe(
      "- Rimes : du niveau 1 au niveau 2 (2 séance(s))\n- Syllabes : niveau 2 (1 séance(s))",
    );
  });

  it("taux de réalisation et ressentis", () => {
    const texte = remplirSource("REALISATION", donnees);
    expect(texte).toContain("À la maison : 15 exercices faits sur 20 prévus (75 %).");
    expect(texte).toContain("Ressenti : 8 facile, 5 moyen, 2 difficile.");
    expect(texte).toContain("- Rimes : 9 sur 12 (75 %)");
    expect(remplirSource("REALISATION", { ...donnees, maison: null })).toBe(
      "Pas de programme à la maison.",
    );
  });

  it("scores moyens par exercice et par niveau", () => {
    expect(scoresParNiveau(donnees.scores)).toEqual([
      { titre: "Lecture", niveau: 1, moyenne: 0.6, nombre: 1 },
      { titre: "Rimes", niveau: 1, moyenne: 0.7, nombre: 2 },
      { titre: "Rimes", niveau: 2, moyenne: 0.9, nombre: 1 },
    ]);
    expect(remplirSource("SCORES_PAR_NIVEAU", donnees)).toBe(
      [
        "- Lecture, niveau 1 : 60 % (1 réalisation)",
        "- Rimes, niveau 1 : 70 % en moyenne (2 réalisations)",
        "- Rimes, niveau 2 : 90 % (1 réalisation)",
      ].join("\n"),
    );
    expect(remplirSource("SCORES_PAR_NIVEAU", { ...donnees, scores: [] })).toBe(
      "Aucun score enregistré sur la période.",
    );
  });

  it("séance du compte rendu : exercices, notes et points à reprendre", () => {
    const avecSeance = { ...donnees, seance: donnees.seances[1] ?? null };
    expect(remplirSource("SEANCE_DU_JOUR", avecSeance)).toBe(
      "Séance du 20/11/2026.\n- Rimes (niveau 2)",
    );
    expect(remplirSource("NOTES_SEANCE", avecSeance)).toBe(
      "Notes : Notes fictives.\nÀ reprendre : Point fictif.",
    );
  });

  it("actualiser : seules les parties automatiques changent, et redeviennent à relire", () => {
    const sections = [
      section({ cle: "s", type: "AUTO", source: "SEANCES", contenu: "ancien", relu: true }),
      section({ cle: "c", contenu: "Texte écrit", relu: true }),
    ];
    const [s, c] = actualiserSections(sections, donnees);
    expect(s).toMatchObject({ contenu: "2 séances, du 23/10/2026 au 20/11/2026.", relu: false });
    expect(c).toEqual(sections[1]);
  });
});

describe("modèles", () => {
  it("bilan d'évolution : chiffres automatiques remplis, parties à écrire vides", () => {
    const sections = creerSections("EVOLUTION", "langage-ecrit", donnees);
    const parCle = Object.fromEntries(sections.map((s) => [s.cle, s]));
    expect(parCle.seances).toMatchObject({ type: "AUTO", source: "SEANCES", relu: false });
    expect(parCle.seances?.contenu).toContain("2 séances");
    expect(parCle.scores?.contenu).toContain("Rimes, niveau 2 : 90 %");
    expect(parCle.conclusion).toMatchObject({ type: "LIBRE", contenu: "" });
    // Aide propre à la pathologie choisie.
    expect(parCle.observations?.aide).toContain("stratégies de lecture");
    expect(statutDocument(sections)).toBe("A_ECRIRE");
  });

  it("bilan initial : anamnèse, tests, observations, conclusion", () => {
    const cles = creerSections("INITIAL", null, donnees).map((s) => s.cle);
    expect(cles).toEqual(
      expect.arrayContaining(["anamnese", "tests", "observations", "conclusion"]),
    );
  });

  it("courriers : texte de départ d'exemple, « À relire », au prénom du patient", () => {
    for (const type of ["COURRIER_MEDECIN", "COURRIER_ECOLE", "COURRIER_ASSURANCE"] as const) {
      const sections = creerSections(type, null, donnees);
      const corps = sections.find((s) => s.cle === "corps");
      expect(corps?.contenu).toContain("Léa");
      expect(corps && statutSection(corps)).toBe("A_RELIRE");
    }
  });

  it("chaque modèle et chaque pathologie ont leurs textes (aucune clé manquante)", () => {
    for (const type of TYPES_CREABLES) {
      for (const pathologie of [null, ...PATHOLOGIES_MODELES]) {
        for (const s of creerSections(type, pathologie, donnees)) {
          expect(s.titre, `${type} ${s.cle}`).not.toMatch(/^web\./);
          expect(s.aide ?? "", `${type} ${s.cle}`).not.toMatch(/^web\./);
          expect(s.contenu, `${type} ${s.cle}`).not.toMatch(/^web\./);
        }
      }
    }
  });

  it("clé du modèle selon la pathologie ; les modèles sont marqués « à valider »", () => {
    expect(cleModele("EVOLUTION", "begaiement")).toBe("EVOLUTION:begaiement");
    expect(cleModele("EVOLUTION", "inconnue")).toBe("EVOLUTION");
    expect(cleModele("COURRIER_ECOLE", "begaiement")).toBe("COURRIER_ECOLE");
    expect(messagesFr.web.bilans.modeles.aValider).toContain("à valider");
  });
});

describe("formats de l'API", () => {
  it("création : période dans l'ordre", () => {
    expect(creationDocumentSchema.safeParse({ type: "EVOLUTION" }).success).toBe(true);
    expect(
      creationDocumentSchema.safeParse({
        type: "EVOLUTION",
        dateDebut: "2026-11-20",
        date: "2026-11-01",
      }).success,
    ).toBe(false);
    expect(creationDocumentSchema.safeParse({ type: "AUTRE" }).success).toBe(false);
  });
});
