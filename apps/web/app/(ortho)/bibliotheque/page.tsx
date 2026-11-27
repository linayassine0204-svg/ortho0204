import Link from "next/link";
import { t } from "@app/shared";
import { BibliothequeComplete } from "@/components/bibliotheque/BibliothequeComplete";
import { Coquille } from "@/components/Coquille";
import { listerCategories } from "@/lib/serveur/categories";
import { db } from "@/lib/serveur/db";
import { listerExercices } from "@/lib/serveur/exercices";
import { orthoConnecte } from "@/lib/serveur/session-page";

// Partie à part, hors dossier patient : parcourir, créer et gérer les exercices.
export default async function BibliothequePage() {
  const utilisateur = await orthoConnecte();
  const [exercices, categories] = await Promise.all([
    listerExercices(db(), utilisateur),
    listerCategories(db()),
  ]);
  return (
    <Coquille>
      <main className="contenu contenu-large">
        <div className="titre-ligne">
          <h1>{t("web.bibliotheque.titre")}</h1>
          <Link className="bouton bouton-ambre" href="/bibliotheque/nouveau">
            + {t("web.bibliotheque.nouvel")}
          </Link>
        </div>
        <BibliothequeComplete exercices={exercices} categories={categories} />
      </main>
    </Coquille>
  );
}
