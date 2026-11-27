import { NextResponse } from "next/server";
import { nouvelleRealisationSchema } from "@app/shared";
import { enregistrerRealisation } from "@/lib/serveur/realisations";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Mobile : « C'est fait » (ressenti, score). 201 si créée ; 200 si cette réalisation
// (même idClient) était déjà enregistrée : la synchronisation ne crée pas de doublon.
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, nouvelleRealisationSchema);
  const { realisation, cree } = await enregistrerRealisation(
    db,
    utilisateur,
    param(params, "id"),
    donnees,
  );
  return NextResponse.json({ realisation }, { status: cree ? 201 : 200 });
});
