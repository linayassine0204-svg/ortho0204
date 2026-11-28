import { NextResponse } from "next/server";
import { listerBilansPartages } from "@/lib/serveur/bilans";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Famille (parent relié ou patient, avec consentement) : documents PARTAGÉS seulement.
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json({
    documents: await listerBilansPartages(db, utilisateur, param(params, "id")),
  });
});
