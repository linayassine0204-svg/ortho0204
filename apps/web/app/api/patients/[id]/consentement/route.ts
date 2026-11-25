import { NextResponse } from "next/server";
import { donnerConsentement, retirerConsentement } from "@/lib/serveur/consentement";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Le compte famille connecté donne son consentement « données de santé » pour ce patient.
export const POST = routeProtegee(async ({ db, utilisateur, params }) => {
  const consentement = await donnerConsentement(db, utilisateur, param(params, "id"));
  return NextResponse.json({ consentement }, { status: 201 });
});

// Retrait du consentement : plus aucune donnée n'est envoyée à ce compte.
export const DELETE = routeProtegee(async ({ db, utilisateur, params }) => {
  await retirerConsentement(db, utilisateur, param(params, "id"));
  return new NextResponse(null, { status: 204 });
});
