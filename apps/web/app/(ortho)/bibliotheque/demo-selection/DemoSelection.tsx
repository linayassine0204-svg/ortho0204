"use client";

import { useState } from "react";
import { t, type ExerciceBibliotheque, type Niveau, type PatientBibliotheque } from "@app/shared";
import {
  BibliothequeSelecteur,
  type CategorieFiltre,
} from "@/components/bibliotheque/BibliothequeSelecteur";

/** Une page hôte : le panneau de sélection à côté de ce que la page en fait. */
export function DemoSelection(props: {
  patient: PatientBibliotheque;
  exercices: ExerciceBibliotheque[];
  categories: CategorieFiltre[];
}) {
  const [ajouts, setAjouts] = useState<{ id: string; titre: string; niveau: Niveau }[]>([]);
  return (
    <div className="demo-selection">
      <section className="carte" aria-labelledby="demo-ajouts">
        <h2 id="demo-ajouts">{t("web.bibliotheque.demoAjouts")}</h2>
        {ajouts.length === 0 ? (
          <p>{t("web.bibliotheque.demoAucun")}</p>
        ) : (
          <ol data-testid="ajouts">
            {ajouts.map((a, i) => (
              <li key={i}>
                {a.titre} — {t("web.bibliotheque.niveauCourt", { niveau: a.niveau })}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section
        className="panneau-selection"
        aria-label={t("web.bibliotheque.titreSelection", { prenom: props.patient.prenom })}
      >
        <h2>{t("web.bibliotheque.titreSelection", { prenom: props.patient.prenom })}</h2>
        <BibliothequeSelecteur
          mode="selection"
          patient={props.patient}
          exercices={props.exercices}
          categories={props.categories}
          onAjouter={(exercice, niveau) =>
            setAjouts((liste) => [...liste, { id: exercice.id, titre: exercice.titre, niveau }])
          }
        />
      </section>
    </div>
  );
}
