import { NextResponse } from "next/server";
import { envoyerProgramme } from "@/lib/serveur/programme";
import { param, routeProtegee } from "@/lib/serveur/routes";

// « Envoyer » : publie une nouvelle version pour la famille.
export const POST = routeProtegee(async ({ db, utilisateur, params }) => {
  const version = await envoyerProgramme(db, utilisateur, param(params, "id"));
  return NextResponse.json({ version }, { status: 201 });
});
