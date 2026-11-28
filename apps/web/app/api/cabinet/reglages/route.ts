import { NextResponse } from "next/server";
import { reglagesCabinetSchema } from "@app/shared";
import { lireReglages, modifierReglages } from "@/lib/serveur/messagerie";
import { lireCorps, routeProtegee } from "@/lib/serveur/routes";

// Réglages du cabinet (orthophonistes du cabinet) : messagerie, horaires de réponse.
export const GET = routeProtegee(async ({ db, utilisateur }) => {
  return NextResponse.json({ reglages: await lireReglages(db, utilisateur) });
});

export const PUT = routeProtegee(async ({ req, db, utilisateur }) => {
  const donnees = await lireCorps(req, reglagesCabinetSchema);
  return NextResponse.json({ reglages: await modifierReglages(db, utilisateur, donnees) });
});
