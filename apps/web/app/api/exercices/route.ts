import { NextResponse } from "next/server";
import { exerciceSchema, filtresBibliothequeSchema } from "@app/shared";
import { erreurs } from "@/lib/serveur/erreurs";
import { creerExercice, listerExercices } from "@/lib/serveur/exercices";
import { lireCorps, routeProtegee } from "@/lib/serveur/routes";

// Bibliothèque : exercices communs + ceux du cabinet, avec recherche et filtres
// (?q=&pathologie=&age=&niveau=&dureeMax=&mesExercices=1&favoris=1).
export const GET = routeProtegee(async ({ req, db, utilisateur }) => {
  const filtres = filtresBibliothequeSchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  );
  if (!filtres.success) throw erreurs.donneesInvalides();
  return NextResponse.json({ exercices: await listerExercices(db, utilisateur, filtres.data) });
});

// « Mes exercices » : création d'un exercice du cabinet, avec ses 3 niveaux.
export const POST = routeProtegee(async ({ req, db, utilisateur }) => {
  const donnees = await lireCorps(req, exerciceSchema);
  return NextResponse.json(
    { exercice: await creerExercice(db, utilisateur, donnees) },
    { status: 201 },
  );
});
