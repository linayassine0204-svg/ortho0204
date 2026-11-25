import { NextResponse } from "next/server";
import { can } from "@/lib/serveur/droits";
import { patientAutorise, ressourcePatient } from "@/lib/serveur/patients";
import { param, routeProtegee } from "@/lib/serveur/routes";

// Résumé du dossier patient. La lecture est écrite dans le journal d'accès.
// Les notes (fiche) ne sont renvoyées qu'à qui a le droit de lire la fiche.
export const GET = routeProtegee(async ({ db, utilisateur, params }) => {
  const patient = await patientAutorise(db, utilisateur, param(params, "id"), "lire");
  const voitFiche = can(utilisateur, "lire", ressourcePatient(patient, "fiche"));
  return NextResponse.json({
    patient: {
      id: patient.id,
      prenom: patient.prenom,
      dateNaissance: patient.dateNaissance,
      ...(voitFiche ? { notes: patient.notes } : {}),
    },
  });
});
