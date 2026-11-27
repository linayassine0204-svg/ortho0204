import { z } from "zod";

// Réalisation d'un exercice du programme, saisie dans l'application (parent ou
// patient adulte). Validation côté serveur, qui fait foi.

export const RESSENTIS = ["FACILE", "MOYEN", "DIFFICILE"] as const;
export type Ressenti = (typeof RESSENTIS)[number];

/** Une réalisation peut être envoyée jusqu'à 30 jours après (téléphone resté hors ligne). */
export const RETARD_MAX_REALISATION_JOURS = 30;
/** Tolérance sur l'horloge du téléphone (réalisation « dans le futur »). */
export const AVANCE_MAX_REALISATION_MS = 10 * 60 * 1000;

/** POST /api/patients/:id/realisations */
export const nouvelleRealisationSchema = z.object({
  /**
   * Identifiant créé par le téléphone (UUID). Renvoyer la même réalisation (après une
   * coupure réseau) ne crée jamais de doublon : le serveur renvoie celle qui existe.
   */
  idClient: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  elementId: z.string().min(1).max(100),
  /** Moment où l'exercice a été fait (heure du téléphone, ISO 8601). */
  faitLe: z.iso.datetime({ offset: true }),
  ressenti: z.enum(RESSENTIS).nullable().default(null),
  score: z.number().int().min(0).max(100).nullable().default(null),
});
export type NouvelleRealisation = z.infer<typeof nouvelleRealisationSchema>;

/** Enregistrement de la voix : format accepté et limites. */
export const AUDIO = {
  /** AAC dans un conteneur MPEG-4 (.m4a), produit par l'iPhone et Android. */
  typeMime: "audio/mp4",
  tailleMaxOctets: 20 * 1024 * 1024,
  dureeMaxSecondes: 10 * 60,
} as const;
