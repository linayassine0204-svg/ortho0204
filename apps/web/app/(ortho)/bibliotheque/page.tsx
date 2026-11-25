import { t } from "@app/shared";
import { Bientot } from "@/components/Bientot";
import { Coquille } from "@/components/Coquille";

// Partie à part, hors dossier patient. Contenu : tâche 4.
export default function BibliothequePage() {
  return (
    <Coquille>
      <Bientot titre={t("web.bibliotheque.titre")} />
    </Coquille>
  );
}
