import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as lirePatient, POST as envoyer } from "@/app/api/patients/[id]/conseils/route";
import { POST as renvoyer } from "@/app/api/patients/[id]/conseils/[conseilId]/envois/route";
import { DELETE as arreter } from "@/app/api/patients/[id]/conseils/plans/[planId]/route";
import { GET as recus } from "@/app/api/patients/[id]/conseils/recus/route";
import { POST as compris } from "@/app/api/patients/[id]/conseils/envois/[envoiId]/lu/route";
import { creerEnvoisDus, envoyerConseil, lireConseilsRecus } from "@/lib/serveur/conseils";
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

// Conseils pour la famille : proposition (filtre pathologie + âge), envoi (tel quel,
// modifié, de zéro), répétition, lecture « J'ai compris », et droits.

const JOUR = 24 * 60 * 60 * 1000;

let cabA: { id: string };
let cabB: { id: string };
let ortho: { id: string; role: "ORTHO"; cabinetId: string };
let cookieOrtho: string;
let cookieOrthoB: string;
let oral: { id: string; slug: string };
let ecrit: { id: string; slug: string };
/** Modèles fictifs, étiquetés avec des catégories propres à ce fichier de test. */
const m: Record<string, string> = {};

async function categorie(nom: string) {
  return db().categorie.create({ data: { nom: `${nom} ${unique()}`, slug: `cat-${unique()}` } });
}

async function modele(
  cle: string,
  categories: string[],
  ageMin: number | null,
  ageMax: number | null,
  cabinetId: string | null = null,
) {
  const c = await db().conseil.create({
    data: {
      titre: `Conseil ${cle}`,
      aFaire: [`${cle} : à faire 1`, `${cle} : à faire 2`],
      aEviter: [`${cle} : à éviter`],
      estModele: true,
      aValider: true,
      ageMin,
      ageMax,
      cabinetId,
      etiquettes: { create: categories.map((categorieId) => ({ categorieId })) },
    },
  });
  m[cle] = c.id;
}

/** Patient du cabinet A (7 ans par défaut, « langage oral ») avec un parent consentant. */
async function famille(options: { age?: number; pathologies?: string[]; prenom?: string } = {}) {
  const parent = await db().user.update({
    where: { id: (await creerCompte("PARENT", cabA.id)).id },
    data: { prenom: options.prenom ?? "Julie" },
  });
  const patient = await creerPatient(cabA.id, { age: options.age ?? 7, tuteurIds: [parent.id] });
  await db().patientPathologie.createMany({
    data: (options.pathologies ?? [oral.id]).map((categorieId) => ({
      patientId: patient.id,
      categorieId,
    })),
  });
  return { parent, patient, bearer: await jetonMobile(parent.id) };
}

const p = (id: string, autres: Record<string, string> = {}) => ({ id, ...autres });
const envoi = (patientId: string, corps: unknown, cookie = cookieOrtho) =>
  appeler(envoyer, { cookie, params: p(patientId), corps });
const listeRecus = (patientId: string, bearer: string) =>
  appeler(recus, { bearer, params: p(patientId) });

beforeAll(async () => {
  cabA = await creerCabinet();
  cabB = await creerCabinet();
  const o = await creerCompte("ORTHO", cabA.id);
  ortho = { id: o.id, role: "ORTHO", cabinetId: cabA.id };
  cookieOrtho = await jetonWeb(o.id);
  cookieOrthoB = await jetonWeb((await creerCompte("ORTHO", cabB.id)).id);
  oral = await categorie("Langage oral");
  ecrit = await categorie("Langage écrit");
  const voix = await categorie("Voix");
  await modele("oral-2-4", [oral.id], 2, 4);
  await modele("oral-3-8", [oral.id], 3, 8);
  await modele("oral-6-11", [oral.id], 6, 11);
  await modele("oral-12-18", [oral.id], 12, 18);
  await modele("oral-ecrit-5-10", [oral.id, ecrit.id], 5, 10);
  await modele("ecrit-5-10", [ecrit.id], 5, 10);
  await modele("voix-12+", [voix.id], 12, null);
  await modele("oral-cabinet-b", [oral.id], null, null, cabB.id);
});
afterAll(() => db().$disconnect());

