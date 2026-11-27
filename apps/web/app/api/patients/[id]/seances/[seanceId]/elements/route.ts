import { NextResponse } from "next/server";
import { ajoutElementSeanceSchema } from "@app/shared";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";
import { ajouterElementSeance } from "@/lib/serveur/seances";

// « Ajouter à la séance » depuis le panneau Bibliothèque, au niveau choisi.
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, ajoutElementSeanceSchema);
  const element = await ajouterElementSeance(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "seanceId"),
    donnees,
  );
  return NextResponse.json({ element }, { status: 201 });
});
