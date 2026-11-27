import { notFound } from "next/navigation";
import { t } from "@app/shared";
import { FormulaireExercice } from "@/components/bibliotheque/FormulaireExercice";
import { Coquille } from "@/components/Coquille";
import { listerCategories } from "@/lib/serveur/categories";
import { db } from "@/lib/serveur/db";
import { can } from "@/lib/serveur/droits";
import { ErreurApi } from "@/lib/serveur/erreurs";
import { lireExercice } from "@/lib/serveur/exercices";
import { orthoConnecte } from "@/lib/serveur/session-page";

// Seuls les exercices du cabinet se modifient (même règle que l'API).
export default async function ModifierExercicePage({
  params,
}: PageProps<"/bibliotheque/[id]/modifier">) {
  const { id } = await params;
  const utilisateur = await orthoConnecte();
  let exercice;
  try {
    exercice = await lireExercice(db(), utilisateur, id);
  } catch (erreur) {
    if (erreur instanceof ErreurApi) notFound();
    throw erreur;
  }
  if (
    !exercice.perso ||
    !can(utilisateur, "modifier", { type: "exercice", cabinetId: utilisateur.cabinetId })
  ) {
    notFound();
  }
  const categories = await listerCategories(db());
  return (
    <Coquille>
      <main className="contenu contenu-etroit">
        <h1>{t("web.exercice.titreModifier")}</h1>
        <FormulaireExercice categories={categories} exercice={exercice} />
      </main>
    </Coquille>
  );
}
