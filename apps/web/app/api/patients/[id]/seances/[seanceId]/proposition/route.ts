import { NextResponse } from "next/server";
import { param, routeProtegee } from "@/lib/serveur/routes";
import { reproposer } from "@/lib/serveur/seances";

// « Proposer à nouveau » : nouveau calcul des propositions en attente (règles simples).
export const POST = routeProtegee(async ({ db, utilisateur, params }) => {
  const elements = await reproposer(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "seanceId"),
  );
  return NextResponse.json({ elements });
});
