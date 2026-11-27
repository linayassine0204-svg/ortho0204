import { t } from "@app/shared";
import { FormulaireExercice } from "@/components/bibliotheque/FormulaireExercice";
import { Coquille } from "@/components/Coquille";
import { listerCategories } from "@/lib/serveur/categories";
import { db } from "@/lib/serveur/db";

export default async function NouvelExercicePage() {
  const categories = await listerCategories(db());
  return (
    <Coquille>
      <main className="contenu contenu-etroit">
        <h1>{t("web.exercice.titreNouveau")}</h1>
        <FormulaireExercice categories={categories} />
      </main>
    </Coquille>
  );
}
