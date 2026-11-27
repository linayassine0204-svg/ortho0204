import { param, routeProtegee } from "@/lib/serveur/routes";
import { exporterFicheSeance } from "@/lib/serveur/seances";

// Fiche de séance imprimable (PDF produit sur notre serveur). Export journalisé.
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  const { pdf, nomFichier } = await exporterFicheSeance(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "seanceId"),
  );
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomFichier}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});
