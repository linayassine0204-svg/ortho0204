import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { nomCookieSession, utilisateurDepuisJeton, type UtilisateurConnecte } from "./sessions";

/**
 * Utilisateur connecté pour une page du logiciel web (orthophonistes).
 * Redirige vers la connexion sinon. Les droits sur les données restent vérifiés
 * par `can()` dans les fonctions serveur appelées ensuite.
 */
export async function orthoConnecte(): Promise<UtilisateurConnecte> {
  const jeton = (await cookies()).get(nomCookieSession())?.value;
  const utilisateur = jeton ? await utilisateurDepuisJeton(db(), jeton, "WEB") : null;
  if (!utilisateur || utilisateur.role !== "ORTHO") redirect("/connexion");
  return utilisateur;
}
