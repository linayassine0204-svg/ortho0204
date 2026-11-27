import { NextResponse } from "next/server";
import { param, routeProtegee } from "@/lib/serveur/routes";
import { lirePreparation } from "@/lib/serveur/seances";

// Préparation (orthophoniste du cabinet) : résumé avant séance, séance en construction
// (créée avec la séance proposée à la première ouverture) et séances passées.
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json(await lirePreparation(db, utilisateur, param(params, "id")));
});
