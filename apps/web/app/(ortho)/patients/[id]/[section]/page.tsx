import { notFound } from "next/navigation";
import { t } from "@app/shared";
import { Bientot } from "@/components/Bientot";
import { Fiche } from "@/components/fiche/Fiche";
import { listerCategories } from "@/lib/serveur/categories";
import { db } from "@/lib/serveur/db";
import { SECTIONS_PATIENT, type SectionPatient } from "@/lib/serveur/droits";
import { patientDePage } from "@/lib/serveur/dossier-page";
import { listerExercices } from "@/lib/serveur/exercices";
import { lireFiche, patientPourBibliotheque } from "@/lib/serveur/patients";
import { lireBrouillon } from "@/lib/serveur/programme";
import { EditeurProgramme } from "@/components/programme/EditeurProgramme";
import { EcranConseils } from "@/components/conseils/EcranConseils";
import { lireConseilsPatient } from "@/lib/serveur/conseils";
import { EcranPreparation } from "@/components/preparation/EcranPreparation";
import { lirePreparation, listerSeancesPassees } from "@/lib/serveur/seances";

function estSection(valeur: string): valeur is SectionPatient {
  return (SECTIONS_PATIENT as readonly string[]).includes(valeur);
}

// Sous-partie du dossier. Chaque ouverture est écrite dans le journal d'accès.
// Une messagerie désactivée donne une page 404 (can() la refuse).
export default async function SectionPage({ params }: PageProps<"/patients/[id]/[section]">) {
  const { id, section } = await params;
  if (!estSection(section)) notFound();

  if (section === "fiche") {
    const { utilisateur } = await patientDePage(id);
    const [fiche, categories] = await Promise.all([
      lireFiche(db(), utilisateur, id), // vérifie les droits et journalise « fiche »
      listerCategories(db()),
    ]);
    const seances = await listerSeancesPassees(db(), utilisateur, id);
    return <Fiche fiche={fiche} categories={categories} seances={seances} />;
  }

  if (section === "programme") {
    const { utilisateur } = await patientDePage(id);
    // lireBrouillon vérifie le droit de composer et journalise la lecture « programme ».
    const brouillon = await lireBrouillon(db(), utilisateur, id);
    const [patient, exercices, categories] = await Promise.all([
      patientPourBibliotheque(db(), id),
      listerExercices(db(), utilisateur),
      listerCategories(db()),
    ]);
    return (
      <main className="contenu contenu-large">
        <h1>{t("web.programme.titre")}</h1>
        <EditeurProgramme
          patient={patient}
          initial={brouillon}
          exercices={exercices}
          categories={categories}
        />
      </main>
    );
  }

  if (section === "preparation") {
    const { utilisateur } = await patientDePage(id);
    // lirePreparation vérifie le droit de préparer et journalise la lecture « preparation ».
    const preparation = await lirePreparation(db(), utilisateur, id);
    const [patient, exercices, categories] = await Promise.all([
      patientPourBibliotheque(db(), id),
      listerExercices(db(), utilisateur),
      listerCategories(db()),
    ]);
    return (
      <main className="contenu contenu-large">
        <h1>{t("web.preparation.titre")}</h1>
        <EcranPreparation
          patient={patient}
          initial={preparation}
          exercices={exercices}
          categories={categories}
        />
      </main>
    );
  }

  if (section === "conseils") {
    const { utilisateur } = await patientDePage(id);
    // lireConseilsPatient vérifie le droit d'envoyer et journalise la lecture « conseils ».
    const conseils = await lireConseilsPatient(db(), utilisateur, id);
    return (
      <main className="contenu contenu-large">
        <h1>{t("web.conseils.titre")}</h1>
        <EcranConseils initial={conseils} />
      </main>
    );
  }

  await patientDePage(id, section);
  return <Bientot titre={t(`web.sections.${section}`)} />;
}
