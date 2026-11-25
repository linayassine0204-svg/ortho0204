import { t } from "@app/shared";

/** Écran provisoire d'une partie qui sera construite dans une prochaine tâche. */
export function Bientot({ titre }: { titre: string }) {
  return (
    <main className="contenu">
      <h1>{titre}</h1>
      <div className="carte bientot">
        <p className="bientot-titre">{t("web.bientot.titre")}</p>
        <p>{t("web.bientot.texte")}</p>
      </div>
    </main>
  );
}
