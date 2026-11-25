import { z } from "zod";

// Schémas partagés entre l'API (validation côté serveur, qui fait foi) et les
// interfaces web et mobile. Aucun message d'erreur ne contient la valeur saisie.

export const LONGUEUR_MIN_MOT_DE_PASSE = 12;
export const LONGUEUR_MAX_MOT_DE_PASSE = 128;

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const nouveauMotDePasseSchema = z
  .string()
  .min(LONGUEUR_MIN_MOT_DE_PASSE)
  .max(LONGUEUR_MAX_MOT_DE_PASSE);

const texteCourt = z.string().trim().min(1).max(100);

/** POST /api/auth/inscription : un orthophoniste crée son compte et son cabinet. */
export const inscriptionSchema = z.object({
  email: emailSchema,
  motDePasse: nouveauMotDePasseSchema,
  prenom: texteCourt,
  nom: texteCourt,
  nomCabinet: z.string().trim().min(1).max(200),
});
export type Inscription = z.infer<typeof inscriptionSchema>;

/** POST /api/auth/connexion (web) et /api/auth/mobile/connexion. */
export const connexionSchema = z.object({
  email: emailSchema,
  // Pas de longueur minimale ici : ne rien révéler de la règle à la connexion.
  motDePasse: z.string().min(1).max(LONGUEUR_MAX_MOT_DE_PASSE),
});
export type Connexion = z.infer<typeof connexionSchema>;

/** POST /api/auth/mobile/renouvellement */
export const renouvellementSchema = z.object({
  jetonRenouvellement: z.string().min(1).max(200),
});

/** Réponse des connexions mobiles. */
export const jetonsMobileSchema = z.object({
  jetonAcces: z.string(),
  /** Durée de validité du jeton d'accès, en secondes. */
  expireDans: z.number().int().positive(),
  jetonRenouvellement: z.string(),
});
export type JetonsMobile = z.infer<typeof jetonsMobileSchema>;

export const ROLES_INVITABLES = ["PARENT", "PATIENT_ADULT"] as const;

/** POST /api/patients/:id/invitations */
export const invitationSchema = z.object({
  email: emailSchema,
  role: z.enum(ROLES_INVITABLES),
});
export type NouvelleInvitation = z.infer<typeof invitationSchema>;

/**
 * POST /api/invitations/accepter
 * Nouveau compte : prénom, nom et mot de passe. Compte parent déjà existant
 * (parent de plusieurs enfants) : son mot de passe actuel suffit.
 */
export const accepterInvitationSchema = z.object({
  jeton: z.string().min(1).max(200),
  motDePasse: z.string().min(1).max(LONGUEUR_MAX_MOT_DE_PASSE),
  prenom: texteCourt.optional(),
  nom: texteCourt.optional(),
});
export type AcceptationInvitation = z.infer<typeof accepterInvitationSchema>;

/** Format commun des erreurs de l'API. */
export const erreurApiSchema = z.object({
  erreur: z.object({ code: z.string(), message: z.string() }),
});
export type ErreurApiCorps = z.infer<typeof erreurApiSchema>;
