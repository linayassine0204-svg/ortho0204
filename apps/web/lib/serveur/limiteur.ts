import type { PrismaClient } from "@app/db";
import { lireConfig } from "./config";
import { empreinteAvecCle } from "./jetons";

// Limitation du nombre d'essais, stockée en base (fonctionne avec plusieurs serveurs).
// Les clés sont des empreintes HMAC : ni e-mail ni adresse IP en clair.

const CONSERVATION_MS = 24 * 60 * 60 * 1000;

export interface Limite {
  max: number;
  fenetreMs: number;
}

export interface CleLimite {
  /** Ex. "connexion:email". */
  type: string;
  valeur: string;
  limite: Limite;
}

function cleStockee(cle: Pick<CleLimite, "type" | "valeur">): string {
  return `${cle.type}:${empreinteAvecCle(lireConfig().authSecret, cle.valeur)}`;
}

/** Vrai si l'une des clés a atteint sa limite. */
export async function limiteAtteinte(
  prisma: PrismaClient,
  cles: CleLimite[],
  maintenant = new Date(),
): Promise<boolean> {
  for (const cle of cles) {
    const depuis = new Date(maintenant.getTime() - cle.limite.fenetreMs);
    const n = await prisma.tentativeConnexion.count({
      where: { cle: cleStockee(cle), createdAt: { gte: depuis } },
    });
    if (n >= cle.limite.max) return true;
  }
  return false;
}

/** Enregistre une tentative pour chaque clé et purge les plus anciennes. */
export async function enregistrerTentative(
  prisma: PrismaClient,
  cles: Pick<CleLimite, "type" | "valeur">[],
  maintenant = new Date(),
): Promise<void> {
  await prisma.$transaction([
    prisma.tentativeConnexion.createMany({
      data: cles.map((cle) => ({ cle: cleStockee(cle), createdAt: maintenant })),
    }),
    prisma.tentativeConnexion.deleteMany({
      where: { createdAt: { lt: new Date(maintenant.getTime() - CONSERVATION_MS) } },
    }),
  ]);
}

/** Remet le compteur à zéro (ex. après une connexion réussie). */
export async function effacerTentatives(
  prisma: PrismaClient,
  cle: Pick<CleLimite, "type" | "valeur">,
): Promise<void> {
  await prisma.tentativeConnexion.deleteMany({ where: { cle: cleStockee(cle) } });
}

/**
 * Adresse IP du client. En production, le proxy de l'hébergeur doit écrire
 * X-Forwarded-For (en écrasant la valeur envoyée par le client).
 */
export function adresseIp(headers: Headers): string {
  const transmise = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return transmise || headers.get("x-real-ip") || "inconnue";
}
