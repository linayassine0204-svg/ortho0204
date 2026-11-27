import type { Prisma, PrismaClient } from "@app/db";
import {
  contenuProgramme,
  jourLocal,
  planJour,
  planSemaine,
  rythme,
  t,
  type AjoutElement,
  type ElementEnvoye,
  type ModificationElement,
} from "@app/shared";
import { can, type Acteur } from "./droits";
import { erreurs } from "./erreurs";
import { journaliserAcces } from "./journal";
import { patientAutorise } from "./patients";

// Programme d'exercices à la maison.
// - L'orthophoniste compose le programme ACTIF du patient (brouillon toujours modifiable).
// - « Envoyer » crée une version figée : c'est elle que voit la famille, jusqu'au prochain envoi.

const inclusionElement = {
  exercice: { include: { categorie: true, niveaux: true } },
} satisfies Prisma.ElementProgrammeInclude;

const elementsActifs = {
  where: { retireLe: null },
  orderBy: { ordre: "asc" },
  include: inclusionElement,
} satisfies Prisma.Programme$elementsArgs;

type Client = PrismaClient | Prisma.TransactionClient;

function programmeActif(prisma: Client, patientId: string) {
  return prisma.programme.findFirst({
    where: { patientId, actif: true },
    include: {
      elements: elementsActifs,
      versions: { orderBy: { numero: "desc" }, take: 1 },
    },
  });
}

/** L'orthophoniste du cabinet compose : droit « modifier » sur la section programme. */
function autoriserComposition(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  return patientAutorise(prisma, acteur, patientId, "modifier", "programme");
}

async function toucher(prisma: Client, programmeId: string) {
  await prisma.programme.update({ where: { id: programmeId }, data: { modifieLe: new Date() } });
}

/** Brouillon du programme (orthophoniste) : contenu, dernier envoi, destinataires. */
export async function lireBrouillon(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  await autoriserComposition(prisma, acteur, patientId);
  await journaliserAcces(prisma, { userId: acteur.id, patientId, section: "programme" });
  const programme = await programmeActif(prisma, patientId);
  const derniere = programme?.versions[0] ?? null;
  const famille = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    select: {
      tuteurs: { select: { parent: { select: { id: true, prenom: true, nom: true } } } },
      compte: { select: { id: true, prenom: true, nom: true } },
      consentements: {
        where: { type: "DONNEES_SANTE", retire: false },
        select: { userId: true },
      },
    },
  });
  const consentants = new Set(famille.consentements.map((c) => c.userId));
  const comptes = [
    ...famille.tuteurs.map((l) => l.parent),
    ...(famille.compte ? [famille.compte] : []),
  ];
  return {
    elements: programme ? contenuProgramme(programme.elements) : [],
    derniereVersion: derniere ? { numero: derniere.numero, envoyeLe: derniere.envoyeLe } : null,
    modifieDepuisEnvoi: Boolean(programme && derniere && programme.modifieLe > derniere.envoyeLe),
    /** Comptes famille qui verront le programme envoyé (ceux qui ont consenti). */
    destinataires: comptes
      .filter((c) => consentants.has(c.id))
      .map((c) => ({ id: c.id, prenom: c.prenom, nom: c.nom })),
  };
}
export type Brouillon = Awaited<ReturnType<typeof lireBrouillon>>;

/** Ajout d'un exercice de la bibliothèque, au niveau choisi, en fin de programme. */
export async function ajouterElement(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  d: AjoutElement,
): Promise<ElementEnvoye> {
  await autoriserComposition(prisma, acteur, patientId);
  const exercice = await prisma.exercice.findUnique({ where: { id: d.exerciceId } });
  if (!exercice || !can(acteur, "lire", { type: "exercice", cabinetId: exercice.cabinetId })) {
    throw erreurs.introuvable();
  }
  const element = await prisma.$transaction(async (tx) => {
    const programme =
      (await tx.programme.findFirst({ where: { patientId, actif: true } })) ??
      (await tx.programme.create({
        data: {
          patientId,
          auteurId: acteur.id,
          titre: t("web.programme.titreParDefaut"),
          dateDebut: new Date(`${jourLocal(new Date()).date}T00:00:00Z`),
        },
      }));
    const dernier = await tx.elementProgramme.aggregate({
      where: { programmeId: programme.id },
      _max: { ordre: true },
    });
    const cree = await tx.elementProgramme.create({
      data: {
        programmeId: programme.id,
        exerciceId: d.exerciceId,
        niveau: d.niveau,
        foisParSemaine: rythme(d.foisParSemaine, d.jours),
        jours: d.jours,
        motFamille: d.motFamille,
        ordre: (dernier._max.ordre ?? 0) + 1,
      },
      include: inclusionElement,
    });
    await toucher(tx, programme.id);
    return cree;
  });
  return contenuProgramme([element])[0] as ElementEnvoye;
}

/** Élément du programme ACTIF de ce patient (sinon 404 : pas d'accès par un autre patient). */
async function elementDuPatient(prisma: Client, patientId: string, elementId: string) {
  const element = await prisma.elementProgramme.findFirst({
    where: { id: elementId, retireLe: null, programme: { patientId, actif: true } },
    include: inclusionElement,
  });
  if (!element) throw erreurs.introuvable();
  return element;
}

