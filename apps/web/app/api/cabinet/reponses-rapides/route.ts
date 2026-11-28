import { NextResponse } from "next/server";
import { reponseRapideSchema } from "@app/shared";
import { creerReponseRapide, listerReponsesRapides } from "@/lib/serveur/messagerie";
import { lireCorps, routeProtegee } from "@/lib/serveur/routes";

// Réponses rapides du cabinet (modèles de messages).
export const GET = routeProtegee(async ({ db, utilisateur }) => {
  return NextResponse.json({ reponses: await listerReponsesRapides(db, utilisateur) });
});

export const POST = routeProtegee(async ({ req, db, utilisateur }) => {
  const donnees = await lireCorps(req, reponseRapideSchema);
  return NextResponse.json(
    { reponse: await creerReponseRapide(db, utilisateur, donnees) },
    { status: 201 },
  );
});
