import { NextResponse } from "next/server";
import { ajoutElementSchema } from "@app/shared";
import { ajouterElement } from "@/lib/serveur/programme";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// « Ajouter au programme » depuis le panneau Bibliothèque : exercice + niveau choisi.
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, ajoutElementSchema);
  const element = await ajouterElement(db, utilisateur, param(params, "id"), donnees);
  return NextResponse.json({ element }, { status: 201 });
});
