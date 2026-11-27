"use client";

import { useState } from "react";
import {
  JOURS,
  t,
  type ElementEnvoye,
  type ExerciceBibliotheque,
  type Jour,
  type PatientBibliotheque,
} from "@app/shared";
import {
  BibliothequeSelecteur,
  type CategorieFiltre,
} from "@/components/bibliotheque/BibliothequeSelecteur";
import { IconeCategorie } from "@/components/bibliotheque/IconeCategorie";
import { Message } from "@/components/Message";
import { useProgramme, type EtatProgramme } from "./useProgramme";
import { dateFr } from "@/lib/format";

export type { EtatProgramme } from "./useProgramme";

/**
 * Écran Programme : à gauche le programme actuel, à droite la bibliothèque
 * (le composant <BibliothequeSelecteur>, en mode sélection, réutilisé tel quel).
 */
export function EditeurProgramme({
  patient,
  initial,
  exercices,
  categories,
}: {
  patient: PatientBibliotheque;
  initial: EtatProgramme;
  exercices: ExerciceBibliotheque[];
  categories: CategorieFiltre[];
}) {
  const programme = useProgramme(patient.id, initial);
  const { elements, ajouter, ajuster, modifier, deplacer, retirer } = programme;

  return (
    <div className="programme-ecran">
      <section className="programme-actuel" aria-labelledby="titre-programme">
        <h2 id="titre-programme">{t("web.programme.actuel")}</h2>
        <EtatEnvoi programme={programme} destinataires={initial.destinataires} />

        {elements.length === 0 ? (
          <p className="carte">{t("web.programme.vide")}</p>
        ) : (
          <ol className="liste-programme" aria-label={t("web.programme.actuel")}>
            {elements.map((el, i) => (
              <ElementProgramme
                key={el.elementId}
                el={el}
                premier={i === 0}
                dernier={i === elements.length - 1}
                onAjuster={(sens) => ajuster(el, sens)}
                onModifier={(champs) => modifier(el, champs)}
                onDeplacer={(d) => deplacer(i, d)}
                onRetirer={() => retirer(el)}
              />
            ))}
          </ol>
        )}
      </section>

      <aside
        className="panneau-selection"
        aria-label={t("web.bibliotheque.titreSelection", { prenom: patient.prenom })}
      >
        <h2>{t("web.programme.bibliotheque")}</h2>
        <BibliothequeSelecteur
          mode="selection"
          patient={patient}
          exercices={exercices}
          categories={categories}
          libelleAjouter={t("web.programme.ajouter")}
          onAjouter={ajouter}
        />
      </aside>
    </div>
  );
}

