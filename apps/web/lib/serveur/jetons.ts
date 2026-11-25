import { createHash, createHmac, randomBytes } from "node:crypto";

/** Jeton aléatoire de 256 bits, encodé pour une URL. Donné au client, jamais stocké tel quel. */
export function genererJeton(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Empreinte SHA-256 d'un jeton à forte entropie : c'est elle qu'on stocke en base.
 * (Un jeton aléatoire de 256 bits n'a pas besoin de sel ni d'un hachage lent.)
 */
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("base64url");
}

/**
 * Empreinte à clé (HMAC) d'une valeur à faible entropie (e-mail, adresse IP),
 * pour compter les tentatives sans stocker la valeur en clair.
 */
export function empreinteAvecCle(secret: string, valeur: string): string {
  return createHmac("sha256", secret).update(valeur).digest("base64url");
}
