import { NextResponse } from "next/server";
import { renvoiConseilSchema } from "@app/shared";
import { renvoyerConseil } from "@/lib/serveur/conseils";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Ré-envoyer un conseil déjà envoyé à ce patient (maintenant, à une date, chaque semaine).
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const { planification } = await lireCorps(req, renvoiConseilSchema);
  const conseil = await renvoyerConseil(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "conseilId"),
    planification,
  );
  return NextResponse.json({ conseil }, { status: 201 });
});
