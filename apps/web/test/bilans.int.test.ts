import { randomUUID } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { PDFDocument } from "pdf-lib";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as lister, POST as creer } from "@/app/api/patients/[id]/bilans/route";
import {
  DELETE as supprimer,
  GET as lire,
  PATCH as modifierDocument,
} from "@/app/api/patients/[id]/bilans/[bilanId]/route";
import { PATCH as modifierPartie } from "@/app/api/patients/[id]/bilans/[bilanId]/sections/[cle]/route";
import { POST as actualiser } from "@/app/api/patients/[id]/bilans/[bilanId]/actualiser/route";
import { PUT as partager } from "@/app/api/patients/[id]/bilans/[bilanId]/partage/route";
import { GET as pdf } from "@/app/api/patients/[id]/bilans/[bilanId]/pdf/route";
import { GET as docx } from "@/app/api/patients/[id]/bilans/[bilanId]/docx/route";
import { GET as partages } from "@/app/api/patients/[id]/bilans-partages/route";
import { GET as pdfPartage } from "@/app/api/patients/[id]/bilans-partages/[bilanId]/pdf/route";
import { POST as realiser } from "@/app/api/patients/[id]/realisations/route";
import type { GestionnaireNext } from "@/lib/serveur/routes";
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
  textePdf,
  unique,
} from "./outils";

// Bilans et comptes rendus : remplissage automatique, statuts, export PDF et Word,
// partage avec la famille (refusé par défaut). Données FICTIVES uniquement.

const JOUR_MS = 24 * 60 * 60 * 1000;
const ilYa = (jours: number) => new Date(Date.now() - jours * JOUR_MS);
const jour = (d: Date) => d.toISOString().slice(0, 10);

let cabA: { id: string };
let cookieOrtho: string;
let cookieOrthoB: string;
let exercices: { rimes: string; syllabes: string };

/**
 * Patient de 7 ans avec : bilan initial il y a 30 jours, 2 séances terminées depuis,
 * un programme (Rimes niveau 1 puis 2, scores), un parent relié et consentant.
 */
async function patientSuivi() {
  const parent = await creerCompte("PARENT", cabA.id);
  const patient = await creerPatient(cabA.id, { age: 7, tuteurIds: [parent.id] });
  await db().patient.update({
    where: { id: patient.id },
    data: { medecinNom: "Dr Fictif", medecinContact: "01 00 00 00 00" },
  });
  await db().bilan.create({
    data: {
      patientId: patient.id,
      type: "INITIAL",
      titre: "Bilan initial",
      date: ilYa(30),
      sections: [],
    },
  });
  for (const [j, niveau] of [
    [20, 1],
    [6, 2],
  ] as const) {
    await db().seance.create({
      data: {
        patientId: patient.id,
        date: ilYa(j),
        termineeLe: ilYa(j),
        notes: `Notes fictives J-${j}.`,
        elements: {
          create: [{ exerciceId: exercices.rimes, niveau, origine: "BIBLIOTHEQUE" }],
        },
      },
    });
  }
  const programme = await db().programme.create({
    data: {
      patientId: patient.id,
      titre: "Programme fictif",
      dateDebut: ilYa(40),
      elements: {
        create: [{ exerciceId: exercices.rimes, niveau: 2, foisParSemaine: 3, jours: [] }],
      },
    },
    include: { elements: true },
  });
  const element = exiger(programme.elements[0]);
  await db().realisation.createMany({
    data: [
      { j: 15, niveau: 1, score: 6 },
      { j: 12, niveau: 1, score: 8 },
      { j: 4, niveau: 2, score: 9 },
      // Avant le bilan initial : hors période.
      { j: 35, niveau: 1, score: 1 },
    ].map((r) => ({
      elementProgrammeId: element.id,
      date: ilYa(r.j),
      fait: true,
      ressenti: "FACILE" as const,
      score: r.score,
      scoreMax: 10,
      niveau: r.niveau,
    })),
  });
  return { parent, patient, element, bearer: await jetonMobile(parent.id) };
}

const nouveau = (patientId: string, corps: Record<string, unknown>, cookie = cookieOrtho) =>
  appeler(creer, { cookie, params: { id: patientId }, corps });

const partie = (
  patientId: string,
  bilanId: string,
  cle: string,
  corps: Record<string, unknown>,
  cookie = cookieOrtho,
) =>
  appeler(modifierPartie, {
    cookie,
    methode: "PATCH",
    params: { id: patientId, bilanId, cle },
    corps,
  });

