import { NextResponse } from "next/server";
import { reponseRapideSchema } from "@app/shared";
import { modifierReponseRapide, supprimerReponseRapide } from "@/lib/serveur/messagerie";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

export const PATCH = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, reponseRapideSchema);
  return NextResponse.json({
    reponse: await modifierReponseRapide(db, utilisateur, param(params, "reponseId"), donnees),
  });
});

export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  await supprimerReponseRapide(db, utilisateur, param(params, "reponseId"));
  return new NextResponse(null, { status: 204 });
});
