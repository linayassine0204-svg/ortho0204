import type { Prisma, PrismaClient } from "@app/db";
import type {
  ModificationPatient,
  NouveauPatient,
  PatientBibliotheque,
  RecherchePatients,
} from "@app/shared";
import {
  can,
  type Acteur,
  type Action,
  type RessourcePatient,
  type SectionRessource,
} from "./droits";
import { erreurs } from "./erreurs";
import { journaliserAcces } from "./journal";

const inclusionDroits = {
  tuteurs: { select: { parentId: true } },
  reglage: { select: { messagerieActivee: true } },
  cabinet: { select: { messagerieActivee: true } },
  consentements: {
    where: { type: "DONNEES_SANTE", retire: false },
    select: { userId: true },
  },
} satisfies Prisma.PatientInclude;

type PatientAvecDroits = Prisma.PatientGetPayload<{ include: typeof inclusionDroits }>;

/** Construit la ressource passée à `can()` à partir du patient chargé en base. */
export function ressourcePatient(
  patient: PatientAvecDroits,
  section?: SectionRessource,
): RessourcePatient {
  return {
    type: "patient",
    cabinetId: patient.cabinetId,
    compteUserId: patient.compteUserId,
    tuteurIds: patient.tuteurs.map((l) => l.parentId),
    messagerieActivee: patient.reglage?.messagerieActivee ?? patient.cabinet.messagerieActivee,
    consentementIds: [...new Set(patient.consentements.map((c) => c.userId))],
    ...(section ? { section } : {}),
  };
}

/** Messagerie activée pour ce patient (réglage du patient, sinon du cabinet). */
export function messagerieActivee(patient: PatientAvecDroits): boolean {
  return patient.reglage?.messagerieActivee ?? patient.cabinet.messagerieActivee;
}

/**
 * Charge un patient et vérifie le droit demandé.
 * - Patient absent ou sans lien : 404, pour ne pas révéler l'existence du dossier.
 * - Compte famille relié mais sans consentement : 403 « consentement requis ».
 * Toute lecture autorisée est écrite dans le journal d'accès (sauf `journaliser: false`,
 * quand l'appelant journalise lui-même une action plus précise).
 */
export async function patientAutorise(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  action: Action,
  section?: SectionRessource,
  options: { journaliser?: boolean } = {},
): Promise<PatientAvecDroits> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: inclusionDroits,
  });
  if (!patient) throw erreurs.introuvable();
  const ressource = ressourcePatient(patient, section);
  if (!can(acteur, action, ressource)) {
    // Messagerie désactivée : refus clair, mais seulement pour qui y aurait accès sinon
    // (les autres reçoivent 404, comme d'habitude, pour ne rien révéler).
    if (
      section === "messagerie" &&
      !ressource.messagerieActivee &&
      can(acteur, action, { ...ressource, messagerieActivee: true })
    ) {
      throw erreurs.messagerieDesactivee();
    }
    // « Consentement requis » seulement si c'est bien lui qui manque (sinon : 404).
    const avecConsentement = {
      ...ressource,
      consentementIds: [...ressource.consentementIds, acteur.id],
    };
    const actionFamille =
      action === "lire" ||
      action === "realiser" ||
      action === "confirmerLecture" ||
      action === "ecrire";
    if (actionFamille && can(acteur, action, avecConsentement)) {
      throw erreurs.consentementRequis();
    }
    throw erreurs.introuvable();
  }
  if (action === "lire" && options.journaliser !== false) {
    await journaliserAcces(prisma, { userId: acteur.id, patientId, section: section ?? "resume" });
  }
  return patient;
}

/** Filtre de requête : patients qu'un acteur peut voir (premier filtre, en base). */
function filtreVisibles(acteur: Acteur): Prisma.PatientWhereInput {
  switch (acteur.role) {
    case "ORTHO":
      return { cabinetId: acteur.cabinetId };
    case "PARENT":
      return { cabinetId: acteur.cabinetId, tuteurs: { some: { parentId: acteur.id } } };
    case "PATIENT_ADULT":
      return { cabinetId: acteur.cabinetId, compteUserId: acteur.id };
    default:
      return { id: { in: [] } };
  }
}

function filtreRecherche(recherche: RecherchePatients): Prisma.PatientWhereInput[] {
  const filtres: Prisma.PatientWhereInput[] = [];
  if (recherche.q) {
    filtres.push({
      OR: [
        { prenom: { contains: recherche.q, mode: "insensitive" } },
        { nom: { contains: recherche.q, mode: "insensitive" } },
      ],
    });
  }
  if (recherche.pathologie) {
    filtres.push({ pathologies: { some: { categorie: { slug: recherche.pathologie } } } });
  }
  return filtres;
}

