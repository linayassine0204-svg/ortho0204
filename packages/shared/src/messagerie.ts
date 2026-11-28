import { z } from "zod";

// Messagerie sécurisée (optionnelle) : un fil par patient, entre l'orthophoniste du cabinet
// et la famille (parents, ou le patient s'il est majeur). Aucun service externe : les messages
// et pièces jointes ne vont qu'à notre serveur. Fonctions pures, partagées web / mobile / API.

/** Réglage effectif : l'exception du patient l'emporte, sinon le réglage du cabinet. */
export function messagerieEffective(cabinet: boolean, patient: boolean | null | undefined) {
  return patient ?? cabinet;
}

// ─── Pièces jointes ─────────────────────────────────────────────────────────

export const GENRES_PIECE_JOINTE = ["PHOTO", "VOCAL"] as const;
export type GenrePieceJointe = (typeof GENRES_PIECE_JOINTE)[number];

/** Types acceptés (le type RÉEL est lu dans le fichier, jamais celui annoncé). */
export const TYPES_PIECE_JOINTE = {
  "image/jpeg": "PHOTO",
  "image/png": "PHOTO",
  /** AAC dans un conteneur MPEG-4 (.m4a) : iPhone, Android, Safari. */
  "audio/mp4": "VOCAL",
  /** Opus dans un conteneur WebM : enregistrement dans Chrome, Edge, Firefox. */
  "audio/webm": "VOCAL",
  "audio/ogg": "VOCAL",
} as const satisfies Record<string, GenrePieceJointe>;
export type TypePieceJointe = keyof typeof TYPES_PIECE_JOINTE;

export const LIMITES_PIECE_JOINTE = {
  PHOTO: { tailleMaxOctets: 10 * 1024 * 1024 },
  VOCAL: { tailleMaxOctets: 10 * 1024 * 1024, dureeMaxSecondes: 5 * 60 },
} as const;

/** Taille maximale, tous genres confondus (contrôle avant lecture complète). */
export const TAILLE_MAX_PIECE_JOINTE = Math.max(
  LIMITES_PIECE_JOINTE.PHOTO.tailleMaxOctets,
  LIMITES_PIECE_JOINTE.VOCAL.tailleMaxOctets,
);

export const LONGUEUR_MAX_MESSAGE = 5000;

/** Extension proposée au téléchargement. */
export const EXTENSIONS_PIECE_JOINTE: Record<TypePieceJointe, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
};

const commencePar = (octets: Uint8Array, signature: readonly number[], decalage = 0) =>
  octets.length >= decalage + signature.length &&
  signature.every((b, i) => octets[decalage + i] === b);

const ascii = (texte: string) => [...texte].map((c) => c.charCodeAt(0));

/** Le contenu WebM (EBML) annonce « webm » comme type de document dans son en-tête. */
function estWebm(octets: Uint8Array): boolean {
  if (!commencePar(octets, [0x1a, 0x45, 0xdf, 0xa3])) return false;
  const debut = Array.from(octets.subarray(0, 64));
  const cible = ascii("webm");
  return debut.some((_, i) => cible.every((b, j) => debut[i + j] === b));
}

/**
 * Type réel d'une pièce jointe, lu dans ses premiers octets (le type ou l'extension
 * annoncés par l'appareil ne sont pas fiables). null : type refusé.
 */
export function detecterTypePieceJointe(octets: Uint8Array): TypePieceJointe | null {
  if (commencePar(octets, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (commencePar(octets, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (commencePar(octets, ascii("ftyp"), 4)) return "audio/mp4";
  if (estWebm(octets)) return "audio/webm";
  if (commencePar(octets, ascii("OggS"))) return "audio/ogg";
  return null;
}

// ─── Ce que voient l'orthophoniste et la famille ────────────────────────────

export interface PieceJointeVue {
  id: string;
  genre: GenrePieceJointe;
  typeMime: TypePieceJointe;
  tailleOctets: number;
  dureeSecondes: number | null;
}

export interface MessageVue {
  id: string;
  /** Écrit par le compte qui lit (affiché à droite). */
  deMoi: boolean;
  /** Côté de l'auteur : le cabinet ou la famille. */
  cote: "CABINET" | "FAMILLE";
  /** Prénom de l'auteur (null : compte supprimé). */
  auteur: string | null;
  contenu: string;
  envoyeLe: string;
  /** Lu par l'autre côté. */
  luLe: string | null;
  piecesJointes: PieceJointeVue[];
}

export interface FilVue {
  /** Message des horaires de réponse, affiché aux familles. */
  horairesReponse: string | null;
  messages: MessageVue[];
}

// ─── Formats de l'API ───────────────────────────────────────────────────────

/** Texte d'un message (vide accepté seulement s'il y a une pièce jointe). */
export const texteMessageSchema = z.string().trim().max(LONGUEUR_MAX_MESSAGE);

/** POST …/messagerie/messages (JSON) */
export const nouveauMessageSchema = z.object({ contenu: texteMessageSchema.min(1) });

/** PUT /api/cabinet/reglages */
export const reglagesCabinetSchema = z
  .object({
    messagerieActivee: z.boolean(),
    horairesReponse: z
      .string()
      .trim()
      .max(300)
      .transform((v) => (v === "" ? null : v))
      .nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export type ReglagesCabinet = z.infer<typeof reglagesCabinetSchema>;

/** PUT /api/patients/:id/reglages/messagerie : true, false, ou null (comme le cabinet). */
export const reglagePatientMessagerieSchema = z.object({
  messagerieActivee: z.boolean().nullable(),
});

/** Réponse rapide (création, modification). */
export const reponseRapideSchema = z.object({
  titre: z.string().trim().min(1).max(80),
  texte: z.string().trim().min(1).max(2000),
});
export type ReponseRapideSaisie = z.infer<typeof reponseRapideSchema>;
