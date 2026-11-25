import { NextResponse } from "next/server";
import { renouvellementSchema } from "@app/shared";
import { erreurs } from "@/lib/serveur/erreurs";
import { lireCorps, routePublique } from "@/lib/serveur/routes";
import { renouvelerSessionMobile } from "@/lib/serveur/sessions";

// Échange un jeton de renouvellement (usage unique) contre une nouvelle paire de jetons.
// Publique car le jeton d'accès a expiré ; le jeton de renouvellement est l'authentification.
export const POST = routePublique(async ({ req, db }) => {
  const { jetonRenouvellement } = await lireCorps(req, renouvellementSchema);
  const jetons = await renouvelerSessionMobile(db, jetonRenouvellement);
  if (!jetons) throw erreurs.nonConnecte();
  return NextResponse.json(jetons);
});
