import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as lister, POST as creer } from "@/app/api/exercices/route";
import { DELETE as supprimer, GET as lire, PUT as modifier } from "@/app/api/exercices/[id]/route";
import {
  DELETE as retirerFavori,
  PUT as marquerFavori,
} from "@/app/api/exercices/[id]/favori/route";
import { db } from "@/lib/serveur/db";
import {
  appeler,
  creerCabinet,
  creerCompte,
  creerPatient,
  jetonMobile,
  jetonWeb,
  unique,
} from "./outils";

// Bibliothèque : exercices communs + exercices du cabinet, recherche, filtres,
// « Mes exercices », favoris, et cloison entre cabinets.

let cabA: { id: string };
let orthoA: { id: string };
let cookieA: string;
let cookieA2: string;
let cookieB: string;
let categorie: { id: string; slug: string };
let commun: { id: string };
let marque: string;

const url = (params: Record<string, string>) =>
  `http://localhost:3000/api/exercices?${new URLSearchParams(params).toString()}`;
const ids = (r: { corps: Record<string, unknown> }) =>
  (r.corps.exercices as { id: string }[]).map((e) => e.id);

function corpsExercice(champs: Record<string, unknown> = {}) {
  return {
    titre: `Mon exercice ${marque}`,
    description: "Exercice fictif créé pendant les tests.",
    categorieId: categorie.id,
    ageMin: 5,
    ageMax: 9,
    dureeMinutes: 10,
    materiel: ["Cartes"],
    apercuConsigne: "Consigne courte fictive.",
    niveaux: [
      "Consigne fictive niveau 1",
      "Consigne fictive niveau 2",
      "Consigne fictive niveau 3",
    ],
    ...champs,
  };
}

beforeAll(async () => {
  marque = `m${unique()}`;
  cabA = await creerCabinet();
  const cabB = await creerCabinet();
  orthoA = await creerCompte("ORTHO", cabA.id);
  cookieA = await jetonWeb(orthoA.id);
  cookieA2 = await jetonWeb((await creerCompte("ORTHO", cabA.id)).id);
  cookieB = await jetonWeb((await creerCompte("ORTHO", cabB.id)).id);
  const slug = `articulation-${marque}`;
  categorie = await db().categorie.create({ data: { nom: `Articulation ${marque}`, slug } });
  commun = await db().exercice.create({
    data: {
      categorieId: categorie.id,
      titre: `Sons ch / j ${marque}`,
      description: "Exemple fictif.",
      ageMin: 4,
      ageMax: 9,
      dureeMinutes: 10,
      materiel: ["Miroir"],
      apercuConsigne: "Fais le train ou l'abeille.",
      aValider: true,
      niveaux: {
        create: [
          { niveau: 1, consigne: "Écoute et montre." },
          { niveau: 2, consigne: "Répète des syllabes." },
          { niveau: 3, consigne: "Nomme les images." },
        ],
      },
    },
  });
});
afterAll(() => db().$disconnect());

describe("recherche et filtres par l'API", () => {
  it("trouve « sons ch / j », avec l'étiquette « à valider »", async () => {
    const r = await appeler(lister, { cookie: cookieA, url: url({ q: `sons ch / j ${marque}` }) });
    expect(r.status).toBe(200);
    expect(ids(r)).toEqual([commun.id]);
    expect(r.corps.exercices[0]).toMatchObject({ aValider: true, perso: false });
    expect(r.corps.exercices[0].niveaux.map((n: { niveau: number }) => n.niveau)).toEqual([
      1, 2, 3,
    ]);
  });

  it("filtre par niveau 2 (la recherche porte sur la consigne de ce niveau)", async () => {
    const q = `syllabes ${marque}`;
    expect(ids(await appeler(lister, { cookie: cookieA, url: url({ q, niveau: "2" }) }))).toEqual([
      commun.id,
    ]);
    expect(ids(await appeler(lister, { cookie: cookieA, url: url({ q, niveau: "1" }) }))).toEqual(
      [],
    );
  });

  it("filtre par pathologie, âge et durée", async () => {
    const base = { q: marque };
    const f = async (p: Record<string, string>) =>
      ids(await appeler(lister, { cookie: cookieA, url: url({ ...base, ...p }) }));
    expect(await f({ pathologie: categorie.slug })).toContain(commun.id);
    expect(await f({ pathologie: "voix" })).toEqual([]);
    expect(await f({ age: "7" })).toContain(commun.id);
    expect(await f({ age: "15" })).toEqual([]);
    expect(await f({ dureeMax: "5" })).toEqual([]);
    expect(await f({ dureeMax: "10" })).toContain(commun.id);
  });

  it("refuse un filtre invalide", async () => {
    const r = await appeler(lister, { cookie: cookieA, url: url({ niveau: "4" }) });
    expect(r.status).toBe(400);
  });

  it("ÉCHEC : les familles n'ont pas accès à la bibliothèque", async () => {
    const parent = await creerCompte("PARENT", cabA.id);
    const r = await appeler(lister, { bearer: await jetonMobile(parent.id) });
    expect(r.status).toBe(404);
  });
});

