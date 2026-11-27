import { NextResponse } from "next/server";
import { param, routeProtegee } from "@/lib/serveur/routes";
import { terminerSeance } from "@/lib/serveur/seances";

// Fin de séance : ses notes et points à reprendre servent à préparer la suivante.
export const POST = routeProtegee(async ({ db, utilisateur, params }) => {
  await terminerSeance(db, utilisateur, param(params, "id"), param(params, "seanceId"));
  return new NextResponse(null, { status: 204 });
});
