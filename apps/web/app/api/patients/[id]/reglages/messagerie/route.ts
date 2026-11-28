import { NextResponse } from "next/server";
import { reglagePatientMessagerieSchema } from "@app/shared";
import { modifierMessageriePatient } from "@/lib/serveur/messagerie";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// Exception de messagerie pour ce patient : true, false, ou null (comme le cabinet).
export const PUT = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const { messagerieActivee } = await lireCorps(req, reglagePatientMessagerieSchema);
  return NextResponse.json(
    await modifierMessageriePatient(db, utilisateur, param(params, "id"), messagerieActivee),
  );
});
