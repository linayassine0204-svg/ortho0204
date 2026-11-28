import { z } from "zod";
import { t, type TranslationKey } from "./i18n.ts";
import type { ResumeMaison } from "./seance.ts";

// Bilans, comptes rendus et courriers : un document est une liste de PARTIES.
// - Parties automatiques : remplies par des RÈGLES depuis les données (identité, séances,
//   taux de réalisation, scores par niveau…). Marquées « Automatique » jusqu'à relecture.
// - Parties à écrire : complétées par l'orthophoniste dans un éditeur simple.
// Aucune IA, aucun service externe : fonctions pures, testées seules.

// ─── Types de documents ─────────────────────────────────────────────────────

export const TYPES_BILAN = [
  "INITIAL",
  "EVOLUTION",
  "RENOUVELLEMENT",
  "FIN_DE_PRISE_EN_CHARGE",
  "COMPTE_RENDU_SEANCE",
  "COURRIER_MEDECIN",
  "COURRIER_ECOLE",
  "COURRIER_ASSURANCE",
] as const;
export type TypeBilan = (typeof TYPES_BILAN)[number];

/** Types proposés à la création (chacun a son modèle). */
export const TYPES_CREABLES = [
  "INITIAL",
  "EVOLUTION",
  "COMPTE_RENDU_SEANCE",
  "COURRIER_MEDECIN",
  "COURRIER_ECOLE",
  "COURRIER_ASSURANCE",
] as const satisfies readonly TypeBilan[];
export type TypeCreable = (typeof TYPES_CREABLES)[number];

export const estCourrier = (type: TypeBilan) => type.startsWith("COURRIER_");

// ─── Parties et statuts ─────────────────────────────────────────────────────

/** D'où vient le contenu d'une partie automatique. */
export const SOURCES_AUTO = [
  "IDENTITE",
  "PRESCRIPTEUR",
  "SEANCES",
  "EXERCICES_SEANCES",
  "REALISATION",
  "SCORES_PAR_NIVEAU",
  "PROGRAMME",
  "SEANCE_DU_JOUR",
  "NOTES_SEANCE",
] as const;
export type SourceAuto = (typeof SOURCES_AUTO)[number];

export const sectionDocumentSchema = z.object({
  cle: z.string().min(1).max(50),
  titre: z.string().max(200),
  /** AUTO : remplie depuis les données ; LIBRE : à écrire. */
  type: z.enum(["AUTO", "LIBRE"]),
  source: z.enum(SOURCES_AUTO).nullable(),
  /** Indication affichée dans l'éditeur (exemple à valider). */
  aide: z.string().nullable(),
  contenu: z.string(),
  /** Relu (ou écrit) par l'orthophoniste. */
  relu: z.boolean(),
});
export type SectionDocument = z.infer<typeof sectionDocumentSchema>;
export const sectionsSchema = z.array(sectionDocumentSchema);

export const STATUTS_DOCUMENT = ["A_ECRIRE", "A_RELIRE", "AUTOMATIQUE", "REMPLI"] as const;
export type StatutDocument = (typeof STATUTS_DOCUMENT)[number];

/**
 * Statut d'une partie :
 * - À écrire : partie à écrire, encore vide ;
 * - Automatique : remplie depuis les données, pas encore relue ;
 * - À relire : partie à écrire qui contient un texte de départ du modèle, pas encore relu ;
 * - Rempli : écrite ou relue par l'orthophoniste.
 */
export function statutSection(
  s: Pick<SectionDocument, "type" | "contenu" | "relu">,
): StatutDocument {
  if (s.type === "LIBRE" && s.contenu.trim() === "") return "A_ECRIRE";
  if (s.relu) return "REMPLI";
  return s.type === "AUTO" ? "AUTOMATIQUE" : "A_RELIRE";
}

/**
 * Statut d'un document : celui de sa partie la plus en retard
 * (À écrire, puis À relire, puis Automatique, puis Rempli).
 */
export function statutDocument(sections: readonly SectionDocument[]): StatutDocument {
  if (sections.length === 0) return "A_ECRIRE";
  const statuts = new Set(sections.map(statutSection));
  return STATUTS_DOCUMENT.find((s) => statuts.has(s)) ?? "REMPLI";
}

/** Nombre de parties par statut (affiché dans la liste). */
export function compterStatuts(
  sections: readonly SectionDocument[],
): Record<StatutDocument, number> {
  const compte = { A_ECRIRE: 0, A_RELIRE: 0, AUTOMATIQUE: 0, REMPLI: 0 };
  for (const s of sections) compte[statutSection(s)] += 1;
  return compte;
}

// ─── Données utilisées par le remplissage automatique ──────────────────────

