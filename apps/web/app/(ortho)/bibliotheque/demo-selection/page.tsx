import { notFound } from "next/navigation";
import { t, type PatientBibliotheque } from "@app/shared";
import { Coquille } from "@/components/Coquille";
import { listerCategories } from "@/lib/serveur/categories";
import { db } from "@/lib/serveur/db";
import { lireConfig } from "@/lib/serveur/config";
import { listerExercices } from "@/lib/serveur/exercices";
import { orthoConnecte } from "@/lib/serveur/session-page";
import { DemoSelection } from "./DemoSelection";

/** Patient FICTIF, uniquement pour cette page de démonstration (pas en base). */
const PATIENT_FICTIF: PatientBibliotheque = {
  id: "patient-fictif-demo",
  prenom: "Camille (fictif)",
  age: 6,
  pathologies: ["articulation"],
};

// Démonstration du mode sélection (tâches 5 et 9). Absente en production.
export default async function DemoSelectionPage() {
  if (lireConfig().production) notFound();
  const utilisateur = await orthoConnecte();
  const [exercices, categories] = await Promise.all([
    listerExercices(db(), utilisateur),
    listerCategories(db()),
  ]);
  return (
    <Coquille>
      <main className="contenu contenu-large">
        <h1>{t("web.bibliotheque.demoTitre")}</h1>
        <p className="alerte">{t("web.bibliotheque.demoTexte")}</p>
        <DemoSelection patient={PATIENT_FICTIF} exercices={exercices} categories={categories} />
      </main>
    </Coquille>
  );
}
