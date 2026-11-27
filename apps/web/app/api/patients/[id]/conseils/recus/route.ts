import { NextResponse } from "next/server";
import { lireConseilsRecus } from "@/lib/serveur/conseils";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Mobile (parents) : conseils reçus, le dernier envoi de chacun, avec « lu » ou non.
// Refus sans lien avec le patient (404) ou sans consentement (403).
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json({
    conseils: await lireConseilsRecus(db, utilisateur, param(params, "id")),
  });
});
