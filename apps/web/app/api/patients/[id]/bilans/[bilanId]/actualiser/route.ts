import { NextResponse } from "next/server";
import { actualiserBilan } from "@/lib/serveur/bilans";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Recalcule les parties automatiques depuis les données (elles redeviennent à relire).
export const POST = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json(
    await actualiserBilan(db, utilisateur, param(params, "id"), param(params, "bilanId")),
  );
});
