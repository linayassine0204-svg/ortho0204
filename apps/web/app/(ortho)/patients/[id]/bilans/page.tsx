import { t } from "@app/shared";
import { ListeBilans } from "@/components/bilans/ListeBilans";
import { listerBilans } from "@/lib/serveur/bilans";
import { db } from "@/lib/serveur/db";
import { patientDePage } from "@/lib/serveur/dossier-page";

// Sous-partie Bilans : documents du patient et création depuis un modèle.
export default async function BilansPage({ params }: PageProps<"/patients/[id]/bilans">) {
  const { id } = await params;
  const { utilisateur } = await patientDePage(id);
  // listerBilans vérifie le droit de rédiger et journalise la lecture « bilans ».
  const liste = await listerBilans(db(), utilisateur, id);
  return (
    <main className="contenu contenu-large">
      <h1>{t("web.bilans.titre")}</h1>
      <ListeBilans patientId={id} initial={liste} />
    </main>
  );
}
