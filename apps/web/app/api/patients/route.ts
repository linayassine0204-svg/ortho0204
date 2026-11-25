import { NextResponse } from "next/server";
import { nouveauPatientSchema, recherchePatientsSchema } from "@app/shared";
import { erreurs } from "@/lib/serveur/erreurs";
import { creerPatient, listerPatientsVisibles } from "@/lib/serveur/patients";
import { lireCorps, routeProtegee } from "@/lib/serveur/routes";

// Patients visibles par l'utilisateur : son cabinet (orthophoniste), ses enfants
// (parent), son propre dossier (patient adulte). Recherche : ?q=…&pathologie=slug
export const GET = routeProtegee(async ({ req, db, utilisateur }) => {
  const recherche = recherchePatientsSchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? undefined,
    pathologie: req.nextUrl.searchParams.get("pathologie") ?? undefined,
  });
  if (!recherche.success) throw erreurs.donneesInvalides();
  return NextResponse.json({
    patients: await listerPatientsVisibles(db, utilisateur, recherche.data),
  });
});

// Création d'un patient dans le cabinet de l'orthophoniste connecté.
export const POST = routeProtegee(async ({ req, db, utilisateur }) => {
  const donnees = await lireCorps(req, nouveauPatientSchema);
  return NextResponse.json(await creerPatient(db, utilisateur, donnees), { status: 201 });
});
