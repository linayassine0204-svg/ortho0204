import { t } from "@app/shared";
import { Coquille } from "@/components/Coquille";
import { listerCategories } from "@/lib/serveur/categories";
import { db } from "@/lib/serveur/db";
import { FormulaireNouveauPatient } from "./FormulaireNouveauPatient";

export default async function NouveauPatientPage() {
  const categories = await listerCategories(db());
  return (
    <Coquille>
      <main className="contenu contenu-etroit">
        <h1>{t("web.nouveauPatient.titre")}</h1>
        <FormulaireNouveauPatient categories={categories} />
      </main>
    </Coquille>
  );
}
