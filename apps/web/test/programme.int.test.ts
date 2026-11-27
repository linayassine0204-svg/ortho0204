import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as brouillon } from "@/app/api/patients/[id]/programme/route";
import { POST as ajouter } from "@/app/api/patients/[id]/programme/elements/route";
import {
  DELETE as retirer,
  PATCH as modifier,
} from "@/app/api/patients/[id]/programme/elements/[elementId]/route";
import { POST as ajuster } from "@/app/api/patients/[id]/programme/elements/[elementId]/ajuster/route";
import { PUT as ordre } from "@/app/api/patients/[id]/programme/ordre/route";
import { POST as envoyer } from "@/app/api/patients/[id]/programme/envoi/route";
import { GET as semaine } from "@/app/api/patients/[id]/programme/semaine/route";
import { GET as jour } from "@/app/api/patients/[id]/programme/jour/route";
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

// Programme à la maison : composition (comme depuis le panneau Bibliothèque), envoi,
// lecture par la famille, et refus pour les autres.

let cabA: { id: string };
let cookieOrtho: string;
let cookieOrthoB: string;
let exercices: string[];
let exerciceAutreCabinet: string;

async function exercice(cabinetId: string | null, titre: string) {
  const categorie = await db().categorie.create({
    data: { nom: `Cat ${unique()}`, slug: `cat-${unique()}` },
  });
  const e = await db().exercice.create({
    data: {
      categorieId: categorie.id,
      cabinetId,
      titre,
      description: "Exercice fictif.",
      ageMin: 4,
      ageMax: 10,
      dureeMinutes: 10,
      materiel: ["Miroir"],
      apercuConsigne: "Consigne courte fictive.",
      aValider: cabinetId === null,
      niveaux: {
        create: [1, 2, 3].map((niveau) => ({ niveau, consigne: `${titre} — consigne ${niveau}` })),
      },
    },
  });
  return e.id;
}

/** Patient du cabinet A, avec un parent relié et consentant. */
async function famille() {
  const parent = await creerCompte("PARENT", cabA.id);
  const patient = await creerPatient(cabA.id, { tuteurIds: [parent.id] });
  return { parent, patient, bearer: await jetonMobile(parent.id) };
}

const ajout = (patientId: string, corps: Record<string, unknown>, cookie = cookieOrtho) =>
  appeler(ajouter, { cookie, params: { id: patientId }, corps });

beforeAll(async () => {
  cabA = await creerCabinet();
  const cabB = await creerCabinet();
  cookieOrtho = await jetonWeb((await creerCompte("ORTHO", cabA.id)).id);
  cookieOrthoB = await jetonWeb((await creerCompte("ORTHO", cabB.id)).id);
  exercices = [
    await exercice(null, "Sons ch / j"),
    await exercice(null, "Le lion qui ronronne"),
    await exercice(cabA.id, "Loto des sons (perso)"),
  ];
  exerciceAutreCabinet = await exercice(cabB.id, "Exercice d'un autre cabinet");
});
afterAll(() => db().$disconnect());

