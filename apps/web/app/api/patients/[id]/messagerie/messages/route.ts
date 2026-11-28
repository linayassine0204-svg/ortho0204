import { NextResponse } from "next/server";
import { nouveauMessageSchema } from "@app/shared";
import { erreurs } from "@/lib/serveur/erreurs";
import { envoyerMessage } from "@/lib/serveur/messagerie";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Nouveau message. JSON { contenu }, ou multipart (« contenu », « fichier », « dureeSecondes »)
// pour une photo ou un message vocal. Envoyé à notre serveur seulement (connexion chiffrée en
// production), jamais à un service externe.
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const patientId = param(params, "id");
  const type = req.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) {
    const { contenu } = await lireCorps(req, nouveauMessageSchema);
    const message = await envoyerMessage(db, utilisateur, patientId, { contenu });
    return NextResponse.json({ message }, { status: 201 });
  }
  let formulaire: FormData;
  try {
    formulaire = await req.formData();
  } catch {
    throw erreurs.donneesInvalides();
  }
  const contenu = formulaire.get("contenu");
  const fichier = formulaire.get("fichier");
  const duree = formulaire.get("dureeSecondes");
  if (contenu !== null && typeof contenu !== "string") throw erreurs.donneesInvalides();
  if (fichier !== null && !(fichier instanceof File)) throw erreurs.donneesInvalides();
  const message = await envoyerMessage(db, utilisateur, patientId, {
    contenu: contenu ?? "",
    fichier,
    dureeSecondes: typeof duree === "string" && duree !== "" ? Number(duree) : null,
  });
  return NextResponse.json({ message }, { status: 201 });
});
