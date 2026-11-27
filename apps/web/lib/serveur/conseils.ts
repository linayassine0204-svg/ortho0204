import type { Prisma, PrismaClient } from "@app/db";
import {
  conseilsProposes,
  datePassee,
  echeance,
  memeContenu,
  premierEnvoi,
  type ConseilModele,
  type ConseilRecu,
  type ContenuConseil,
  type NouvelEnvoiConseil,
  type Planification,
} from "@app/shared";
import type { Acteur } from "./droits";
import { erreurs } from "./erreurs";
import { journaliserAcces } from "./journal";
import { ageEnAnnees, patientAutorise } from "./patients";

// Conseils pour la famille.
// - Modèles pré-faits (étiquettes pathologie + tranche d'âge) : les PROPOSÉS sont choisis
//   par `conseilsProposes` (@app/shared), un simple filtre. Aucune IA, aucun service externe.
// - Chaque envoi porte sur une COPIE propre au patient (tel quel, modifié, ou écrit de zéro) :
//   le texte reçu par la famille ne change plus ensuite.
// - Une planification (PlanConseil) dit quand envoyer : maintenant, à une date, chaque
//   semaine. Les envois dus sont créés à la lecture (`creerEnvoisDus`) : pas de tâche de
//   fond à faire tourner, et le même calcul partout.

type Client = PrismaClient | Prisma.TransactionClient;

const inclusionModele = {
  etiquettes: { include: { categorie: { select: { slug: true, nom: true } } } },
} satisfies Prisma.ConseilInclude;
type ModeleEnBase = Prisma.ConseilGetPayload<{ include: typeof inclusionModele }>;

function versModele(c: ModeleEnBase): ConseilModele {
  return {
    id: c.id,
    titre: c.titre,
    aFaire: c.aFaire,
    aEviter: c.aEviter,
    ageMin: c.ageMin,
    ageMax: c.ageMax,
    pathologies: c.etiquettes
      .map((e) => e.categorie)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    aValider: c.aValider,
  };
}

/** Modèles visibles par un orthophoniste : communs, et ceux de son cabinet. */
function filtreModeles(acteur: Acteur): Prisma.ConseilWhereInput {
  return { estModele: true, OR: [{ cabinetId: null }, { cabinetId: acteur.cabinetId }] };
}

const inclusionEnvoye = {
  envois: {
    orderBy: { envoyeLe: "desc" },
    include: { luPar: { select: { prenom: true } } },
  },
  plans: {
    where: { arreteLe: null, prochainEnvoi: { not: null } },
    orderBy: { prochainEnvoi: "asc" },
  },
} satisfies Prisma.ConseilInclude;
type EnvoyeEnBase = Prisma.ConseilGetPayload<{ include: typeof inclusionEnvoye }>;

/** Un conseil envoyé à ce patient, vu par l'orthophoniste (avec « lu / pas lu »). */
export interface ConseilEnvoye {
  id: string;
  titre: string;
  aFaire: string[];
  aEviter: string[];
  aValider: boolean;
  origine: "modele" | "modifie" | "libre";
  modeleSourceId: string | null;
  nbEnvois: number;
  dernierEnvoi: {
    id: string;
    envoyeLe: Date;
    luLe: Date | null;
    luPar: string | null;
  } | null;
  /** Envois encore prévus (répétition chaque semaine, ou date choisie). */
  plans: { id: string; repetition: "UNE_FOIS" | "HEBDOMADAIRE"; prochainEnvoi: Date }[];
}

function versEnvoye(c: EnvoyeEnBase): ConseilEnvoye {
  const dernier = c.envois[0];
  return {
    id: c.id,
    titre: c.titre,
    aFaire: c.aFaire,
    aEviter: c.aEviter,
    aValider: c.aValider,
    origine: c.modeleSourceId === null ? "libre" : c.modifie ? "modifie" : "modele",
    modeleSourceId: c.modeleSourceId,
    nbEnvois: c.envois.length,
    dernierEnvoi: dernier
      ? {
          id: dernier.id,
          envoyeLe: dernier.envoyeLe,
          luLe: dernier.luLe,
          luPar: dernier.luPar?.prenom ?? null,
        }
      : null,
    plans: c.plans.flatMap((p) =>
      p.prochainEnvoi && (p.repetition === "UNE_FOIS" || p.repetition === "HEBDOMADAIRE")
        ? [{ id: p.id, repetition: p.repetition, prochainEnvoi: p.prochainEnvoi }]
        : [],
    ),
  };
}

/** Plus récent d'abord (dernier envoi, sinon création). */
function activite(c: EnvoyeEnBase): number {
  return (c.envois[0]?.envoyeLe ?? c.createdAt).getTime();
}

/**
 * Crée les envois arrivés à échéance pour ce patient (un par plan au plus, voir
 * `echeance`). Deux lectures simultanées ne créent pas de doublon : contrainte unique
 * (plan, date d'envoi) + mise à jour conditionnelle du plan.
 */
