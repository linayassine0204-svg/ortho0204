import { NextResponse } from "next/server";
import { arreterPlan } from "@/lib/serveur/conseils";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Arrêter une répétition ou annuler un envoi prévu (les envois déjà faits restent).
export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  const conseil = await arreterPlan(db, utilisateur, param(params, "id"), param(params, "planId"));
  return NextResponse.json({ conseil });
});