export interface SeancePourBilan {
  /** AAAA-MM-JJ (heure de Paris). */
  jour: string;
  exercices: { titre: string; niveau: number }[];
  notes: string | null;
  pointsAReprendre: string | null;
}

export interface ScoreRealisation {
  titre: string;
  niveau: number;
  score: number;
  scoreMax: number;
}

export interface DonneesBilan {
  patient: {
    prenom: string;
    nom: string;
    /** AAAA-MM-JJ */
    dateNaissance: string;
    age: number;
    /** Noms des pathologies. */
    pathologies: string[];
    medecinNom: string | null;
    medecinContact: string | null;
  };
  /** Période couverte : début (null = depuis le début du suivi) et fin, AAAA-MM-JJ. */
  periode: { debut: string | null; fin: string };
  /** Séances terminées dans la période, de la plus ancienne à la plus récente. */
  seances: SeancePourBilan[];
  /** Ce qui a été fait à la maison dans la période (null : pas de programme). */
  maison: ResumeMaison | null;
  /** Réalisations faites avec un score, dans la période. */
  scores: ScoreRealisation[];
  /** Programme à la maison actuel. */
  programme: { titre: string; niveau: number; foisParSemaine: number; jours: string[] }[];
  /** Compte rendu de séance : la séance concernée. */
  seance: SeancePourBilan | null;
}

/** AAAA-MM-JJ → jj/mm/aaaa. */
export function jourFr(jour: string): string {
  const [a, m, j] = jour.split("-");
  return `${j}/${m}/${a}`;
}

const A = "web.bilans.auto";
const tx = (cle: string, params?: Record<string, string | number>) =>
  t(`${A}.${cle}` as TranslationKey, params);
const pourcent = (part: number) => Math.round(part * 100);

/** Scores moyens par exercice et par niveau (part du « sur N »), triés. */
export function scoresParNiveau(scores: readonly ScoreRealisation[]) {
  const groupes = new Map<string, { titre: string; niveau: number; total: number; n: number }>();
  for (const s of scores) {
    if (s.scoreMax <= 0) continue;
    const cle = `${s.titre}\u0000${s.niveau}`;
    const g = groupes.get(cle) ?? { titre: s.titre, niveau: s.niveau, total: 0, n: 0 };
    g.total += s.score / s.scoreMax;
    g.n += 1;
    groupes.set(cle, g);
  }
  return [...groupes.values()]
    .map((g) => ({ titre: g.titre, niveau: g.niveau, moyenne: g.total / g.n, nombre: g.n }))
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr") || a.niveau - b.niveau);
}

/** Niveaux travaillés en séance, par exercice (premier → dernier niveau). */
export function exercicesTravailles(seances: readonly SeancePourBilan[]) {
  const parTitre = new Map<string, { titre: string; niveaux: number[]; seances: number }>();
  for (const s of seances) {
    for (const e of s.exercices) {
      const g = parTitre.get(e.titre) ?? { titre: e.titre, niveaux: [], seances: 0 };
      g.niveaux.push(e.niveau);
      g.seances += 1;
      parTitre.set(e.titre, g);
    }
  }
  return [...parTitre.values()].map((g) => ({
    titre: g.titre,
    premier: g.niveaux[0] ?? 1,
    dernier: g.niveaux.at(-1) ?? 1,
    seances: g.seances,
  }));
}

const liste = (lignes: string[]) => lignes.map((l) => `- ${l}`).join("\n");

