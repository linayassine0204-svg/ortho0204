import { NextResponse } from "next/server";
import { partageSchema } from "@app/shared";
import { partagerBilan } from "@/lib/serveur/bilans";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Case « Partager avec la famille » (désactivée par défaut ; document relu seulement).
export const PUT = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const { partage } = await lireCorps(req, partageSchema);
  const bilan = await partagerBilan(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "bilanId"),
    partage,
  );
  return NextResponse.json({ bilan });
});
