import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "../src/password.ts";
import { DOMAINE_FICTIF, SEMAINES_DE_REALISATIONS, seed } from "../src/seed/seed.ts";
import { AUJOURDHUI_TEST, MOT_DE_PASSE_TEST, age, clientDeTest } from "./client.ts";

const prisma = clientDeTest();
let ids: Awaited<ReturnType<typeof seed>>;

beforeAll(async () => {
  ids = await seed(prisma, { aujourdhui: AUJOURDHUI_TEST, motDePasse: MOT_DE_PASSE_TEST });
});
afterAll(() => prisma.$disconnect());

const JOUR_MS = 24 * 60 * 60 * 1000;

describe("seed : données fictives", () => {
  it("crée 1 cabinet et 1 orthophoniste", async () => {
    expect(await prisma.cabinet.count()).toBe(1);
    expect(await prisma.user.count({ where: { role: "ORTHO" } })).toBe(1);
  });

  it("crée 3 patients : Léa 7 ans, Tom 9 ans et un adulte", async () => {
    const patients = await prisma.patient.findMany();
    expect(patients).toHaveLength(3);
    const lea = patients.find((p) => p.id === ids.patients.lea);
    const tom = patients.find((p) => p.id === ids.patients.tom);
    const adulte = patients.find((p) => p.id === ids.patients.adulte);
    expect(lea?.prenom).toBe("Léa");
    expect(tom?.prenom).toBe("Tom");
    expect(age(lea?.dateNaissance ?? new Date(), AUJOURDHUI_TEST)).toBe(7);
    expect(age(tom?.dateNaissance ?? new Date(), AUJOURDHUI_TEST)).toBe(9);
    expect(age(adulte?.dateNaissance ?? new Date(), AUJOURDHUI_TEST)).toBeGreaterThanOrEqual(18);
  });

  it("rattache tous les patients et comptes au cabinet", async () => {
    expect(await prisma.patient.count({ where: { cabinetId: { not: ids.cabinetId } } })).toBe(0);
    expect(await prisma.user.count({ where: { cabinetId: { not: ids.cabinetId } } })).toBe(0);
  });

  it("lie les enfants à leurs parents ; l'adulte a son propre compte", async () => {
    const liens = await prisma.lienTuteur.findMany();
    const parentsDe = (patientId: string) =>
      liens.filter((l) => l.patientId === patientId).map((l) => l.parentId);
    expect(parentsDe(ids.patients.lea)).toEqual([ids.parents.lea]);
    expect(parentsDe(ids.patients.tom).sort()).toEqual(
      [ids.parents.tomMere, ids.parents.tomPere].sort(),
    );
    expect(parentsDe(ids.patients.adulte)).toEqual([]);

    const adulte = await prisma.patient.findUniqueOrThrow({
      where: { id: ids.patients.adulte },
      include: { compte: true },
    });
    expect(adulte.compte?.role).toBe("PATIENT_ADULT");
    expect(
      await prisma.patient.count({
        where: { id: { in: [ids.patients.lea, ids.patients.tom] }, compteUserId: { not: null } },
      }),
    ).toBe(0);
  });

  it("n'utilise que des e-mails fictifs et des mots de passe hachés", async () => {
    const comptes = await prisma.user.findMany();
    for (const c of comptes) {
      expect(c.email.endsWith(`@${DOMAINE_FICTIF}`)).toBe(true);
      expect(c.motDePasseHash).not.toContain(MOT_DE_PASSE_TEST);
    }
    expect(await verifyPassword(MOT_DE_PASSE_TEST, comptes[0]?.motDePasseHash ?? "")).toBe(true);
  });

  it("crée 2 programmes avec des exercices de niveau 1 à 3", async () => {
    const programmes = await prisma.programme.findMany({ include: { elements: true } });
    expect(programmes).toHaveLength(2);
    for (const p of programmes) {
      expect(p.elements.length).toBeGreaterThan(0);
      for (const e of p.elements) {
        expect(e.niveau).toBeGreaterThanOrEqual(1);
        expect(e.niveau).toBeLessThanOrEqual(3);
        expect(e.jours.length).toBe(e.foisParSemaine);
      }
    }
  });

  it("donne exactement 3 niveaux (1, 2, 3) et un aperçu à chaque exercice", async () => {
    const exercices = await prisma.exercice.findMany({ include: { niveaux: true } });
    expect(exercices.length).toBeGreaterThan(0);
    for (const e of exercices) {
      expect(e.niveaux.map((n) => n.niveau).sort()).toEqual([1, 2, 3]);
      expect(e.apercuConsigne.length).toBeGreaterThan(0);
    }
  });

  it("envoie les 2 programmes à la famille (version 1, avec niveau et consigne)", async () => {
    const versions = await prisma.versionProgramme.findMany();
    expect(versions).toHaveLength(2);
    for (const v of versions) {
      expect(v.numero).toBe(1);
      const contenu = v.contenu as { niveau: number; consigne: string }[];
      expect(contenu.length).toBeGreaterThan(0);
      for (const e of contenu) expect(e.consigne.length).toBeGreaterThan(0);
    }
  });

  it("crée une vingtaine d'exercices d'exemple, TOUS étiquetés « à valider »", async () => {
    const exercices = await prisma.exercice.findMany();
    expect(exercices.length).toBeGreaterThanOrEqual(18);
    expect(exercices.length).toBeLessThanOrEqual(25);
    // Le contenu d'exemple n'est jamais présenté comme validé médicalement.
    expect(exercices.every((e) => e.aValider)).toBe(true);
    expect(exercices.every((e) => e.cabinetId === null)).toBe(true);
  });

  it("répartit les exercices dans toutes les catégories", async () => {
    const categories = await prisma.categorie.findMany({
      include: { _count: { select: { exercices: true } } },
    });
    for (const c of categories) expect(c._count.exercices).toBeGreaterThan(0);
  });

  it("crée des réalisations réparties sur les 6 dernières semaines", async () => {
    const realisations = await prisma.realisation.findMany({ orderBy: { date: "asc" } });
    expect(realisations.length).toBeGreaterThan(0);
    const debut = AUJOURDHUI_TEST.getTime() - SEMAINES_DE_REALISATIONS * 7 * JOUR_MS;
    const semaines = new Set<number>();
    for (const r of realisations) {
      expect(r.date.getTime()).toBeGreaterThanOrEqual(debut);
      expect(r.date.getTime()).toBeLessThan(AUJOURDHUI_TEST.getTime());
      semaines.add(Math.floor((r.date.getTime() - debut) / (7 * JOUR_MS)));
      if (!r.fait) {
        expect(r.ressenti).toBeNull();
        expect(r.score).toBeNull();
      }
    }
    expect(semaines.size).toBe(SEMAINES_DE_REALISATIONS);
  });

  it("respecte les réglages de messagerie (cabinet activé, exception pour l'adulte)", async () => {
    const cabinet = await prisma.cabinet.findUniqueOrThrow({ where: { id: ids.cabinetId } });
    expect(cabinet.messagerieActivee).toBe(true);
    const reglage = await prisma.reglagePatient.findUnique({
      where: { patientId: ids.patients.adulte },
    });
    expect(reglage?.messagerieActivee).toBe(false);
  });

  it("propose des modèles de conseil étiquetés par pathologie", async () => {
    const modeles = await prisma.conseil.findMany({
      where: { estModele: true },
      include: { etiquettes: true },
    });
    expect(modeles.length).toBeGreaterThanOrEqual(15);
    for (const m of modeles) {
      expect(m.etiquettes.length, m.titre).toBeGreaterThan(0);
      // Deux blocs remplis, et jamais présentés comme validés médicalement.
      expect(m.aFaire.length, m.titre).toBeGreaterThan(0);
      expect(m.aEviter.length, m.titre).toBeGreaterThan(0);
      expect(m.aValider, m.titre).toBe(true);
      expect(m.ageMin ?? m.ageMax, m.titre).not.toBeNull();
    }
  });

  it("couvre chaque pathologie par au moins un conseil pré-fait", async () => {
    const categories = await prisma.categorie.findMany({
      include: { etiquettes: { where: { conseil: { estModele: true } } } },
    });
    for (const c of categories) expect(c.etiquettes.length, c.slug).toBeGreaterThan(0);
  });

  it("envoie des conseils fictifs : Léa chaque semaine (un lu), Tom une fois (pas lu)", async () => {
    const lea = await prisma.envoiConseil.findMany({
      where: { patientId: ids.patients.lea },
      orderBy: { envoyeLe: "asc" },
    });
    expect(lea.map((e) => [e.repetition, e.luParId])).toEqual([
      ["HEBDOMADAIRE", ids.parents.lea],
      ["HEBDOMADAIRE", null],
    ]);
    const tom = await prisma.envoiConseil.findMany({ where: { patientId: ids.patients.tom } });
    expect(tom.map((e) => [e.repetition, e.luLe])).toEqual([["UNE_FOIS", null]]);
  });

  it("peut être relancé et donne toujours le même résultat", async () => {
    const avant = {
      patients: await prisma.patient.count(),
      realisations: await prisma.realisation.count(),
      comptes: await prisma.user.count(),
    };
    ids = await seed(prisma, { aujourdhui: AUJOURDHUI_TEST, motDePasse: MOT_DE_PASSE_TEST });
    expect({
      patients: await prisma.patient.count(),
      realisations: await prisma.realisation.count(),
      comptes: await prisma.user.count(),
    }).toEqual(avant);
  });

  it("crée des séances passées terminées, avec exercices et points à reprendre", async () => {
    for (const patientId of Object.values(ids.patients)) {
      const seances = await prisma.seance.findMany({
        where: { patientId },
        include: { elements: true },
        orderBy: { date: "desc" },
      });
      expect(seances).toHaveLength(3);
      expect(seances.every((s) => s.termineeLe !== null && s.elements.length > 0)).toBe(true);
      expect(seances[0]?.pointsAReprendre).toBeTruthy();
      expect(seances[0]?.date.getTime()).toBeLessThan(AUJOURDHUI_TEST.getTime());
    }
  });

  it("crée un bilan initial par patient ; seul celui de Tom est partagé", async () => {
    const bilans = await prisma.bilan.findMany();
    expect(bilans).toHaveLength(3);
    expect(bilans.filter((b) => b.partage).map((b) => b.patientId)).toEqual([ids.patients.tom]);
  });

  it("garde le niveau de l'exercice sur chaque réalisation", async () => {
    expect(await prisma.realisation.count({ where: { niveau: null } })).toBe(0);
  });

  it("messagerie : horaires du cabinet, réponses rapides et conversation de Léa", async () => {
    const cabinet = await prisma.cabinet.findUniqueOrThrow({ where: { id: ids.cabinetId } });
    expect(cabinet.messagerieActivee).toBe(true);
    expect(cabinet.horairesReponse).toBeTruthy();
    expect(await prisma.reponseRapide.count({ where: { cabinetId: ids.cabinetId } })).toBe(3);
    const fil = await prisma.filMessages.findUniqueOrThrow({
      where: { patientId: ids.patients.lea },
      include: { messages: true },
    });
    expect(fil.messages.length).toBeGreaterThan(0);
  });
});
