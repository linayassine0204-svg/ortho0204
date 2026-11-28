import { exporterBilanPartage } from "@/lib/serveur/bilans";
import { fichier } from "@/lib/serveur/fichier";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Famille : PDF d'un document partagé (non partagé : 404).
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  const { octets, nomFichier } = await exporterBilanPartage(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "bilanId"),
  );
  return fichier(octets, "application/pdf", nomFichier, "inline");
});
