import { NextResponse } from "next/server";
import { modificationSectionSchema } from "@app/shared";
import { modifierSection } from "@/lib/serveur/bilans";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Écrire ou corriger une partie (`contenu`), ou la marquer relue (`relu: true`).
export const PATCH = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, modificationSectionSchema);
  return NextResponse.json(
    await modifierSection(
      db,
      utilisateur,
      param(params, "id"),
      param(params, "bilanId"),
      param(params, "cle"),
      donnees,
    ),
  );
});