/** Écrit toutes les parties à écrire et relit les automatiques : statut « Rempli ». */
async function toutRelire(
  patientId: string,
  bilan: { id: string; sections: { cle: string; type: string }[] },
) {
  for (const s of bilan.sections) {
    await partie(
      patientId,
      bilan.id,
      s.cle,
      s.type === "LIBRE" ? { contenu: `Texte ${s.cle}` } : { relu: true },
    );
  }
}

async function fichier(
  gestionnaire: GestionnaireNext,
  params: Record<string, string>,
  auth: { cookie?: string; bearer?: string } = { cookie: cookieOrtho },
) {
  const entetes = new Headers({ "x-forwarded-for": ipFictive() });
  if (auth.cookie) entetes.set("cookie", `session=${auth.cookie}`);
  if (auth.bearer) entetes.set("authorization", `Bearer ${auth.bearer}`);
  const req = new NextRequest("http://localhost:3000/api/test", { headers: entetes });
  return gestionnaire(req, { params: Promise.resolve(params) });
}

beforeAll(async () => {
  cabA = await creerCabinet();
  const cabB = await creerCabinet();
  cookieOrtho = await jetonWeb((await creerCompte("ORTHO", cabA.id)).id);
  cookieOrthoB = await jetonWeb((await creerCompte("ORTHO", cabB.id)).id);
  const categorie = await db().categorie.create({
    data: { nom: `Cat ${unique()}`, slug: `cat-${unique()}` },
  });
  const exercice = async (titre: string) =>
    (
      await db().exercice.create({
        data: {
          categorieId: categorie.id,
          titre,
          description: "Exercice fictif.",
          ageMin: 4,
          ageMax: 10,
          dureeMinutes: 10,
          materiel: [],
          apercuConsigne: "Consigne fictive.",
          scoreMax: 10,
          aValider: true,
          niveaux: {
            create: [1, 2, 3].map((niveau) => ({ niveau, consigne: `${titre} ${niveau}` })),
          },
        },
      })
    ).id;
  exercices = {
    rimes: await exercice(`Rimes ${unique()}`),
    syllabes: await exercice(`Syllabes ${unique()}`),
  };
});
afterAll(() => db().$disconnect());

describe("remplissage automatique", () => {
  it("bilan d'évolution : identité, séances, taux et scores par niveau remplis", async () => {
    const { patient } = await patientSuivi();
    const r = await nouveau(patient.id, { type: "EVOLUTION" });
    expect(r.status).toBe(201);
    const { bilan } = r.corps;
    expect(bilan).toMatchObject({ type: "EVOLUTION", titre: "Bilan d'évolution", partage: false });
    // Période par défaut : depuis le bilan initial.
    expect(bilan.dateDebut).toBe(jour(ilYa(30)));
    const parCle = Object.fromEntries(
      bilan.sections.map((s: { cle: string }) => [s.cle, s]),
    ) as Record<string, { contenu: string; type: string; relu: boolean }>;
    expect(parCle.identite?.contenu).toContain(`${patient.prenom} Exemple`);
    expect(parCle.identite?.contenu).toContain("(7 ans)");
    expect(parCle.prescripteur?.contenu).toContain("Dr Fictif");
    expect(parCle.seances?.contenu).toMatch(/^2 séances, du /);
    expect(parCle.exercices?.contenu).toMatch(/du niveau 1 au niveau 2 \(2 séance\(s\)\)/);
    expect(parCle.scores?.contenu).toMatch(/niveau 1 : 70 % en moyenne \(2 réalisations\)/);
    expect(parCle.scores?.contenu).toMatch(/niveau 2 : 90 % \(1 réalisation\)/);
    expect(parCle.scores?.contenu).not.toContain("10 %"); // réalisation hors période
    expect(parCle.realisation?.contenu).toContain("exercices faits sur");
    // Automatique tant que ce n'est pas relu ; parties à écrire vides.
    expect(parCle.seances).toMatchObject({ type: "AUTO", relu: false });
    expect(parCle.conclusion).toMatchObject({ type: "LIBRE", contenu: "" });
    expect(bilan.statut).toBe("A_ECRIRE");
    expect(
      await db().journalAcces.count({
        where: { patientId: patient.id, section: "bilans", action: "MODIFICATION" },
      }),
    ).toBe(1);
  });

  it("le niveau est gardé sur une réalisation saisie dans l'application", async () => {
    const { patient, element, bearer } = await patientSuivi();
    const r = await appeler(realiser, {
      bearer,
      params: { id: patient.id },
      corps: {
        idClient: randomUUID(),
        elementId: element.id,
        faitLe: new Date().toISOString(),
        ressenti: "FACILE",
        score: 7,
      },
    });
    expect(r.status).toBe(201);
    const enBase = await db().realisation.findFirstOrThrow({
      where: { elementProgrammeId: element.id, score: 7 },
    });
    expect(enBase.niveau).toBe(2);
  });

  it("compte rendu de séance : la séance choisie (exercices et notes)", async () => {
    const { patient } = await patientSuivi();
    const seance = await db().seance.findFirstOrThrow({
      where: { patientId: patient.id },
      orderBy: { date: "asc" },
    });
    const r = await nouveau(patient.id, { type: "COMPTE_RENDU_SEANCE", seanceId: seance.id });
    const parCle = Object.fromEntries(
      r.corps.bilan.sections.map((s: { cle: string; contenu: string }) => [s.cle, s.contenu]),
    );
    expect(parCle.seance).toContain(`Séance du `);
    expect(parCle.seance).toContain("(niveau 1)");
    expect(parCle.notesSeance).toBe("Notes : Notes fictives J-20.");

    // La séance d'un autre patient est refusée.
    const { patient: autre } = await patientSuivi();
    expect(
      (await nouveau(autre.id, { type: "COMPTE_RENDU_SEANCE", seanceId: seance.id })).status,
    ).toBe(404);
  });

  it("actualiser : les chiffres sont recalculés et redeviennent « Automatique »", async () => {
    const { patient, element } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    await partie(patient.id, bilan.id, "scores", { relu: true });
    await db().realisation.create({
      data: {
        elementProgrammeId: element.id,
        date: ilYa(1),
        fait: true,
        score: 3,
        scoreMax: 10,
        niveau: 3,
      },
    });
    const r = await appeler(actualiser, {
      cookie: cookieOrtho,
      params: { id: patient.id, bilanId: bilan.id },
      corps: {},
    });
    const scores = r.corps.bilan.sections.find((s: { cle: string }) => s.cle === "scores");
    expect(scores.contenu).toMatch(/niveau 3 : 30 %/);
    expect(scores.relu).toBe(false);
  });
});