/** Texte d'une partie automatique, calculé depuis les données (règles simples). */
export function remplirSource(source: SourceAuto, d: DonneesBilan): string {
  const p = d.patient;
  switch (source) {
    case "IDENTITE":
      return [
        tx("identite", {
          prenom: p.prenom,
          nom: p.nom,
          naissance: jourFr(p.dateNaissance),
          age: p.age,
        }),
        p.pathologies.length > 0
          ? tx("pathologies", { pathologies: p.pathologies.join(", ") })
          : tx("aucunePathologie"),
      ].join("\n");
    case "PRESCRIPTEUR":
      if (!p.medecinNom) return tx("aucunPrescripteur");
      return p.medecinContact
        ? tx("prescripteurContact", { nom: p.medecinNom, contact: p.medecinContact })
        : tx("prescripteur", { nom: p.medecinNom });
    case "SEANCES": {
      const n = d.seances.length;
      const debut = d.seances[0]?.jour;
      const fin = d.seances.at(-1)?.jour;
      if (n === 0 || !debut || !fin) return tx("aucuneSeance");
      return tx(n > 1 ? "seances" : "seance", {
        n,
        debut: jourFr(debut),
        fin: jourFr(fin),
      });
    }
    case "EXERCICES_SEANCES": {
      const travailles = exercicesTravailles(d.seances);
      if (travailles.length === 0) return tx("aucunExercice");
      return liste(
        travailles.map((e) =>
          e.premier === e.dernier
            ? tx("exerciceNiveau", { titre: e.titre, niveau: e.dernier, n: e.seances })
            : tx("exerciceProgression", {
                titre: e.titre,
                premier: e.premier,
                dernier: e.dernier,
                n: e.seances,
              }),
        ),
      );
    }
    case "REALISATION": {
      const m = d.maison;
      if (!m) return tx("pasDeProgramme");
      if (m.taux === null) return tx("rienDePrevu");
      return [
        tx("taux", { faites: m.faites, prevues: m.prevues, pourcent: pourcent(m.taux) }),
        tx("ressentis", {
          facile: m.ressentis.FACILE,
          moyen: m.ressentis.MOYEN,
          difficile: m.ressentis.DIFFICILE,
        }),
        liste(
          m.lignes.map((l) =>
            l.taux === null
              ? tx("ligneSansPrevu", { titre: l.titre })
              : tx("ligneTaux", {
                  titre: l.titre,
                  faites: l.faites,
                  prevues: l.prevues,
                  pourcent: pourcent(l.taux),
                }),
          ),
        ),
      ].join("\n");
    }
    case "SCORES_PAR_NIVEAU": {
      const groupes = scoresParNiveau(d.scores);
      if (groupes.length === 0) return tx("aucunScore");
      return liste(
        groupes.map((g) =>
          tx(g.nombre > 1 ? "scoreNiveau" : "scoreNiveauUn", {
            titre: g.titre,
            niveau: g.niveau,
            pourcent: pourcent(g.moyenne),
            n: g.nombre,
          }),
        ),
      );
    }
    case "PROGRAMME":
      if (d.programme.length === 0) return tx("pasDeProgramme");
      return liste(
        d.programme.map((e) =>
          tx("programme", { titre: e.titre, niveau: e.niveau, fois: e.foisParSemaine }),
        ),
      );
    case "SEANCE_DU_JOUR": {
      const s = d.seance;
      if (!s) return tx("aucuneSeanceChoisie");
      return [
        tx("seanceDu", { date: jourFr(s.jour) }),
        s.exercices.length > 0
          ? liste(
              s.exercices.map((e) => tx("exerciceSeance", { titre: e.titre, niveau: e.niveau })),
            )
          : tx("aucunExercice"),
      ].join("\n");
    }
    case "NOTES_SEANCE": {
      const s = d.seance;
      if (!s) return tx("aucuneSeanceChoisie");
      return [
        s.notes ? tx("notes", { notes: s.notes }) : tx("aucuneNote"),
        s.pointsAReprendre ? tx("points", { points: s.pointsAReprendre }) : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    default:
      return "";
  }
}

/** Parties automatiques recalculées depuis les données : à relire de nouveau. */
export function actualiserSections(
  sections: readonly SectionDocument[],
  d: DonneesBilan,
): SectionDocument[] {
  return sections.map((s) =>
    s.type === "AUTO" && s.source ? { ...s, contenu: remplirSource(s.source, d), relu: false } : s,
  );
}

// ─── Formats de l'API ───────────────────────────────────────────────────────

const jourSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v);
const texteCourt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

/** POST /api/patients/:id/bilans */
export const creationDocumentSchema = z
  .object({
    type: z.enum(TYPES_CREABLES),
    /** Pathologie du modèle (slug) ; absente : la première du patient. */
    pathologie: z.string().max(100).nullable().default(null),
    dateDebut: jourSchema.nullable().default(null),
    date: jourSchema.nullable().default(null),
    seanceId: z.string().min(1).max(100).nullable().default(null),
    destinataire: texteCourt(300).default(null),
  })
  .refine((v) => !v.dateDebut || !v.date || v.dateDebut <= v.date, { path: ["dateDebut"] });
export type CreationDocument = z.infer<typeof creationDocumentSchema>;

/** PATCH /api/patients/:id/bilans/:bilanId */
export const modificationDocumentSchema = z
  .object({ titre: z.string().trim().min(1).max(200), destinataire: texteCourt(300) })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

/**
 * PATCH …/bilans/:bilanId/sections/:cle
 * - `contenu` : texte écrit ou corrigé par l'orthophoniste (la partie devient « Rempli ») ;
 * - `relu: true` : partie relue telle quelle.
 */
export const modificationSectionSchema = z
  .object({ contenu: z.string().max(20_000), relu: z.literal(true) })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

/** PUT …/bilans/:bilanId/partage */
export const partageSchema = z.object({ partage: z.boolean() });
