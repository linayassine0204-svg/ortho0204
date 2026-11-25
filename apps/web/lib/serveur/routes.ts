import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import type { PrismaClient } from "@app/db";
import { lireConfig } from "./config";
import { db } from "./db";
import { ErreurApi, corpsErreur, erreurs } from "./erreurs";
import {
  jetonBearer,
  nomCookieSession,
  utilisateurDepuisJeton,
  type UtilisateurConnecte,
} from "./sessions";

// Toute route de l'API est créée avec `routeProtegee` ou `routePublique`.
// Un test parcourt app/api/**/route.ts et refuse toute route qui n'y passe pas.

export const MARQUE_ROUTE = Symbol.for("ortho.route");
export type TypeRoute = "protegee" | "publique";

type Params = Record<string, string | string[] | undefined>;
interface ContexteNext {
  params: Promise<Params>;
}
export type GestionnaireNext = ((req: NextRequest, ctx: ContexteNext) => Promise<Response>) & {
  [MARQUE_ROUTE]?: TypeRoute;
};

interface ContexteBase {
  req: NextRequest;
  params: Params;
  db: PrismaClient;
}
export type ContextePublic = ContexteBase;
export interface ContexteProtege extends ContexteBase {
  utilisateur: UtilisateurConnecte;
}

const METHODES_SURES = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Protection contre les requêtes envoyées depuis un autre site (en plus de
 * SameSite=Strict) : une requête qui modifie et porte un en-tête Origin
 * étranger est refusée. L'application mobile n'envoie pas d'en-tête Origin.
 */
function verifierOrigine(req: NextRequest): void {
  if (METHODES_SURES.has(req.method)) return;
  const origine = req.headers.get("origin");
  if (origine !== null && origine !== lireConfig().appOrigin) throw erreurs.requeteRefusee();
}

/** Mobile : en-tête Bearer (jeton d'accès). Web : cookie de session. */
async function authentifier(req: NextRequest, prisma: PrismaClient) {
  const bearer = jetonBearer(req.headers);
  if (bearer !== null) return utilisateurDepuisJeton(prisma, bearer, "MOBILE_ACCES");
  const cookie = req.cookies.get(nomCookieSession())?.value;
  if (cookie) return utilisateurDepuisJeton(prisma, cookie, "WEB");
  return null;
}

function reponseErreur(erreur: unknown): Response {
  if (erreur instanceof ErreurApi) {
    return NextResponse.json(corpsErreur(erreur), { status: erreur.status });
  }
  // Erreur imprévue : réponse générique, aucun détail (ni données) dans la réponse ou les journaux.
  return NextResponse.json(
    { erreur: { code: "erreur_inconnue", message: "Erreur interne." } },
    { status: 500 },
  );
}

function marquer(fn: GestionnaireNext, type: TypeRoute): GestionnaireNext {
  fn[MARQUE_ROUTE] = type;
  return fn;
}

/** Route réservée aux utilisateurs connectés. Le gestionnaire doit ensuite appeler `can()`. */
export function routeProtegee(
  gestionnaire: (ctx: ContexteProtege) => Promise<Response>,
): GestionnaireNext {
  return marquer(async (req, ctx) => {
    try {
      verifierOrigine(req);
      const prisma = db();
      const utilisateur = await authentifier(req, prisma);
      if (!utilisateur) throw erreurs.nonConnecte();
      const params = await ctx.params;
      const reponse = await gestionnaire({ req, params, db: prisma, utilisateur });
      reponse.headers.set("Cache-Control", "no-store");
      return reponse;
    } catch (erreur) {
      return reponseErreur(erreur);
    }
  }, "protegee");
}

/**
 * Route accessible sans être connecté (connexion, inscription, invitation…).
 * Chaque route publique est listée et justifiée dans le test de couverture des routes.
 */
export function routePublique(
  gestionnaire: (ctx: ContextePublic) => Promise<Response>,
): GestionnaireNext {
  return marquer(async (req, ctx) => {
    try {
      verifierOrigine(req);
      const params = await ctx.params;
      const reponse = await gestionnaire({ req, params, db: db() });
      reponse.headers.set("Cache-Control", "no-store");
      return reponse;
    } catch (erreur) {
      return reponseErreur(erreur);
    }
  }, "publique");
}

/** Lit et valide le corps JSON. Erreur générique si invalide (sans écho des valeurs). */
export async function lireCorps<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): Promise<z.output<S>> {
  let brut: unknown;
  try {
    brut = await req.json();
  } catch {
    throw erreurs.donneesInvalides();
  }
  const resultat = schema.safeParse(brut);
  if (!resultat.success) throw erreurs.donneesInvalides();
  return resultat.data;
}

/** Paramètre de chemin attendu sous forme de texte simple. */
export function param(params: Params, nom: string): string {
  const valeur = params[nom];
  if (typeof valeur !== "string" || valeur.length === 0 || valeur.length > 100) {
    throw erreurs.introuvable();
  }
  return valeur;
}
