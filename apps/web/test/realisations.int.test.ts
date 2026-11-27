import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as realiser } from "@/app/api/patients/[id]/realisations/route";
import { POST as envoyerVoix } from "@/app/api/patients/[id]/realisations/[realisationId]/enregistrement/route";
import {
  DELETE as retirerAccordAudio,
  POST as accordAudio,
} from "@/app/api/patients/[id]/consentement/audio/route";
import { GET as listerPatients } from "@/app/api/patients/route";
import { db } from "@/lib/serveur/db";
import type { GestionnaireNext } from "@/lib/serveur/routes";
import {
  appeler,
  creerCabinet,
  creerCompte,
  creerPatient,
  ipFictive,
  jetonMobile,
  jetonWeb,
  unique,
} from "./outils";

// Réalisations saisies dans l'application : droits, absence de doublon à la
// synchronisation, score « sur N », enregistrement de la voix.

let cabinetId: string;
let parent: { id: string };
let bearerParent: string;
let bearerAutreParent: string;
let bearerParentAutreCabinet: string;
let cookieOrtho: string;
let enfant: { id: string };
let autreEnfant: { id: string };
let elementAvecScore: string;
let elementSansScore: string;
let elementAutreEnfant: string;

async function element(patientId: string, scoreMax: number | null) {
  const categorie = await db().categorie.create({
    data: { nom: `Cat ${unique()}`, slug: `cat-${unique()}` },
  });
  const exercice = await db().exercice.create({
    data: {
      categorieId: categorie.id,
      titre: "Exercice fictif",
      description: "Fictif.",
      ageMin: 4,
      ageMax: 10,
      dureeMinutes: 10,
      materiel: [],
      apercuConsigne: "Consigne fictive.",
      scoreMax,
      niveaux: { create: [1, 2, 3].map((niveau) => ({ niveau, consigne: `C${niveau}` })) },
    },
  });
  const programme = await db().programme.upsert({
    where: { id: `prog-${patientId}` },
    create: {
      id: `prog-${patientId}`,
      patientId,
      titre: "Programme fictif",
      dateDebut: new Date(),
    },
    update: {},
  });
  const e = await db().elementProgramme.create({
    data: {
      programmeId: programme.id,
      exerciceId: exercice.id,
      niveau: 1,
      foisParSemaine: 3,
      jours: [],
    },
  });
  return e.id;
}

const corps = (elementId: string, extra: Record<string, unknown> = {}) => ({
  idClient: randomUUID(),
  elementId,
  faitLe: new Date().toISOString(),
  ressenti: "FACILE",
  ...extra,
});

const envoyer = (patientId: string, donnees: unknown, bearer = bearerParent) =>
  appeler(realiser, { bearer, params: { id: patientId }, corps: donnees });

/** Envoi multipart de la voix, comme l'application mobile. */
async function voix(
  patientId: string,
  realisationId: string,
  octets: Uint8Array,
  options: { bearer?: string; duree?: string } = {},
) {
  const formulaire = new FormData();
  formulaire.set("audio", new File([new Uint8Array(octets)], "voix.m4a", { type: "audio/mp4" }));
  formulaire.set("dureeSecondes", options.duree ?? "12");
  const req = new NextRequest("http://localhost:3000/api/test", {
    method: "POST",
    headers: {
      "x-forwarded-for": ipFictive(),
      authorization: `Bearer ${options.bearer ?? bearerParent}`,
    },
    body: formulaire,
  });
  const r = await (envoyerVoix as GestionnaireNext)(req, {
    params: Promise.resolve({ id: patientId, realisationId }),
  });
  const texte = await r.text();
  return { status: r.status, corps: texte ? JSON.parse(texte) : null };
}

/** Début d'un fichier .m4a (boîte « ftyp »), contenu fictif. */
const M4A_FICTIF = new Uint8Array([
  0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20, 0, 0, 0, 0, 1, 2, 3, 4,
]);