export async function modifierElement(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  elementId: string,
  d: ModificationElement,
): Promise<ElementEnvoye> {
  await autoriserComposition(prisma, acteur, patientId);
  const element = await elementDuPatient(prisma, patientId, elementId);
  const jours = d.jours ?? element.jours;
  if (d.foisParSemaine !== undefined && d.jours === undefined && jours.length > 0) {
    // Avec des jours fixés, le rythme se règle en cochant les jours.
    if (d.foisParSemaine !== jours.length) throw erreurs.donneesInvalides();
  }
  const misAJour = await prisma.elementProgramme.update({
    where: { id: element.id },
    data: {
      niveau: d.niveau,
      jours: d.jours,
      motFamille: d.motFamille,
      foisParSemaine: rythme(d.foisParSemaine ?? element.foisParSemaine, jours),
    },
    include: inclusionElement,
  });
  await toucher(prisma, element.programmeId);
  return contenuProgramme([misAJour])[0] as ElementEnvoye;
}

/** « Passer au niveau supérieur » / « Baisser d'un niveau », en un clic. */
export async function ajusterNiveau(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  elementId: string,
  sens: "monter" | "baisser",
): Promise<ElementEnvoye> {
  await autoriserComposition(prisma, acteur, patientId);
  const element = await elementDuPatient(prisma, patientId, elementId);
  const niveau = element.niveau + (sens === "monter" ? 1 : -1);
  if (niveau < 1 || niveau > 3) throw erreurs.niveauLimite();
  return modifierElement(prisma, acteur, patientId, elementId, { niveau });
}

/** Retrait doux : l'exercice sort du programme, l'historique des réalisations reste. */
export async function retirerElement(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  elementId: string,
) {
  await autoriserComposition(prisma, acteur, patientId);
  const element = await elementDuPatient(prisma, patientId, elementId);
  await prisma.elementProgramme.update({
    where: { id: element.id },
    data: { retireLe: new Date() },
  });
  await toucher(prisma, element.programmeId);
}

/** Nouvel ordre : la liste doit contenir exactement tous les exercices du programme. */
export async function reordonner(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  elementIds: string[],
) {
  await autoriserComposition(prisma, acteur, patientId);
  const programme = await programmeActif(prisma, patientId);
  const actuels = programme?.elements.map((e) => e.id) ?? [];
  const memes =
    elementIds.length === actuels.length &&
    new Set(elementIds).size === elementIds.length &&
    elementIds.every((id) => actuels.includes(id));
  if (!programme || !memes) throw erreurs.donneesInvalides();
  await prisma.$transaction([
    ...elementIds.map((id, i) =>
      prisma.elementProgramme.update({ where: { id }, data: { ordre: i + 1 } }),
    ),
    prisma.programme.update({ where: { id: programme.id }, data: { modifieLe: new Date() } }),
  ]);
}

/** Envoi : version figée suivante, visible par la famille (si elle a consenti). */
export async function envoyerProgramme(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  await autoriserComposition(prisma, acteur, patientId);
  const version = await prisma.$transaction(async (tx) => {
    const programme = await programmeActif(tx, patientId);
    if (!programme || programme.elements.length === 0) throw erreurs.programmeVide();
    const numero = (programme.versions[0]?.numero ?? 0) + 1;
    return tx.versionProgramme.create({
      data: {
        programmeId: programme.id,
        numero,
        envoyeParId: acteur.id,
        contenu: JSON.parse(JSON.stringify(contenuProgramme(programme.elements))),
      },
    });
  });
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "programme",
    action: "MODIFICATION",
  });
  return { numero: version.numero, envoyeLe: version.envoyeLe };
}

// ─── Lecture par la famille (mobile, espace famille du web) ────────────────

/**
 * Dernière version ENVOYÉE (jamais le brouillon). Droits et consentement vérifiés
 * par `can()` (section « programme ») ; la lecture est journalisée.
 */
export async function lireProgrammeEnvoye(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  await patientAutorise(prisma, acteur, patientId, "lire", "programme");
  const programme = await prisma.programme.findFirst({
    where: { patientId, actif: true },
    include: { versions: { orderBy: { numero: "desc" }, take: 1 } },
  });
  const version = programme?.versions[0];
  if (!programme || !version) return null;
  return {
    titre: programme.titre,
    version: version.numero,
    envoyeLe: version.envoyeLe,
    elements: version.contenu as unknown as ElementEnvoye[],
  };
}

export async function programmeDeLaSemaine(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  date = jourLocal(new Date()).date,
) {
  const envoye = await lireProgrammeEnvoye(prisma, acteur, patientId);
  if (!envoye) return { programme: null, semaine: null };
  const { elements, ...infos } = envoye;
  return { programme: { ...infos, elements }, semaine: planSemaine(elements, date) };
}

export async function programmeDuJour(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  date = jourLocal(new Date()).date,
) {
  const envoye = await lireProgrammeEnvoye(prisma, acteur, patientId);
  if (!envoye) return { programme: null, jour: null };
  const { elements, ...infos } = envoye;
  return { programme: infos, jour: planJour(elements, date) };
}