describe("statuts", () => {
  it("À écrire → Automatique → Rempli, et dans la liste", async () => {
    const { patient } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    let dernier = bilan;
    for (const s of bilan.sections.filter((x: { type: string }) => x.type === "LIBRE")) {
      dernier = (await partie(patient.id, bilan.id, s.cle, { contenu: "Texte fictif." })).corps
        .bilan;
    }
    expect(dernier.statut).toBe("AUTOMATIQUE");
    for (const s of bilan.sections.filter((x: { type: string }) => x.type === "AUTO")) {
      dernier = (await partie(patient.id, bilan.id, s.cle, { relu: true })).corps.bilan;
    }
    expect(dernier.statut).toBe("REMPLI");

    const liste = await appeler(lister, { cookie: cookieOrtho, params: { id: patient.id } });
    const doc = liste.corps.documents.find((d: { id: string }) => d.id === bilan.id);
    expect(doc).toMatchObject({ statut: "REMPLI", total: bilan.sections.length, partage: false });
    expect(liste.corps.familleConsentante).toBe(1);
  });

  it("enregistrements simultanés de plusieurs parties : aucun n'est perdu", async () => {
    const { patient } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    await Promise.all(
      bilan.sections.map((s: { cle: string; type: string }) =>
        partie(
          patient.id,
          bilan.id,
          s.cle,
          s.type === "LIBRE" ? { contenu: "Écrit." } : { relu: true },
        ),
      ),
    );
    const { bilan: final } = (
      await appeler(lire, { cookie: cookieOrtho, params: { id: patient.id, bilanId: bilan.id } })
    ).corps;
    expect(final.statut).toBe("REMPLI");
  });

  it("courrier : texte de départ « À relire », partie inconnue refusée", async () => {
    const { patient } = await patientSuivi();
    const { bilan } = (
      await nouveau(patient.id, { type: "COURRIER_ECOLE", destinataire: "École fictive" })
    ).corps;
    expect(bilan.statut).toBe("A_RELIRE");
    expect(bilan.destinataire).toBe("École fictive");
    expect((await partie(patient.id, bilan.id, "inexistante", { relu: true })).status).toBe(404);
  });
});