describe("composition du programme", () => {
  it("ajoute 3 exercices (exercice + niveau choisis dans la bibliothèque), dans l'ordre", async () => {
    const { patient } = await famille();
    for (const [i, exerciceId] of exercices.entries()) {
      const r = await ajout(patient.id, { exerciceId, niveau: i + 1 });
      expect(r.status).toBe(201);
      expect(r.corps.element).toMatchObject({
        exerciceId,
        niveau: i + 1,
        foisParSemaine: 3,
        jours: [],
      });
      expect(r.corps.element.consigne).toMatch(new RegExp(`consigne ${i + 1}$`));
    }
    const b = await appeler(brouillon, { cookie: cookieOrtho, params: { id: patient.id } });
    expect(b.corps.elements.map((e: { exerciceId: string }) => e.exerciceId)).toEqual(exercices);
    expect(b.corps.derniereVersion).toBeNull();
  });

  it("règle niveau, jours (le rythme suit les jours) et mot pour la famille", async () => {
    const { patient } = await famille();
    const el = (await ajout(patient.id, { exerciceId: exercices[0], niveau: 1 })).corps.element;
    const r = await appeler(modifier, {
      methode: "PATCH",
      cookie: cookieOrtho,
      params: { id: patient.id, elementId: el.elementId },
      corps: { niveau: 2, jours: ["VENDREDI", "LUNDI"], motFamille: "Après le goûter." },
    });
    expect(r.status).toBe(200);
    expect(r.corps.element).toMatchObject({
      niveau: 2,
      jours: ["LUNDI", "VENDREDI"],
      foisParSemaine: 2,
      motFamille: "Après le goûter.",
    });
    // Avec des jours fixés, un nombre de fois incohérent est refusé.
    const incoherent = await appeler(modifier, {
      methode: "PATCH",
      cookie: cookieOrtho,
      params: { id: patient.id, elementId: el.elementId },
      corps: { foisParSemaine: 5 },
    });
    expect(incoherent.status).toBe(400);
  });

  it("monte et baisse d'un niveau en un clic, dans les limites 1 à 3", async () => {
    const { patient } = await famille();
    const el = (await ajout(patient.id, { exerciceId: exercices[0], niveau: 2 })).corps.element;
    const clic = (sens: string) =>
      appeler(ajuster, {
        cookie: cookieOrtho,
        params: { id: patient.id, elementId: el.elementId },
        corps: { sens },
      });
    const haut = await clic("monter");
    expect(haut.corps.element).toMatchObject({ niveau: 3, consigne: "Sons ch / j — consigne 3" });
    expect((await clic("monter")).status).toBe(409);
    expect((await clic("baisser")).corps.element.niveau).toBe(2);
    expect((await clic("baisser")).corps.element.niveau).toBe(1);
    expect((await clic("baisser")).status).toBe(409);
  });

  it("réordonne et retire (retrait doux : la ligne reste en base)", async () => {
    const { patient } = await famille();
    const ids: string[] = [];
    const id = (i: number) => ids[i] as string;
    for (const exerciceId of exercices) {
      ids.push((await ajout(patient.id, { exerciceId, niveau: 1 })).corps.element.elementId);
    }
    const nouvelOrdre = [id(2), id(0), id(1)];
    const r = await appeler(ordre, {
      methode: "PUT",
      cookie: cookieOrtho,
      params: { id: patient.id },
      corps: { elementIds: nouvelOrdre },
    });
    expect(r.status).toBe(204);
    // Une liste incomplète est refusée.
    const incomplet = await appeler(ordre, {
      methode: "PUT",
      cookie: cookieOrtho,
      params: { id: patient.id },
      corps: { elementIds: [id(0)] },
    });
    expect(incomplet.status).toBe(400);

    const d = await appeler(retirer, {
      methode: "DELETE",
      cookie: cookieOrtho,
      params: { id: patient.id, elementId: id(0) },
    });
    expect(d.status).toBe(204);
    const b = await appeler(brouillon, { cookie: cookieOrtho, params: { id: patient.id } });
    expect(b.corps.elements.map((e: { elementId: string }) => e.elementId)).toEqual([
      ids[2],
      ids[1],
    ]);
    expect(await db().elementProgramme.count({ where: { id: id(0) } })).toBe(1);
  });

  it("ÉCHEC : exercice d'un autre cabinet, ou inexistant", async () => {
    const { patient } = await famille();
    expect((await ajout(patient.id, { exerciceId: exerciceAutreCabinet, niveau: 1 })).status).toBe(
      404,
    );
    expect((await ajout(patient.id, { exerciceId: "inexistant", niveau: 1 })).status).toBe(404);
  });

  it("ÉCHEC : un orthophoniste d'un autre cabinet ne voit ni ne modifie le programme", async () => {
    const { patient } = await famille();
    const el = (await ajout(patient.id, { exerciceId: exercices[0], niveau: 1 })).corps.element;
    expect(
      (await appeler(brouillon, { cookie: cookieOrthoB, params: { id: patient.id } })).status,
    ).toBe(404);
    expect(
      (await ajout(patient.id, { exerciceId: exercices[1], niveau: 1 }, cookieOrthoB)).status,
    ).toBe(404);
    const m = await appeler(modifier, {
      methode: "PATCH",
      cookie: cookieOrthoB,
      params: { id: patient.id, elementId: el.elementId },
      corps: { niveau: 3 },
    });
    expect(m.status).toBe(404);
    expect(
      (await appeler(envoyer, { cookie: cookieOrthoB, params: { id: patient.id } })).status,
    ).toBe(404);
  });

  it("ÉCHEC : un élément ne se modifie pas en passant par un autre patient", async () => {
    const a = await famille();
    const b = await famille();
    const el = (await ajout(a.patient.id, { exerciceId: exercices[0], niveau: 1 })).corps.element;
    await ajout(b.patient.id, { exerciceId: exercices[0], niveau: 1 });
    const r = await appeler(modifier, {
      methode: "PATCH",
      cookie: cookieOrtho,
      params: { id: b.patient.id, elementId: el.elementId },
      corps: { niveau: 3 },
    });
    expect(r.status).toBe(404);
  });

  it("ÉCHEC : le parent ne lit pas le brouillon et ne compose pas", async () => {
    const { patient, bearer } = await famille();
    expect((await appeler(brouillon, { bearer, params: { id: patient.id } })).status).toBe(404);
    const r = await appeler(ajouter, {
      bearer,
      params: { id: patient.id },
      corps: { exerciceId: exercices[0], niveau: 1 },
    });
    expect(r.status).toBe(404);
  });
});

