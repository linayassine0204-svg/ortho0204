import { NextResponse } from "next/server";
import { modificationElementSchema } from "@app/shared";
import { modifierElement, retirerElement } from "@/lib/serveur/programme";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Niveau, rythme (fois par semaine, jours) et mot pour la famille.
export const PATCH = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, modificationElementSchema);
  const element = await modifierElement(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "elementId"),
    donnees,
  );
  return NextResponse.json({ element });
});

// Retrait du programme (l'historique des réalisations est conservé).
export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  await retirerElement(db, utilisateur, param(params, "id"), param(params, "elementId"));
  return new NextResponse(null, { status: 204 });
});
