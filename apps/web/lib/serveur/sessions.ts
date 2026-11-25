import { randomUUID } from "node:crypto";
import type { PrismaClient, Role, TypeSession } from "@app/db";
import { DUREES, lireConfig } from "./config";
import type { Acteur } from "./droits";
import { empreinteJeton, genererJeton } from "./jetons";

/** Utilisateur authentifié pour la requête en cours. */
export interface UtilisateurConnecte extends Acteur {
  sessionId: string;
  typeSession: TypeSession;
  familleId: string;
}

/** Nom du cookie de session. `__Host-` impose Secure, Path=/ et aucun domaine (production). */
export function nomCookieSession(): string {
  return lireConfig().production ? "__Host-session" : "session";
}

/** Options du cookie de session web. */
export function optionsCookieSession(expireLe: Date) {
  return {
    httpOnly: true,
    secure: lireConfig().production,
    sameSite: "strict" as const,
    path: "/",
    expires: expireLe,
  };
}

async function creerSession(
  prisma: PrismaClient,
  userId: string,
  type: TypeSession,
  dureeMs: number,
  familleId: string,
  maintenant: Date,
) {
  const jeton = genererJeton();
  const expireLe = new Date(maintenant.getTime() + dureeMs);
  await prisma.session.create({
    data: { userId, type, jetonHash: empreinteJeton(jeton), familleId, expireLe },
  });
  return { jeton, expireLe };
}

/**
 * Ouvre une session web. Point d'extension prévu pour la double authentification
 * (TOTP) : la session pourra être créée « en attente » puis validée en remplissant
 * `deuxiemeFacteurLe`. Non codé en version 1.
 */
export function ouvrirSessionWeb(prisma: PrismaClient, userId: string, maintenant = new Date()) {
  return creerSession(prisma, userId, "WEB", DUREES.sessionWebMs, randomUUID(), maintenant);
}

/** Ouvre une session mobile : jeton d'accès court + jeton de renouvellement. */
export async function ouvrirSessionMobile(
  prisma: PrismaClient,
  userId: string,
  maintenant = new Date(),
  familleId: string = randomUUID(),
) {
  const acces = await creerSession(
    prisma,
    userId,
    "MOBILE_ACCES",
    DUREES.jetonAccesMs,
    familleId,
    maintenant,
  );
  const renouvellement = await creerSession(
    prisma,
    userId,
    "MOBILE_RENOUVELLEMENT",
    DUREES.jetonRenouvellementMs,
    familleId,
    maintenant,
  );
  return {
    jetonAcces: acces.jeton,
    expireDans: Math.floor(DUREES.jetonAccesMs / 1000),
    jetonRenouvellement: renouvellement.jeton,
  };
}

/**
 * Échange un jeton de renouvellement contre une nouvelle paire (rotation).
 * Un jeton déjà utilisé qui revient = vol probable : toute la famille est révoquée.
 * Renvoie null si le jeton est invalide.
 */
export async function renouvelerSessionMobile(
  prisma: PrismaClient,
  jetonRenouvellement: string,
  maintenant = new Date(),
) {
  const session = await prisma.session.findUnique({
    where: { jetonHash: empreinteJeton(jetonRenouvellement) },
  });
  if (!session || session.type !== "MOBILE_RENOUVELLEMENT") return null;

  if (session.revoqueLe) {
    await revoquerFamille(prisma, session.familleId, maintenant);
    return null;
  }
  if (session.expireLe <= maintenant) return null;

  // Révocation atomique : deux renouvellements simultanés ne peuvent pas réussir tous les deux.
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, revoqueLe: null },
    data: { revoqueLe: maintenant },
  });
  if (count !== 1) {
    await revoquerFamille(prisma, session.familleId, maintenant);
    return null;
  }
  // Les anciens jetons d'accès de la famille deviennent inutilisables.
  await prisma.session.updateMany({
    where: { familleId: session.familleId, type: "MOBILE_ACCES", revoqueLe: null },
    data: { revoqueLe: maintenant },
  });
  return ouvrirSessionMobile(prisma, session.userId, maintenant, session.familleId);
}

export async function revoquerFamille(
  prisma: PrismaClient,
  familleId: string,
  maintenant = new Date(),
): Promise<void> {
  await prisma.session.updateMany({
    where: { familleId, revoqueLe: null },
    data: { revoqueLe: maintenant },
  });
}

/**
 * Retrouve l'utilisateur à partir d'un jeton, en vérifiant le type de session,
 * l'expiration et la révocation. Le rôle et le cabinet sont relus en base à chaque fois.
 */
export async function utilisateurDepuisJeton(
  prisma: PrismaClient,
  jeton: string,
  typeAttendu: Extract<TypeSession, "WEB" | "MOBILE_ACCES">,
  maintenant = new Date(),
): Promise<UtilisateurConnecte | null> {
  if (!jeton || jeton.length > 200) return null;
  const session = await prisma.session.findUnique({
    where: { jetonHash: empreinteJeton(jeton) },
    include: { user: { select: { id: true, role: true, cabinetId: true } } },
  });
  if (!session || session.type !== typeAttendu) return null;
  if (session.revoqueLe || session.expireLe <= maintenant) return null;
  return {
    id: session.user.id,
    role: session.user.role as Role,
    cabinetId: session.user.cabinetId,
    sessionId: session.id,
    typeSession: session.type,
    familleId: session.familleId,
  };
}

/** Jeton présent dans l'en-tête `Authorization: Bearer …` (application mobile). */
export function jetonBearer(headers: Headers): string | null {
  const valeur = headers.get("authorization");
  if (!valeur) return null;
  const [schema, jeton] = valeur.split(" ");
  return schema?.toLowerCase() === "bearer" && jeton ? jeton : null;
}
