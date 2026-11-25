import { NextResponse } from "next/server";
import { lireDocument, supprimerDocument } from "@/lib/serveur/documents";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Téléchargement d'un document (journalisé comme une sortie de données).
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  const { doc, contenu } = await lireDocument(
    db,
    utilisateur,
    param(params, "id"),
    param(params, "documentId"),
  );
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": doc.typeMime,
      "Content-Length": String(contenu.length),
      // Toujours en téléchargement, jamais affiché dans la page du logiciel.
      "Content-Disposition": `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(doc.nomFichier)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  await supprimerDocument(db, utilisateur, param(params, "id"), param(params, "documentId"));
  return new NextResponse(null, { status: 204 });
});