describe("Mes exercices", () => {
  it("crée un exercice perso avec ses 3 niveaux, dans le cabinet, non marqué « à valider »", async () => {
    const r = await appeler(creer, {
      cookie: cookieA,
      corps: corpsExercice({ cabinetId: "pirate" }),
    });
    expect(r.status).toBe(201);
    expect(r.corps.exercice).toMatchObject({ perso: true, aValider: false });
    expect(r.corps.exercice.niveaux).toEqual([
      { niveau: 1, consigne: "Consigne fictive niveau 1" },
      { niveau: 2, consigne: "Consigne fictive niveau 2" },
      { niveau: 3, consigne: "Consigne fictive niveau 3" },
    ]);
    const enBase = await db().exercice.findUniqueOrThrow({ where: { id: r.corps.exercice.id } });
    expect(enBase.cabinetId).toBe(cabA.id);
    expect(enBase.auteurId).toBe(orthoA.id);
    // Visible dans « Mes exercices » pour un collègue du même cabinet.
    const mes = await appeler(lister, {
      cookie: cookieA2,
      url: url({ mesExercices: "1", q: marque }),
    });
    expect(ids(mes)).toEqual([r.corps.exercice.id]);
  });

  it("refuse un exercice sans ses 3 niveaux", async () => {
    const r = await appeler(creer, {
      cookie: cookieA,
      corps: corpsExercice({ niveaux: ["Un", "Deux"] }),
    });
    expect(r.status).toBe(400);
  });

  it("modifie son exercice (y compris les consignes des niveaux)", async () => {
    const cree = (await appeler(creer, { cookie: cookieA, corps: corpsExercice() })).corps.exercice;
    const r = await appeler(modifier, {
      methode: "PUT",
      cookie: cookieA,
      params: { id: cree.id },
      corps: corpsExercice({ titre: "Titre modifié", niveaux: ["A", "B modifié", "C"] }),
    });
    expect(r.status).toBe(200);
    expect(r.corps.exercice.titre).toBe("Titre modifié");
    expect(r.corps.exercice.niveaux[1]).toEqual({ niveau: 2, consigne: "B modifié" });
  });

  it("ÉCHEC : personne ne modifie ni ne supprime un exercice commun", async () => {
    const m = await appeler(modifier, {
      methode: "PUT",
      cookie: cookieA,
      params: { id: commun.id },
      corps: corpsExercice(),
    });
    expect(m.status).toBe(404);
    const s = await appeler(supprimer, {
      methode: "DELETE",
      cookie: cookieA,
      params: { id: commun.id },
    });
    expect(s.status).toBe(404);
  });

  it("ÉCHEC : un autre cabinet ne voit, ne modifie ni ne supprime l'exercice", async () => {
    const cree = (await appeler(creer, { cookie: cookieA, corps: corpsExercice() })).corps.exercice;
    expect(ids(await appeler(lister, { cookie: cookieB, url: url({ q: marque }) }))).not.toContain(
      cree.id,
    );
    expect((await appeler(lire, { cookie: cookieB, params: { id: cree.id } })).status).toBe(404);
    const m = await appeler(modifier, {
      methode: "PUT",
      cookie: cookieB,
      params: { id: cree.id },
      corps: corpsExercice({ titre: "Piraté" }),
    });
    expect(m.status).toBe(404);
    const s = await appeler(supprimer, {
      methode: "DELETE",
      cookie: cookieB,
      params: { id: cree.id },
    });
    expect(s.status).toBe(404);
    expect((await db().exercice.findUniqueOrThrow({ where: { id: cree.id } })).titre).not.toBe(
      "Piraté",
    );
  });

  it("supprime son exercice, sauf s'il est utilisé dans un programme", async () => {
    const libre = (await appeler(creer, { cookie: cookieA, corps: corpsExercice() })).corps
      .exercice;
    const r = await appeler(supprimer, {
      methode: "DELETE",
      cookie: cookieA,
      params: { id: libre.id },
    });
    expect(r.status).toBe(204);

    const utilise = (await appeler(creer, { cookie: cookieA, corps: corpsExercice() })).corps
      .exercice;
    const patient = await creerPatient(cabA.id);
    await db().programme.create({
      data: {
        patientId: patient.id,
        titre: "Programme fictif",
        dateDebut: new Date(),
        elements: { create: { exerciceId: utilise.id, niveau: 2, foisParSemaine: 3 } },
      },
    });
    const refus = await appeler(supprimer, {
      methode: "DELETE",
      cookie: cookieA,
      params: { id: utilise.id },
    });
    expect(refus.status).toBe(409);
  });
});

describe("favoris", () => {
  it("chaque orthophoniste a ses propres favoris", async () => {
    const r = await appeler(marquerFavori, {
      methode: "PUT",
      cookie: cookieA,
      params: { id: commun.id },
    });
    expect(r.status).toBe(204);
    const favA = await appeler(lister, { cookie: cookieA, url: url({ favoris: "1", q: marque }) });
    expect(ids(favA)).toEqual([commun.id]);
    expect(favA.corps.exercices[0].favori).toBe(true);
    const favA2 = await appeler(lister, {
      cookie: cookieA2,
      url: url({ favoris: "1", q: marque }),
    });
    expect(ids(favA2)).toEqual([]);

    await appeler(retirerFavori, { methode: "DELETE", cookie: cookieA, params: { id: commun.id } });
    expect(
      ids(await appeler(lister, { cookie: cookieA, url: url({ favoris: "1", q: marque }) })),
    ).toEqual([]);
  });

  it("ÉCHEC : pas de favori sur l'exercice d'un autre cabinet", async () => {
    const cree = (await appeler(creer, { cookie: cookieA, corps: corpsExercice() })).corps.exercice;
    const r = await appeler(marquerFavori, {
      methode: "PUT",
      cookie: cookieB,
      params: { id: cree.id },
    });
    expect(r.status).toBe(404);
  });
});
