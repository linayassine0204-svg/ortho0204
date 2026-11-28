import { NextResponse } from "next/server";
import { param, routeProtegee } from "@/lib/serveur/routes";
import { reutiliserSeance } from "@/lib/serveur/seances";

// « Réutiliser cette séance » (Fiche) : pré-remplit la préparation de la prochaine séance
// avec les exercices de cette séance passée.
export const POST = routeProtegee(async ({ db, utilisateur, params }) => {
  const resultat = await reutiliserSeance(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "seanceId"),
  );
  return NextResponse.json(resultat, { status: 201 });
});
