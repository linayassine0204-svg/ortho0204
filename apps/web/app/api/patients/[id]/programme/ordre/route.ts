import { NextResponse } from "next/server";
import { ordreSchema } from "@app/shared";
import { reordonner } from "@/lib/serveur/programme";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Nouvel ordre des exercices : { elementIds: [...] } (tous les exercices du programme).
export const PUT = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const { elementIds } = await lireCorps(req, ordreSchema);
  await reordonner(db, utilisateur, param(params, "id"), elementIds);
  return new NextResponse(null, { status: 204 });
});