describe("conseils proposés (règle simple : même pathologie, âge dans la tranche)", () => {
  it("Léa (langage oral, 7 ans) : seulement les conseils de langage oral pour son âge", async () => {
    const { patient } = await famille({ age: 7, pathologies: [oral.id] });
    const r = await appeler(lirePatient, { cookie: cookieOrtho, params: p(patient.id) });
    expect(r.status).toBe(200);
    const proposes = r.corps.proposes.map((c: { id: string }) => c.id);
    expect(new Set(proposes)).toEqual(
      new Set([m["oral-ecrit-5-10"], m["oral-3-8"], m["oral-6-11"]]),
    );
    for (const c of r.corps.proposes) {
      expect(c.pathologies.map((x: { slug: string }) => x.slug)).toContain(oral.slug);
      expect(c.ageMin ?? 0).toBeLessThanOrEqual(7);
      expect(c.ageMax ?? 99).toBeGreaterThanOrEqual(7);
      expect(c.aValider).toBe(true);
    }
    // Hors tranche d'âge ou autre pathologie : dans « autres », pas dans les propositions.
    const autres = r.corps.autres.map((c: { id: string }) => c.id);
    for (const cle of ["oral-2-4", "oral-12-18", "ecrit-5-10", "voix-12+"]) {
      expect(proposes).not.toContain(m[cle]);
      expect(autres).toContain(m[cle]);
    }
    expect(r.corps.patient).toMatchObject({ age: 7 });
  });

  it("les modèles d'un autre cabinet ne sont jamais montrés", async () => {
    const { patient } = await famille();
    const r = await appeler(lirePatient, { cookie: cookieOrtho, params: p(patient.id) });
    const tous = [...r.corps.proposes, ...r.corps.autres].map((c: { id: string }) => c.id);
    expect(tous).not.toContain(m["oral-cabinet-b"]);
  });

  it("à 13 ans, le même patient reçoit les conseils de sa nouvelle tranche", async () => {
    const { patient } = await famille({ age: 13 });
    const r = await appeler(lirePatient, { cookie: cookieOrtho, params: p(patient.id) });
    expect(r.corps.proposes.map((c: { id: string }) => c.id)).toEqual([m["oral-12-18"]]);
  });

  it("indique les parents qui verront les conseils (consentement donné)", async () => {
    const { patient, parent } = await famille();
    const r = await appeler(lirePatient, { cookie: cookieOrtho, params: p(patient.id) });
    expect(r.corps.destinataires.map((d: { id: string }) => d.id)).toEqual([parent.id]);
  });
});

