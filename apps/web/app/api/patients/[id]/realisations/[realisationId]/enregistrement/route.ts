import { NextResponse } from "next/server";
import { erreurs } from "@/lib/serveur/erreurs";
import { ajouterEnregistrement } from "@/lib/serveur/realisations";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Mobile : voix enregistrée pendant l'exercice (multipart : « audio » + « dureeSecondes »).
// Envoyée à notre serveur seulement (connexion chiffrée en production), jamais ailleurs.
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  let formulaire: FormData;
  try {
    formulaire = await req.formData();
  } catch {
    throw erreurs.donneesInvalides();
  }
  const fichier = formulaire.get("audio");
  if (!(fichier instanceof File)) throw erreurs.donneesInvalides();
  const duree = Number(formulaire.get("dureeSecondes"));
  const { enregistrement, cree } = await ajouterEnregistrement(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "realisationId"),
    fichier,
    duree,
  );
  return NextResponse.json({ enregistrement }, { status: cree ? 201 : 200 });
});
