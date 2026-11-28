import { NextResponse } from "next/server";
import { modificationDocumentSchema } from "@app/shared";
import { lireBilan, modifierBilan, supprimerBilan } from "@/lib/serveur/bilans";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json(
    await lireBilan(db, utilisateur, param(params, "id"), param(params, "bilanId")),
  );
});

// Titre, destinataire (un document partagé modifié n'est plus partagé).
export const PATCH = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, modificationDocumentSchema);
  return NextResponse.json(
    await modifierBilan(db, utilisateur, param(params, "id"), param(params, "bilanId"), donnees),
  );
});

export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  await supprimerBilan(db, utilisateur, param(params, "id"), param(params, "bilanId"));
  return new NextResponse(null, { status: 204 });
});
