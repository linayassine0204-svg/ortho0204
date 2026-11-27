import { z } from "zod";
import { motsNormalises, type Niveau } from "./bibliotheque.ts";
import { jourDeDate, type Jour } from "./programme.ts";
import type { Ressenti } from "./realisation.ts";

// Préparation d'une séance au cabinet.
// - Proposition : des RÈGLES SIMPLES (pathologie, âge, derniers résultats). Aucune IA,
//   aucun service externe : la même fonction pure tourne partout et se teste seule.
// - Résumé de ce qui a été fait à la maison depuis la dernière séance.
// - Matériel à préparer, calculé à partir des exercices de la séance.

// ─── Proposition ────────────────────────────────────────────────────────────

/** Nombre d'exercices proposés pour une séance. */
export const NOMBRE_EXERCICES_PROPOSES = 4;
/** Nombre de réalisations récentes regardées pour juger les résultats d'un exercice. */
export const REALISATIONS_POUR_JUGER = 3;
/** Score moyen à atteindre (part du « sur N ») pour des résultats « bons ». */
export const SEUIL_SCORE_BON = 0.8;

/** D'où vient un exercice de la séance. */
export const ORIGINES_ELEMENT = ["PROPOSITION", "BIBLIOTHEQUE", "COPIE"] as const;
export type OrigineElement = (typeof ORIGINES_ELEMENT)[number];

export const RAISONS_PROPOSITION = ["NIVEAU_SUIVANT", "NIVEAU_EN_COURS", "NOUVEAU"] as const;
export type RaisonProposition = (typeof RAISONS_PROPOSITION)[number];

/** Exercice de la bibliothèque, réduit à ce qui sert à la proposition. */
export interface ExercicePropose {
  id: string;
  categorie: { slug: string };
  ageMin: number;
  ageMax: number;
}

/** Exercice déjà travaillé par le patient, avec son niveau en cours. */
export interface ExerciceTravaille {
  exerciceId: string;
  niveau: number;
}

/** Résultat d'une réalisation à la maison (dernières réalisations du patient). */
export interface ResultatRealisation {
  exerciceId: string;
  date: Date | string;
  fait: boolean;
  ressenti: Ressenti | null;
  score: number | null;
  scoreMax: number | null;
}

export interface EntreeProposition {
  patient: { age: number; pathologies: readonly string[] };
  /** Exercices visibles dans la bibliothèque (dans l'ordre où l'on veut les proposer). */
  exercices: readonly ExercicePropose[];
  /**
   * Exercices déjà travaillés, les plus récents d'abord (dernière séance, puis programme).
   * Le premier niveau trouvé pour un exercice est son niveau en cours.
   */
  travailles: readonly ExerciceTravaille[];
  /** Réalisations à la maison depuis la dernière séance. */
  resultats: readonly ResultatRealisation[];
  /** Exercices à ne pas proposer (déjà dans la séance). */
  exclus?: readonly string[];
  nombre?: number;
}

export interface Proposition {
  exerciceId: string;
  niveau: Niveau;
  raison: RaisonProposition;
}

/** Même pathologie que le patient (l'une de ses pathologies) et âge dans la tranche. */
export function convientPourSeance(
  exercice: ExercicePropose,
  patient: EntreeProposition["patient"],
): boolean {
  return (
    patient.pathologies.includes(exercice.categorie.slug) &&
    patient.age >= exercice.ageMin &&
    patient.age <= exercice.ageMax
  );
}

/**
 * Derniers résultats « bons » pour un exercice : ses 3 dernières réalisations sont
 * toutes faites, aucune n'est ressentie « difficile », et
 * - si des scores existent : score moyen d'au moins 80 % ;
 * - sinon : au moins 2 ressentis « facile ».
 * Moins de 3 réalisations : on ne sait pas, donc pas « bons ».
 */
export function resultatsBons(resultats: readonly ResultatRealisation[]): boolean {
  const derniers = [...resultats]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, REALISATIONS_POUR_JUGER);
  if (derniers.length < REALISATIONS_POUR_JUGER) return false;
  if (derniers.some((r) => !r.fait || r.ressenti === "DIFFICILE")) return false;
  const notes = derniers.filter((r) => r.score !== null && r.scoreMax !== null && r.scoreMax > 0);
  if (notes.length > 0) {
    const moyenne =
      notes.reduce((somme, r) => somme + (r.score ?? 0) / (r.scoreMax ?? 1), 0) / notes.length;
    return moyenne >= SEUIL_SCORE_BON;
  }
  return derniers.filter((r) => r.ressenti === "FACILE").length >= 2;
}

const versNiveau = (n: number): Niveau => Math.min(3, Math.max(1, Math.round(n))) as Niveau;

