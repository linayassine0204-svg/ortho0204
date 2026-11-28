import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seed, viderBase } from "../src/seed/seed.ts";
import { AUJOURDHUI_TEST, MOT_DE_PASSE_TEST, clientDeTest } from "./client.ts";

const prisma = clientDeTest();
afterAll(() => prisma.$disconnect());

const TABLES_ATTENDUES = [
  "bilan",
  "cabinet",
  "categorie",
  "conseil",
  "conseil_etiquette",
  "consentement",
  "document",
  "element_programme",
  "element_seance",
  "enregistrement",
  "envoi_conseil",
  "exercice",
  "favori",
  "fil_messages",
  "invitation",
  "journal_acces",
  "lien_tuteur",
  "message",
  "niveau_exercice",
  "patient",
  "patient_pathologie",
  "piece_jointe",
  "plan_conseil",
  "programme",
  "realisation",
  "reglage_patient",
  "seance",
  "session",
  "tentative_connexion",
  "utilisateur",
  "version_programme",
];

async function compter(table: string, colonne: string, valeur: string): Promise<number> {
  const lignes = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM "${table}" WHERE "${colonne}" = $1`,
    valeur,
  );
  return Number(lignes[0]?.n ?? 0);
}

describe("migration sur une base vide", () => {
  it("crée toutes les tables attendues", async () => {
    const lignes = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
      ORDER BY tablename`;
    expect(lignes.map((l) => l.tablename)).toEqual(TABLES_ATTENDUES);
  });

  it("enregistre la migration comme appliquée sans erreur", async () => {
    const lignes = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations`;
    expect(lignes.length).toBeGreaterThan(0);
    for (const l of lignes) expect(l.finished_at).not.toBeNull();
  });
});

describe("contraintes", () => {
  let ids: Awaited<ReturnType<typeof seed>>;
  beforeEach(async () => {
    ids = await seed(prisma, { aujourdhui: AUJOURDHUI_TEST, motDePasse: MOT_DE_PASSE_TEST });
  });

  it("refuse un niveau d'exercice hors de 1 à 3", async () => {
    const exercice = await prisma.exercice.findFirstOrThrow();
    await expect(
      prisma.niveauExercice.create({ data: { exerciceId: exercice.id, niveau: 4, consigne: "x" } }),
    ).rejects.toThrow();
    await expect(
      prisma.niveauExercice.create({ data: { exerciceId: exercice.id, niveau: 0, consigne: "x" } }),
    ).rejects.toThrow();
  });

  it("refuse deux fois le même niveau pour un exercice", async () => {
    const exercice = await prisma.exercice.findFirstOrThrow();
    await expect(
      prisma.niveauExercice.create({ data: { exerciceId: exercice.id, niveau: 1, consigne: "x" } }),
    ).rejects.toThrow();
  });

  it("refuse un niveau hors de 1 à 3 dans un programme", async () => {
    const element = await prisma.elementProgramme.findFirstOrThrow();
    await expect(
      prisma.elementProgramme.update({ where: { id: element.id }, data: { niveau: 5 } }),
    ).rejects.toThrow();
  });

  it("refuse deux séances en préparation pour le même patient", async () => {
    const donnees = { patientId: ids.patients.lea, date: new Date() };
    await prisma.seance.create({ data: donnees });
    await expect(prisma.seance.create({ data: donnees })).rejects.toThrow();
    // Une séance terminée de plus, elle, est acceptée.
    await prisma.seance.create({ data: { ...donnees, termineeLe: new Date() } });
  });

  it("refuse un niveau hors de 1 à 3, ou deux fois le même exercice, dans une séance", async () => {
    const element = await prisma.elementSeance.findFirstOrThrow();
    await expect(
      prisma.elementSeance.update({ where: { id: element.id }, data: { niveau: 4 } }),
    ).rejects.toThrow();
    await expect(
      prisma.elementSeance.create({
        data: {
          seanceId: element.seanceId,
          exerciceId: element.exerciceId,
          niveau: 1,
          origine: "BIBLIOTHEQUE",
        },
      }),
    ).rejects.toThrow();
  });

  it("n'accepte une proposition en attente que pour une proposition, avec sa raison", async () => {
    const element = await prisma.elementSeance.findFirstOrThrow();
    await expect(
      prisma.elementSeance.update({ where: { id: element.id }, data: { retenu: false } }),
    ).rejects.toThrow();
    await expect(
      prisma.elementSeance.update({
        where: { id: element.id },
        data: { origine: "PROPOSITION" },
      }),
    ).rejects.toThrow();
  });

  it("refuse un document partagé sans date de partage, ou une période à l'envers", async () => {
    const bilan = await prisma.bilan.findFirstOrThrow({ where: { partage: false } });
    await expect(
      prisma.bilan.update({ where: { id: bilan.id }, data: { partage: true } }),
    ).rejects.toThrow();
    await expect(
      prisma.bilan.update({
        where: { id: bilan.id },
        data: { dateDebut: new Date(bilan.date.getTime() + 86_400_000) },
      }),
    ).rejects.toThrow();
  });

  it("refuse un niveau hors de 1 à 3 sur une réalisation", async () => {
    const realisation = await prisma.realisation.findFirstOrThrow();
    await expect(
      prisma.realisation.update({ where: { id: realisation.id }, data: { niveau: 4 } }),
    ).rejects.toThrow();
  });

  it("refuse un score hors de 0 à 100", async () => {
    const realisation = await prisma.realisation.findFirstOrThrow();
    await expect(
      prisma.realisation.update({ where: { id: realisation.id }, data: { score: 101 } }),
    ).rejects.toThrow();
  });

  it("refuse un score supérieur au « sur N » de la réalisation", async () => {
    const realisation = await prisma.realisation.findFirstOrThrow();
    await expect(
      prisma.realisation.update({
        where: { id: realisation.id },
        data: { score: 8, scoreMax: 5 },
      }),
    ).rejects.toThrow();
  });

  it("refuse deux réalisations avec le même identifiant du téléphone (pas de doublon)", async () => {
    const r = await prisma.realisation.findFirstOrThrow();
    const base = { elementProgrammeId: r.elementProgrammeId, date: new Date(), fait: true };
    await prisma.realisation.create({ data: { ...base, idClient: "telephone-0001" } });
    await expect(
      prisma.realisation.create({ data: { ...base, idClient: "telephone-0001" } }),
    ).rejects.toThrow();
  });

  it("refuse un conseil sans aucune ligne « À faire » ni « À éviter »", async () => {
    const conseil = await prisma.conseil.findFirstOrThrow({ where: { estModele: true } });
    await expect(
      prisma.conseil.update({ where: { id: conseil.id }, data: { aFaire: [], aEviter: [] } }),
    ).rejects.toThrow();
  });

  it("refuse une répétition de conseil autre que « une fois » ou « chaque semaine »", async () => {
    const plan = await prisma.planConseil.findFirstOrThrow();
    await expect(
      prisma.planConseil.update({ where: { id: plan.id }, data: { repetition: "QUOTIDIENNE" } }),
    ).rejects.toThrow();
  });

  it("refuse deux fois la même occurrence d'une répétition de conseil", async () => {
    const envoi = await prisma.envoiConseil.findFirstOrThrow({ where: { planId: { not: null } } });
    await expect(
      prisma.envoiConseil.create({
        data: {
          conseilId: envoi.conseilId,
          patientId: envoi.patientId,
          planId: envoi.planId,
          envoyeLe: envoi.envoyeLe,
        },
      }),
    ).rejects.toThrow();
  });

  it("refuse un âge maximum inférieur à l'âge minimum", async () => {
    const exercice = await prisma.exercice.findFirstOrThrow();
    await expect(
      prisma.exercice.update({ where: { id: exercice.id }, data: { ageMin: 10, ageMax: 5 } }),
    ).rejects.toThrow();
  });

  it("refuse deux comptes avec le même e-mail", async () => {
    const ortho = await prisma.user.findUniqueOrThrow({ where: { id: ids.orthoId } });
    await expect(
      prisma.user.create({
        data: {
          email: ortho.email,
          motDePasseHash: "x",
          role: "ORTHO",
          prenom: "Autre",
          nom: "Exemple",
          cabinetId: ids.cabinetId,
        },
      }),
    ).rejects.toThrow();
  });

  it("refuse un consentement retiré sans date de retrait", async () => {
    await expect(
      prisma.consentement.create({
        data: {
          userId: ids.parents.lea,
          type: "MESSAGERIE",
          versionTexte: "v1",
          retire: true,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("suppressions", () => {
  let ids: Awaited<ReturnType<typeof seed>>;
  beforeEach(async () => {
    ids = await seed(prisma, { aujourdhui: AUJOURDHUI_TEST, motDePasse: MOT_DE_PASSE_TEST });
  });

  it("supprimer un patient supprime tout ce qui le concerne", async () => {
    const tom = ids.patients.tom;
    const programmes = await prisma.programme.findMany({ where: { patientId: tom } });
    const elementIds = (
      await prisma.elementProgramme.findMany({
        where: { programmeId: { in: programmes.map((p) => p.id) } },
      })
    ).map((e) => e.id);
    expect(elementIds.length).toBeGreaterThan(0);
    expect(await prisma.enregistrement.count()).toBeGreaterThan(0);

    await prisma.patient.delete({ where: { id: tom } });

    for (const table of [
      "programme",
      "seance",
      "bilan",
      "envoi_conseil",
      "plan_conseil",
      "lien_tuteur",
      "patient_pathologie",
    ]) {
      expect(await compter(table, "patientId", tom), table).toBe(0);
    }
    expect(await prisma.elementProgramme.count({ where: { id: { in: elementIds } } })).toBe(0);
    expect(await prisma.elementSeance.count({ where: { seance: { patientId: tom } } })).toBe(0);
    expect(
      await prisma.realisation.count({ where: { elementProgrammeId: { in: elementIds } } }),
    ).toBe(0);
    // Les enregistrements du seed appartenaient tous à Tom.
    expect(await prisma.enregistrement.count()).toBe(0);
  });

  it("supprimer un patient supprime ses messages, pièces jointes, conseils et réglages", async () => {
    const lea = ids.patients.lea;
    expect(await prisma.message.count()).toBeGreaterThan(0);
    await prisma.patient.delete({ where: { id: lea } });
    expect(await prisma.filMessages.count({ where: { patientId: lea } })).toBe(0);
    expect(await prisma.message.count()).toBe(0);
    expect(await prisma.pieceJointe.count()).toBe(0);
    expect(await prisma.conseil.count({ where: { patientId: lea } })).toBe(0);

    const adulte = ids.patients.adulte;
    await prisma.patient.delete({ where: { id: adulte } });
    expect(await prisma.reglagePatient.count({ where: { patientId: adulte } })).toBe(0);
  });

  it("conserve le journal d'accès et les preuves de consentement", async () => {
    const lea = ids.patients.lea;
    const journalAvant = await prisma.journalAcces.count({ where: { patientId: lea } });
    const consentementsAvant = await prisma.consentement.count({ where: { patientId: lea } });
    expect(journalAvant).toBeGreaterThan(0);
    expect(consentementsAvant).toBeGreaterThan(0);

    await prisma.patient.delete({ where: { id: lea } });

    expect(await prisma.journalAcces.count({ where: { patientId: lea } })).toBe(journalAvant);
    expect(
      await prisma.consentement.count({ where: { userId: ids.parents.lea, patientId: null } }),
    ).toBe(consentementsAvant);
  });

  it("ne supprime ni les parents, ni les exercices, ni les modèles de conseil", async () => {
    const exercices = await prisma.exercice.count();
    const modeles = await prisma.conseil.count({ where: { estModele: true } });
    await prisma.patient.delete({ where: { id: ids.patients.lea } });
    expect(await prisma.user.count({ where: { id: ids.parents.lea } })).toBe(1);
    expect(await prisma.exercice.count()).toBe(exercices);
    expect(await prisma.conseil.count({ where: { estModele: true } })).toBe(modeles);
  });

  it("supprimer un parent retire le lien tuteur mais pas l'enfant", async () => {
    await prisma.user.delete({ where: { id: ids.parents.lea } });
    expect(await prisma.lienTuteur.count({ where: { patientId: ids.patients.lea } })).toBe(0);
    expect(await prisma.patient.count({ where: { id: ids.patients.lea } })).toBe(1);
  });

  it("supprimer le compte d'un patient adulte garde son dossier", async () => {
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: ids.patients.adulte } });
    expect(patient.compteUserId).not.toBeNull();
    await prisma.user.delete({ where: { id: patient.compteUserId ?? "" } });
    const apres = await prisma.patient.findUniqueOrThrow({ where: { id: ids.patients.adulte } });
    expect(apres.compteUserId).toBeNull();
  });

  it("refuse de supprimer un cabinet qui a encore des patients", async () => {
    await expect(prisma.cabinet.delete({ where: { id: ids.cabinetId } })).rejects.toThrow();
  });

  it("refuse de supprimer un exercice utilisé dans un programme", async () => {
    const element = await prisma.elementProgramme.findFirstOrThrow();
    await expect(prisma.exercice.delete({ where: { id: element.exerciceId } })).rejects.toThrow();
  });

  it("refuse de supprimer un exercice utilisé dans une séance", async () => {
    const element = await prisma.elementSeance.findFirstOrThrow();
    await expect(prisma.exercice.delete({ where: { id: element.exerciceId } })).rejects.toThrow();
  });

  it("vider la base laisse toutes les tables vides", async () => {
    await viderBase(prisma);
    expect(await prisma.patient.count()).toBe(0);
    expect(await prisma.realisation.count()).toBe(0);
    expect(await prisma.journalAcces.count()).toBe(0);
  });
});
