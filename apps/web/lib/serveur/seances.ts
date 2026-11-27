import type { Prisma, PrismaClient } from "@app/db";
import {
  jourLocal,
  materielSeance,
  proposerSeance,
  resumeMaison,
  type ElementPourResume,
  type Jour,
  type ModificationElementSeance,
  type ModificationSeance,
  type Niveau,
  type OrigineElement,
  type RaisonProposition,
  type ResultatRealisation,
} from "@app/shared";
import { can, type Acteur } from "./droits";
import { erreurs } from "./erreurs";
import { listerExercices } from "./exercices";
import { journaliserAcces } from "./journal";
import { ageEnAnnees, patientAutorise } from "./patients";
import { ficheSeancePdf } from "./pdf-seance";

// Préparation d'une séance au cabinet (orthophoniste du cabinet seulement).
// - Une seule séance « en préparation » par patient (garanti par la base). Elle est
//   créée à la première ouverture de « Préparation », avec la séance PROPOSÉE.
// - Les propositions viennent de règles simples (packages/shared/src/seance.ts), sans IA.
// - L'orthophoniste accepte, change ou retire chaque proposition, et ajoute des exercices
//   depuis le panneau Bibliothèque.

const JOUR_MS = 24 * 60 * 60 * 1000;
/** Sans séance terminée, le résumé et les résultats portent sur les 14 derniers jours. */
const JOURS_SANS_SEANCE = 14;
/** Nombre de séances passées listées pour être copiées. */
const SEANCES_PASSEES = 10;

const inclusionElement = {
  exercice: { include: { categorie: true, niveaux: true } },
} satisfies Prisma.ElementSeanceInclude;

type ElementCharge = Prisma.ElementSeanceGetPayload<{ include: typeof inclusionElement }>;
type Client = PrismaClient | Prisma.TransactionClient;

/** Exercice d'une séance, tel que l'écran et la fiche PDF l'affichent. */
export interface ElementSeanceVue {
  id: string;
  exerciceId: string;
  titre: string;
  apercuConsigne: string;
  categorie: { nom: string; slug: string };
  niveau: Niveau;
  /** Consigne du niveau choisi. */
  consigne: string;
  dureeMinutes: number;
  materiel: string[];
  aValider: boolean;
  origine: OrigineElement;
  raison: RaisonProposition | null;
  /** Faux : proposition en attente (pas encore dans la séance). */
  retenu: boolean;
}

function versVue(e: ElementCharge): ElementSeanceVue {
  return {
    id: e.id,
    exerciceId: e.exerciceId,
    titre: e.exercice.titre,
    apercuConsigne: e.exercice.apercuConsigne,
    categorie: { nom: e.exercice.categorie.nom, slug: e.exercice.categorie.slug },
    niveau: e.niveau as Niveau,
    consigne: e.exercice.niveaux.find((n) => n.niveau === e.niveau)?.consigne ?? "",
    dureeMinutes: e.exercice.dureeMinutes,
    materiel: [...e.exercice.materiel],
    aValider: e.exercice.aValider,
    origine: e.origine,
    raison: e.raison,
    retenu: e.retenu,
  };
}

/** L'orthophoniste du cabinet prépare : droit « modifier » sur la section préparation. */
function autoriser(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  return patientAutorise(prisma, acteur, patientId, "modifier", "preparation");
}

/** Dernière séance terminée du patient (avant `avant` si fourni). */
function derniereSeanceTerminee(prisma: Client, patientId: string, avant?: Date) {
  return prisma.seance.findFirst({
    where: {
      patientId,
      termineeLe: { not: null },
      ...(avant ? { date: { lt: avant } } : {}),
    },
    orderBy: { date: "desc" },
    include: { elements: { where: { retenu: true }, orderBy: { ordre: "asc" } } },
  });
}

function programmeActif(prisma: Client, patientId: string) {
  return prisma.programme.findFirst({
    where: { patientId, actif: true },
    include: {
      elements: {
        where: { retireLe: null },
        orderBy: { ordre: "asc" },
        include: { exercice: { select: { titre: true } } },
      },
    },
  });
}

/** Début de la période « depuis la dernière séance » (instant). */
function debutPeriode(derniere: { date: Date } | null, maintenant: Date): Date {
  return derniere?.date ?? new Date(maintenant.getTime() - JOURS_SANS_SEANCE * JOUR_MS);
}

/**
 * Calcule la séance proposée (règles simples) pour un patient.
 * `exclus` : exercices déjà dans la séance.
 */
