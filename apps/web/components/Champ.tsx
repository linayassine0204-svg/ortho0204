import type { InputHTMLAttributes } from "react";

/** Champ de formulaire avec son libellé (accessibilité : libellé toujours visible). */
export function Champ({
  libelle,
  ...props
}: { libelle: string; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="champ">
      <span>{libelle}</span>
      <input {...props} />
    </label>
  );
}
