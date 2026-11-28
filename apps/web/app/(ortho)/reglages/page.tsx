import { t } from "@app/shared";
import { ReglagesCabinet } from "@/components/reglages/ReglagesCabinet";
import { db } from "@/lib/serveur/db";
import { lireReglages, listerReponsesRapides } from "@/lib/serveur/messagerie";
import { orthoConnecte } from "@/lib/serveur/session-page";

// Réglages du cabinet : messagerie (interrupteur, horaires de réponse) et réponses rapides.
export default async function ReglagesPage() {
  const utilisateur = await orthoConnecte();
  const [reglages, reponses] = await Promise.all([
    lireReglages(db(), utilisateur),
    listerReponsesRapides(db(), utilisateur),
  ]);
  return (
    <main className="contenu">
      <h1>{t("web.reglages.titre")}</h1>
      <ReglagesCabinet initial={reglages} reponsesInitiales={reponses} />
    </main>
  );
}
