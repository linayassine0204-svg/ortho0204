import { NextResponse } from "next/server";
import { erreurs } from "@/lib/serveur/erreurs";
import { routeProtegee } from "@/lib/serveur/routes";

// Compte connecté (ses propres informations uniquement).
export const GET = routeProtegee(async ({ db, utilisateur }) => {
  const user = await db.user.findUnique({
    where: { id: utilisateur.id },
    select: { id: true, prenom: true, nom: true, role: true, cabinetId: true },
  });
  if (!user) throw erreurs.nonConnecte();
  return NextResponse.json({ utilisateur: user });
});
