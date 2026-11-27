import { NextResponse } from "next/server";
import { marquerConseilLu } from "@/lib/serveur/conseils";
import { param, routeProtegee } from "@/lib/serveur/routes";

// « J'ai compris » (parents) : marque le conseil reçu comme lu.
export const POST = routeProtegee(async ({ db, utilisateur, params }) => {
  const lecture = await marquerConseilLu(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "envoiId"),
  );
  return NextResponse.json(lecture);
});
