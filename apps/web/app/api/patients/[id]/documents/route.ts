import { NextResponse } from "next/server";
import { ajouterDocument } from "@/lib/serveur/documents";
import { erreurs } from "@/lib/serveur/erreurs";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Ajout d'un document à la Fiche (formulaire multipart, champ « fichier »).
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  let fichier: FormDataEntryValue | null;
  try {
    fichier = (await req.formData()).get("fichier");
  } catch {
    throw erreurs.donneesInvalides();
  }
  if (!(fichier instanceof File)) throw erreurs.donneesInvalides();
  const document = await ajouterDocument(db, utilisateur, param(params, "id"), fichier);
  return NextResponse.json({ document }, { status: 201 });
});
