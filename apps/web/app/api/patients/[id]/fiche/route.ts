import { NextResponse } from "next/server";
import { modificationPatientSchema } from "@app/shared";
import { lireFiche, modifierPatient } from "@/lib/serveur/patients";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Fiche complète du patient (orthophoniste du cabinet). Lecture journalisée.
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  return NextResponse.json({ fiche: await lireFiche(db, utilisateur, param(params, "id")) });
});

// Modification de la Fiche : seuls les champs envoyés changent.
export const PATCH = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, modificationPatientSchema);
  await modifierPatient(db, utilisateur, param(params, "id"), donnees);
  return new NextResponse(null, { status: 204 });
});
