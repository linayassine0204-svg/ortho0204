import { exporterBilan } from "@/lib/serveur/bilans";
import { fichier } from "@/lib/serveur/fichier";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Export PDF, produit sur notre serveur. Export journalisé.
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  const { octets, nomFichier } = await exporterBilan(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "bilanId"),
    "pdf",
  );
  return fichier(octets, "application/pdf", nomFichier, "inline");
});