export type PatientListe =
  | {
      id: string;
      prenom: string;
      nom?: string;
      dateNaissance: Date;
      pathologies?: { id: string; nom: string; slug: string }[];
      /** Familles seulement : le mobile affiche l'onglet Messages si `true`. */
      messagerieActivee?: boolean;
      /** Familles seulement : accord de CE compte pour enregistrer la voix. */
      accordAudio?: boolean;
    }
  | { id: string; prenom: string; consentementRequis: true };

/**
 * Liste des patients visibles, avec recherche et filtre par pathologie.
 * Double contrôle : filtre en base, puis `can()` sur chaque ligne.
 * Une famille sans consentement ne reçoit que le prénom (pour l'écran de consentement).
 * Une famille reçoit aussi `messagerieActivee` (onglet Messages du mobile ; l'API de
 * messagerie revérifie de toute façon avec `can()`) et `accordAudio` (son propre accord
 * pour l'enregistrement de la voix).
 */
export async function listerPatientsVisibles(
  prisma: PrismaClient,
  acteur: Acteur,
  recherche: RecherchePatients = {},
): Promise<PatientListe[]> {
  const patients = await prisma.patient.findMany({
    where: { AND: [filtreVisibles(acteur), ...filtreRecherche(recherche)] },
    include: {
      ...inclusionDroits,
      pathologies: { include: { categorie: true }, orderBy: { categorie: { nom: "asc" } } },
    },
    orderBy: [{ prenom: "asc" }, { nom: "asc" }],
  });
  // Accords « enregistrement de la voix » de ce compte (familles seulement).
  const accordsAudio =
    acteur.role === "ORTHO"
      ? new Set<string>()
      : new Set(
          (
            await prisma.consentement.findMany({
              where: {
                userId: acteur.id,
                type: "ENREGISTREMENT_AUDIO",
                retire: false,
                patientId: { in: patients.map((p) => p.id) },
              },
              select: { patientId: true },
            })
          ).map((c) => c.patientId),
        );
  const resultat: PatientListe[] = [];
  for (const p of patients) {
    const ressource = ressourcePatient(p);
    if (can(acteur, "lire", ressource)) {
      resultat.push(
        acteur.role === "ORTHO"
          ? {
              id: p.id,
              prenom: p.prenom,
              nom: p.nom,
              dateNaissance: p.dateNaissance,
              pathologies: p.pathologies.map(({ categorie: c }) => ({
                id: c.id,
                nom: c.nom,
                slug: c.slug,
              })),
            }
          : {
              id: p.id,
              prenom: p.prenom,
              dateNaissance: p.dateNaissance,
              messagerieActivee: messagerieActivee(p),
              accordAudio: accordsAudio.has(p.id),
            },
      );
    } else if (can(acteur, "consentir", ressource)) {
      resultat.push({ id: p.id, prenom: p.prenom, consentementRequis: true });
    }
  }
  return resultat;
}

/** Vérifie que toutes les pathologies choisies existent. */
async function verifierPathologies(prisma: PrismaClient, ids: string[]): Promise<string[]> {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return [];
  const n = await prisma.categorie.count({ where: { id: { in: uniques } } });
  if (n !== uniques.length) throw erreurs.pathologieInconnue();
  return uniques;
}

const enDate = (jour: string) => new Date(`${jour}T00:00:00Z`);

/** Création d'un patient dans le cabinet de l'orthophoniste (jamais un autre cabinet). */
export async function creerPatient(prisma: PrismaClient, acteur: Acteur, donnees: NouveauPatient) {
  if (!can(acteur, "creer", { type: "cabinet", id: acteur.cabinetId })) {
    throw erreurs.introuvable();
  }
  const pathologieIds = await verifierPathologies(prisma, donnees.pathologieIds);
  const patient = await prisma.patient.create({
    data: {
      cabinetId: acteur.cabinetId,
      prenom: donnees.prenom,
      nom: donnees.nom,
      dateNaissance: enDate(donnees.dateNaissance),
      pathologies: { create: pathologieIds.map((categorieId) => ({ categorieId })) },
    },
  });
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId: patient.id,
    section: "fiche",
    action: "MODIFICATION",
  });
  return { id: patient.id };
}

