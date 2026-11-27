import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as preparation } from "@/app/api/patients/[id]/preparation/route";
import { PATCH as modifierSeance } from "@/app/api/patients/[id]/seances/[seanceId]/route";
import { POST as ajouter } from "@/app/api/patients/[id]/seances/[seanceId]/elements/route";
import {
  DELETE as retirer,
  PATCH as modifierElement,
} from "@/app/api/patients/[id]/seances/[seanceId]/elements/[elementId]/route";
import { POST as reproposer } from "@/app/api/patients/[id]/seances/[seanceId]/proposition/route";
import { POST as terminer } from "@/app/api/patients/[id]/seances/[seanceId]/terminer/route";
import { POST as copier } from "@/app/api/patients/[id]/seances/[seanceId]/copie/route";
import { GET as pdf } from "@/app/api/patients/[id]/seances/[seanceId]/pdf/route";
import { POST as ajouterAuProgramme } from "@/app/api/patients/[id]/programme/elements/route";
import { db } from "@/lib/serveur/db";
import {
  appeler,
  creerCabinet,
  creerCompte,
  creerPatient,
  exiger,
  ipFictive,
  jetonMobile,
  jetonWeb,
  unique,
} from "./outils";

// Préparation de séance : séance PROPOSÉE (règles simples), ajout depuis le panneau
// Bibliothèque, notes, fin de séance, réutilisation, fiche PDF, et droits.
// Données FICTIVES uniquement.

const JOUR_MS = 24 * 60 * 60 * 1000;

let cabA: { id: string };
let cookieOrtho: string;
let cookieOrthoB: string;
let categorie: { id: string; slug: string };
let autreCategorie: { id: string };
const exo: Record<string, string> = {};

async function exercice(
  cle: string,
  options: {
    categorieId?: string;
    cabinetId?: string | null;
    ageMin?: number;
    ageMax?: number;
    materiel?: string[];
  } = {},
) {
  const e = await db().exercice.create({
    data: {
      categorieId: options.categorieId ?? categorie.id,
      cabinetId: options.cabinetId ?? null,
      titre: `${cle} ${unique()}`,
      description: "Exercice fictif.",
      ageMin: options.ageMin ?? 4,
      ageMax: options.ageMax ?? 10,
      dureeMinutes: 10,
      materiel: options.materiel ?? [],
      apercuConsigne: "Consigne courte fictive.",
      scoreMax: 10,
      aValider: (options.cabinetId ?? null) === null,
      niveaux: {
        create: [1, 2, 3].map((niveau) => ({ niveau, consigne: `${cle} : consigne ${niveau}` })),
      },
    },
  });
  exo[cle] = e.id;
  return e;
}

/**
 * Patient de 7 ans (pathologie de test) avec :
 * - une séance terminée il y a 7 jours (exercice B au niveau 2, notes et points) ;
 * - un programme (exercice A au niveau 1) réussi 3 fois depuis (9 sur 10, « facile »).
 */
async function patientPrepare() {
  const parent = await creerCompte("PARENT", cabA.id);
  const patient = await creerPatient(cabA.id, { age: 7, tuteurIds: [parent.id] });
  await db().patientPathologie.create({
    data: { patientId: patient.id, categorieId: categorie.id },
  });
  const ilYa7Jours = new Date(Date.now() - 7 * JOUR_MS);
  const passee = await db().seance.create({
    data: {
      patientId: patient.id,
      date: ilYa7Jours,
      termineeLe: ilYa7Jours,
      notes: "Notes fictives de la dernière séance.",
      pointsAReprendre: "Point fictif à reprendre.",
      elements: { create: [{ exerciceId: exiger(exo.B), niveau: 2, origine: "BIBLIOTHEQUE" }] },
    },
  });
  const programme = await db().programme.create({
    data: {
      patientId: patient.id,
      titre: "Programme fictif",
      dateDebut: new Date(Date.now() - 30 * JOUR_MS),
      elements: {
        create: [{ exerciceId: exiger(exo.A), niveau: 1, foisParSemaine: 3, jours: [] }],
      },
    },
    include: { elements: true },
  });
  const element = exiger(programme.elements[0]);
  await db().realisation.createMany({
    data: [2, 4, 6].map((j) => ({
      elementProgrammeId: element.id,
      date: new Date(Date.now() - j * JOUR_MS),
      fait: true,
      ressenti: "FACILE" as const,
      score: 9,
      scoreMax: 10,
    })),
  });
  return { patient, parent, passee };
}

