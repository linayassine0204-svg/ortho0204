import { NextResponse } from "next/server";
import { connexionSchema } from "@app/shared";
import { verifierIdentifiants } from "@/lib/serveur/comptes";
import { adresseIp } from "@/lib/serveur/limiteur";
import { lireCorps, routePublique } from "@/lib/serveur/routes";
import { nomCookieSession, optionsCookieSession, ouvrirSessionWeb } from "@/lib/serveur/sessions";

// Connexion au logiciel web (orthophonistes) : cookie de session HttpOnly, SameSite=Strict.
export const POST = routePublique(async ({ req, db }) => {
  const donnees = await lireCorps(req, connexionSchema);
  const user = await verifierIdentifiants(db, donnees, adresseIp(req.headers), ["ORTHO"]);
  // Double authentification (TOTP) : à insérer ici plus tard (session « en attente »).
  const { jeton, expireLe } = await ouvrirSessionWeb(db, user.id);
  const reponse = NextResponse.json({
    utilisateur: { id: user.id, prenom: user.prenom, nom: user.nom, role: user.role },
  });
  reponse.cookies.set(nomCookieSession(), jeton, optionsCookieSession(expireLe));
  return reponse;
});
