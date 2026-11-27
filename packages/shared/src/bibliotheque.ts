import { z } from "zod";

// Bibliothèque d'exercices : recherche, filtres et pré-réglage.
// Fonctions PURES, partagées par le composant <BibliothequeSelecteur> (dans le
// navigateur) et par l'API (côté serveur) : une seule logique, testée une fois.

export const NIVEAUX = [1, 2, 3] as const;
export type Niveau = (typeof NIVEAUX)[number];

/** Choix du filtre « durée maximale », en minutes. */
export const DUREES_FILTRE = [5, 10, 15, 20, 30] as const;

/** Exercice tel que l'affiche la bibliothèque (liste + aperçu). */
export interface ExerciceBibliotheque {
  id: string;
  titre: string;
  description: string;
  apercuConsigne: string;
  apercuImage: string | null;
  materiel: string[];
  dureeMinutes: number;
  ageMin: number;
  ageMax: number;
  categorie: { id: string; nom: string; slug: string };
  niveaux: { niveau: Niveau; consigne: string }[];
  /** Exercice créé par le cabinet (« Mes exercices »), modifiable. */
  perso: boolean;
  /** Contenu d'exemple non vérifié : « à valider par un orthophoniste ». */
  aValider: boolean;
  favori: boolean;
}

export interface FiltresBibliotheque {
  /** Texte libre : tous les mots doivent être trouvés (début de mot, sans accents). */
  q: string;
  /** Slug de la pathologie (catégorie). */
  pathologie: string | null;
  /** Âge du patient : l'exercice doit convenir à cet âge. */
  age: number | null;
  /**
   * Niveau choisi. Chaque exercice a ses 3 niveaux : ce filtre n'en retire aucun,
   * il affiche la consigne de ce niveau et la recherche porte sur elle.
   */
  niveau: Niveau | null;
  /** Durée maximale en minutes. */
  dureeMax: number | null;
  mesExercices: boolean;
  favoris: boolean;
}

export const FILTRES_VIDES: FiltresBibliotheque = {
  q: "",
  pathologie: null,
  age: null,
  niveau: null,
  dureeMax: null,
  mesExercices: false,
  favoris: false,
};

/** Patient en cours, réduit à ce qui sert à pré-régler les filtres. */
export interface PatientBibliotheque {
  id: string;
  prenom: string;
  age: number;
  /** Slugs des pathologies du patient. */
  pathologies: string[];
}

/** Filtres de départ en mode sélection : pathologie et âge du patient. */
export function filtresPourPatient(patient?: PatientBibliotheque | null): FiltresBibliotheque {
  if (!patient) return FILTRES_VIDES;
  return { ...FILTRES_VIDES, pathologie: patient.pathologies[0] ?? null, age: patient.age };
}

/** Minuscules, sans accents ; découpé en mots (lettres et chiffres). */
export function motsNormalises(texte: string): string[] {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Consigne d'un niveau donné. */
export function consigneNiveau(exercice: ExerciceBibliotheque, niveau: Niveau): string {
  return exercice.niveaux.find((n) => n.niveau === niveau)?.consigne ?? "";
}

function texteRecherche(e: ExerciceBibliotheque, niveau: Niveau | null): string[] {
  const consignes = niveau ? [consigneNiveau(e, niveau)] : e.niveaux.map((n) => n.consigne);
  return motsNormalises(
    [e.titre, e.description, e.apercuConsigne, e.categorie.nom, ...e.materiel, ...consignes].join(
      " ",
    ),
  );
}

export function correspond(e: ExerciceBibliotheque, f: FiltresBibliotheque): boolean {
  if (f.pathologie && e.categorie.slug !== f.pathologie) return false;
  if (f.age !== null && (f.age < e.ageMin || f.age > e.ageMax)) return false;
  if (f.dureeMax !== null && e.dureeMinutes > f.dureeMax) return false;
  if (f.mesExercices && !e.perso) return false;
  if (f.favoris && !e.favori) return false;
  const recherche = motsNormalises(f.q);
  if (recherche.length > 0) {
    const mots = texteRecherche(e, f.niveau);
    if (!recherche.every((r) => mots.some((m) => m.startsWith(r)))) return false;
  }
  return true;
}

/** Exercices qui correspondent aux filtres (l'ordre d'origine est conservé). */
export function filtrerExercices(
  exercices: readonly ExerciceBibliotheque[],
  filtres: FiltresBibliotheque,
): ExerciceBibliotheque[] {
  return exercices.filter((e) => correspond(e, filtres));
}

const entierOuNull = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? null : Number(v)),
    z.number().int().min(min).max(max).nullable(),
  );
const booleen = z.preprocess((v) => v === true || v === "1" || v === "true", z.boolean());

/** Filtres reçus en paramètres d'URL (GET /api/exercices?q=…&niveau=2…). */
export const filtresBibliothequeSchema = z.object({
  q: z.string().trim().max(100).default(""),
  pathologie: z.preprocess((v) => (v ? v : null), z.string().max(100).nullable()),
  age: entierOuNull(0, 120),
  niveau: entierOuNull(1, 3).transform((v) => v as Niveau | null),
  dureeMax: entierOuNull(1, 240),
  mesExercices: booleen,
  favoris: booleen,
});

/** Création ou modification d'un exercice du cabinet (« Mes exercices »). */
export const exerciceSchema = z
  .object({
    titre: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(1000),
    categorieId: z.string().min(1).max(100),
    ageMin: z.coerce.number().int().min(0).max(120),
    ageMax: z.coerce.number().int().min(0).max(120),
    dureeMinutes: z.coerce.number().int().min(1).max(240),
    materiel: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    apercuConsigne: z.string().trim().min(1).max(300),
    /** Exactement 3 niveaux : consignes des niveaux 1, 2 et 3. */
    niveaux: z.tuple([
      z.string().trim().min(1).max(1000),
      z.string().trim().min(1).max(1000),
      z.string().trim().min(1).max(1000),
    ]),
  })
  .refine((e) => e.ageMax >= e.ageMin, { path: ["ageMax"] });
export type NouvelExercice = z.infer<typeof exerciceSchema>;