function ElementProgramme({
  el,
  premier,
  dernier,
  onAjuster,
  onModifier,
  onDeplacer,
  onRetirer,
}: {
  el: ElementEnvoye;
  premier: boolean;
  dernier: boolean;
  onAjuster: (sens: "monter" | "baisser") => void;
  onModifier: (champs: Partial<ElementEnvoye>) => Promise<boolean>;
  onDeplacer: (decalage: -1 | 1) => void;
  onRetirer: () => void;
}) {
  const [mot, setMot] = useState(el.motFamille ?? "");
  const [motOk, setMotOk] = useState(false);
  const basculerJour = (jour: Jour) => {
    const jours = el.jours.includes(jour)
      ? el.jours.filter((j) => j !== jour)
      : [...el.jours, jour];
    void onModifier({ jours });
  };

  return (
    <li className="element-programme" aria-label={el.titre}>
      <div className="element-entete">
        <IconeCategorie slug={el.categorie.slug} />
        <div className="element-titre">
          <strong>{el.titre}</strong>
          <span className="discret">{el.consigne}</span>
          {el.aValider && <span className="badge-a-valider">{t("web.bibliotheque.aValider")}</span>}
        </div>
        <div className="element-ordre">
          <button
            type="button"
            className="bouton-icone"
            disabled={premier}
            onClick={() => onDeplacer(-1)}
            aria-label={`${t("web.programme.monterOrdre")} : ${el.titre}`}
          >
            ↑
          </button>
          <button
            type="button"
            className="bouton-icone"
            disabled={dernier}
            onClick={() => onDeplacer(1)}
            aria-label={`${t("web.programme.descendreOrdre")} : ${el.titre}`}
          >
            ↓
          </button>
        </div>
      </div>

      <div className="element-niveau">
        <button
          type="button"
          className="bouton-niveau"
          disabled={el.niveau <= 1}
          onClick={() => onAjuster("baisser")}
          aria-label={`${t("web.programme.baisser")} : ${el.titre}`}
        >
          −
        </button>
        <span className="niveau-actuel">{t("web.programme.niveau", { niveau: el.niveau })}</span>
        <button
          type="button"
          className="bouton-niveau"
          disabled={el.niveau >= 3}
          onClick={() => onAjuster("monter")}
          aria-label={`${t("web.programme.monter")} : ${el.titre}`}
        >
          +
        </button>
      </div>

      <div className="element-rythme">
        <label className="champ champ-court">
          <span>{t("web.programme.fois")}</span>
          <select
            value={el.foisParSemaine}
            disabled={el.jours.length > 0}
            onChange={(e) => void onModifier({ foisParSemaine: Number(e.currentTarget.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="jours">
          <legend>{t("web.programme.jours")}</legend>
          {JOURS.map((jour) => (
            <label key={jour} className={`case-jour ${el.jours.includes(jour) ? "actif" : ""}`}>
              <input
                type="checkbox"
                checked={el.jours.includes(jour)}
                onChange={() => basculerJour(jour)}
                aria-label={t(`web.programme.joursLongs.${jour}`)}
              />
              <span aria-hidden="true">{t(`web.programme.joursCourts.${jour}`)}</span>
            </label>
          ))}
        </fieldset>
        {el.jours.length === 0 && <p className="aide">{t("web.programme.joursAide")}</p>}
      </div>

      <label className="champ">
        <span>{t("web.programme.mot")}</span>
        <textarea
          rows={2}
          maxLength={500}
          value={mot}
          placeholder={t("web.programme.motAide")}
          onChange={(e) => {
            setMot(e.currentTarget.value);
            setMotOk(false);
          }}
        />
      </label>
      <div className="actions">
        <button
          type="button"
          className="bouton-secondaire-vert"
          disabled={mot === (el.motFamille ?? "")}
          onClick={async () => setMotOk(await onModifier({ motFamille: mot }))}
        >
          {t("web.programme.enregistrerMot")}
        </button>
        {motOk && <span className="statut statut-ok">{t("web.programme.motEnregistre")}</span>}
        <button type="button" className="bouton-lien bouton-danger" onClick={onRetirer}>
          {t("web.programme.retirer")}
        </button>
      </div>
    </li>
  );
}

/** État de l'envoi à la famille, destinataires et bouton « Envoyer » (Programme et Préparation). */
export function EtatEnvoi({
  programme,
  destinataires,
}: {
  programme: ReturnType<typeof useProgramme>;
  destinataires: EtatProgramme["destinataires"];
}) {
  const { derniere, modifie, envoi, elements, message, envoyer } = programme;
  let statut = t("web.programme.jamaisEnvoye");
  if (derniere && modifie) statut = t("web.programme.modifie", { numero: derniere.numero });
  else if (derniere) {
    statut = t("web.programme.envoye", {
      date: dateFr(derniere.envoyeLe),
      numero: derniere.numero,
    });
  }
  return (
    <>
      <p className={`statut-envoi ${derniere && !modifie ? "statut-ok" : "statut-attente"}`}>
        {statut}
      </p>
      <p className="discret">
        {destinataires.length > 0
          ? t("web.programme.destinataires", {
              noms: destinataires.map((d) => `${d.prenom} ${d.nom}`).join(", "),
            })
          : t("web.programme.aucunDestinataire")}
      </p>
      <button
        type="button"
        className="bouton-envoyer"
        disabled={envoi || elements.length === 0 || Boolean(derniere && !modifie)}
        onClick={envoyer}
      >
        {derniere ? t("web.programme.renvoyer") : t("web.programme.envoyer")}
      </button>
      {message && <Message type={message.type} texte={message.texte} />}
    </>
  );
}