describe("export PDF et Word", () => {
  it("PDF : chiffres et texte écrit ; « Brouillon » tant que tout n'est pas relu", async () => {
    const { patient } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    await partie(patient.id, bilan.id, "conclusion", {
      contenu: "Conclusion fictive.\n- point un",
    });
    const params = { id: patient.id, bilanId: bilan.id };

    const reponse = await fichier(pdf, params);
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("content-type")).toBe("application/pdf");
    expect(reponse.headers.get("content-disposition")).toMatch(/evolution-\d{4}-\d{2}-\d{2}\.pdf/);
    const octets = new Uint8Array(await reponse.arrayBuffer());
    expect((await PDFDocument.load(octets)).getTitle()).toBe("Bilan d'évolution");
    const texte = textePdf(octets);
    expect(texte).toContain("BROUILLON — parties à relire");
    expect(texte).toContain(`Patient : ${patient.prenom} Exemple`);
    expect(texte).toMatch(/2 séances, du/);
    expect(texte).toContain("Conclusion fictive.");
    expect(texte).toContain("• point un");
    expect(texte).toContain("(à compléter)");

    await toutRelire(patient.id, bilan);
    expect(
      textePdf(new Uint8Array(await (await fichier(pdf, params)).arrayBuffer())),
    ).not.toContain("BROUILLON");
    expect(
      await db().journalAcces.count({
        where: { patientId: patient.id, section: "bilans", action: "EXPORT" },
      }),
    ).toBe(2);
  });

  it("Word (.docx) : un vrai fichier Word avec les parties du document", async () => {
    const { patient } = await patientSuivi();
    const { bilan } = (
      await nouveau(patient.id, { type: "COURRIER_MEDECIN", destinataire: "Dr Fictif" })
    ).corps;
    await partie(patient.id, bilan.id, "corps", { contenu: "Corps du courrier fictif." });
    const reponse = await fichier(docx, { id: patient.id, bilanId: bilan.id });
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(reponse.headers.get("content-disposition")).toMatch(
      /attachment; filename="courrier-medecin-/,
    );
    const archive = unzipSync(new Uint8Array(await reponse.arrayBuffer()));
    expect(Object.keys(archive)).toEqual(
      expect.arrayContaining(["[Content_Types].xml", "word/document.xml"]),
    );
    const xml = strFromU8(exiger(archive["word/document.xml"]));
    expect(xml).toContain("Courrier au médecin");
    expect(xml).toMatch(/attention de : Dr Fictif/);
    expect(xml).toContain("Corps du courrier fictif.");
    expect(xml).toContain(`${patient.prenom} Exemple`);
    // Brouillon : mention en en-tête.
    const entetes = Object.keys(archive).filter((n) => n.startsWith("word/header"));
    expect(entetes.map((n) => strFromU8(exiger(archive[n]))).join("")).toContain("BROUILLON");
  });
});

describe("partage avec la famille", () => {
  it("par défaut, rien n'est partagé : la famille ne voit aucun document", async () => {
    const { patient, bearer } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    await toutRelire(patient.id, bilan);

    const liste = await appeler(partages, { bearer, params: { id: patient.id } });
    expect(liste.status).toBe(200);
    expect(liste.corps.documents).toEqual([]);
    expect(
      (await fichier(pdfPartage, { id: patient.id, bilanId: bilan.id }, { bearer })).status,
    ).toBe(404);
  });

  it("partage refusé tant que le document n'est pas entièrement relu", async () => {
    const { patient } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    const r = await appeler(partager, {
      cookie: cookieOrtho,
      methode: "PUT",
      params: { id: patient.id, bilanId: bilan.id },
      corps: { partage: true },
    });
    expect(r.status).toBe(409);
    expect(r.corps.erreur.code).toBe("document_a_relire");
  });

  it("coché : la famille le voit ; modifié ensuite : le partage est retiré", async () => {
    const { patient, bearer } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    await toutRelire(patient.id, bilan);
    const params = { id: patient.id, bilanId: bilan.id };
    const r = await appeler(partager, {
      cookie: cookieOrtho,
      methode: "PUT",
      params,
      corps: { partage: true },
    });
    expect(r.corps.bilan.partage).toBe(true);
    expect(r.corps.bilan.partageLe).toBeTruthy();

    const liste = await appeler(partages, { bearer, params: { id: patient.id } });
    expect(liste.corps.documents.map((d: { id: string }) => d.id)).toEqual([bilan.id]);
    const lu = await fichier(pdfPartage, params, { bearer });
    expect(lu.status).toBe(200);
    expect(textePdf(new Uint8Array(await lu.arrayBuffer()))).toContain("Texte conclusion");

    // Le document est modifié : il n'est plus partagé (la famille ne voit pas de brouillon).
    const modif = await partie(patient.id, bilan.id, "conclusion", {
      contenu: "Nouvelle version.",
    });
    expect(modif.corps).toMatchObject({ partageRetire: true, bilan: { partage: false } });
    expect(
      (await appeler(partages, { bearer, params: { id: patient.id } })).corps.documents,
    ).toEqual([]);
    expect((await fichier(pdfPartage, params, { bearer })).status).toBe(404);
  });

  it("décocher retire le partage", async () => {
    const { patient, bearer } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    await toutRelire(patient.id, bilan);
    const params = { id: patient.id, bilanId: bilan.id };
    await appeler(partager, {
      cookie: cookieOrtho,
      methode: "PUT",
      params,
      corps: { partage: true },
    });
    await appeler(partager, {
      cookie: cookieOrtho,
      methode: "PUT",
      params,
      corps: { partage: false },
    });
    expect(
      (await appeler(partages, { bearer, params: { id: patient.id } })).corps.documents,
    ).toEqual([]);
  });
});