/**
 * Séance proposée, par des règles simples :
 * 1. seulement des exercices de la pathologie et de l'âge du patient ;
 * 2. d'abord ceux déjà travaillés : niveau suivant si les derniers résultats sont bons
 *    (sans dépasser 3), niveau en cours sinon ;
 * 3. puis des exercices nouveaux, au niveau 1, en alternant les pathologies du patient.
 */
export function proposerSeance(entree: EntreeProposition): Proposition[] {
  const nombre = entree.nombre ?? NOMBRE_EXERCICES_PROPOSES;
  const exclus = new Set(entree.exclus ?? []);
  const candidats = entree.exercices.filter(
    (e) => !exclus.has(e.id) && convientPourSeance(e, entree.patient),
  );
  const parId = new Map(candidats.map((e) => [e.id, e]));

  const niveauEnCours = new Map<string, number>();
  for (const t of entree.travailles) {
    if (!niveauEnCours.has(t.exerciceId)) niveauEnCours.set(t.exerciceId, t.niveau);
  }

  const propositions: Proposition[] = [];
  for (const [exerciceId, niveau] of niveauEnCours) {
    if (propositions.length >= nombre) break;
    if (!parId.has(exerciceId)) continue;
    const bons = resultatsBons(entree.resultats.filter((r) => r.exerciceId === exerciceId));
    const monte = bons && niveau < 3;
    propositions.push({
      exerciceId,
      niveau: versNiveau(monte ? niveau + 1 : niveau),
      raison: monte ? "NIVEAU_SUIVANT" : "NIVEAU_EN_COURS",
    });
  }

  // Exercices nouveaux : une pathologie après l'autre, dans l'ordre de la bibliothèque.
  const files = entree.patient.pathologies.map((slug) =>
    candidats.filter((e) => e.categorie.slug === slug && !niveauEnCours.has(e.id)),
  );
  while (propositions.length < nombre && files.some((f) => f.length > 0)) {
    for (const file of files) {
      const suivant = file.shift();
      if (suivant && propositions.length < nombre) {
        propositions.push({ exerciceId: suivant.id, niveau: 1, raison: "NOUVEAU" });
      }
    }
  }
  return propositions;
}

// ─── Résumé de la maison depuis la dernière séance ──────────────────────────

/** Exercice du programme actif, tel qu'il sert au résumé. */
export interface ElementPourResume {
  elementId: string;
  titre: string;
  foisParSemaine: number;
  jours: readonly Jour[];
}

export interface RealisationPourResume {
  elementId: string;
  /** Jour de la réalisation (AAAA-MM-JJ, heure de Paris). */
  jour: string;
  fait: boolean;
  ressenti: Ressenti | null;
  score: number | null;
  scoreMax: number | null;
}

export interface Ressentis {
  FACILE: number;
  MOYEN: number;
  DIFFICILE: number;
}

export interface LigneResume {
  elementId: string;
  titre: string;
  prevues: number;
  faites: number;
  /** Faites / prévues (0 à 1). null si rien n'était prévu. */
  taux: number | null;
  ressentis: Ressentis;
  /** Score moyen en part du « sur N » (0 à 1). null sans score. */
  scoreMoyen: number | null;
  /** Dernier score saisi, ex. { score: 7, scoreMax: 10 }. */
  dernierScore: { score: number; scoreMax: number } | null;
}

export interface ResumeMaison {
  /** Premier jour compté (jour de la dernière séance). */
  depuis: string;
  /** Dernier jour compté (la veille de la préparation). */
  jusqua: string;
  prevues: number;
  faites: number;
  taux: number | null;
  ressentis: Ressentis;
  lignes: LigneResume[];
}

