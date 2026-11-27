import { describe, expect, it } from "vitest";
import { CONSEILS_MODELES } from "../../db/src/seed/bibliotheque.ts";
import {
  ageDansTranche,
  conseilsProposes,
  contenuConseilSchema,
  convientAuPatient,
  debutDuJour,
  datePassee,
  echeance,
  envoiConseilSchema,
  lignes,
  memeContenu,
  planificationSchema,
  plusSemaines,
  premierEnvoi,
  type ConseilModele,
} from "./conseils";

// Les 16 conseils pré-faits du seed, au format de l'écran.
const MODELES: ConseilModele[] = CONSEILS_MODELES.map((c) => ({
  id: c.cle,
  titre: c.titre,
  aFaire: c.aFaire,
  aEviter: c.aEviter,
  ageMin: c.ageMin,
  ageMax: c.ageMax,
  pathologies: c.categories.map((slug) => ({ slug, nom: slug })),
  aValider: true,
}));

function modele(partiel: Partial<ConseilModele>): ConseilModele {
  return {
    id: "m",
    titre: "Conseil",
    aFaire: ["a"],
    aEviter: [],
    ageMin: null,
    ageMax: null,
    pathologies: [{ slug: "langage-oral", nom: "Langage oral" }],
    aValider: true,
    ...partiel,
  };
}

describe("règle de proposition (filtre sur les étiquettes)", () => {
  it("Léa (langage oral, 7 ans) : seulement des conseils de langage oral pour son âge", () => {
    const proposes = conseilsProposes(MODELES, { age: 7, pathologies: ["langage-oral"] });
    expect(proposes.map((m) => m.id).sort()).toEqual([
      "jeux-de-mots",
      "raconter-sa-journee",
      "reformuler",
    ]);
    for (const m of proposes) {
      expect(m.pathologies.map((p) => p.slug)).toContain("langage-oral");
      expect(ageDansTranche(7, m)).toBe(true);
    }
  });

  it("écarte les conseils de langage oral hors de sa tranche d'âge (tout-petits, ados)", () => {
    const ids = conseilsProposes(MODELES, { age: 7, pathologies: ["langage-oral"] }).map(
      (m) => m.id,
    );
    expect(ids).not.toContain("parler-en-jouant"); // 2–4 ans
    expect(ids).not.toContain("expliquer-avec-ses-mots"); // 12–18 ans
  });

  it("Léa du seed (langage oral + langage écrit, 7 ans) : les deux pathologies, rien d'autre", () => {
    const proposes = conseilsProposes(MODELES, {
      age: 7,
      pathologies: ["langage-ecrit", "langage-oral"],
    });
    expect(proposes.map((m) => m.id).sort()).toEqual([
      "devoirs-sans-tension",
      "jeux-de-mots",
      "lecture-partagee",
      "raconter-sa-journee",
      "reformuler",
    ]);
  });

  it("met d'abord les conseils qui touchent le plus de pathologies du patient, puis par titre", () => {
    const proposes = conseilsProposes(
      [
        modele({ id: "b", titre: "B" }),
        modele({ id: "a", titre: "A" }),
        modele({
          id: "z",
          titre: "Z",
          pathologies: [
            { slug: "langage-oral", nom: "" },
            { slug: "articulation", nom: "" },
          ],
        }),
      ],
      { age: 5, pathologies: ["langage-oral", "articulation"] },
    );
    expect(proposes.map((m) => m.id)).toEqual(["z", "a", "b"]);
  });

  it("bornes d'âge comprises ; borne absente = pas de limite", () => {
    expect(ageDansTranche(5, { ageMin: 5, ageMax: 10 })).toBe(true);
    expect(ageDansTranche(10, { ageMin: 5, ageMax: 10 })).toBe(true);
    expect(ageDansTranche(4, { ageMin: 5, ageMax: 10 })).toBe(false);
    expect(ageDansTranche(11, { ageMin: 5, ageMax: 10 })).toBe(false);
    expect(ageDansTranche(80, { ageMin: 12, ageMax: null })).toBe(true);
    expect(ageDansTranche(1, { ageMin: null, ageMax: 6 })).toBe(true);
  });

  it("aucune pathologie en commun : jamais proposé, même à l'âge parfait", () => {
    expect(convientAuPatient(modele({}), { age: 7, pathologies: ["voix"] })).toBe(false);
  });

  it("patient sans pathologie renseignée : aucune proposition", () => {
    expect(conseilsProposes(MODELES, { age: 7, pathologies: [] })).toEqual([]);
  });

  it("adulte avec trouble de la voix : seulement les conseils voix adultes", () => {
    const ids = conseilsProposes(MODELES, { age: 34, pathologies: ["voix"] }).map((m) => m.id);
    expect(ids).toEqual(["hydratation-voix"]);
  });
});