async function calculerPropositions(
  prisma: Client,
  acteur: Acteur,
  patientId: string,
  exclus: string[],
  maintenant: Date,
) {
  const [patient, derniere, programme] = await Promise.all([
    prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: {
        dateNaissance: true,
        pathologies: { select: { categorie: { select: { slug: true, nom: true } } } },
      },
    }),
    derniereSeanceTerminee(prisma, patientId),
    programmeActif(prisma, patientId),
  ]);
  const exercices = await listerExercices(prisma, acteur);
  const realisations = programme
    ? await prisma.realisation.findMany({
        where: {
          element: { programme: { patientId } },
          date: { gte: debutPeriode(derniere, maintenant) },
        },
        select: {
          date: true,
          fait: true,
          ressenti: true,
          score: true,
          scoreMax: true,
          element: { select: { exerciceId: true } },
        },
      })
    : [];
  const resultats: ResultatRealisation[] = realisations.map((r) => ({
    exerciceId: r.element.exerciceId,
    date: r.date,
    fait: r.fait,
    ressenti: r.ressenti,
    score: r.score,
    scoreMax: r.scoreMax,
  }));
  return proposerSeance({
    patient: {
      age: ageEnAnnees(patient.dateNaissance, maintenant),
      pathologies: patient.pathologies
        .map((p) => p.categorie)
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
        .map((c) => c.slug),
    },
    exercices,
    // Le plus récent d'abord : la dernière séance, puis le programme à la maison.
    travailles: [
      ...(derniere?.elements ?? []).map((e) => ({ exerciceId: e.exerciceId, niveau: e.niveau })),
      ...(programme?.elements ?? []).map((e) => ({ exerciceId: e.exerciceId, niveau: e.niveau })),
    ],
    resultats,
    exclus,
  });
}

/** Ajoute les propositions à la séance, à la suite des exercices déjà présents. */
async function insererPropositions(
  prisma: Client,
  acteur: Acteur,
  patientId: string,
  seanceId: string,
  maintenant: Date,
) {
  const presents = await prisma.elementSeance.findMany({
    where: { seanceId },
    select: { exerciceId: true, ordre: true },
  });
  const propositions = await calculerPropositions(
    prisma,
    acteur,
    patientId,
    presents.map((p) => p.exerciceId),
    maintenant,
  );
  const depart = Math.max(0, ...presents.map((p) => p.ordre));
  await prisma.elementSeance.createMany({
    data: propositions.map((p, i) => ({
      seanceId,
      exerciceId: p.exerciceId,
      niveau: p.niveau,
      ordre: depart + i + 1,
      origine: "PROPOSITION" as const,
      raison: p.raison,
      retenu: false,
    })),
    skipDuplicates: true,
  });
}

function estDoublon(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code: unknown }).code === "P2002"
  );
}

/** Séance en préparation du patient ; créée (avec la séance proposée) si elle n'existe pas. */
async function seanceEnPreparation(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  maintenant: Date,
) {
  const existante = await prisma.seance.findFirst({ where: { patientId, termineeLe: null } });
  if (existante) return existante;
  try {
    return await prisma.$transaction(async (tx) => {
      const seance = await tx.seance.create({
        data: { patientId, orthoId: acteur.id, date: maintenant },
      });
      await insererPropositions(tx, acteur, patientId, seance.id, maintenant);
      return seance;
    });
  } catch (erreur) {
    // Deux ouvertures simultanées : la base n'en garde qu'une, on relit celle-là.
    if (!estDoublon(erreur)) throw erreur;
    return prisma.seance.findFirstOrThrow({ where: { patientId, termineeLe: null } });
  }
}

/** Séance de ce patient (sinon 404). `modifiable` : refusée si elle est terminée. */
async function seanceDuPatient(
  prisma: Client,
  patientId: string,
  seanceId: string,
  modifiable = true,
) {
  const seance = await prisma.seance.findFirst({ where: { id: seanceId, patientId } });
  if (!seance) throw erreurs.introuvable();
  if (modifiable && seance.termineeLe !== null) throw erreurs.seanceTerminee();
  return seance;
}

async function elementsDe(prisma: Client, seanceId: string) {
  const elements = await prisma.elementSeance.findMany({
    where: { seanceId },
    orderBy: [{ ordre: "asc" }, { createdAt: "asc" }],
    include: inclusionElement,
  });
  return elements.map(versVue);
}