export async function creerEnvoisDus(prisma: PrismaClient, patientId: string, maintenant: Date) {
  const plans = await prisma.planConseil.findMany({
    where: { patientId, arreteLe: null, prochainEnvoi: { lte: maintenant } },
  });
  for (const plan of plans) {
    if (plan.repetition !== "UNE_FOIS" && plan.repetition !== "HEBDOMADAIRE") continue;
    const { envoyerLe, prochain } = echeance(
      { repetition: plan.repetition, prochainEnvoi: plan.prochainEnvoi },
      maintenant,
    );
    if (!envoyerLe) continue;
    await prisma.$transaction([
      prisma.envoiConseil.createMany({
        data: [
          {
            conseilId: plan.conseilId,
            patientId,
            planId: plan.id,
            envoyeParId: plan.creeParId,
            repetition: plan.repetition,
            envoyeLe: envoyerLe,
          },
        ],
        skipDuplicates: true,
      }),
      prisma.planConseil.updateMany({
        where: { id: plan.id, prochainEnvoi: plan.prochainEnvoi },
        data: { prochainEnvoi: prochain },
      }),
    ]);
  }
}

/** L'orthophoniste du cabinet : droit « modifier » sur la section conseils. */
function autoriserOrtho(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  return patientAutorise(prisma, acteur, patientId, "modifier", "conseils");
}

async function conseilEnvoye(prisma: Client, conseilId: string): Promise<ConseilEnvoye> {
  return versEnvoye(
    await prisma.conseil.findUniqueOrThrow({ where: { id: conseilId }, include: inclusionEnvoye }),
  );
}

/**
 * Écran Conseils (orthophoniste) : conseils proposés pour ce patient, autres modèles,
 * conseils envoyés avec « lu / pas lu », et les parents qui les verront.
 */
export async function lireConseilsPatient(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  maintenant = new Date(),
) {
  await autoriserOrtho(prisma, acteur, patientId);
  await journaliserAcces(prisma, { userId: acteur.id, patientId, section: "conseils" });
  await creerEnvoisDus(prisma, patientId, maintenant);

  const [patient, modelesEnBase, envoyesEnBase] = await Promise.all([
    prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: {
        prenom: true,
        dateNaissance: true,
        pathologies: { select: { categorie: { select: { slug: true, nom: true } } } },
        tuteurs: { select: { parent: { select: { id: true, prenom: true, nom: true } } } },
        consentements: {
          where: { type: "DONNEES_SANTE", retire: false },
          select: { userId: true },
        },
      },
    }),
    prisma.conseil.findMany({
      where: filtreModeles(acteur),
      include: inclusionModele,
      orderBy: { titre: "asc" },
    }),
    prisma.conseil.findMany({
      where: { patientId, estModele: false },
      include: inclusionEnvoye,
    }),
  ]);

  const pathologies = patient.pathologies
    .map((p) => p.categorie)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const age = ageEnAnnees(patient.dateNaissance, maintenant);
  const modeles = modelesEnBase.map(versModele);
  const proposes = conseilsProposes(modeles, { age, pathologies: pathologies.map((p) => p.slug) });
  const idsProposes = new Set(proposes.map((m) => m.id));
  const consentants = new Set(patient.consentements.map((c) => c.userId));

  return {
    patient: { id: patientId, prenom: patient.prenom, age, pathologies },
    proposes,
    autres: modeles.filter((m) => !idsProposes.has(m.id)),
    envoyes: envoyesEnBase.sort((a, b) => activite(b) - activite(a)).map(versEnvoye),
    /** Parents qui verront les conseils (reliés, avec consentement). */
    destinataires: patient.tuteurs
      .map((l) => l.parent)
      .filter((p) => consentants.has(p.id))
      .map((p) => ({ id: p.id, prenom: p.prenom, nom: p.nom })),
  };
}
export type ConseilsPatient = Awaited<ReturnType<typeof lireConseilsPatient>>;

/** Crée la planification et, si c'est maintenant, l'envoi. */
async function planifier(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  conseilId: string,
  planification: Planification,
  maintenant: Date,
) {
  await prisma.planConseil.create({
    data: {
      conseilId,
      patientId,
      creeParId: acteur.id,
      repetition: planification.repetition,
      prochainEnvoi: premierEnvoi(planification, maintenant),
    },
  });
  await creerEnvoisDus(prisma, patientId, maintenant);
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "conseils",
    action: "MODIFICATION",
  });
}

function verifierDate(planification: Planification, maintenant: Date) {
  if (planification.date !== undefined && datePassee(planification.date, maintenant)) {
    throw erreurs.datePassee();
  }
}

/**
 * Envoi d'un conseil : modèle tel quel (`modeleId`), modèle modifié (`modeleId` +
 * `contenu`) ou écrit de zéro (`contenu`). Un conseil adapté d'un exemple garde
 * l'étiquette « à valider » : il n'est jamais présenté comme validé médicalement.
 */
