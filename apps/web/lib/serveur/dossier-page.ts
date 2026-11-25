import { notFound } from "next/navigation";
import type { SectionPatient } from "./droits";
import { db } from "./db";
import { ErreurApi } from "./erreurs";
import { messagerieActivee, patientAutorise } from "./patients";
import { orthoConnecte } from "./session-page";

/**
 * Patient d'une page du dossier (/patients/[id]/…), avec la même vérification de
 * droits que l'API. Refus ou patient absent : page 404.
 * `section` fournie : la lecture est écrite dans le journal d'accès.
 */
export async function patientDePage(id: string, section?: SectionPatient) {
  const utilisateur = await orthoConnecte();
  try {
    const patient = await patientAutorise(db(), utilisateur, id, "lire", section ?? "fiche", {
      journaliser: section !== undefined,
    });
    return {
      utilisateur,
      patient: {
        id: patient.id,
        prenom: patient.prenom,
        nom: patient.nom,
        messagerieActivee: messagerieActivee(patient),
      },
    };
  } catch (erreur) {
    if (erreur instanceof ErreurApi) notFound();
    throw erreur;
  }
}
