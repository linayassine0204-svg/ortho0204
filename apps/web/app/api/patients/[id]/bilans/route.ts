import { NextResponse } from "next/server";
import { creationDocumentSchema } from "@app/shared";
import { creerBilan, listerBilans } from "@/lib/serveur/bilans";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Documents du patient (orthophoniste du cabinet) : liste avec statut, et création
// depuis un modèle (parties factuelles remplies automatiquement).
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json(await listerBilans(db, utilisateur, param(params, "id")));
});

export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, creationDocumentSchema);
  const bilan = await creerBilan(db, utilisateur, param(params, "id"), donnees);
  return NextResponse.json({ bilan }, { status: 201 });
});
