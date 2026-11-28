import { fichier } from "@/lib/serveur/fichier";
import { lirePieceJointe } from "@/lib/serveur/messagerie";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Photo ou message vocal d'un message (mêmes droits que le fil). Lecture journalisée.
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  const { contenu, typeMime, nomFichier } = await lirePieceJointe(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "pieceId"),
  );
  return fichier(contenu, typeMime, nomFichier, "inline");
});