describe("envoi, lecture par le parent, « J'ai compris », « lu » côté orthophoniste", () => {
  it("parcours complet : j'envoie, le parent voit, appuie sur « J'ai compris », je vois « lu »", async () => {
    const { patient, bearer, parent } = await famille({ prenom: "Julie" });
    const e = await envoi(patient.id, { modeleId: m["oral-3-8"] });
    expect(e.status).toBe(201);
    expect(e.corps.conseil).toMatchObject({ origine: "modele", aValider: true, nbEnvois: 1 });
    expect(e.corps.conseil.dernierEnvoi.luLe).toBeNull();

    const avant = await listeRecus(patient.id, bearer);
    expect(avant.status).toBe(200);
    expect(avant.corps.conseils).toHaveLength(1);
    const recu = avant.corps.conseils[0];
    expect(recu).toMatchObject({
      titre: "Conseil oral-3-8",
      aFaire: ["oral-3-8 : à faire 1", "oral-3-8 : à faire 2"],
      aEviter: ["oral-3-8 : à éviter"],
      aValider: true,
      luLe: null,
    });

    const lu = await appeler(compris, {
      bearer,
      params: p(patient.id, { envoiId: recu.envoiId }),
      corps: {},
    });
    expect(lu.status).toBe(200);
    expect(lu.corps.luLe).toBeTruthy();
    expect((await listeRecus(patient.id, bearer)).corps.conseils[0].luLe).toBeTruthy();

    const vue = await appeler(lirePatient, { cookie: cookieOrtho, params: p(patient.id) });
    const envoye = vue.corps.envoyes.find((c: { id: string }) => c.id === e.corps.conseil.id);
    expect(envoye.dernierEnvoi.luLe).toBeTruthy();
    expect(envoye.dernierEnvoi.luPar).toBe("Julie");
    const ligne = await db().envoiConseil.findFirstOrThrow({ where: { id: recu.envoiId } });
    expect(ligne.luParId).toBe(parent.id);
    // Le modèle déjà envoyé reste proposé (l'écran le marque « déjà envoyé »).
    expect(vue.corps.proposes.map((c: { id: string }) => c.id)).toContain(m["oral-3-8"]);
  });

  it("« J'ai compris » deux fois : la première lecture est gardée", async () => {
    const { patient, bearer } = await famille();
    await envoi(patient.id, { modeleId: m["oral-3-8"] });
    const envoiId = (await listeRecus(patient.id, bearer)).corps.conseils[0].envoiId;
    const appel = () => appeler(compris, { bearer, params: p(patient.id, { envoiId }), corps: {} });
    const premier = (await appel()).corps.luLe;
    expect((await appel()).corps.luLe).toBe(premier);
  });

  it("modifié avant envoi : le texte de la famille est le texte modifié, toujours « à valider »", async () => {
    const { patient, bearer } = await famille();
    const contenu = {
      titre: "Raconter sa journée avec Léa",
      aFaire: ["Demandez-lui un moment de sa journée."],
      aEviter: ["Finir ses phrases."],
    };
    const e = await envoi(patient.id, { modeleId: m["oral-6-11"], contenu });
    expect(e.status).toBe(201);
    expect(e.corps.conseil).toMatchObject({ ...contenu, origine: "modifie", aValider: true });
    expect((await listeRecus(patient.id, bearer)).corps.conseils[0]).toMatchObject(contenu);
    // Le modèle commun n'est pas touché.
    const modeleApres = await db().conseil.findUniqueOrThrow({ where: { id: m["oral-6-11"] } });
    expect(modeleApres.titre).toBe("Conseil oral-6-11");
  });

  it("contenu identique au modèle : compté comme envoyé tel quel", async () => {
    const { patient } = await famille();
    const source = await db().conseil.findUniqueOrThrow({ where: { id: m["oral-3-8"] } });
    const contenu = { titre: source.titre, aFaire: source.aFaire, aEviter: source.aEviter };
    const e = await envoi(patient.id, { modeleId: source.id, contenu });
    expect(e.corps.conseil.origine).toBe("modele");
  });

  it("écrit de zéro : pas d'étiquette « à valider »", async () => {
    const { patient, bearer } = await famille();
    const contenu = { titre: "Mon conseil", aFaire: [], aEviter: ["Le stress au coucher."] };
    const e = await envoi(patient.id, { contenu });
    expect(e.status).toBe(201);
    expect(e.corps.conseil).toMatchObject({ origine: "libre", aValider: false });
    expect((await listeRecus(patient.id, bearer)).corps.conseils[0]).toMatchObject({
      ...contenu,
      aValider: false,
    });
  });

  it("refuse un conseil vide, sans titre, ou un modèle inconnu / d'un autre cabinet", async () => {
    const { patient } = await famille();
    expect((await envoi(patient.id, {})).status).toBe(400);
    expect(
      (await envoi(patient.id, { contenu: { titre: "T", aFaire: [], aEviter: [] } })).status,
    ).toBe(400);
    expect(
      (await envoi(patient.id, { contenu: { titre: "", aFaire: ["x"], aEviter: [] } })).status,
    ).toBe(400);
    expect((await envoi(patient.id, { modeleId: "inconnu" })).status).toBe(404);
    expect((await envoi(patient.id, { modeleId: m["oral-cabinet-b"] })).status).toBe(404);
    // Un conseil déjà propre à un patient n'est pas un modèle.
    const autre = await famille();
    const copie = (await envoi(autre.patient.id, { modeleId: m["oral-3-8"] })).corps.conseil;
    expect((await envoi(patient.id, { modeleId: copie.id })).status).toBe(404);
  });
});

