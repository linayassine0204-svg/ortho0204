import { z } from "zod";
import { FUSEAU_PROGRAMME, jourLocal } from "./programme.ts";

// Conseils pour la famille.
// - Proposition : un simple filtre sur les étiquettes (pathologie, tranche d'âge).
//   Aucune IA, aucun service externe : la même règle tourne partout (fonction pure).
// - Répétition : un envoi maintenant, à une date choisie, ou chaque semaine.

// ─── Proposition ────────────────────────────────────────────────────────────

/** Conseil pré-fait (modèle), tel que l'écran Conseils le reçoit. */
export interface ConseilModele {
  id: string;
  titre: string;
  aFaire: string[];
  aEviter: string[];
  /** Tranche d'âge en années. null = pas de limite de ce côté. */
  ageMin: number | null;
  ageMax: number | null;
  /** Étiquettes pathologie. */
  pathologies: { slug: string; nom: string }[];
  /** Exemple non vérifié médicalement : « à valider par un orthophoniste ». */
  aValider: boolean;
}

/** Ce qui sert à choisir les conseils d'un patient. */
export interface PatientPourConseils {
  /** Âge en années révolues. */
  age: number;
  /** Slugs des pathologies du patient. */
  pathologies: readonly string[];
}

/** Âge dans la tranche du conseil (bornes comprises ; borne absente = pas de limite). */
export function ageDansTranche(
  age: number,
  tranche: { ageMin: number | null; ageMax: number | null },
): boolean {
  return (
    (tranche.ageMin === null || age >= tranche.ageMin) &&
    (tranche.ageMax === null || age <= tranche.ageMax)
  );
}

/** Pathologies du patient présentes dans les étiquettes du conseil. */
export function pathologiesCommunes(
  modele: Pick<ConseilModele, "pathologies">,
  patient: PatientPourConseils,
): string[] {
  return modele.pathologies.map((p) => p.slug).filter((s) => patient.pathologies.includes(s));
}

/** Règle de proposition : au moins une pathologie en commun ET âge dans la tranche. */
export function convientAuPatient(
  modele: Pick<ConseilModele, "pathologies" | "ageMin" | "ageMax">,
  patient: PatientPourConseils,
): boolean {
  return pathologiesCommunes(modele, patient).length > 0 && ageDansTranche(patient.age, modele);
}

/**
 * Conseils proposés pour un patient : ceux qui conviennent, les plus ciblés d'abord
 * (plus de pathologies en commun), puis par titre. Sans pathologie renseignée : aucun.
 */
export function conseilsProposes<M extends ConseilModele>(
  modeles: readonly M[],
  patient: PatientPourConseils,
): M[] {
  return modeles
    .filter((m) => convientAuPatient(m, patient))
    .sort(
      (a, b) =>
        pathologiesCommunes(b, patient).length - pathologiesCommunes(a, patient).length ||
        a.titre.localeCompare(b.titre, "fr"),
    );
}

// ─── Contenu ────────────────────────────────────────────────────────────────

export const LIMITES_CONSEIL = { titre: 120, ligne: 300, lignes: 10 } as const;

/** Texte saisi (une idée par ligne) → liste de lignes propres (puces retirées). */
export function lignes(texte: string): string[] {
  return texte
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, "").trim())
    .filter((l) => l.length > 0);
}

const ligneSchema = z.string().trim().min(1).max(LIMITES_CONSEIL.ligne);
const blocSchema = z.array(ligneSchema).max(LIMITES_CONSEIL.lignes);

/** Contenu d'un conseil : titre, « À faire », « À éviter » (au moins une ligne en tout). */
export const contenuConseilSchema = z
  .object({
    titre: z.string().trim().min(1).max(LIMITES_CONSEIL.titre),
    aFaire: blocSchema,
    aEviter: blocSchema,
  })
  .refine((c) => c.aFaire.length + c.aEviter.length > 0);
export type ContenuConseil = z.infer<typeof contenuConseilSchema>;

/** Même contenu (pour savoir si un modèle a été modifié avant l'envoi). */
export function memeContenu(a: ContenuConseil, b: ContenuConseil): boolean {
  const memes = (x: readonly string[], y: readonly string[]) =>
    x.length === y.length && x.every((v, i) => v === y[i]);
  return a.titre === b.titre && memes(a.aFaire, b.aFaire) && memes(a.aEviter, b.aEviter);
}

// ─── Répétition ─────────────────────────────────────────────────────────────

export const REPETITIONS_CONSEIL = ["UNE_FOIS", "HEBDOMADAIRE"] as const;
export type RepetitionConseil = (typeof REPETITIONS_CONSEIL)[number];

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v);

/**
 * Quand envoyer : `date` absente = maintenant. Une date (AAAA-MM-JJ, heure de Paris)
 * ne peut pas être passée. Avec « chaque semaine », c'est la date du premier envoi.
 */
export const planificationSchema = z.object({
  repetition: z.enum(REPETITIONS_CONSEIL).default("UNE_FOIS"),
  date: dateSchema.optional(),
});
export type Planification = z.infer<typeof planificationSchema>;

