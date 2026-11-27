import type { Prisma, PrismaClient } from "@app/db";
import {
  FILTRES_VIDES,
  filtrerExercices,
  type ExerciceBibliotheque,
  type FiltresBibliotheque,
  type Niveau,
  type NouvelExercice,
} from "@app/shared";
import { can, type Acteur } from "./droits";
import { erreurs } from "./erreurs";

// Bibliothèque d'exercices (hors dossier patient : aucune donnée de santé ici).

const inclusion = (userId: string) =>
  ({
    categorie: { select: { id: true, nom: true, slug: true } },
    niveaux: { orderBy: { niveau: "asc" }, select: { niveau: true, consigne: true } },
    favoris: { where: { userId }, select: { userId: true } },
  }) satisfies Prisma.ExerciceInclude;

type ExerciceCharge = Prisma.ExerciceGetPayload<{ include: ReturnType<typeof inclusion> }>;

function versBibliotheque(e: ExerciceCharge, acteur: Acteur): ExerciceBibliotheque {
  return {
    id: e.id,
    titre: e.titre,
    description: e.description,
    apercuConsigne: e.apercuConsigne,
    apercuImage: e.apercuImage,
    materiel: e.materiel,
    dureeMinutes: e.dureeMinutes,
    scoreMax: e.scoreMax,
    ageMin: e.ageMin,
    ageMax: e.ageMax,
    categorie: e.categorie,
    niveaux: e.niveaux.map((n) => ({ niveau: n.niveau as Niveau, consigne: n.consigne })),
    perso: e.cabinetId !== null && e.cabinetId === acteur.cabinetId,
    aValider: e.aValider,
    favori: e.favoris.length > 0,
  };
}

/**
 * Exercices visibles (communs + ceux du cabinet), filtrés avec la MÊME logique
 * que le composant <BibliothequeSelecteur>. Double contrôle : filtre en base, puis `can()`.
 */
export async function listerExercices(
  prisma: PrismaClient,
  acteur: Acteur,
  filtres: FiltresBibliotheque = FILTRES_VIDES,
): Promise<ExerciceBibliotheque[]> {
  if (!can(acteur, "lire", { type: "exercice", cabinetId: null })) throw erreurs.introuvable();
  const exercices = await prisma.exercice.findMany({
    where: { OR: [{ cabinetId: null }, { cabinetId: acteur.cabinetId }] },
    include: inclusion(acteur.id),
    orderBy: [{ titre: "asc" }],
  });
  const visibles = exercices
    .filter((e) => can(acteur, "lire", { type: "exercice", cabinetId: e.cabinetId }))
    .map((e) => versBibliotheque(e, acteur));
  return filtrerExercices(visibles, filtres);
}

async function exerciceAutorise(
  prisma: PrismaClient,
  acteur: Acteur,
  id: string,
  action: "lire" | "modifier" | "supprimer",
) {
  const e = await prisma.exercice.findUnique({ where: { id }, include: inclusion(acteur.id) });
  if (!e || !can(acteur, action, { type: "exercice", cabinetId: e.cabinetId })) {
    throw erreurs.introuvable();
  }
  return e;
}

export async function lireExercice(prisma: PrismaClient, acteur: Acteur, id: string) {
  return versBibliotheque(await exerciceAutorise(prisma, acteur, id, "lire"), acteur);
}

async function verifierCategorie(prisma: PrismaClient, categorieId: string) {
  if (!(await prisma.categorie.findUnique({ where: { id: categorieId } }))) {
    throw erreurs.pathologieInconnue();
  }
}

const champsExercice = (d: NouvelExercice) => ({
  titre: d.titre,
  description: d.description,
  categorieId: d.categorieId,
  ageMin: d.ageMin,
  ageMax: d.ageMax,
  dureeMinutes: d.dureeMinutes,
  scoreMax: d.scoreMax,
  materiel: d.materiel,
  apercuConsigne: d.apercuConsigne,
});

/** « Mes exercices » : création dans le cabinet de l'orthophoniste, avec ses 3 niveaux. */
export async function creerExercice(prisma: PrismaClient, acteur: Acteur, d: NouvelExercice) {
  if (!can(acteur, "creer", { type: "cabinet", id: acteur.cabinetId })) {
    throw erreurs.introuvable();
  }
  await verifierCategorie(prisma, d.categorieId);
  const e = await prisma.exercice.create({
    data: {
      ...champsExercice(d),
      cabinetId: acteur.cabinetId,
      auteurId: acteur.id,
      aValider: false,
      niveaux: { create: d.niveaux.map((consigne, i) => ({ niveau: i + 1, consigne })) },
    },
    include: inclusion(acteur.id),
  });
  return versBibliotheque(e, acteur);
}

export async function modifierExercice(
  prisma: PrismaClient,
  acteur: Acteur,
  id: string,
  d: NouvelExercice,
) {
  await exerciceAutorise(prisma, acteur, id, "modifier");
  await verifierCategorie(prisma, d.categorieId);
  await prisma.$transaction(async (tx) => {
    await tx.exercice.update({ where: { id }, data: champsExercice(d) });
    for (const [i, consigne] of d.niveaux.entries()) {
      await tx.niveauExercice.upsert({
        where: { exerciceId_niveau: { exerciceId: id, niveau: i + 1 } },
        create: { exerciceId: id, niveau: i + 1, consigne },
        update: { consigne },
      });
    }
  });
  return lireExercice(prisma, acteur, id);
}

export async function supprimerExercice(prisma: PrismaClient, acteur: Acteur, id: string) {
  await exerciceAutorise(prisma, acteur, id, "supprimer");
  if ((await prisma.elementProgramme.count({ where: { exerciceId: id } })) > 0) {
    throw erreurs.exerciceUtilise();
  }
  await prisma.exercice.delete({ where: { id } });
}

/** Favori personnel de l'orthophoniste (sur tout exercice qu'il peut lire). */
export async function definirFavori(
  prisma: PrismaClient,
  acteur: Acteur,
  id: string,
  favori: boolean,
) {
  await exerciceAutorise(prisma, acteur, id, "lire");
  if (favori) {
    await prisma.favori.upsert({
      where: { userId_exerciceId: { userId: acteur.id, exerciceId: id } },
      create: { userId: acteur.id, exerciceId: id },
      update: {},
    });
  } else {
    await prisma.favori.deleteMany({ where: { userId: acteur.id, exerciceId: id } });
  }
}
