/** Icône d'une pathologie, affichée quand l'exercice n'a pas d'image. */
const ICONES: Record<string, string> = {
  "langage-oral": "💬",
  "langage-ecrit": "✏️",
  articulation: "👄",
  begaiement: "🐢",
  voix: "🎵",
  deglutition: "🥄",
  "cognition-mathematique": "🔢",
};

export function IconeCategorie({ slug, grande = false }: { slug: string; grande?: boolean }) {
  return (
    <span className={`icone-exercice ${grande ? "icone-grande" : ""}`} aria-hidden="true">
      {ICONES[slug] ?? "📘"}
    </span>
  );
}
