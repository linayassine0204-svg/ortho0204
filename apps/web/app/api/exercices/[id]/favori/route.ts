import { NextResponse } from "next/server";
import { definirFavori } from "@/lib/serveur/exercices";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Favori personnel : PUT pour marquer, DELETE pour retirer.
export const PUT = routeProtegee(async ({ db, utilisateur, params }) => {
  await definirFavori(db, utilisateur, param(params, "id"), true);
  return new NextResponse(null, { status: 204 });
});

export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  await definirFavori(db, utilisateur, param(params, "id"), false);
  return new NextResponse(null, { status: 204 });
});