/** Exercice visible par l'orthophoniste (commun ou de son cabinet), sinon 404. */
async function exerciceVisible(prisma: Client, acteur: Acteur, exerciceId: string) {
  const exercice = await prisma.exercice.findUnique({ where: { id: exerciceId } });
  if (!exercice || !can(acteur, "lire", { type: "exercice", cabinetId: exercice.cabinetId })) {
    throw erreurs.introuvable();
  }
  return exercice;
}

async function prochainOrdre(prisma: Client, seanceId: string) {
  const max = await prisma.elementSeance.aggregate({
    where: { seanceId },
    _max: { ordre: true },
  });
  return (max._max.ordre ?? 0) + 1;
}

// ─── Lecture ────────────────────────────────────────────────────────────────

/**
 * Tout ce qu'affiche « Préparation » : la séance en construction (proposée + retenue),
 * le résumé avant séance et les séances passées. La lecture est journalisée.
 */
export async function lirePreparation(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  maintenant = new Date(),
) {
  await autoriser(prisma, acteur, patientId);
  await journaliserAcces(prisma, { userId: acteur.id, patientId, section: "preparation" });
  const seance = await seanceEnPreparation(prisma, acteur, patientId, maintenant);
  const [elements, derniere, programme, passees] = await Promise.all([
    elementsDe(prisma, seance.id),
    derniereSeanceTerminee(prisma, patientId),
    programmeActif(prisma, patientId),
    prisma.seance.findMany({
      where: { patientId, termineeLe: { not: null } },
      orderBy: { date: "desc" },
      take: SEANCES_PASSEES,
      include: {
        elements: {
          where: { retenu: true },
          orderBy: { ordre: "asc" },
          include: { exercice: { select: { titre: true } } },
        },
      },
    }),
  ]);

  // Résumé de la maison : du jour de la dernière séance à hier (heure de Paris).
  const aujourdhui = jourLocal(maintenant).date;
  const depuis = jourLocal(debutPeriode(derniere, maintenant)).date;
  let maison = null;
  if (programme && programme.elements.length > 0) {
    const realisations = await prisma.realisation.findMany({
      where: {
        elementProgrammeId: { in: programme.elements.map((e) => e.id) },
        date: { gte: new Date(new Date(`${depuis}T00:00:00Z`).getTime() - JOUR_MS) },
      },
      select: {
        elementProgrammeId: true,
        date: true,
        fait: true,
        ressenti: true,
        score: true,
        scoreMax: true,
      },
    });
    maison = resumeMaison({
      depuis,
      aujourdhui,
      elements: programme.elements.map((e): ElementPourResume => ({
        elementId: e.id,
        titre: e.exercice.titre,
        foisParSemaine: e.foisParSemaine,
        jours: e.jours as Jour[],
      })),
      realisations: realisations.map((r) => ({
        elementId: r.elementProgrammeId,
        jour: jourLocal(r.date).date,
        fait: r.fait,
        ressenti: r.ressenti,
        score: r.score,
        scoreMax: r.scoreMax,
      })),
    });
  }

  return {
    seance: {
      id: seance.id,
      date: seance.date,
      objectifs: seance.objectifs,
      materiel: seance.materiel,
      notes: seance.notes,
      pointsAReprendre: seance.pointsAReprendre,
      elements,
    },
    resume: {
      maison,
      derniereSeance: derniere
        ? {
            date: derniere.date,
            notes: derniere.notes,
            pointsAReprendre: derniere.pointsAReprendre,
          }
        : null,
    },
    seancesPassees: passees.map((s) => ({
      id: s.id,
      date: s.date,
      exercices: s.elements.map((e) => ({ titre: e.exercice.titre, niveau: e.niveau })),
    })),
  };
}
export type Preparation = Awaited<ReturnType<typeof lirePreparation>>;

// ─── Construction de la séance ─────────────────────────────────────────────

/**
 * Ajout depuis le panneau Bibliothèque, au niveau choisi. Si l'exercice était proposé
 * (en attente), la proposition est acceptée à ce niveau. Déjà retenu : 409.
 */