describe("contenu d'un conseil", () => {
  it("découpe le texte saisi en lignes (puces et lignes vides retirées)", () => {
    expect(lignes("- Lire ensemble\n\n• Jouer\n  3. Chanter  \n*  Rire\r\nfin")).toEqual([
      "Lire ensemble",
      "Jouer",
      "Chanter",
      "Rire",
      "fin",
    ]);
  });

  it("exige un titre et au moins une ligne dans « À faire » ou « À éviter »", () => {
    expect(contenuConseilSchema.safeParse({ titre: "T", aFaire: ["x"], aEviter: [] }).success).toBe(
      true,
    );
    expect(contenuConseilSchema.safeParse({ titre: "T", aFaire: [], aEviter: ["x"] }).success).toBe(
      true,
    );
    expect(contenuConseilSchema.safeParse({ titre: "T", aFaire: [], aEviter: [] }).success).toBe(
      false,
    );
    expect(contenuConseilSchema.safeParse({ titre: " ", aFaire: ["x"], aEviter: [] }).success).toBe(
      false,
    );
    const trop = Array.from({ length: 11 }, (_, i) => `ligne ${i}`);
    expect(contenuConseilSchema.safeParse({ titre: "T", aFaire: trop, aEviter: [] }).success).toBe(
      false,
    );
  });

  it("envoi : un modèle, un contenu, ou les deux ; jamais rien", () => {
    const contenu = { titre: "T", aFaire: ["x"], aEviter: [] };
    expect(envoiConseilSchema.safeParse({ modeleId: "m" }).success).toBe(true);
    expect(envoiConseilSchema.safeParse({ contenu }).success).toBe(true);
    expect(envoiConseilSchema.safeParse({ modeleId: "m", contenu }).success).toBe(true);
    expect(envoiConseilSchema.safeParse({}).success).toBe(false);
    expect(envoiConseilSchema.parse({ modeleId: "m" }).planification).toEqual({
      repetition: "UNE_FOIS",
    });
  });

  it("compare deux contenus (modèle modifié ou non)", () => {
    const a = { titre: "T", aFaire: ["x", "y"], aEviter: ["z"] };
    expect(memeContenu(a, { ...a })).toBe(true);
    expect(memeContenu(a, { ...a, aFaire: ["y", "x"] })).toBe(false);
    expect(memeContenu(a, { ...a, titre: "U" })).toBe(false);
  });
});

describe("répétition", () => {
  // Vendredi 27 novembre 2026, 10 h à Paris (UTC+1).
  const MAINTENANT = new Date("2026-11-27T09:00:00Z");

  it("planification : répétition limitée à une fois / chaque semaine, date valide", () => {
    expect(planificationSchema.safeParse({ repetition: "HEBDOMADAIRE" }).success).toBe(true);
    expect(planificationSchema.safeParse({ repetition: "QUOTIDIENNE" }).success).toBe(false);
    expect(planificationSchema.safeParse({ date: "2026-02-30" }).success).toBe(false);
    expect(planificationSchema.safeParse({ date: "2026-12-01" }).success).toBe(true);
  });

  it("une date avant aujourd'hui (heure de Paris) est passée", () => {
    expect(datePassee("2026-11-26", MAINTENANT)).toBe(true);
    expect(datePassee("2026-11-27", MAINTENANT)).toBe(false);
  });

  it("premier envoi : maintenant, ou à 00:00 (Paris) le jour choisi", () => {
    expect(premierEnvoi({ repetition: "UNE_FOIS" }, MAINTENANT)).toEqual(MAINTENANT);
    expect(premierEnvoi({ repetition: "UNE_FOIS", date: "2026-11-27" }, MAINTENANT)).toEqual(
      MAINTENANT,
    );
    expect(premierEnvoi({ repetition: "UNE_FOIS", date: "2026-12-01" }, MAINTENANT)).toEqual(
      new Date("2026-11-30T23:00:00Z"),
    );
  });

  it("début du jour à Paris, en heure d'été comme en heure d'hiver", () => {
    expect(debutDuJour("2026-07-14")).toEqual(new Date("2026-07-13T22:00:00Z"));
    expect(debutDuJour("2026-01-05")).toEqual(new Date("2026-01-04T23:00:00Z"));
  });

  it("chaque semaine : même heure à Paris, même après le changement d'heure", () => {
    const lundiEte = new Date("2026-10-19T07:00:00Z"); // lundi 9 h, heure d'été
    expect(plusSemaines(lundiEte, 1)).toEqual(new Date("2026-10-26T08:00:00Z")); // 9 h, hiver
  });

  it("une fois : envoyé à l'heure prévue, puis plus rien", () => {
    const prevu = new Date("2026-11-27T08:00:00Z");
    expect(echeance({ repetition: "UNE_FOIS", prochainEnvoi: prevu }, MAINTENANT)).toEqual({
      envoyerLe: prevu,
      prochain: null,
    });
  });

  it("pas encore l'heure, ou plus rien de prévu : rien à envoyer", () => {
    const futur = new Date("2026-12-01T00:00:00Z");
    expect(echeance({ repetition: "HEBDOMADAIRE", prochainEnvoi: futur }, MAINTENANT)).toEqual({
      envoyerLe: null,
      prochain: futur,
    });
    expect(echeance({ repetition: "UNE_FOIS", prochainEnvoi: null }, MAINTENANT)).toEqual({
      envoyerLe: null,
      prochain: null,
    });
  });

  it("chaque semaine : un seul envoi (le plus récent dû), puis la semaine d'après", () => {
    // Prévu il y a 3 semaines et 1 jour : on n'envoie que l'occurrence d'il y a 1 jour.
    const prevu = new Date("2026-11-05T09:00:00Z");
    expect(echeance({ repetition: "HEBDOMADAIRE", prochainEnvoi: prevu }, MAINTENANT)).toEqual({
      envoyerLe: new Date("2026-11-26T09:00:00Z"),
      prochain: new Date("2026-12-03T09:00:00Z"),
    });
  });

  it("chaque semaine, pile à l'heure : envoyé maintenant, prochain dans 7 jours", () => {
    expect(echeance({ repetition: "HEBDOMADAIRE", prochainEnvoi: MAINTENANT }, MAINTENANT)).toEqual(
      {
        envoyerLe: MAINTENANT,
        prochain: new Date("2026-12-04T09:00:00Z"),
      },
    );
  });
});