function ajouterJours(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Jours de `depuis` (compris) à `avant` (exclu). */
export function joursEntre(depuis: string, avant: string): string[] {
  const jours: string[] = [];
  for (let j = depuis; j < avant; j = ajouterJours(j, 1)) jours.push(j);
  return jours;
}

/**
 * Nombre de fois qu'un exercice était prévu sur une période :
 * jours fixés → nombre de ces jours dans la période ;
 * sinon → N fois par semaine, au prorata du nombre de jours (arrondi).
 */
export function realisationsPrevues(
  element: Pick<ElementPourResume, "foisParSemaine" | "jours">,
  jours: readonly string[],
): number {
  if (element.jours.length > 0) {
    return jours.filter((d) => element.jours.includes(jourDeDate(d))).length;
  }
  return Math.round((element.foisParSemaine * jours.length) / 7);
}

const ressentisVides = (): Ressentis => ({ FACILE: 0, MOYEN: 0, DIFFICILE: 0 });
const taux = (faites: number, prevues: number) =>
  prevues > 0 ? Math.min(1, faites / prevues) : null;

/**
 * Ce qui a été fait à la maison du jour de la dernière séance (compris) à aujourd'hui
 * (exclu : les exercices du jour ne sont peut-être pas encore faits).
 */
export function resumeMaison(entree: {
  elements: readonly ElementPourResume[];
  realisations: readonly RealisationPourResume[];
  depuis: string;
  aujourdhui: string;
}): ResumeMaison {
  const jours = joursEntre(entree.depuis, entree.aujourdhui);
  const dansPeriode = entree.realisations.filter(
    (r) => r.jour >= entree.depuis && r.jour < entree.aujourdhui,
  );
  const total = ressentisVides();
  const lignes = entree.elements.map((el): LigneResume => {
    const siennes = dansPeriode
      .filter((r) => r.elementId === el.elementId)
      .sort((a, b) => a.jour.localeCompare(b.jour));
    const faites = siennes.filter((r) => r.fait);
    const ressentis = ressentisVides();
    for (const r of faites) {
      if (r.ressenti) {
        ressentis[r.ressenti] += 1;
        total[r.ressenti] += 1;
      }
    }
    const notes = faites.filter(
      (r): r is RealisationPourResume & { score: number; scoreMax: number } =>
        r.score !== null && r.scoreMax !== null && r.scoreMax > 0,
    );
    const dernier = notes.at(-1);
    const prevues = realisationsPrevues(el, jours);
    return {
      elementId: el.elementId,
      titre: el.titre,
      prevues,
      faites: faites.length,
      taux: taux(faites.length, prevues),
      ressentis,
      scoreMoyen:
        notes.length > 0
          ? notes.reduce((s, r) => s + r.score / r.scoreMax, 0) / notes.length
          : null,
      dernierScore: dernier ? { score: dernier.score, scoreMax: dernier.scoreMax } : null,
    };
  });
  const prevues = lignes.reduce((s, l) => s + l.prevues, 0);
  // Une ligne ne compte pas plus de réalisations que prévu (pas de taux > 100 %).
  const faites = lignes.reduce((s, l) => s + Math.min(l.faites, l.prevues), 0);
  return {
    depuis: entree.depuis,
    jusqua: ajouterJours(entree.aujourdhui, -1),
    prevues,
    faites,
    taux: taux(faites, prevues),
    ressentis: total,
    lignes,
  };
}

// ─── Matériel à préparer ────────────────────────────────────────────────────

export interface MaterielAPreparer {
  nom: string;
  /** Titres des exercices qui l'utilisent. */
  exercices: string[];
}

/**
 * Matériel de tous les exercices de la séance, sans doublon (majuscules, accents et
 * espaces ignorés pour comparer), trié par ordre alphabétique.
 */
export function materielSeance(
  exercices: readonly { titre: string; materiel: readonly string[] }[],
): MaterielAPreparer[] {
  const parCle = new Map<string, MaterielAPreparer>();
  for (const e of exercices) {
    for (const brut of e.materiel) {
      const nom = brut.trim().replace(/\s+/g, " ");
      const cle = motsNormalises(nom).join(" ");
      if (!cle) continue;
      const existant = parCle.get(cle);
      if (!existant) parCle.set(cle, { nom, exercices: [e.titre] });
      else if (!existant.exercices.includes(e.titre)) existant.exercices.push(e.titre);
    }
  }
  return [...parCle.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/** Durée totale de la séance, en minutes. */
export function dureeSeance(exercices: readonly { dureeMinutes: number }[]): number {
  return exercices.reduce((s, e) => s + e.dureeMinutes, 0);
}

// ─── Formats de l'API ───────────────────────────────────────────────────────

const niveauSchema = z.coerce.number().int().min(1).max(3);
const idSchema = z.string().min(1).max(100);
const texteLong = z
  .string()
  .max(10_000)
  .transform((v) => (v.trim() === "" ? null : v))
  .nullable();

/** POST …/seances/:seanceId/elements : ajout depuis le panneau Bibliothèque. */
export const ajoutElementSeanceSchema = z.object({ exerciceId: idSchema, niveau: niveauSchema });

/**
 * PATCH …/seances/:seanceId/elements/:elementId
 * - `retenu: true` : accepter une proposition ;
 * - `niveau` : changer le niveau ;
 * - `exerciceId` : remplacer par un autre exercice.
 */
export const modificationElementSeanceSchema = z
  .object({ retenu: z.literal(true), niveau: niveauSchema, exerciceId: idSchema })
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export type ModificationElementSeance = z.infer<typeof modificationElementSeanceSchema>;

/** PATCH …/seances/:seanceId : notes, points à reprendre, objectifs, matériel en plus. */
export const modificationSeanceSchema = z
  .object({
    notes: texteLong,
    pointsAReprendre: texteLong,
    objectifs: texteLong,
    materiel: texteLong,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export type ModificationSeance = z.infer<typeof modificationSeanceSchema>;

/** POST …/seances/:seanceId/copie : reprendre les exercices d'une séance passée. */
export const copieSeanceSchema = z.object({ depuisSeanceId: idSchema });