async function ouvrir(patientId: string, cookie = cookieOrtho) {
  return appeler(preparation, { cookie, params: { id: patientId } });
}

beforeAll(async () => {
  cabA = await creerCabinet();
  const cabB = await creerCabinet();
  cookieOrtho = await jetonWeb((await creerCompte("ORTHO", cabA.id)).id);
  cookieOrthoB = await jetonWeb((await creerCompte("ORTHO", cabB.id)).id);
  categorie = await db().categorie.create({
    data: { nom: `Pathologie test ${unique()}`, slug: `patho-${unique()}` },
  });
  autreCategorie = await db().categorie.create({
    data: { nom: `Autre ${unique()}`, slug: `autre-${unique()}` },
  });
  await exercice("A", { materiel: ["Miroir", "Cartes images"] });
  await exercice("B", { materiel: ["miroir"] });
  await exercice("C");
  await exercice("Grands", { ageMin: 12, ageMax: 99 });
  await exercice("Autre", { categorieId: autreCategorie.id });
  await exercice("Perso", { cabinetId: cabA.id, materiel: ["Ardoise"] });
  await exercice("CabinetB", { cabinetId: cabB.id });
});
afterAll(() => db().$disconnect());

describe("séance proposée (règles simples)", () => {
  it("à l'ouverture : résumé, séance proposée selon pathologie, âge et résultats", async () => {
    const { patient } = await patientPrepare();
    const r = await ouvrir(patient.id);
    expect(r.status).toBe(200);
    const proposes = r.corps.seance.elements.map(
      (e: { exerciceId: string; niveau: number; raison: string; retenu: boolean }) => [
        e.exerciceId,
        e.niveau,
        e.raison,
        e.retenu,
      ],
    );
    expect(proposes).toEqual([
      // Travaillé à la dernière séance, sans résultat depuis : niveau en cours.
      [exo.B, 2, "NIVEAU_EN_COURS", false],
      // Du programme, 3 réussites à 90 % : niveau suivant.
      [exo.A, 2, "NIVEAU_SUIVANT", false],
      // Nouveaux, de la pathologie et de l'âge du patient, au niveau 1.
      [exo.C, 1, "NOUVEAU", false],
      [exo.Perso, 1, "NOUVEAU", false],
    ]);
    const ids = proposes.map((p: unknown[]) => p[0]);
    expect(ids).not.toContain(exo.Grands); // pas de l'âge
    expect(ids).not.toContain(exo.Autre); // autre pathologie
    expect(ids).not.toContain(exo.CabinetB); // pas visible

    // Résumé avant séance.
    expect(r.corps.resume.derniereSeance).toMatchObject({
      notes: "Notes fictives de la dernière séance.",
      pointsAReprendre: "Point fictif à reprendre.",
    });
    expect(r.corps.resume.maison).toMatchObject({ prevues: 3, faites: 3, taux: 1 });
    expect(r.corps.resume.maison.ressentis.FACILE).toBe(3);
    expect(r.corps.resume.maison.lignes[0].dernierScore).toEqual({ score: 9, scoreMax: 10 });
    expect(r.corps.seancesPassees).toHaveLength(1);
  });

  it("la lecture est journalisée ; rouvrir ne crée pas une deuxième séance", async () => {
    const { patient } = await patientPrepare();
    const premier = await ouvrir(patient.id);
    const second = await ouvrir(patient.id);
    expect(second.corps.seance.id).toBe(premier.corps.seance.id);
    expect(await db().seance.count({ where: { patientId: patient.id, termineeLe: null } })).toBe(1);
    expect(
      await db().journalAcces.count({
        where: { patientId: patient.id, section: "preparation", action: "LECTURE" },
      }),
    ).toBe(2);
  });

  it("deux ouvertures simultanées : une seule séance en préparation", async () => {
    const { patient } = await patientPrepare();
    const [a, b] = await Promise.all([ouvrir(patient.id), ouvrir(patient.id)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.corps.seance.id).toBe(b.corps.seance.id);
  });

  it("accepter, changer le niveau, remplacer ou retirer chaque proposition", async () => {
    const { patient } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const params = (elementId: string) => ({ id: patient.id, seanceId: seance.id, elementId });
    const [b, a, c, perso] = seance.elements;

    const accepte = await appeler(modifierElement, {
      cookie: cookieOrtho,
      methode: "PATCH",
      params: params(b.id),
      corps: { retenu: true },
    });
    expect(accepte.corps.element).toMatchObject({ retenu: true, niveau: 2 });

    const change = await appeler(modifierElement, {
      cookie: cookieOrtho,
      methode: "PATCH",
      params: params(a.id),
      corps: { niveau: 3 },
    });
    // Changer une proposition l'accepte.
    expect(change.corps.element).toMatchObject({ retenu: true, niveau: 3 });

    const remplace = await appeler(modifierElement, {
      cookie: cookieOrtho,
      methode: "PATCH",
      params: params(c.id),
      corps: { exerciceId: exo.Autre },
    });
    expect(remplace.corps.element).toMatchObject({
      exerciceId: exo.Autre,
      niveau: 1,
      retenu: true,
      origine: "BIBLIOTHEQUE",
      raison: null,
    });

    // Remplacer par un exercice déjà dans la séance : refusé.
    const doublon = await appeler(modifierElement, {
      cookie: cookieOrtho,
      methode: "PATCH",
      params: params(perso.id),
      corps: { exerciceId: exo.B },
    });
    expect(doublon.status).toBe(409);

    const retrait = await appeler(retirer, {
      cookie: cookieOrtho,
      methode: "DELETE",
      params: params(perso.id),
    });
    expect(retrait.status).toBe(204);

    const apres = (await ouvrir(patient.id)).corps.seance.elements;
    expect(apres.map((e: { exerciceId: string }) => e.exerciceId)).toEqual([
      exo.B,
      exo.A,
      exo.Autre,
    ]);
  });

  it("« Proposer à nouveau » garde les retenus et ne les repropose pas", async () => {
    const { patient } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const [b] = seance.elements;
    await appeler(modifierElement, {
      cookie: cookieOrtho,
      methode: "PATCH",
      params: { id: patient.id, seanceId: seance.id, elementId: b.id },
      corps: { retenu: true },
    });
    const r = await appeler(reproposer, {
      cookie: cookieOrtho,
      params: { id: patient.id, seanceId: seance.id },
      corps: {},
    });
    expect(r.status).toBe(200);
    const elements = r.corps.elements as { exerciceId: string; retenu: boolean }[];
    expect(elements.filter((e) => e.exerciceId === exo.B)).toHaveLength(1);
    expect(elements.find((e) => e.exerciceId === exo.B)?.retenu).toBe(true);
    expect(elements.filter((e) => !e.retenu)).toHaveLength(3);
  });
});

describe("ajout depuis le panneau Bibliothèque", () => {
  it("« Ajouter à la séance » au niveau choisi", async () => {
    const { patient } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const r = await appeler(ajouter, {
      cookie: cookieOrtho,
      params: { id: patient.id, seanceId: seance.id },
      corps: { exerciceId: exo.Grands, niveau: 3 },
    });
    expect(r.status).toBe(201);
    expect(r.corps.element).toMatchObject({
      exerciceId: exo.Grands,
      niveau: 3,
      consigne: "Grands : consigne 3",
      origine: "BIBLIOTHEQUE",
      retenu: true,
    });
    // Deuxième ajout du même exercice : refusé.
    const encore = await appeler(ajouter, {
      cookie: cookieOrtho,
      params: { id: patient.id, seanceId: seance.id },
      corps: { exerciceId: exo.Grands, niveau: 1 },
    });
    expect(encore.status).toBe(409);
    expect(encore.corps.erreur.code).toBe("deja_dans_seance");
  });

  it("ajouter un exercice proposé l'accepte au niveau choisi (pas de doublon)", async () => {
    const { patient } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const r = await appeler(ajouter, {
      cookie: cookieOrtho,
      params: { id: patient.id, seanceId: seance.id },
      corps: { exerciceId: exo.C, niveau: 2 },
    });
    expect(r.status).toBe(201);
    expect(r.corps.element).toMatchObject({ exerciceId: exo.C, niveau: 2, retenu: true });
    expect(
      await db().elementSeance.count({ where: { seanceId: seance.id, exerciceId: exo.C } }),
    ).toBe(1);
  });

  it("« Ajouter au programme » depuis la préparation : même programme que l'écran Programme", async () => {
    const { patient } = await patientPrepare();
    const r = await appeler(ajouterAuProgramme, {
      cookie: cookieOrtho,
      params: { id: patient.id },
      corps: { exerciceId: exo.C, niveau: 2 },
    });
    expect(r.status).toBe(201);
    const programme = await db().programme.findFirstOrThrow({
      where: { patientId: patient.id, actif: true },
      include: { elements: true },
    });
    expect(programme.elements.map((e) => [e.exerciceId, e.niveau])).toContainEqual([exo.C, 2]);
  });

  it("refuse un exercice d'un autre cabinet, un niveau hors de 1 à 3", async () => {
    const { patient } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const params = { id: patient.id, seanceId: seance.id };
    expect(
      (
        await appeler(ajouter, {
          cookie: cookieOrtho,
          params,
          corps: { exerciceId: exo.CabinetB, niveau: 1 },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await appeler(ajouter, {
          cookie: cookieOrtho,
          params,
          corps: { exerciceId: exo.C, niveau: 4 },
        })
      ).status,
    ).toBe(400);
  });
});

describe("notes, fin de séance et réutilisation", () => {
  it("notes enregistrées ; après « Terminer », elles alimentent la préparation suivante", async () => {
    const { patient } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const params = { id: patient.id, seanceId: seance.id };
    const notes = await appeler(modifierSeance, {
      cookie: cookieOrtho,
      methode: "PATCH",
      params,
      corps: { notes: "Notes fictives du jour.", pointsAReprendre: "À revoir (fictif)." },
    });
    expect(notes.status).toBe(200);
    expect(notes.corps.seance.notes).toBe("Notes fictives du jour.");

    expect((await appeler(terminer, { cookie: cookieOrtho, params, corps: {} })).status).toBe(204);
    // Les propositions jamais acceptées ne restent pas dans la séance terminée.
    expect(await db().elementSeance.count({ where: { seanceId: seance.id, retenu: false } })).toBe(
      0,
    );

    const suivante = (await ouvrir(patient.id)).corps;
    expect(suivante.seance.id).not.toBe(seance.id);
    expect(suivante.resume.derniereSeance).toMatchObject({
      notes: "Notes fictives du jour.",
      pointsAReprendre: "À revoir (fictif).",
    });

    // Une séance terminée ne se modifie plus.
    const refus = await appeler(ajouter, {
      cookie: cookieOrtho,
      params,
      corps: { exerciceId: exo.C, niveau: 1 },
    });
    expect(refus.status).toBe(409);
    expect(refus.corps.erreur.code).toBe("seance_terminee");
  });

  it("copier une séance passée : ses exercices rejoignent la séance, sans doublon", async () => {
    const { patient, passee } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const params = { id: patient.id, seanceId: seance.id };
    const r = await appeler(copier, {
      cookie: cookieOrtho,
      params,
      corps: { depuisSeanceId: passee.id },
    });
    expect(r.status).toBe(200);
    expect(r.corps.copies).toBe(1);
    const b = r.corps.elements.find((e: { exerciceId: string }) => e.exerciceId === exo.B);
    // B était proposé (en attente) : la copie l'accepte au niveau de la séance passée.
    expect(b).toMatchObject({ niveau: 2, retenu: true });
    expect(
      r.corps.elements.filter((e: { exerciceId: string }) => e.exerciceId === exo.B),
    ).toHaveLength(1);

    const encore = await appeler(copier, {
      cookie: cookieOrtho,
      params,
      corps: { depuisSeanceId: passee.id },
    });
    expect(encore.corps.copies).toBe(0);
  });

  it("refuse de copier la séance d'un autre patient", async () => {
    const { patient } = await patientPrepare();
    const { passee: autre } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const r = await appeler(copier, {
      cookie: cookieOrtho,
      params: { id: patient.id, seanceId: seance.id },
      corps: { depuisSeanceId: autre.id },
    });
    expect(r.status).toBe(404);
  });
});

/** Texte d'un PDF produit par pdf-lib (flux décompressés, chaînes en hexadécimal). */
function textePdf(octets: Uint8Array): string {
  const brut = Buffer.from(octets).toString("latin1");
  const morceaux: string[] = [];
  for (const m of brut.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const flux = Buffer.from(m[1] ?? "", "latin1");
    let contenu: string;
    try {
      contenu = inflateSync(flux).toString("latin1");
    } catch {
      contenu = flux.toString("latin1");
    }
    for (const t of contenu.matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
      // Polices standard : codage WinAnsi (latin-1, sauf quelques signes comme « — »).
      const winAnsi: Record<number, string> = { 0x96: "–", 0x97: "—", 0x92: "’", 0x9c: "œ" };
      morceaux.push(
        [...Buffer.from(t[1] ?? "", "hex")]
          .map((o) => winAnsi[o] ?? String.fromCharCode(o))
          .join(""),
      );
    }
  }
  return morceaux.join("\n");
}

async function telecharger(patientId: string, seanceId: string, cookie = cookieOrtho) {
  const req = new NextRequest("http://localhost:3000/api/test", {
    headers: { cookie: `session=${cookie}`, "x-forwarded-for": ipFictive() },
  });
  return pdf(req, { params: Promise.resolve({ id: patientId, seanceId }) });
}

describe("fiche de séance en PDF", () => {
  it("PDF imprimable : exercices retenus, niveaux, matériel calculé et notes", async () => {
    const { patient } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const params = { id: patient.id, seanceId: seance.id };
    // Séance : A au niveau 3 (bibliothèque) et B accepté ; C reste en attente.
    await appeler(ajouter, {
      cookie: cookieOrtho,
      params,
      corps: { exerciceId: exo.A, niveau: 3 },
    });
    const b = seance.elements.find((e: { exerciceId: string }) => e.exerciceId === exo.B);
    await appeler(modifierElement, {
      cookie: cookieOrtho,
      methode: "PATCH",
      params: { ...params, elementId: b.id },
      corps: { retenu: true },
    });
    await appeler(modifierSeance, {
      cookie: cookieOrtho,
      methode: "PATCH",
      params,
      corps: { notes: "Notes fictives écrites pendant la séance.", materiel: "Sablier" },
    });

    const reponse = await telecharger(patient.id, seance.id);
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("content-type")).toBe("application/pdf");
    expect(reponse.headers.get("cache-control")).toBe("no-store");
    // Nom de fichier sans le nom du patient.
    expect(reponse.headers.get("content-disposition")).toMatch(
      /fiche-seance-\d{4}-\d{2}-\d{2}\.pdf/,
    );
    const octets = new Uint8Array(await reponse.arrayBuffer());
    expect(Buffer.from(octets.slice(0, 5)).toString()).toBe("%PDF-");

    const document = await PDFDocument.load(octets);
    expect(document.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(document.getTitle()).toBe("Fiche de séance");

    const texte = textePdf(octets);
    expect(texte).toContain(`Patient : ${patient.prenom} Exemple`);
    expect(texte).toContain("Exercices (2) — 20 min");
    expect(texte).toContain("A : consigne 3");
    expect(texte).toContain("B : consigne 2");
    expect(texte).not.toContain("C : consigne"); // proposition en attente : pas sur la fiche
    expect(texte).toContain("Matériel à préparer");
    // « miroir » (B) et « Miroir » (A) : une seule ligne, pour les deux exercices.
    expect(texte.match(/^miroir$/gim)).toHaveLength(1);
    expect(texte).toContain("Cartes images");
    expect(texte).toContain("En plus : Sablier");
    expect(texte).toContain("Notes fictives écrites pendant la séance.");
    expect(texte).toContain("Point fictif à reprendre.");

    expect(
      await db().journalAcces.count({
        where: { patientId: patient.id, section: "preparation", action: "EXPORT" },
      }),
    ).toBe(1);
  });

  it("textes longs et caractères non imprimables : le PDF est quand même produit", async () => {
    const { patient } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    await appeler(modifierSeance, {
      cookie: cookieOrtho,
      methode: "PATCH",
      params: { id: patient.id, seanceId: seance.id },
      corps: { notes: `Très bien 🙂 ★\n${"mot ".repeat(1500)}${"x".repeat(300)}` },
    });
    const reponse = await telecharger(patient.id, seance.id);
    expect(reponse.status).toBe(200);
    const document = await PDFDocument.load(new Uint8Array(await reponse.arrayBuffer()));
    expect(document.getPageCount()).toBeGreaterThan(1);
  });
});

describe("droits", () => {
  it("orthophoniste d'un autre cabinet, parent relié, compte non connecté : refusés", async () => {
    const { patient, parent, passee } = await patientPrepare();
    const { seance } = (await ouvrir(patient.id)).corps;
    const params = { id: patient.id, seanceId: seance.id };

    expect((await ouvrir(patient.id, cookieOrthoB)).status).toBe(404);
    expect(
      (
        await appeler(ajouter, {
          cookie: cookieOrthoB,
          params,
          corps: { exerciceId: exo.C, niveau: 1 },
        })
      ).status,
    ).toBe(404);
    expect((await telecharger(patient.id, seance.id, cookieOrthoB)).status).toBe(404);

    // Le parent (relié, consentant) ne voit jamais la préparation.
    const bearer = await jetonMobile(parent.id);
    expect((await appeler(preparation, { bearer, params: { id: patient.id } })).status).toBe(404);
    expect(
      (await appeler(modifierSeance, { bearer, methode: "PATCH", params, corps: { notes: "x" } }))
        .status,
    ).toBe(404);
    expect(
      (await appeler(copier, { bearer, params, corps: { depuisSeanceId: passee.id } })).status,
    ).toBe(404);

    expect((await appeler(preparation, { params: { id: patient.id } })).status).toBe(401);
  });

  it("une séance d'un autre patient n'est pas accessible par ce patient", async () => {
    const { patient } = await patientPrepare();
    const { patient: autre } = await patientPrepare();
    const seanceAutre = (await ouvrir(autre.id)).corps.seance;
    const r = await appeler(ajouter, {
      cookie: cookieOrtho,
      params: { id: patient.id, seanceId: seanceAutre.id },
      corps: { exerciceId: exo.C, niveau: 1 },
    });
    expect(r.status).toBe(404);
    expect((await telecharger(patient.id, seanceAutre.id)).status).toBe(404);
  });
});