export async function ajouterElementSeance(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  seanceId: string,
  d: { exerciceId: string; niveau: number },
): Promise<ElementSeanceVue> {
  await autoriser(prisma, acteur, patientId);
  await seanceDuPatient(prisma, patientId, seanceId);
  await exerciceVisible(prisma, acteur, d.exerciceId);
  const existant = await prisma.elementSeance.findUnique({
    where: { seanceId_exerciceId: { seanceId, exerciceId: d.exerciceId } },
  });
  if (existant?.retenu) throw erreurs.dejaDansSeance();
  try {
    const element = existant
      ? await prisma.elementSeance.update({
          where: { id: existant.id },
          data: { niveau: d.niveau, retenu: true },
          include: inclusionElement,
        })
      : await prisma.elementSeance.create({
          data: {
            seanceId,
            exerciceId: d.exerciceId,
            niveau: d.niveau,
            ordre: await prochainOrdre(prisma, seanceId),
            origine: "BIBLIOTHEQUE",
          },
          include: inclusionElement,
        });
    return versVue(element);
  } catch (erreur) {
    if (estDoublon(erreur)) throw erreurs.dejaDansSeance();
    throw erreur;
  }
}

/** Élément d'une séance en préparation de ce patient (sinon 404 / 409). */
async function elementDeSeance(
  prisma: Client,
  patientId: string,
  seanceId: string,
  elementId: string,
) {
  await seanceDuPatient(prisma, patientId, seanceId);
  const element = await prisma.elementSeance.findFirst({ where: { id: elementId, seanceId } });
  if (!element) throw erreurs.introuvable();
  return element;
}

/**
 * Accepter (`retenu: true`), changer le niveau, ou remplacer par un autre exercice.
 * Changer une proposition l'accepte : l'orthophoniste l'a choisie.
 */
export async function modifierElementSeance(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  seanceId: string,
  elementId: string,
  d: ModificationElementSeance,
): Promise<ElementSeanceVue> {
  await autoriser(prisma, acteur, patientId);
  const element = await elementDeSeance(prisma, patientId, seanceId, elementId);
  const remplace = d.exerciceId !== undefined && d.exerciceId !== element.exerciceId;
  if (remplace && d.exerciceId) {
    await exerciceVisible(prisma, acteur, d.exerciceId);
    const occupe = await prisma.elementSeance.findUnique({
      where: { seanceId_exerciceId: { seanceId, exerciceId: d.exerciceId } },
    });
    if (occupe) throw erreurs.dejaDansSeance();
  }
  try {
    const misAJour = await prisma.elementSeance.update({
      where: { id: element.id },
      data: {
        retenu: true,
        niveau: d.niveau ?? (remplace ? 1 : undefined),
        ...(remplace ? { exerciceId: d.exerciceId, origine: "BIBLIOTHEQUE", raison: null } : {}),
      },
      include: inclusionElement,
    });
    return versVue(misAJour);
  } catch (erreur) {
    if (estDoublon(erreur)) throw erreurs.dejaDansSeance();
    throw erreur;
  }
}

/** Retirer un exercice (ou refuser une proposition). */
export async function retirerElementSeance(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  seanceId: string,
  elementId: string,
) {
  await autoriser(prisma, acteur, patientId);
  const element = await elementDeSeance(prisma, patientId, seanceId, elementId);
  await prisma.elementSeance.delete({ where: { id: element.id } });
}

/**
 * « Proposer à nouveau » : les propositions en attente sont remplacées par un nouveau
 * calcul ; les exercices retenus ne bougent pas et ne sont pas reproposés.
 */
export async function reproposer(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  seanceId: string,
  maintenant = new Date(),
) {
  await autoriser(prisma, acteur, patientId);
  await seanceDuPatient(prisma, patientId, seanceId);
  await prisma.$transaction(async (tx) => {
    await tx.elementSeance.deleteMany({ where: { seanceId, retenu: false } });
    await insererPropositions(tx, acteur, patientId, seanceId, maintenant);
  });
  return elementsDe(prisma, seanceId);
}

/** Notes (pendant ou après la séance), points à reprendre, objectifs, matériel en plus. */
export async function modifierSeance(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  seanceId: string,
  d: ModificationSeance,
) {
  await autoriser(prisma, acteur, patientId);
  await seanceDuPatient(prisma, patientId, seanceId);
  const seance = await prisma.seance.update({
    where: { id: seanceId },
    data: {
      notes: d.notes,
      pointsAReprendre: d.pointsAReprendre,
      objectifs: d.objectifs,
      materiel: d.materiel,
    },
  });
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "preparation",
    action: "MODIFICATION",
  });
  return {
    notes: seance.notes,
    pointsAReprendre: seance.pointsAReprendre,
    objectifs: seance.objectifs,
    materiel: seance.materiel,
  };
}

