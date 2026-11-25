import type { Categorie } from "@/lib/serveur/categories";

/** Cases à cocher des pathologies (champ « pathologieIds », plusieurs valeurs). */
export function CasesPathologies({
  legende,
  categories,
  cochees,
  legendeCachee = false,
}: {
  legende: string;
  categories: Categorie[];
  cochees: string[];
  /** Légende lue par les lecteurs d'écran mais non affichée (titre déjà visible). */
  legendeCachee?: boolean;
}) {
  return (
    <fieldset className="cases">
      <legend className={legendeCachee ? "visuellement-cache" : undefined}>{legende}</legend>
      {categories.map((c) => (
        <label key={c.id} className="choix">
          <input
            type="checkbox"
            name="pathologieIds"
            value={c.id}
            defaultChecked={cochees.includes(c.id)}
          />
          {c.nom}
        </label>
      ))}
    </fieldset>
  );
}