beforeAll(async () => {
  const cabinet = await creerCabinet();
  cabinetId = cabinet.id;
  const autreCabinet = await creerCabinet();
  parent = await creerCompte("PARENT", cabinetId);
  const autreParent = await creerCompte("PARENT", cabinetId);
  const parentAutreCabinet = await creerCompte("PARENT", autreCabinet.id);
  enfant = await creerPatient(cabinetId, { tuteurIds: [parent.id] });
  autreEnfant = await creerPatient(cabinetId, { tuteurIds: [autreParent.id] });
  await creerPatient(autreCabinet.id, { tuteurIds: [parentAutreCabinet.id] });
  bearerParent = await jetonMobile(parent.id);
  bearerAutreParent = await jetonMobile(autreParent.id);
  bearerParentAutreCabinet = await jetonMobile(parentAutreCabinet.id);
  cookieOrtho = await jetonWeb((await creerCompte("ORTHO", cabinetId)).id);
  elementAvecScore = await element(enfant.id, 10);
  elementSansScore = await element(enfant.id, null);
  elementAutreEnfant = await element(autreEnfant.id, null);
});
afterAll(() => db().$disconnect());

describe("enregistrer une réalisation", () => {
  it("le parent enregistre « c'est fait », le ressenti et le score : la ligne est en base", async () => {
    const donnees = corps(elementAvecScore, { ressenti: "MOYEN", score: 7 });
    const r = await envoyer(enfant.id, donnees);
    expect(r.status).toBe(201);
    const enBase = await db().realisation.findUniqueOrThrow({
      where: { id: r.corps.realisation.id },
    });
    expect(enBase).toMatchObject({
      elementProgrammeId: elementAvecScore,
      saisieParId: parent.id,
      fait: true,
      ressenti: "MOYEN",
      score: 7,
      scoreMax: 10,
      idClient: donnees.idClient,
    });
  });

  it("synchronisation : la même réalisation envoyée 3 fois n'est enregistrée qu'une fois", async () => {
    const donnees = corps(elementSansScore);
    const premier = await envoyer(enfant.id, donnees);
    const deuxieme = await envoyer(enfant.id, donnees);
    const troisieme = await envoyer(enfant.id, donnees);
    expect([premier.status, deuxieme.status, troisieme.status]).toEqual([201, 200, 200]);
    expect(deuxieme.corps.realisation.id).toBe(premier.corps.realisation.id);
    const n = await db().realisation.count({ where: { idClient: donnees.idClient } });
    expect(n).toBe(1);
  });

  it("deux envois simultanés de la même réalisation : une seule ligne", async () => {
    const donnees = corps(elementSansScore);
    const reponses = await Promise.all([1, 2, 3].map(() => envoyer(enfant.id, donnees)));
    expect(new Set(reponses.map((r) => r.corps.realisation.id)).size).toBe(1);
    expect(await db().realisation.count({ where: { idClient: donnees.idClient } })).toBe(1);
  });

  it("chaque envoi autorisé est journalisé (sans contenu médical)", async () => {
    const avant = await db().journalAcces.count({
      where: { patientId: enfant.id, action: "MODIFICATION", section: "programme" },
    });
    await envoyer(enfant.id, corps(elementSansScore));
    const apres = await db().journalAcces.count({
      where: { patientId: enfant.id, action: "MODIFICATION", section: "programme" },
    });
    expect(apres).toBe(avant + 1);
  });

  it("refuse un score si l'exercice n'en prévoit pas, ou au-delà du « sur N »", async () => {
    expect((await envoyer(enfant.id, corps(elementSansScore, { score: 3 }))).status).toBe(400);
    expect((await envoyer(enfant.id, corps(elementAvecScore, { score: 11 }))).status).toBe(400);
  });

  it("refuse une date dans le futur ou trop ancienne", async () => {
    const futur = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const ancien = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    expect((await envoyer(enfant.id, corps(elementSansScore, { faitLe: futur }))).status).toBe(400);
    expect((await envoyer(enfant.id, corps(elementSansScore, { faitLe: ancien }))).status).toBe(
      400,
    );
  });
});

