"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { NIVEAUX, t, type ExerciceBibliotheque } from "@app/shared";
import { Champ } from "@/components/Champ";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";
import type { CategorieFiltre } from "./BibliothequeSelecteur";

/** Création ou modification d'un exercice du cabinet, avec ses 3 niveaux. */
export function FormulaireExercice({
  categories,
  exercice,
}: {
  categories: CategorieFiltre[];
  exercice?: ExerciceBibliotheque;
}) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const f = new FormData(e.currentTarget);
    const texte = (cle: string) => String(f.get(cle) ?? "");
    const corps = {
      titre: texte("titre"),
      description: texte("description"),
      categorieId: texte("categorieId"),
      ageMin: texte("ageMin"),
      ageMax: texte("ageMax"),
      dureeMinutes: texte("dureeMinutes"),
      scoreMax: texte("scoreMax"),
      apercuConsigne: texte("apercuConsigne"),
      materiel: texte("materiel")
        .split("\n")
        .map((m) => m.trim())
        .filter(Boolean),
      niveaux: NIVEAUX.map((n) => texte(`niveau${n}`)),
    };
    const r = exercice
      ? await envoyerJson(`/api/exercices/${encodeURIComponent(exercice.id)}`, corps, "PUT")
      : await envoyerJson("/api/exercices", corps);
    if (r.ok) {
      router.push("/bibliotheque");
      router.refresh();
    } else {
      setEnvoi(false);
      setErreur(r.message);
    }
  }

  async function supprimer() {
    if (!exercice || !window.confirm(t("web.bibliotheque.confirmerSuppression"))) return;
    const r = await envoyerJson(
      `/api/exercices/${encodeURIComponent(exercice.id)}`,
      undefined,
      "DELETE",
    );
    if (r.ok) {
      router.push("/bibliotheque");
      router.refresh();
    } else setErreur(r.message);
  }

  const consigne = (n: number) => exercice?.niveaux.find((x) => x.niveau === n)?.consigne ?? "";

  return (
    <form onSubmit={soumettre} className="carte">
      <Champ
        libelle={t("web.exercice.titre")}
        name="titre"
        defaultValue={exercice?.titre}
        required
        maxLength={150}
      />
      <label className="champ">
        <span>{t("web.exercice.description")}</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={exercice?.description}
          required
          maxLength={1000}
        />
      </label>
      <label className="champ">
        <span>{t("web.exercice.categorie")}</span>
        <select
          name="categorieId"
          defaultValue={exercice?.categorie.id ?? categories[0]?.id}
          required
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="grille-3">
        <Champ
          libelle={t("web.exercice.ageMin")}
          name="ageMin"
          type="number"
          min={0}
          max={120}
          defaultValue={exercice?.ageMin ?? 4}
          required
        />
        <Champ
          libelle={t("web.exercice.ageMax")}
          name="ageMax"
          type="number"
          min={0}
          max={120}
          defaultValue={exercice?.ageMax ?? 10}
          required
        />
        <Champ
          libelle={t("web.exercice.duree")}
          name="dureeMinutes"
          type="number"
          min={1}
          max={240}
          defaultValue={exercice?.dureeMinutes ?? 10}
          required
        />
        <Champ
          libelle={t("web.exercice.scoreMax")}
          name="scoreMax"
          type="number"
          min={1}
          max={100}
          defaultValue={exercice?.scoreMax ?? ""}
        />
      </div>
      <label className="champ">
        <span>{t("web.exercice.materiel")}</span>
        <textarea name="materiel" rows={3} defaultValue={exercice?.materiel.join("\n")} />
      </label>
      <Champ
        libelle={t("web.exercice.apercuConsigne")}
        name="apercuConsigne"
        defaultValue={exercice?.apercuConsigne}
        required
        maxLength={300}
      />
      <fieldset>
        <legend>{t("web.exercice.niveaux")}</legend>
        {NIVEAUX.map((n) => (
          <label key={n} className="champ">
            <span>{t("web.exercice.consigneNiveau", { niveau: n })}</span>
            <textarea
              name={`niveau${n}`}
              rows={2}
              defaultValue={consigne(n)}
              required
              maxLength={1000}
            />
          </label>
        ))}
      </fieldset>
      <Message type="erreur" texte={erreur} />
      <div className="actions">
        <button type="submit" disabled={envoi}>
          {t("web.exercice.enregistrer")}
        </button>
        <a href="/bibliotheque">{t("web.exercice.annuler")}</a>
        {exercice && (
          <button type="button" className="bouton-lien bouton-danger" onClick={supprimer}>
            {t("web.bibliotheque.supprimer")}
          </button>
        )}
      </div>
    </form>
  );
}
