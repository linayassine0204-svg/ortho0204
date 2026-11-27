"use client";

import type { ExerciceBibliotheque } from "@app/shared";
import { envoyerJson } from "@/lib/client/api";
import { BibliothequeSelecteur, type CategorieFiltre } from "./BibliothequeSelecteur";

/** Page /bibliotheque : le composant en mode complet, avec les favoris branchés sur l'API. */
export function BibliothequeComplete(props: {
  exercices: ExerciceBibliotheque[];
  categories: CategorieFiltre[];
}) {
  return (
    <BibliothequeSelecteur
      mode="complet"
      {...props}
      onFavori={async (exercice, favori) => {
        const r = await envoyerJson(
          `/api/exercices/${encodeURIComponent(exercice.id)}/favori`,
          undefined,
          favori ? "PUT" : "DELETE",
        );
        return r.ok;
      }}
    />
  );
}
