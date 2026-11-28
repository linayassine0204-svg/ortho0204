import { t, type StatutDocument } from "@app/shared";

/** Statut d'un document ou d'une partie : texte toujours visible (pas seulement une couleur). */
export function BadgeStatut({ statut }: { statut: StatutDocument }) {
  return (
    <span className={`badge-statut statut-${statut.toLowerCase().replace("_", "-")}`}>
      {t(`web.bilans.statuts.${statut}`)}
    </span>
  );
}
