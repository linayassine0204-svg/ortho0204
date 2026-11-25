import { NextResponse } from "next/server";
import { listerPatientsVisibles } from "@/lib/serveur/patients";
import { routeProtegee } from "@/lib/serveur/routes";

// Patients visibles par l'utilisateur : son cabinet (orthophoniste), ses enfants
// (parent), son propre dossier (patient adulte).
export const GET = routeProtegee(async ({ db, utilisateur }) => {
  return NextResponse.json({ patients: await listerPatientsVisibles(db, utilisateur) });
});