describe("répétition : chaque semaine ou à une date choisie", () => {
  it("date choisie : invisible pour la famille avant le jour, visible ensuite", async () => {
    const { patient, bearer, parent } = await famille();
    const dans3Jours = new Date(Date.now() + 3 * JOUR).toISOString().slice(0, 10);
    const e = await envoi(patient.id, {
      modeleId: m["oral-3-8"],
      planification: { repetition: "UNE_FOIS", date: dans3Jours },
    });
    expect(e.status).toBe(201);
    expect(e.corps.conseil.dernierEnvoi).toBeNull();
    expect(e.corps.conseil.plans).toHaveLength(1);
    expect((await listeRecus(patient.id, bearer)).corps.conseils).toEqual([]);

    const acteurParent = { id: parent.id, role: parent.role, cabinetId: cabA.id };
    const plusTard = new Date(Date.now() + 4 * JOUR);
    const apres = await lireConseilsRecus(db(), acteurParent, patient.id, plusTard);
    expect(apres).toHaveLength(1);
    expect((apres[0]?.envoyeLe ?? "").slice(0, 10) <= dans3Jours).toBe(true);
    // Une seule fois : rien de plus une semaine après.
    await creerEnvoisDus(db(), patient.id, new Date(Date.now() + 20 * JOUR));
    expect(await db().envoiConseil.count({ where: { patientId: patient.id } })).toBe(1);
  });

  it("refuse une date déjà passée", async () => {
    const { patient } = await famille();
    const hier = new Date(Date.now() - 2 * JOUR).toISOString().slice(0, 10);
    const r = await envoi(patient.id, {
      modeleId: m["oral-3-8"],
      planification: { repetition: "UNE_FOIS", date: hier },
    });
    expect(r.status).toBe(400);
    expect(r.corps.erreur.code).toBe("date_passee");
  });

  it("chaque semaine : un nouvel envoi par semaine, sans doublon, à lire à nouveau", async () => {
    const { patient, parent } = await famille();
    const t0 = new Date("2026-11-02T09:00:00Z"); // lundi 10 h à Paris
    const conseil = await envoyerConseil(
      db(),
      ortho,
      patient.id,
      { modeleId: m["oral-3-8"], planification: { repetition: "HEBDOMADAIRE" } },
      t0,
    );
    expect(conseil.nbEnvois).toBe(1);
    expect(conseil.plans[0]?.prochainEnvoi).toEqual(new Date("2026-11-09T09:00:00Z"));

    const acteurParent = { id: parent.id, role: parent.role, cabinetId: cabA.id };
    const semaine2 = new Date("2026-11-09T12:00:00Z");
    // Deux lectures en même temps : un seul envoi créé.
    await Promise.all([
      lireConseilsRecus(db(), acteurParent, patient.id, semaine2),
      lireConseilsRecus(db(), acteurParent, patient.id, semaine2),
    ]);
    expect(await db().envoiConseil.count({ where: { patientId: patient.id } })).toBe(2);

    // La famille ne voit qu'une carte : le dernier envoi, à lire.
    const vue = await lireConseilsRecus(db(), acteurParent, patient.id, semaine2);
    expect(vue).toHaveLength(1);
    expect(vue[0]?.envoyeLe).toBe("2026-11-09T09:00:00.000Z");
    expect(vue[0]?.luLe).toBeNull();

    // Trois semaines sans ouvrir l'application : un seul rappel, le plus récent.
    await creerEnvoisDus(db(), patient.id, new Date("2026-12-01T12:00:00Z"));
    const dates = (
      await db().envoiConseil.findMany({
        where: { patientId: patient.id },
        orderBy: { envoyeLe: "asc" },
      })
    ).map((e) => e.envoyeLe.toISOString());
    expect(dates).toEqual([
      "2026-11-02T09:00:00.000Z",
      "2026-11-09T09:00:00.000Z",
      "2026-11-30T09:00:00.000Z",
    ]);
  });

  it("« J'ai compris » sur le dernier envoi marque aussi les envois plus anciens non lus", async () => {
    const { patient, bearer } = await famille();
    const t0 = new Date(Date.now() - 8 * JOUR);
    await envoyerConseil(
      db(),
      ortho,
      patient.id,
      { modeleId: m["oral-3-8"], planification: { repetition: "HEBDOMADAIRE" } },
      t0,
    );
    const liste = await listeRecus(patient.id, bearer); // crée l'envoi de cette semaine
    expect(await db().envoiConseil.count({ where: { patientId: patient.id } })).toBe(2);
    const envoiId = liste.corps.conseils[0].envoiId;
    await appeler(compris, { bearer, params: p(patient.id, { envoiId }), corps: {} });
    expect(await db().envoiConseil.count({ where: { patientId: patient.id, luLe: null } })).toBe(0);
  });

  it("ré-envoyer un conseil déjà envoyé, puis arrêter la répétition", async () => {
    const { patient } = await famille();
    const copie = (await envoi(patient.id, { modeleId: m["oral-3-8"] })).corps.conseil;
    const r = await appeler(renvoyer, {
      cookie: cookieOrtho,
      params: p(patient.id, { conseilId: copie.id }),
      corps: { planification: { repetition: "HEBDOMADAIRE" } },
    });
    expect(r.status).toBe(201);
    expect(r.corps.conseil.nbEnvois).toBe(2);
    expect(r.corps.conseil.plans).toHaveLength(1);
    expect(r.corps.conseil.plans[0].repetition).toBe("HEBDOMADAIRE");

    const a = await appeler(arreter, {
      methode: "DELETE",
      cookie: cookieOrtho,
      params: p(patient.id, { planId: r.corps.conseil.plans[0].id }),
    });
    expect(a.status).toBe(200);
    expect(a.corps.conseil.plans).toEqual([]);
    await creerEnvoisDus(db(), patient.id, new Date(Date.now() + 30 * JOUR));
    expect(await db().envoiConseil.count({ where: { patientId: patient.id } })).toBe(2);
  });
});