/** Modification de la Fiche (champs envoyés seulement). */
export async function modifierPatient(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  donnees: ModificationPatient,
) {
  await patientAutorise(prisma, acteur, patientId, "modifier", "fiche");
  const pathologieIds =
    donnees.pathologieIds === undefined
      ? undefined
      : await verifierPathologies(prisma, donnees.pathologieIds);
  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: patientId },
      data: {
        prenom: donnees.prenom,
        nom: donnees.nom,
        dateNaissance: donnees.dateNaissance ? enDate(donnees.dateNaissance) : undefined,
        notes: donnees.notes,
        medecinNom: donnees.medecinNom,
        medecinContact: donnees.medecinContact,
      },
    });
    if (pathologieIds) {
      await tx.patientPathologie.deleteMany({ where: { patientId } });
      await tx.patientPathologie.createMany({
        data: pathologieIds.map((categorieId) => ({ patientId, categorieId })),
      });
    }
  });
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "fiche",
    action: "MODIFICATION",
  });
}

/**
 * Contenu complet de la Fiche (orthophoniste). La lecture est journalisée (« fiche »).
 */
export async function lireFiche(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  const base = await patientAutorise(prisma, acteur, patientId, "lire", "fiche");
  const maintenant = new Date();
  const p = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    include: {
      pathologies: { include: { categorie: true }, orderBy: { categorie: { nom: "asc" } } },
      tuteurs: {
        include: { parent: { select: { id: true, prenom: true, nom: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      compte: { select: { id: true, prenom: true, nom: true, email: true } },
      consentements: {
        where: { type: "DONNEES_SANTE", retire: false },
        orderBy: { accordeLe: "desc" },
      },
      invitations: {
        where: { utiliseeLe: null, expireLe: { gt: maintenant } },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expireLe: true },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, nomFichier: true, typeMime: true, tailleOctets: true, createdAt: true },
      },
    },
  });
  const consentementDe = (userId: string) => {
    const c = p.consentements.find((x) => x.userId === userId);
    return c ? { accordeLe: c.accordeLe, version: c.versionTexte } : null;
  };
  const contacts = [
    ...p.tuteurs.map((l) => ({
      ...l.parent,
      role: "PARENT" as const,
      consentement: consentementDe(l.parent.id),
    })),
    ...(p.compte
      ? [{ ...p.compte, role: "PATIENT_ADULT" as const, consentement: consentementDe(p.compte.id) }]
      : []),
  ];
  return {
    id: p.id,
    prenom: p.prenom,
    nom: p.nom,
    dateNaissance: p.dateNaissance,
    age: ageEnAnnees(p.dateNaissance, maintenant),
    pathologies: p.pathologies.map(({ categorie: c }) => ({ id: c.id, nom: c.nom, slug: c.slug })),
    contacts,
    invitationsEnAttente: p.invitations,
    medecinNom: p.medecinNom,
    medecinContact: p.medecinContact,
    documents: p.documents,
    notes: p.notes,
    messagerieActivee: messagerieActivee(base),
    /** Réglage du cabinet et exception du patient (null : suit le cabinet). */
    messagerie: {
      cabinet: base.cabinet.messagerieActivee,
      patient: base.reglage?.messagerieActivee ?? null,
    },
  };
}
export type Fiche = Awaited<ReturnType<typeof lireFiche>>;

/**
 * Patient réduit à ce qu'il faut pour pré-régler la bibliothèque (âge, pathologies).
 * À appeler APRÈS la vérification des droits sur ce patient.
 */
export async function patientPourBibliotheque(
  prisma: PrismaClient,
  patientId: string,
): Promise<PatientBibliotheque> {
  const p = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    select: {
      id: true,
      prenom: true,
      dateNaissance: true,
      pathologies: { select: { categorie: { select: { slug: true, nom: true } } } },
    },
  });
  return {
    id: p.id,
    prenom: p.prenom,
    age: ageEnAnnees(p.dateNaissance),
    pathologies: p.pathologies
      .map((x) => x.categorie)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
      .map((c) => c.slug),
  };
}

/** Âge en années révolues. */
export function ageEnAnnees(naissance: Date, aujourdhui = new Date()): number {
  let ans = aujourdhui.getUTCFullYear() - naissance.getUTCFullYear();
  const avantAnniversaire =
    aujourdhui.getUTCMonth() < naissance.getUTCMonth() ||
    (aujourdhui.getUTCMonth() === naissance.getUTCMonth() &&
      aujourdhui.getUTCDate() < naissance.getUTCDate());
  if (avantAnniversaire) ans -= 1;
  return ans;
}
