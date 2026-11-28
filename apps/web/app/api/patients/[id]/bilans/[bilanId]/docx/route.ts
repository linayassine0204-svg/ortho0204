import { exporterBilan } from "@/lib/serveur/bilans";
import { fichier } from "@/lib/serveur/fichier";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Export Word (.docx), produit sur notre serveur. Export journalisé.
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  const { octets, nomFichier } = await exporterBilan(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "bilanId"),
    "docx",
  );
  return fichier(
    octets,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    nomFichier,
    "attachment",
  );
});