describe("droits", () => {
  it("un autre parent, ou un parent d'un autre cabinet : 404 (lecture et « J'ai compris »)", async () => {
    const { patient, bearer } = await famille();
    await envoi(patient.id, { modeleId: m["oral-3-8"] });
    const envoiId = (await listeRecus(patient.id, bearer)).corps.conseils[0].envoiId;

    const autre = await famille();
    expect((await listeRecus(patient.id, autre.bearer)).status).toBe(404);
    const lu = await appeler(compris, {
      bearer: autre.bearer,
      params: p(patient.id, { envoiId }),
      corps: {},
    });
    expect(lu.status).toBe(404);
    // Avec SON patient dans l'adresse mais l'envoi d'un autre : 404 aussi.
    const detourne = await appeler(compris, {
      bearer: autre.bearer,
      params: p(autre.patient.id, { envoiId }),
      corps: {},
    });
    expect(detourne.status).toBe(404);
    expect((await db().envoiConseil.findUniqueOrThrow({ where: { id: envoiId } })).luLe).toBeNull();

    const parentB = await creerCompte("PARENT", cabB.id);
    expect((await listeRecus(patient.id, await jetonMobile(parentB.id))).status).toBe(404);
  });

  it("parent sans consentement « données de santé » : 403 consentement requis", async () => {
    const parent = await creerCompte("PARENT", cabA.id);
    const patient = await creerPatient(cabA.id, { tuteurIds: [parent.id], consentement: false });
    const r = await listeRecus(patient.id, await jetonMobile(parent.id));
    expect(r.status).toBe(403);
    expect(r.corps.erreur.code).toBe("consentement_requis");
  });

  it("patient adulte : pas de conseils (réservés aux parents)", async () => {
    const compte = await creerCompte("PATIENT_ADULT", cabA.id);
    const dossier = await creerPatient(cabA.id, { age: 34, compteUserId: compte.id });
    expect((await listeRecus(dossier.id, await jetonMobile(compte.id))).status).toBe(404);
  });

  it("le parent ne peut ni envoyer, ni ré-envoyer, ni arrêter, ni voir l'écran orthophoniste", async () => {
    const { patient, bearer } = await famille();
    const copie = (
      await envoi(patient.id, {
        modeleId: m["oral-3-8"],
        planification: { repetition: "HEBDOMADAIRE" },
      })
    ).corps.conseil;
    expect(
      (
        await appeler(envoyer, {
          bearer,
          params: p(patient.id),
          corps: { modeleId: m["oral-3-8"] },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await appeler(renvoyer, {
          bearer,
          params: p(patient.id, { conseilId: copie.id }),
          corps: {},
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await appeler(arreter, {
          methode: "DELETE",
          bearer,
          params: p(patient.id, { planId: copie.plans[0].id }),
        })
      ).status,
    ).toBe(404);
    expect((await appeler(lirePatient, { bearer, params: p(patient.id) })).status).toBe(404);
  });

  it("l'orthophoniste d'un autre cabinet : 404 partout", async () => {
    const { patient } = await famille();
    const copie = (
      await envoi(patient.id, {
        modeleId: m["oral-3-8"],
        planification: { repetition: "HEBDOMADAIRE" },
      })
    ).corps.conseil;
    expect(
      (await appeler(lirePatient, { cookie: cookieOrthoB, params: p(patient.id) })).status,
    ).toBe(404);
    expect((await envoi(patient.id, { modeleId: m["oral-3-8"] }, cookieOrthoB)).status).toBe(404);
    expect(
      (
        await appeler(renvoyer, {
          cookie: cookieOrthoB,
          params: p(patient.id, { conseilId: copie.id }),
          corps: {},
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await appeler(arreter, {
          methode: "DELETE",
          cookie: cookieOrthoB,
          params: p(patient.id, { planId: copie.plans[0].id }),
        })
      ).status,
    ).toBe(404);
  });

  it("un conseil ou un plan d'un autre patient ne peut pas être visé par l'adresse", async () => {
    const a = await famille();
    const b = await famille();
    const copieA = (
      await envoi(a.patient.id, {
        modeleId: m["oral-3-8"],
        planification: { repetition: "HEBDOMADAIRE" },
      })
    ).corps.conseil;
    expect(
      (
        await appeler(renvoyer, {
          cookie: cookieOrtho,
          params: p(b.patient.id, { conseilId: copieA.id }),
          corps: {},
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await appeler(arreter, {
          methode: "DELETE",
          cookie: cookieOrtho,
          params: p(b.patient.id, { planId: copieA.plans[0].id }),
        })
      ).status,
    ).toBe(404);
  });

  it("l'orthophoniste ne peut pas appuyer sur « J'ai compris » à la place du parent", async () => {
    const { patient, bearer } = await famille();
    await envoi(patient.id, { modeleId: m["oral-3-8"] });
    const envoiId = (await listeRecus(patient.id, bearer)).corps.conseils[0].envoiId;
    const r = await appeler(compris, {
      cookie: cookieOrtho,
      params: p(patient.id, { envoiId }),
      corps: {},
    });
    expect(r.status).toBe(404);
  });

  it("sans connexion : 401", async () => {
    const { patient } = await famille();
    expect((await appeler(recus, { params: p(patient.id) })).status).toBe(401);
    expect((await appeler(lirePatient, { params: p(patient.id) })).status).toBe(401);
  });

  it("chaque lecture des conseils est écrite dans le journal d'accès, sans contenu", async () => {
    const { patient, bearer, parent } = await famille();
    await appeler(lirePatient, { cookie: cookieOrtho, params: p(patient.id) });
    await listeRecus(patient.id, bearer);
    const lignes = await db().journalAcces.findMany({
      where: { patientId: patient.id, section: "conseils", action: "LECTURE" },
    });
    expect(lignes.map((l) => l.userId).sort()).toEqual([ortho.id, parent.id].sort());
  });
});
