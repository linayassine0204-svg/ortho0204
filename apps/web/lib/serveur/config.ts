import { z } from "zod";

// Configuration lue dans les variables d'environnement (jamais de secret dans le code).
// Lue à la demande, pas à l'import : `next build` n'a pas besoin des secrets.

const HEURE_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const DUREES = {
  /** Session web (cookie) : durée absolue. */
  sessionWebMs: 12 * HEURE_MS,
  /** Jeton d'accès mobile : court. */
  jetonAccesMs: 15 * MINUTE_MS,
  /** Jeton de renouvellement mobile. */
  jetonRenouvellementMs: 30 * 24 * HEURE_MS,
  /** Lien d'invitation. */
  invitationMs: 72 * HEURE_MS,
} as const;

/** Limites d'essais : nombre maximum sur une fenêtre glissante. */
export const LIMITES = {
  connexionParEmail: { max: 5, fenetreMs: 15 * MINUTE_MS },
  connexionParIp: { max: 50, fenetreMs: 15 * MINUTE_MS },
  inscriptionParIp: { max: 10, fenetreMs: HEURE_MS },
  invitationParIp: { max: 20, fenetreMs: HEURE_MS },
} as const;

const configSchema = z.object({
  AUTH_SECRET: z
    .string({ message: "AUTH_SECRET est manquante (voir .env.example)." })
    .min(32, "AUTH_SECRET doit contenir au moins 32 caractères."),
  APP_URL: z.url("APP_URL doit être une URL.").default("http://localhost:3000"),
  NODE_ENV: z.string().default("development"),
});

export interface Config {
  authSecret: string;
  /** Origine publique du logiciel web (liens d'invitation, contrôle de l'en-tête Origin). */
  appOrigin: string;
  production: boolean;
}

/** Lit la configuration. Les messages d'erreur ne contiennent jamais les valeurs. */
export function lireConfig(env: Record<string, string | undefined> = process.env): Config {
  const resultat = configSchema.safeParse(env);
  if (!resultat.success) {
    throw new Error(resultat.error.issues[0]?.message ?? "Configuration invalide.");
  }
  const { AUTH_SECRET, APP_URL, NODE_ENV } = resultat.data;
  return {
    authSecret: AUTH_SECRET,
    appOrigin: new URL(APP_URL).origin,
    production: NODE_ENV === "production",
  };
}
