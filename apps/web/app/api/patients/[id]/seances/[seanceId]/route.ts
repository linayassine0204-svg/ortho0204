import { NextResponse } from "next/server";
import { modificationSeanceSchema } from "@app/shared";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";
import { modifierSeance } from "@/lib/serveur/seances";

// Notes de séance, points à reprendre, objectifs et matériel en plus.
export const PATCH = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, modificationSeanceSchema);
  const seance = await modifierSeance(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "seanceId"),
    donnees,
  );
  return NextResponse.json({ seance });
});
