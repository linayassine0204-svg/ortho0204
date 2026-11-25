import { NextResponse } from "next/server";
import { connexionSchema } from "@app/shared";
import { verifierIdentifiants } from "@/lib/serveur/comptes";
import { adresseIp } from "@/lib/serveur/limiteur";
import { lireCorps, routePublique } from "@/lib/serveur/routes";
import { ouvrirSessionMobile } from "@/lib/serveur/sessions";

// Connexion de l'application mobile (parents et patients) : jeton court + jeton de renouvellement.
export const POST = routePublique(async ({ req, db }) => {
  const donnees = await lireCorps(req, connexionSchema);
  const user = await verifierIdentifiants(db, donnees, adresseIp(req.headers), [
    "PARENT",
    "PATIENT_ADULT",
  ]);
  return NextResponse.json(await ouvrirSessionMobile(db, user.id));
});