/**
 * Fin de séance : elle ne se modifie plus, ses notes et points à reprendre
 * alimentent le résumé de la suivante. Les propositions jamais acceptées sont retirées.
 */
export async function terminerSeance(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  seanceId: string,
  maintenant = new Date(),
) {
  await autoriser(prisma, acteur, patientId);
  await seanceDuPatient(prisma, patientId, seanceId);
  await prisma.$transaction([
    prisma.elementSeance.deleteMany({ where: { seanceId, retenu: false } }),
    prisma.seance.update({ where: { id: seanceId }, data: { termineeLe: maintenant } }),
  ]);
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "preparation",
    action: "MODIFICATION",
  });
}

/**
 * Réutiliser une séance passée : ses exercices (aux mêmes niveaux) rejoignent la séance
 * en préparation. Ceux déjà retenus sont laissés tels quels ; une proposition en attente
 * pour le même exercice est acceptée au niveau de la séance copiée.
 */
export async function copierSeance(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  seanceId: string,
  depuisSeanceId: string,
) {
  await autoriser(prisma, acteur, patientId);
  await seanceDuPatient(prisma, patientId, seanceId);
  if (depuisSeanceId === seanceId) throw erreurs.donneesInvalides();
  await seanceDuPatient(prisma, patientId, depuisSeanceId, false);
  const source = await prisma.elementSeance.findMany({
    where: { seanceId: depuisSeanceId, retenu: true },
    orderBy: { ordre: "asc" },
    include: { exercice: { select: { cabinetId: true } } },
  });
  const copies = await prisma.$transaction(async (tx) => {
    const presents = new Map(
      (await tx.elementSeance.findMany({ where: { seanceId } })).map((e) => [e.exerciceId, e]),
    );
    let ordre = await prochainOrdre(tx, seanceId);
    let n = 0;
    for (const e of source) {
      if (!can(acteur, "lire", { type: "exercice", cabinetId: e.exercice.cabinetId })) continue;
      const present = presents.get(e.exerciceId);
      if (present?.retenu) continue;
      if (present) {
        await tx.elementSeance.update({
          where: { id: present.id },
          data: { retenu: true, niveau: e.niveau },
        });
      } else {
        await tx.elementSeance.create({
          data: {
            seanceId,
            exerciceId: e.exerciceId,
            niveau: e.niveau,
            ordre: ordre++,
            origine: "COPIE",
          },
        });
      }
      n += 1;
    }
    return n;
  });
  return { copies, elements: await elementsDe(prisma, seanceId) };
}

// ─── Fiche de séance (PDF) ─────────────────────────────────────────────────

/**
 * Fiche imprimable d'une séance (en préparation ou passée), produite sur NOTRE serveur :
 * aucun service externe. Seuls les exercices retenus y figurent. L'export est journalisé.
 */
export async function exporterFicheSeance(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  seanceId: string,
  maintenant = new Date(),
): Promise<{ pdf: Uint8Array; nomFichier: string }> {
  await autoriser(prisma, acteur, patientId);
  const seance = await seanceDuPatient(prisma, patientId, seanceId, false);
  const [patient, ortho, elements, precedente] = await Promise.all([
    prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: { prenom: true, nom: true, dateNaissance: true },
    }),
    seance.orthoId
      ? prisma.user.findUnique({
          where: { id: seance.orthoId },
          select: { prenom: true, nom: true },
        })
      : null,
    elementsDe(prisma, seanceId),
    derniereSeanceTerminee(prisma, patientId, seance.date),
  ]);
  const retenus = elements.filter((e) => e.retenu);
  const pdf = await ficheSeancePdf({
    patient: {
      prenom: patient.prenom,
      nom: patient.nom,
      age: ageEnAnnees(patient.dateNaissance, seance.date),
    },
    date: seance.date,
    professionnel: ortho ? `${ortho.prenom} ${ortho.nom}` : null,
    objectifs: seance.objectifs,
    pointsAReprendre: precedente?.pointsAReprendre
      ? { date: precedente.date, texte: precedente.pointsAReprendre }
      : null,
    exercices: retenus,
    materiel: materielSeance(retenus),
    materielEnPlus: seance.materiel,
    notes: seance.notes,
    creeLe: maintenant,
  });
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "preparation",
    action: "EXPORT",
  });
  return { pdf, nomFichier: `fiche-seance-${jourLocal(seance.date).date}.pdf` };
}
