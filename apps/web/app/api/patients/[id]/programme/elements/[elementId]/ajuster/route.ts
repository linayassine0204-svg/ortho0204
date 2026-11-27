import { NextResponse } from "next/server";
import { ajustementSchema } from "@app/shared";
import { ajusterNiveau } from "@/lib/serveur/programme";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// « Passer au niveau supérieur » ({ sens: "monter" }) ou « Baisser d'un niveau » ({ sens: "baisser" }).
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const { sens } = await lireCorps(req, ajustementSchema);
  const element = await ajusterNiveau(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "elementId"),
    sens,
  );
  return NextResponse.json({ element });
});
