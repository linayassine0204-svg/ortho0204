import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { nomCookieSession, utilisateurDepuisJeton, type UtilisateurConnecte } from "./sessions";

// Utilisateur connecté pour une page web. Les droits sur les données restent
// vérifiés par `can()` dans les fonctions serveur appelées ensuite.

/** Page d'accueil après connexion, selon le rôle. */
export function accueilDuRole(role: UtilisateurConnecte["role"]): string {
  return role === "ORTHO" ? "/patients" : "/famille";
}

/** N'importe quel compte connecté ; sinon redirection vers la connexion. */
export async function utilisateurConnecte(): Promise<UtilisateurConnecte> {
  const jeton = (await cookies()).get(nomCookieSession())?.value;
  const utilisateur = jeton ? await utilisateurDepuisJeton(db(), jeton, "WEB") : null;
  if (!utilisateur) redirect("/connexion");
  return utilisateur;
}

/** Espace orthophoniste. Un parent ou un patient est renvoyé vers son espace. */
export async function orthoConnecte(): Promise<UtilisateurConnecte> {
  const utilisateur = await utilisateurConnecte();
  if (utilisateur.role !== "ORTHO") redirect(accueilDuRole(utilisateur.role));
  return utilisateur;
}

/** Espace famille (parent ou patient). Un orthophoniste est renvoyé vers ses patients. */
export async function familleConnectee(): Promise<UtilisateurConnecte> {
  const utilisateur = await utilisateurConnecte();
  if (utilisateur.role === "ORTHO") redirect(accueilDuRole(utilisateur.role));
  return utilisateur;
}
