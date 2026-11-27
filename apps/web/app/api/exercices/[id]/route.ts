import { NextResponse } from "next/server";
import { exerciceSchema } from "@app/shared";
import { lireExercice, modifierExercice, supprimerExercice } from "@/lib/serveur/exercices";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json({ exercice: await lireExercice(db, utilisateur, param(params, "id")) });
});

// Modification complète d'un exercice du cabinet (jamais d'un exercice commun).
export const PUT = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, exerciceSchema);
  return NextResponse.json({
    exercice: await modifierExercice(db, utilisateur, param(params, "id"), donnees),
  });
});

export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  await supprimerExercice(db, utilisateur, param(params, "id"));
  return new NextResponse(null, { status: 204 });
});
