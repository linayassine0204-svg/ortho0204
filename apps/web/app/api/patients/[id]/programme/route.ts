import { NextResponse } from "next/server";
import { lireBrouillon } from "@/lib/serveur/programme";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Brouillon du programme (orthophoniste du cabinet) : contenu, dernier envoi, destinataires.
// La famille ne voit jamais le brouillon : elle lit /semaine et /jour (version envoyée).
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json(await lireBrouillon(db, utilisateur, param(params, "id")));
});
