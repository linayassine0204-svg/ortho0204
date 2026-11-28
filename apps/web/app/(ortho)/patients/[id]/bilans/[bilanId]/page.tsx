import { notFound } from "next/navigation";
import { EditeurBilan } from "@/components/bilans/EditeurBilan";
import { lireBilan } from "@/lib/serveur/bilans";
import { db } from "@/lib/serveur/db";
import { patientDePage } from "@/lib/serveur/dossier-page";
import { ErreurApi } from "@/lib/serveur/erreurs";

/** Document de ce patient (droits vérifiés, lecture journalisée) ; sinon page 404. */
async function documentDePage(...args: Parameters<typeof lireBilan>) {
  try {
    return await lireBilan(...args);
  } catch (erreur) {
    if (erreur instanceof ErreurApi) notFound();
    throw erreur;
  }
}

// Éditeur d'un bilan, compte rendu ou courrier.
export default async function BilanPage({ params }: PageProps<"/patients/[id]/bilans/[bilanId]">) {
  const { id, bilanId } = await params;
  const { utilisateur } = await patientDePage(id);
  const { bilan, familleConsentante } = await documentDePage(db(), utilisateur, id, bilanId);
  return (
    <main className="contenu contenu-large">
      <h1 className="visuellement-cache">{bilan.titre}</h1>
      <EditeurBilan patientId={id} initial={bilan} familleConsentante={familleConsentante} />
    </main>
  );
}
