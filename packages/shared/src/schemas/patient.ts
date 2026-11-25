import { z } from "zod";

// Formats partagés du dossier patient (validation côté serveur, qui fait foi).

const texteCourt = z.string().trim().min(1).max(100);

/** Champ texte facultatif : une chaîne vide devient null (effacement). */
const texteFacultatif = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

/** Date au format AAAA-MM-JJ, réelle, entre 1900 et aujourd'hui. */
export const dateNaissanceSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === v &&
      v >= "1900-01-01" &&
      d.getTime() <= Date.now()
    );
  });

const pathologieIdsSchema = z.array(z.string().min(1).max(100)).max(20);

/** POST /api/patients */
export const nouveauPatientSchema = z.object({
  prenom: texteCourt,
  nom: texteCourt,
  dateNaissance: dateNaissanceSchema,
  pathologieIds: pathologieIdsSchema.default([]),
});
export type NouveauPatient = z.infer<typeof nouveauPatientSchema>;

/** PATCH /api/patients/:id — seuls les champs envoyés sont modifiés. */
export const modificationPatientSchema = z
  .object({
    prenom: texteCourt,
    nom: texteCourt,
    dateNaissance: dateNaissanceSchema,
    pathologieIds: pathologieIdsSchema,
    notes: texteFacultatif(20_000),
    medecinNom: texteFacultatif(200),
    medecinContact: texteFacultatif(200),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export type ModificationPatient = z.infer<typeof modificationPatientSchema>;

/** GET /api/patients?q=…&pathologie=… */
export const recherchePatientsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  pathologie: z.string().trim().max(100).optional(),
});
export type RecherchePatients = z.infer<typeof recherchePatientsSchema>;

/** Documents du dossier : types acceptés et taille maximale. */
export const TYPES_DOCUMENT = ["application/pdf", "image/png", "image/jpeg"] as const;
export type TypeDocument = (typeof TYPES_DOCUMENT)[number];
export const TAILLE_MAX_DOCUMENT = 10 * 1024 * 1024;
