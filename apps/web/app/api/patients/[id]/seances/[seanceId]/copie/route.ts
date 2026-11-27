import { NextResponse } from "next/server";
import { copieSeanceSchema } from "@app/shared";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";
import { copierSeance } from "@/lib/serveur/seances";

// Réutiliser une séance passée : ses exercices rejoignent la séance en préparation.
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const { depuisSeanceId } = await lireCorps(req, copieSeanceSchema);
  const resultat = await copierSeance(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "seanceId"),
    depuisSeanceId,
  );
  return NextResponse.json(resultat);
});