export async function envoyerConseil(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  d: NouvelEnvoiConseil,
  maintenant = new Date(),
): Promise<ConseilEnvoye> {
  const patient = await autoriserOrtho(prisma, acteur, patientId);
  verifierDate(d.planification, maintenant);

  let modele: ModeleEnBase | null = null;
  if (d.modeleId !== undefined) {
    modele = await prisma.conseil.findFirst({
      where: { id: d.modeleId, ...filtreModeles(acteur) },
      include: inclusionModele,
    });
    if (!modele) throw erreurs.introuvable();
  }
  const contenu: ContenuConseil = d.contenu ?? {
    titre: modele?.titre ?? "",
    aFaire: modele?.aFaire ?? [],
    aEviter: modele?.aEviter ?? [],
  };

  const conseil = await prisma.conseil.create({
    data: {
      ...contenu,
      patientId,
      cabinetId: patient.cabinetId,
      modeleSourceId: modele?.id ?? null,
      modifie: modele !== null && !memeContenu(contenu, modele),
      aValider: modele?.aValider ?? false,
    },
  });
  await planifier(prisma, acteur, patientId, conseil.id, d.planification, maintenant);
  return conseilEnvoye(prisma, conseil.id);
}

/** Conseil déjà envoyé à CE patient (sinon 404 : pas d'accès par un autre patient). */
async function conseilDuPatient(prisma: PrismaClient, patientId: string, conseilId: string) {
  const conseil = await prisma.conseil.findFirst({
    where: { id: conseilId, patientId, estModele: false },
  });
  if (!conseil) throw erreurs.introuvable();
  return conseil;
}

/** Ré-envoyer un conseil : maintenant, à une date choisie, ou chaque semaine. */
export async function renvoyerConseil(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  conseilId: string,
  planification: Planification,
  maintenant = new Date(),
): Promise<ConseilEnvoye> {
  await autoriserOrtho(prisma, acteur, patientId);
  verifierDate(planification, maintenant);
  const conseil = await conseilDuPatient(prisma, patientId, conseilId);
  await planifier(prisma, acteur, patientId, conseil.id, planification, maintenant);
  return conseilEnvoye(prisma, conseil.id);
}

/** Arrête une répétition (ou annule un envoi prévu). Les envois déjà faits restent. */
export async function arreterPlan(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  planId: string,
): Promise<ConseilEnvoye> {
  await autoriserOrtho(prisma, acteur, patientId);
  const plan = await prisma.planConseil.findFirst({ where: { id: planId, patientId } });
  if (!plan) throw erreurs.introuvable();
  await prisma.planConseil.update({
    where: { id: plan.id },
    data: { arreteLe: new Date(), prochainEnvoi: null },
  });
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "conseils",
    action: "MODIFICATION",
  });
  return conseilEnvoye(prisma, plan.conseilId);
}

// ─── Famille (mobile) ──────────────────────────────────────────────────────

/**
 * Conseils reçus : le dernier envoi de chaque conseil, ceux à lire d'abord.
 * Droits et consentement vérifiés par `can()` (section « conseils », parents seulement) ;
 * la lecture est journalisée.
 */
export async function lireConseilsRecus(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  maintenant = new Date(),
): Promise<ConseilRecu[]> {
  await patientAutorise(prisma, acteur, patientId, "lire", "conseils");
  await creerEnvoisDus(prisma, patientId, maintenant);
  const envois = await prisma.envoiConseil.findMany({
    where: { patientId, envoyeLe: { lte: maintenant } },
    orderBy: { envoyeLe: "desc" },
    include: { conseil: true },
  });
  const vus = new Set<string>();
  const recus: ConseilRecu[] = [];
  for (const e of envois) {
    if (vus.has(e.conseilId)) continue;
    vus.add(e.conseilId);
    recus.push({
      envoiId: e.id,
      conseilId: e.conseilId,
      titre: e.conseil.titre,
      aFaire: e.conseil.aFaire,
      aEviter: e.conseil.aEviter,
      aValider: e.conseil.aValider,
      envoyeLe: e.envoyeLe.toISOString(),
      luLe: e.luLe?.toISOString() ?? null,
    });
  }
  // À lire d'abord, puis du plus récent au plus ancien (ordre déjà trié par date).
  return [...recus.filter((r) => r.luLe === null), ...recus.filter((r) => r.luLe !== null)];
}

/**
 * « J'ai compris » : marque l'envoi comme lu (et les envois plus anciens du même
 * conseil, encore non lus). Déjà lu : on garde la première lecture.
 */
export async function marquerConseilLu(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  envoiId: string,
  maintenant = new Date(),
): Promise<{ luLe: Date }> {
  await patientAutorise(prisma, acteur, patientId, "confirmerLecture", "conseils");
  const envoi = await prisma.envoiConseil.findFirst({
    where: { id: envoiId, patientId, envoyeLe: { lte: maintenant } },
  });
  if (!envoi) throw erreurs.introuvable();
  if (envoi.luLe) return { luLe: envoi.luLe };
  await prisma.envoiConseil.updateMany({
    where: {
      patientId,
      conseilId: envoi.conseilId,
      envoyeLe: { lte: envoi.envoyeLe },
      luLe: null,
    },
    data: { luLe: maintenant, luParId: acteur.id },
  });
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "conseils",
    action: "MODIFICATION",
  });
  return { luLe: maintenant };
}
