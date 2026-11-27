import { NextResponse } from "next/server";
import { envoiConseilSchema } from "@app/shared";
import { envoyerConseil, lireConseilsPatient } from "@/lib/serveur/conseils";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Orthophoniste : conseils proposés (filtre pathologie + âge), autres modèles, envoyés (lu / pas lu).
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json(await lireConseilsPatient(db, utilisateur, param(params, "id")));
});

// Envoyer un conseil : pré-fait tel quel, pré-fait modifié, ou écrit de zéro ; maintenant,
// à une date choisie, ou chaque semaine.
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, envoiConseilSchema);
  const conseil = await envoyerConseil(db, utilisateur, param(params, "id"), donnees);
  return NextResponse.json({ conseil }, { status: 201 });
});
