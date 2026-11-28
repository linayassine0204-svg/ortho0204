import {
  remplirSource,
  type DonneesBilan,
  type SectionDocument,
  type SourceAuto,
  type TypeCreable,
} from "./bilans.ts";
import { t, type TranslationKey } from "./i18n.ts";

// Modèles de documents par pathologie. La structure est ici ; les textes (titres des
// parties, aides, textes de départ) sont dans le fichier de traduction (web.bilans.modeles).
// CONTENU D'EXEMPLE : à valider par des orthophonistes avant tout usage réel.

/** Pathologies qui ont des aides propres (slugs des catégories). */
export const PATHOLOGIES_MODELES = [
  "langage-oral",
  "langage-ecrit",
  "articulation",
  "begaiement",
  "voix",
  "deglutition",
  "cognition-mathematique",
] as const;
type PathologieModele = (typeof PATHOLOGIES_MODELES)[number];

interface ModeleSection {
  cle: string;
  source?: SourceAuto;
  /** L'aide dépend de la pathologie (sinon : aide générale de la partie, si elle existe). */
  aideParPathologie?: boolean;
  /** Texte de départ inséré dans la partie (exemple « À relire »). */
  texteDepart?: boolean;
}

/** Parties de chaque type de document, dans l'ordre. */
const STRUCTURES: Record<TypeCreable, ModeleSection[]> = {
  INITIAL: [
    { cle: "identite", source: "IDENTITE" },
    { cle: "prescripteur", source: "PRESCRIPTEUR" },
    { cle: "motif" },
    { cle: "anamnese" },
    { cle: "tests", aideParPathologie: true },
    { cle: "observations", aideParPathologie: true },
    { cle: "conclusion" },
    { cle: "projet" },
  ],
  EVOLUTION: [
    { cle: "identite", source: "IDENTITE" },
    { cle: "prescripteur", source: "PRESCRIPTEUR" },
    { cle: "seances", source: "SEANCES" },
    { cle: "exercices", source: "EXERCICES_SEANCES" },
    { cle: "realisation", source: "REALISATION" },
    { cle: "scores", source: "SCORES_PAR_NIVEAU" },
    { cle: "observations", aideParPathologie: true },
    { cle: "evolution" },
    { cle: "conclusion" },
    { cle: "suite" },
  ],
  COMPTE_RENDU_SEANCE: [
    { cle: "identite", source: "IDENTITE" },
    { cle: "seance", source: "SEANCE_DU_JOUR" },
    { cle: "notesSeance", source: "NOTES_SEANCE" },
    { cle: "observations", aideParPathologie: true },
    { cle: "maison" },
    { cle: "programme", source: "PROGRAMME" },
  ],
  COURRIER_MEDECIN: [
    { cle: "identite", source: "IDENTITE" },
    { cle: "seances", source: "SEANCES" },
    { cle: "objet", texteDepart: true },
    { cle: "corps", texteDepart: true },
    { cle: "formule", texteDepart: true },
  ],
  COURRIER_ECOLE: [
    { cle: "identite", source: "IDENTITE" },
    { cle: "objet", texteDepart: true },
    { cle: "corps", texteDepart: true },
    { cle: "formule", texteDepart: true },
  ],
  COURRIER_ASSURANCE: [
    { cle: "identite", source: "IDENTITE" },
    { cle: "prescripteur", source: "PRESCRIPTEUR" },
    { cle: "seances", source: "SEANCES" },
    { cle: "objet", texteDepart: true },
    { cle: "corps", texteDepart: true },
    { cle: "formule", texteDepart: true },
  ],
};

const M = "web.bilans.modeles";
const cle = (s: string) => s as TranslationKey;

function estPathologieModele(slug: string | null): slug is PathologieModele {
  return slug !== null && (PATHOLOGIES_MODELES as readonly string[]).includes(slug);
}

/** Clé du modèle : type, et pathologie quand le modèle a des aides propres. */
export function cleModele(type: TypeCreable, pathologie: string | null): string {
  const avecPathologie = STRUCTURES[type].some((s) => s.aideParPathologie);
  return avecPathologie && estPathologieModele(pathologie) ? `${type}:${pathologie}` : type;
}

/** Aide (exemple) d'une partie, selon la pathologie. */
function aide(section: ModeleSection, pathologie: string | null): string | null {
  if (section.source) return null;
  if (section.aideParPathologie && estPathologieModele(pathologie)) {
    return t(cle(`${M}.aidesPathologie.${pathologie}.${section.cle}`));
  }
  const generale = t(cle(`${M}.aides.${section.cle}`));
  return generale.startsWith(`${M}.`) ? null : generale;
}

/**
 * Parties d'un nouveau document : automatiques remplies depuis les données,
 * à écrire vides (ou avec un texte de départ d'exemple, « À relire »).
 */
export function creerSections(
  type: TypeCreable,
  pathologie: string | null,
  donnees: DonneesBilan,
): SectionDocument[] {
  const params = { prenom: donnees.patient.prenom, nom: donnees.patient.nom };
  return STRUCTURES[type].map((s) => ({
    cle: s.cle,
    titre: t(cle(`${M}.parties.${s.cle}`)),
    type: s.source ? "AUTO" : "LIBRE",
    source: s.source ?? null,
    aide: aide(s, pathologie),
    contenu: s.source
      ? remplirSource(s.source, donnees)
      : s.texteDepart
        ? t(cle(`${M}.departs.${type}.${s.cle}`), params)
        : "",
    relu: false,
  }));
}

/** Titre par défaut d'un document. */
export function titreParDefaut(type: TypeCreable): string {
  return t(cle(`web.bilans.types.${type}`));
}