describe("envoi et lecture par la famille", () => {
  it("compose 3 exercices, envoie, et le parent lit le programme (aperçu, niveau, consigne)", async () => {
    const { patient, bearer, parent } = await famille();
    await ajout(patient.id, {
      exerciceId: exercices[0],
      niveau: 2,
      jours: ["LUNDI", "JEUDI"],
      motFamille: "Bravo !",
    });
    await ajout(patient.id, { exerciceId: exercices[1], niveau: 1 });
    await ajout(patient.id, { exerciceId: exercices[2], niveau: 3, jours: ["JEUDI"] });

    // Avant l'envoi : rien pour la famille.
    const avant = await appeler(semaine, { bearer, params: { id: patient.id } });
    expect(avant.status).toBe(200);
    expect(avant.corps.programme).toBeNull();

    const e = await appeler(envoyer, { cookie: cookieOrtho, params: { id: patient.id } });
    expect(e.status).toBe(201);
    expect(e.corps.version.numero).toBe(1);

    const s = await appeler(semaine, {
      bearer,
      params: { id: patient.id },
      url: "http://localhost:3000/api/test?date=2026-11-26",
    });
    expect(s.status).toBe(200);
    expect(s.corps.programme.version).toBe(1);
    expect(s.corps.programme.elements).toHaveLength(3);
    expect(s.corps.programme.elements[0]).toMatchObject({
      titre: "Sons ch / j",
      niveau: 2,
      consigne: "Sons ch / j — consigne 2",
      apercuConsigne: "Consigne courte fictive.",
      materiel: ["Miroir"],
      dureeMinutes: 10,
      motFamille: "Bravo !",
      aValider: true,
    });
    expect(s.corps.semaine.debut).toBe("2026-11-23");
    const jeudi = s.corps.semaine.jours.find((j: { jour: string }) => j.jour === "JEUDI");
    expect(jeudi.elements.map((x: { titre: string }) => x.titre)).toEqual([
      "Sons ch / j",
      "Loto des sons (perso)",
    ]);
    expect(s.corps.semaine.sansJourFixe.map((x: { titre: string }) => x.titre)).toEqual([
      "Le lion qui ronronne",
    ]);

    const j = await appeler(jour, {
      bearer,
      params: { id: patient.id },
      url: "http://localhost:3000/api/test?date=2026-11-23",
    });
    expect(j.corps.jour.jour).toBe("LUNDI");
    expect(j.corps.jour.elements.map((x: { titre: string }) => x.titre)).toEqual(["Sons ch / j"]);
    expect(j.corps.programme.elements).toBeUndefined();

    // Chaque lecture par la famille est journalisée.
    const journal = await db().journalAcces.count({
      where: { patientId: patient.id, userId: parent.id, section: "programme", action: "LECTURE" },
    });
    expect(journal).toBe(3);
  });

  it("un programme envoyé reste modifiable : la famille voit les changements après un nouvel envoi", async () => {
    const { patient, bearer } = await famille();
    const el = (await ajout(patient.id, { exerciceId: exercices[0], niveau: 1 })).corps.element;
    await appeler(envoyer, { cookie: cookieOrtho, params: { id: patient.id } });

    await appeler(ajuster, {
      cookie: cookieOrtho,
      params: { id: patient.id, elementId: el.elementId },
      corps: { sens: "monter" },
    });
    const b = await appeler(brouillon, { cookie: cookieOrtho, params: { id: patient.id } });
    expect(b.corps.modifieDepuisEnvoi).toBe(true);
    expect(b.corps.derniereVersion.numero).toBe(1);
    // La famille voit encore la version 1, au niveau 1.
    const v1 = await appeler(semaine, { bearer, params: { id: patient.id } });
    expect(v1.corps.programme.elements[0].niveau).toBe(1);

    expect(
      (await appeler(envoyer, { cookie: cookieOrtho, params: { id: patient.id } })).corps.version
        .numero,
    ).toBe(2);
    const v2 = await appeler(semaine, { bearer, params: { id: patient.id } });
    expect(v2.corps.programme.version).toBe(2);
    expect(v2.corps.programme.elements[0].niveau).toBe(2);
    const b2 = await appeler(brouillon, { cookie: cookieOrtho, params: { id: patient.id } });
    expect(b2.corps.modifieDepuisEnvoi).toBe(false);
  });

  it("refuse d'envoyer un programme vide", async () => {
    const { patient } = await famille();
    const r = await appeler(envoyer, { cookie: cookieOrtho, params: { id: patient.id } });
    expect(r.status).toBe(400);
    expect(r.corps.erreur.code).toBe("programme_vide");
  });

  it("liste les destinataires : seulement les comptes qui ont consenti", async () => {
    const parentOk = await creerCompte("PARENT", cabA.id);
    const parentSans = await creerCompte("PARENT", cabA.id);
    const patient = await creerPatient(cabA.id, { tuteurIds: [parentOk.id] });
    await db().lienTuteur.create({ data: { parentId: parentSans.id, patientId: patient.id } });
    const b = await appeler(brouillon, { cookie: cookieOrtho, params: { id: patient.id } });
    expect(b.corps.destinataires.map((d: { id: string }) => d.id)).toEqual([parentOk.id]);
  });

  it("ÉCHEC : un autre parent ne reçoit pas le programme (404)", async () => {
    const { patient } = await famille();
    await ajout(patient.id, { exerciceId: exercices[0], niveau: 1 });
    await appeler(envoyer, { cookie: cookieOrtho, params: { id: patient.id } });
    const autre = await famille(); // même cabinet, autre enfant
    const r = await appeler(semaine, { bearer: autre.bearer, params: { id: patient.id } });
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.corps)).not.toContain("Sons ch / j");
    const parentAilleurs = await creerCompte("PARENT", (await creerCabinet()).id);
    const r2 = await appeler(jour, {
      bearer: await jetonMobile(parentAilleurs.id),
      params: { id: patient.id },
    });
    expect(r2.status).toBe(404);
  });

  it("ÉCHEC : sans consentement, le parent relié ne reçoit rien (403)", async () => {
    const parent = await creerCompte("PARENT", cabA.id);
    const patient = await creerPatient(cabA.id, { tuteurIds: [parent.id], consentement: false });
    await ajout(patient.id, { exerciceId: exercices[0], niveau: 1 });
    await appeler(envoyer, { cookie: cookieOrtho, params: { id: patient.id } });
    const r = await appeler(semaine, {
      bearer: await jetonMobile(parent.id),
      params: { id: patient.id },
    });
    expect(r.status).toBe(403);
    expect(r.corps.erreur.code).toBe("consentement_requis");
  });

  it("le patient adulte lit son propre programme", async () => {
    const compte = await creerCompte("PATIENT_ADULT", cabA.id);
    const patient = await creerPatient(cabA.id, { age: 30, compteUserId: compte.id });
    await ajout(patient.id, { exerciceId: exercices[1], niveau: 2 });
    await appeler(envoyer, { cookie: cookieOrtho, params: { id: patient.id } });
    const r = await appeler(semaine, {
      bearer: await jetonMobile(compte.id),
      params: { id: patient.id },
    });
    expect(r.corps.programme.elements[0]).toMatchObject({
      niveau: 2,
      titre: "Le lion qui ronronne",
    });
  });

  it("refuse une date invalide", async () => {
    const { patient, bearer } = await famille();
    const r = await appeler(jour, {
      bearer,
      params: { id: patient.id },
      url: "http://localhost:3000/api/test?date=2026-02-30",
    });
    expect(r.status).toBe(400);
  });
});