/**
 * POST /api/patients/:id/conseils
 * - `modeleId` seul : envoyer le conseil pré-fait tel quel ;
 * - `modeleId` + `contenu` : envoyer le conseil pré-fait modifié ;
 * - `contenu` seul : conseil écrit de zéro.
 */
export const envoiConseilSchema = z
  .object({
    modeleId: z.string().min(1).max(100).optional(),
    contenu: contenuConseilSchema.optional(),
    planification: planificationSchema.default({ repetition: "UNE_FOIS" }),
  })
  .refine((v) => v.modeleId !== undefined || v.contenu !== undefined);
export type NouvelEnvoiConseil = z.infer<typeof envoiConseilSchema>;

/** POST /api/patients/:id/conseils/:conseilId/envois : ré-envoyer un conseil déjà envoyé. */
export const renvoiConseilSchema = z.object({
  planification: planificationSchema.default({ repetition: "UNE_FOIS" }),
});

/** Date locale + heure, minute, seconde (fuseau donné) d'un instant. */
function partiesLocales(instant: Date, fuseau: string) {
  const parties = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const val = (type: string) => Number(parties.find((p) => p.type === type)?.value ?? 0);
  return {
    annee: val("year"),
    mois: val("month"),
    jour: val("day"),
    heure: val("hour"),
    minute: val("minute"),
    seconde: val("second"),
  };
}

/** Instant correspondant à une date et une heure LOCALES (fuseau donné). */
function instantLocal(l: ReturnType<typeof partiesLocales>, ms: number, fuseau: string): Date {
  const commeUtc = Date.UTC(l.annee, l.mois - 1, l.jour, l.heure, l.minute, l.seconde, ms);
  let instant = commeUtc;
  // Deux passes suffisent, y compris autour des changements d'heure.
  for (let i = 0; i < 2; i++) {
    const p = partiesLocales(new Date(instant), fuseau);
    const vu = Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute, p.seconde, ms);
    instant += commeUtc - vu;
  }
  return new Date(instant);
}

/** Début (00:00) d'une date AAAA-MM-JJ, heure de Paris. */
export function debutDuJour(date: string, fuseau = FUSEAU_PROGRAMME): Date {
  const [annee, mois, jour] = date.split("-").map(Number) as [number, number, number];
  return instantLocal({ annee, mois, jour, heure: 0, minute: 0, seconde: 0 }, 0, fuseau);
}

/** Même heure locale, `semaines` semaines plus tard (les changements d'heure ne décalent rien). */
export function plusSemaines(instant: Date, semaines: number, fuseau = FUSEAU_PROGRAMME): Date {
  const l = partiesLocales(instant, fuseau);
  return instantLocal({ ...l, jour: l.jour + 7 * semaines }, instant.getUTCMilliseconds(), fuseau);
}

/** Date passée (avant aujourd'hui, heure de Paris) : refusée. */
export function datePassee(date: string, maintenant: Date): boolean {
  return date < jourLocal(maintenant).date;
}

/** Premier envoi : maintenant, ou le matin (00:00, Paris) de la date choisie si elle est future. */
export function premierEnvoi(planification: Planification, maintenant: Date): Date {
  const { date } = planification;
  if (date === undefined || date <= jourLocal(maintenant).date) return maintenant;
  return debutDuJour(date);
}

/**
 * Ce qu'un plan doit envoyer à l'instant `maintenant`.
 * - Rien de prévu, ou pas encore l'heure : rien.
 * - Une fois : l'envoi prévu, puis plus rien.
 * - Chaque semaine : UN seul envoi, l'occurrence due la plus récente (si personne n'a
 *   ouvert l'application pendant trois semaines, la famille ne reçoit pas trois fois le
 *   même conseil), puis la semaine suivante.
 */
export function echeance(
  plan: { repetition: RepetitionConseil; prochainEnvoi: Date | null },
  maintenant: Date,
): { envoyerLe: Date | null; prochain: Date | null } {
  const prevu = plan.prochainEnvoi;
  if (prevu === null || prevu.getTime() > maintenant.getTime()) {
    return { envoyerLe: null, prochain: prevu };
  }
  if (plan.repetition === "UNE_FOIS") return { envoyerLe: prevu, prochain: null };
  const SEMAINE_MS = 7 * 24 * 60 * 60 * 1000;
  let n = Math.floor((maintenant.getTime() - prevu.getTime()) / SEMAINE_MS);
  while (n > 0 && plusSemaines(prevu, n) > maintenant) n -= 1;
  while (plusSemaines(prevu, n + 1) <= maintenant) n += 1;
  const envoyerLe = plusSemaines(prevu, n);
  return { envoyerLe, prochain: plusSemaines(prevu, n + 1) };
}

// ─── Lecture par la famille ─────────────────────────────────────────────────

/** Conseil reçu (GET /api/patients/:id/conseils/recus) : le dernier envoi de chaque conseil. */
export interface ConseilRecu {
  envoiId: string;
  conseilId: string;
  titre: string;
  aFaire: string[];
  aEviter: string[];
  aValider: boolean;
  envoyeLe: string;
  /** « J'ai compris » : null tant que la famille ne l'a pas marqué. */
  luLe: string | null;
}
