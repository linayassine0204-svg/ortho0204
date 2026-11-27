import { NextResponse } from "next/server";
import { donnerConsentement, retirerConsentement } from "@/lib/serveur/consentement";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Accord facultatif du compte famille pour enregistrer la voix pendant les exercices.
export const POST = routeProtegee(async ({ db, utilisateur, params }) => {
  const consentement = await donnerConsentement(
    db,
    utilisateur,
    param(params, "id"),
    "ENREGISTREMENT_AUDIO",
  );
  return NextResponse.json({ consentement }, { status: 201 });
});

export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  await retirerConsentement(db, utilisateur, param(params, "id"), "ENREGISTREMENT_AUDIO");
  return new NextResponse(null, { status: 204 });
});