describe("refus", () => {
  it("ÉCHEC : un autre parent ne peut pas enregistrer pour cet enfant (404)", async () => {
    const donnees = corps(elementSansScore);
    const r = await envoyer(enfant.id, donnees, bearerAutreParent);
    expect(r.status).toBe(404);
    expect(await db().realisation.count({ where: { idClient: donnees.idClient } })).toBe(0);
  });

  it("ÉCHEC : un parent d'un autre cabinet (404)", async () => {
    expect(
      (await envoyer(enfant.id, corps(elementSansScore), bearerParentAutreCabinet)).status,
    ).toBe(404);
  });

  it("ÉCHEC : l'exercice d'un autre enfant, via le dossier de son propre enfant (404)", async () => {
    expect((await envoyer(enfant.id, corps(elementAutreEnfant))).status).toBe(404);
  });

  it("ÉCHEC : l'orthophoniste ne saisit pas à la place de la famille", async () => {
    const r = await appeler(realiser, {
      cookie: cookieOrtho,
      params: { id: enfant.id },
      corps: corps(elementSansScore),
    });
    expect(r.status).toBe(404);
  });

  it("ÉCHEC : sans connexion (401)", async () => {
    const r = await appeler(realiser, {
      params: { id: enfant.id },
      corps: corps(elementSansScore),
    });
    expect(r.status).toBe(401);
  });

  it("ÉCHEC : parent relié sans consentement « données de santé » (403)", async () => {
    const p = await creerCompte("PARENT", cabinetId);
    const e = await creerPatient(cabinetId, { tuteurIds: [p.id], consentement: false });
    const el = await element(e.id, null);
    const r = await envoyer(e.id, corps(el), await jetonMobile(p.id));
    expect(r.status).toBe(403);
    expect(r.corps.erreur.code).toBe("consentement_requis");
  });
});

describe("enregistrement de la voix", () => {
  let realisationId: string;

  beforeAll(async () => {
    realisationId = (await envoyer(enfant.id, corps(elementSansScore))).corps.realisation.id;
  });

  it("ÉCHEC sans l'accord facultatif du parent (403)", async () => {
    const r = await voix(enfant.id, realisationId, M4A_FICTIF);
    expect(r.status).toBe(403);
    expect(r.corps.erreur.code).toBe("consentement_audio_requis");
  });

  it("avec l'accord : fichier stocké, une seule voix par réalisation", async () => {
    const accord = await appeler(accordAudio, {
      methode: "POST",
      bearer: bearerParent,
      params: { id: enfant.id },
    });
    expect(accord.status).toBe(201);
    const liste = await appeler(listerPatients, { bearer: bearerParent });
    expect(liste.corps.patients.find((p: { id: string }) => p.id === enfant.id).accordAudio).toBe(
      true,
    );

    const r = await voix(enfant.id, realisationId, M4A_FICTIF);
    expect(r.status).toBe(201);
    const enBase = await db().enregistrement.findMany({ where: { realisationId } });
    expect(enBase).toHaveLength(1);
    expect(enBase[0]).toMatchObject({ typeMime: "audio/mp4", dureeSecondes: 12 });

    // Renvoi (synchronisation) : pas de deuxième fichier.
    const encore = await voix(enfant.id, realisationId, M4A_FICTIF);
    expect(encore.status).toBe(200);
    expect(await db().enregistrement.count({ where: { realisationId } })).toBe(1);
  });

  it("refuse un fichier qui n'est pas un enregistrement m4a, ou une durée invalide", async () => {
    const autre = (await envoyer(enfant.id, corps(elementSansScore))).corps.realisation.id;
    const pdf = new TextEncoder().encode("%PDF-1.4 fictif, pas un son");
    expect((await voix(enfant.id, autre, pdf)).status).toBe(415);
    expect((await voix(enfant.id, autre, M4A_FICTIF, { duree: "0" })).status).toBe(400);
    expect((await voix(enfant.id, autre, M4A_FICTIF, { duree: "9999" })).status).toBe(413);
  });

  it("ÉCHEC : un autre parent ne peut pas ajouter de voix à cette réalisation", async () => {
    await appeler(accordAudio, {
      methode: "POST",
      bearer: bearerAutreParent,
      params: { id: autreEnfant.id },
    });
    const r = await voix(enfant.id, realisationId, M4A_FICTIF, { bearer: bearerAutreParent });
    expect(r.status).toBe(404);
  });

  it("accord retiré : plus d'enregistrement possible", async () => {
    const autre = (await envoyer(enfant.id, corps(elementSansScore))).corps.realisation.id;
    const retrait = await appeler(retirerAccordAudio, {
      methode: "DELETE",
      bearer: bearerParent,
      params: { id: enfant.id },
    });
    expect(retrait.status).toBe(204);
    expect((await voix(enfant.id, autre, M4A_FICTIF)).status).toBe(403);
  });
});
