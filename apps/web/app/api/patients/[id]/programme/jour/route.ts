import { NextResponse } from "next/server";
import { dateFacultative } from "@/lib/serveur/date-param";
import { programmeDuJour } from "@/lib/serveur/programme";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Mobile : exercices du jour (aperçu, niveau, consigne) + ceux à placer dans la semaine.
export const GET = routeProtegee(async ({ req, db, utilisateur, params }) => {
  return NextResponse.json(
    await programmeDuJour(db, utilisateur, param(params, "id"), dateFacultative(req)),
  );
});
