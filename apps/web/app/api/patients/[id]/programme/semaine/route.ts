import { NextResponse } from "next/server";
import { dateFacultative } from "@/lib/serveur/date-param";
import { programmeDeLaSemaine } from "@/lib/serveur/programme";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Mobile : programme ENVOYÉ et plan de la semaine (lundi → dimanche), ?date=AAAA-MM-JJ.
// Refus sans lien avec le patient (404) ou sans consentement (403).
export const GET = routeProtegee(async ({ req, db, utilisateur, params }) => {
  return NextResponse.json(
    await programmeDeLaSemaine(db, utilisateur, param(params, "id"), dateFacultative(req)),
  );
});
