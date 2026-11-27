import { z } from "zod";
import type { Niveau } from "./bibliotheque.ts";

// Programme d'exercices à la maison : contenu envoyé à la famille et plan du jour /
// de la semaine. Fonctions PURES, partagées par l'API, le seed et (tâche 6) le mobile.

export const JOURS = [
  "LUNDI",
  "MARDI",
  "MERCREDI",
  "JEUDI",
  "VENDREDI",
  "SAMEDI",
  "DIMANCHE",
] as const;
export type Jour = (typeof JOURS)[number];

/** Fuseau utilisé pour savoir « quel jour on est » (cabinets en France). */
export const FUSEAU_PROGRAMME = "Europe/Paris";

/** Exercice tel qu'il est envoyé à la famille (copie figée au moment de l'envoi). */
export interface ElementEnvoye {
  elementId: string;
  exerciceId: string;
  titre: string;
  description: string;
  apercuConsigne: string;
  apercuImage: string | null;
  materiel: string[];
  dureeMinutes: number;
  categorie: { nom: string; slug: string };
  niveau: Niveau;
  /** Consigne du niveau choisi. */
  consigne: string;
  foisParSemaine: number;
  /** Jours fixés ; vide = à placer librement dans la semaine. */
  jours: Jour[];
  motFamille: string | null;
  /** Contenu d'exemple non vérifié médicalement (« à valider »). */
  aValider: boolean;
}

/** Élément du programme tel qu'il est chargé en base (forme minimale utile). */
export interface ElementSource {
  id: string;
  ordre: number;
  niveau: number;
  foisParSemaine: number;
  jours: readonly string[];
  motFamille: string | null;
  exercice: {
    id: string;
    titre: string;
    description: string;
    apercuConsigne: string;
    apercuImage: string | null;
    materiel: string[];
    dureeMinutes: number;
    aValider: boolean;
    categorie: { nom: string; slug: string };
    niveaux: readonly { niveau: number; consigne: string }[];
  };
}

/** Construit le contenu figé d'une version envoyée, dans l'ordre du programme. */
export function contenuProgramme(elements: readonly ElementSource[]): ElementEnvoye[] {
  return [...elements]
    .sort((a, b) => a.ordre - b.ordre)
    .map((e) => ({
      elementId: e.id,
      exerciceId: e.exercice.id,
      titre: e.exercice.titre,
      description: e.exercice.description,
      apercuConsigne: e.exercice.apercuConsigne,
      apercuImage: e.exercice.apercuImage,
      materiel: [...e.exercice.materiel],
      dureeMinutes: e.exercice.dureeMinutes,
      categorie: { nom: e.exercice.categorie.nom, slug: e.exercice.categorie.slug },
      niveau: e.niveau as Niveau,
      consigne: e.exercice.niveaux.find((n) => n.niveau === e.niveau)?.consigne ?? "",
      foisParSemaine: e.foisParSemaine,
      jours: JOURS.filter((j) => e.jours.includes(j)),
      motFamille: e.motFamille,
      aValider: e.exercice.aValider,
    }));
}

/** Date locale (AAAA-MM-JJ) et jour de la semaine dans le fuseau donné. */
export function jourLocal(instant: Date, fuseau = FUSEAU_PROGRAMME): { date: string; jour: Jour } {
  const parties = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const val = (type: string) => parties.find((p) => p.type === type)?.value ?? "";
  const date = `${val("year")}-${val("month")}-${val("day")}`;
  return { date, jour: jourDeDate(date) };
}

/** Jour de la semaine d'une date AAAA-MM-JJ. */
export function jourDeDate(date: string): Jour {
  const indexDimanche0 = new Date(`${date}T12:00:00Z`).getUTCDay();
  return JOURS[(indexDimanche0 + 6) % 7] as Jour;
}

function ajouterJours(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface JourPlan {
  date: string;
  jour: Jour;
  /** Exercices prévus ce jour-là (jours fixés). */
  elements: ElementEnvoye[];
}

export interface PlanSemaine {
  /** Lundi de la semaine. */
  debut: string;
  /** Dimanche de la semaine. */
  fin: string;
  jours: JourPlan[];
  /** Exercices sans jour fixé : à faire « N fois dans la semaine », quand on veut. */
  sansJourFixe: ElementEnvoye[];
}

/** Plan de la semaine (lundi → dimanche) qui contient la date donnée. */
export function planSemaine(elements: readonly ElementEnvoye[], date: string): PlanSemaine {
  const lundi = ajouterJours(date, -JOURS.indexOf(jourDeDate(date)));
  const jours = JOURS.map((jour, i) => ({
    date: ajouterJours(lundi, i),
    jour,
    elements: elements.filter((e) => e.jours.includes(jour)),
  }));
  return {
    debut: lundi,
    fin: ajouterJours(lundi, 6),
    jours,
    sansJourFixe: elements.filter((e) => e.jours.length === 0),
  };
}

/** Programme d'un jour : exercices prévus ce jour + exercices à placer dans la semaine. */
export function planJour(elements: readonly ElementEnvoye[], date: string) {
  const jour = jourDeDate(date);
  return {
    date,
    jour,
    elements: elements.filter((e) => e.jours.includes(jour)),
    sansJourFixe: elements.filter((e) => e.jours.length === 0),
  };
}

// ─── Formats de l'API (composition par l'orthophoniste) ────────────────────

const niveauSchema = z.coerce.number().int().min(1).max(3);
const joursSchema = z
  .array(z.enum(JOURS))
  .max(7)
  .transform((liste) => JOURS.filter((j) => liste.includes(j)));
const motSchema = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v))
  .nullable();

/** POST /api/patients/:id/programme/elements */
export const ajoutElementSchema = z.object({
  exerciceId: z.string().min(1).max(100),
  niveau: niveauSchema,
  foisParSemaine: z.coerce.number().int().min(1).max(7).default(3),
  jours: joursSchema.default([]),
  motFamille: motSchema.default(null),
});
export type AjoutElement = z.infer<typeof ajoutElementSchema>;

/** PATCH /api/patients/:id/programme/elements/:elementId */
export const modificationElementSchema = z
  .object({
    niveau: niveauSchema,
    foisParSemaine: z.coerce.number().int().min(1).max(7),
    jours: joursSchema,
    motFamille: motSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export type ModificationElement = z.infer<typeof modificationElementSchema>;

/** POST …/elements/:elementId/ajuster : un niveau de plus ou de moins, en un clic. */
export const ajustementSchema = z.object({ sens: z.enum(["monter", "baisser"]) });

/** PUT /api/patients/:id/programme/ordre : tous les éléments, dans le nouvel ordre. */
export const ordreSchema = z.object({ elementIds: z.array(z.string().min(1).max(100)).max(100) });

/**
 * Règle de rythme : si des jours précis sont choisis, le nombre de fois par semaine
 * est égal au nombre de jours ; sinon on garde le nombre demandé.
 */
export function rythme(foisParSemaine: number, jours: readonly Jour[]): number {
  return jours.length > 0 ? jours.length : foisParSemaine;
}
