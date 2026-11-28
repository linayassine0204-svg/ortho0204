import { NextResponse } from "next/server";
import { lireFil } from "@/lib/serveur/messagerie";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Fil du patient (orthophoniste du cabinet, parent relié ou patient, avec consentement).
// Messagerie désactivée : 403 « messagerie_desactivee ». Lecture journalisée.
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json(await lireFil(db, utilisateur, param(params, "id")));
});
