import { NextResponse } from "next/server";
import { routeProtegee } from "@/lib/serveur/routes";
import { nomCookieSession, optionsCookieSession, revoquerFamille } from "@/lib/serveur/sessions";

// Déconnexion web (révoque la session) ou mobile (révoque jeton d'accès et de renouvellement).
export const POST = routeProtegee(async ({ db, utilisateur }) => {
  await revoquerFamille(db, utilisateur.familleId);
  const reponse = new NextResponse(null, { status: 204 });
  if (utilisateur.typeSession === "WEB") {
    reponse.cookies.set(nomCookieSession(), "", optionsCookieSession(new Date(0)));
  }
  return reponse;
});