describe("droits", () => {
  it("la famille n'accède jamais aux documents de l'orthophoniste (partagés ou non)", async () => {
    const { patient, bearer } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    const params = { id: patient.id, bilanId: bilan.id };
    expect((await appeler(lister, { bearer, params: { id: patient.id } })).status).toBe(404);
    expect((await appeler(lire, { bearer, params })).status).toBe(404);
    expect((await fichier(pdf, params, { bearer })).status).toBe(404);
    expect((await fichier(docx, params, { bearer })).status).toBe(404);
    expect((await partie(patient.id, bilan.id, "conclusion", { contenu: "x" }, "")).status).toBe(
      401,
    );
    expect(
      (
        await appeler(modifierPartie, {
          bearer,
          methode: "PATCH",
          params: { ...params, cle: "conclusion" },
          corps: { contenu: "x" },
        })
      ).status,
    ).toBe(404);
    expect(
      (await appeler(partager, { bearer, methode: "PUT", params, corps: { partage: true } }))
        .status,
    ).toBe(404);
    expect((await nouveau(patient.id, { type: "EVOLUTION" }, "")).status).toBe(401);
  });

  it("parent sans consentement : 403 ; parent d'un autre enfant : 404", async () => {
    const { patient } = await patientSuivi();
    const sansAccord = await creerCompte("PARENT", cabA.id);
    await db().lienTuteur.create({ data: { parentId: sansAccord.id, patientId: patient.id } });
    const r = await appeler(partages, {
      bearer: await jetonMobile(sansAccord.id),
      params: { id: patient.id },
    });
    expect(r.status).toBe(403);
    expect(r.corps.erreur.code).toBe("consentement_requis");

    const { bearer: autreParent } = await patientSuivi();
    expect(
      (await appeler(partages, { bearer: autreParent, params: { id: patient.id } })).status,
    ).toBe(404);
  });

  it("orthophoniste d'un autre cabinet : 404 partout", async () => {
    const { patient } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "EVOLUTION" })).corps;
    const params = { id: patient.id, bilanId: bilan.id };
    expect(
      (await appeler(lister, { cookie: cookieOrthoB, params: { id: patient.id } })).status,
    ).toBe(404);
    expect((await nouveau(patient.id, { type: "EVOLUTION" }, cookieOrthoB)).status).toBe(404);
    expect((await fichier(pdf, params, { cookie: cookieOrthoB })).status).toBe(404);
    expect(
      (await appeler(supprimer, { cookie: cookieOrthoB, methode: "DELETE", params })).status,
    ).toBe(404);
    expect(
      (
        await appeler(modifierDocument, {
          cookie: cookieOrthoB,
          methode: "PATCH",
          params,
          corps: { titre: "x" },
        })
      ).status,
    ).toBe(404);
  });

  it("un document d'un autre patient n'est pas accessible par ce patient", async () => {
    const { patient } = await patientSuivi();
    const { patient: autre } = await patientSuivi();
    const { bilan } = (await nouveau(autre.id, { type: "EVOLUTION" })).corps;
    expect(
      (await appeler(lire, { cookie: cookieOrtho, params: { id: patient.id, bilanId: bilan.id } }))
        .status,
    ).toBe(404);
  });

  it("supprimer un document", async () => {
    const { patient } = await patientSuivi();
    const { bilan } = (await nouveau(patient.id, { type: "INITIAL" })).corps;
    const params = { id: patient.id, bilanId: bilan.id };
    expect(
      (await appeler(supprimer, { cookie: cookieOrtho, methode: "DELETE", params })).status,
    ).toBe(204);
    expect((await appeler(lire, { cookie: cookieOrtho, params })).status).toBe(404);
  });
});
