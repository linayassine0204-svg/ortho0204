import { NextResponse } from "next/server";
import { modificationElementSeanceSchema } from "@app/shared";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";
import { modifierElementSeance, retirerElementSeance } from "@/lib/serveur/seances";

// Accepter une proposition, changer le niveau, ou remplacer par un autre exercice.
export const PATCH = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, modificationElementSeanceSchema);
  const element = await modifierElementSeance(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "seanceId"),
    param(params, "elementId"),
    donnees,
  );
  return NextResponse.json({ element });
});

// Retirer un exercice de la séance (ou refuser une proposition).
export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  await retirerElementSeance(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "seanceId"),
    param(params, "elementId"),
  );
  return new NextResponse(null, { status: 204 });
});
