"use client";

import { useState } from "react";
import {
  JOURS,
  rythme,
  t,
  type ElementEnvoye,
  type ExerciceBibliotheque,
  type Jour,
  type Niveau,
  type PatientBibliotheque,
} from "@app/shared";
import {
  BibliothequeSelecteur,
  type CategorieFiltre,
} from "@/components/bibliotheque/BibliothequeSelecteur";
import { IconeCategorie } from "@/components/bibliotheque/IconeCategorie";
import { Message } from "@/components/Message";
import { envoyerJson, type ResultatApi } from "@/lib/client/api";
import { dateFr } from "@/lib/format";

export interface EtatProgramme {
  elements: ElementEnvoye[];
  derniereVersion: { numero: number; envoyeLe: Date | string } | null;
  modifieDepuisEnvoi: boolean;
  destinataires: { id: string; prenom: string; nom: string }[];
}

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
  const [elements, setElements] = useState(initial.elements);
  const [derniere, setDerniere] = useState(initial.derniereVersion);
  const [modifie, setModifie] = useState(initial.modifieDepuisEnvoi);
  const [message, setMessage] = useState<{ type: "erreur" | "succes"; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const base = `/api/patients/${encodeURIComponent(patient.id)}/programme`;

  /** Affiche l'erreur éventuelle ; renvoie true si l'appel a réussi. */
  function reussi(r: ResultatApi<unknown>): boolean {
    if (!r.ok) {
      setMessage({ type: "erreur", texte: r.message });
      return false;
    }
    setMessage(null);
    if (derniere) setModifie(true);
    return true;
  }

  /** Données de la réponse, ou null en cas d'erreur (message affiché). */
  function traiter<T>(r: ResultatApi<T>): T | null {
    return reussi(r) && r.ok ? r.donnees : null;
  }

  const remplacer = (el: ElementEnvoye) =>
    setElements((liste) => liste.map((x) => (x.elementId === el.elementId ? el : x)));

  async function ajouter(exercice: ExerciceBibliotheque, niveau: Niveau) {
    const d = traiter(
      await envoyerJson<{ element: ElementEnvoye }>(`${base}/elements`, {
        exerciceId: exercice.id,
        niveau,
      }),
    );
    if (!d) return false;
    setElements((liste) => [...liste, d.element]);
    return true;
  }

  async function modifier(el: ElementEnvoye, champs: Partial<ElementEnvoye>) {
    // Affichage immédiat (cases, listes) ; on revient en arrière si le serveur refuse.
    if (champs.jours !== undefined || champs.foisParSemaine !== undefined) {
      const jours = champs.jours ?? el.jours;
      remplacer({
        ...el,
        ...champs,
        foisParSemaine: rythme(champs.foisParSemaine ?? el.foisParSemaine, jours),
      });
    }
    const d = traiter(
      await envoyerJson<{ element: ElementEnvoye }>(
        `${base}/elements/${encodeURIComponent(el.elementId)}`,
        champs,
        "PATCH",
      ),
    );
    remplacer(d ? d.element : el);
    return Boolean(d);
  }

  async function ajuster(el: ElementEnvoye, sens: "monter" | "baisser") {
    const d = traiter(
      await envoyerJson<{ element: ElementEnvoye }>(
        `${base}/elements/${encodeURIComponent(el.elementId)}/ajuster`,
        { sens },
      ),
    );
    if (d) remplacer(d.element);
  }

  async function retirer(el: ElementEnvoye) {
    const r = await envoyerJson(
      `${base}/elements/${encodeURIComponent(el.elementId)}`,
      undefined,
      "DELETE",
    );
    if (reussi(r)) setElements((liste) => liste.filter((x) => x.elementId !== el.elementId));
  }

  async function deplacer(index: number, decalage: -1 | 1) {
    const cible = index + decalage;
    if (cible < 0 || cible >= elements.length) return;
    const nouvel = [...elements];
    [nouvel[index], nouvel[cible]] = [
      nouvel[cible] as ElementEnvoye,
      nouvel[index] as ElementEnvoye,
    ];
    const avant = elements;
    setElements(nouvel); // affichage immédiat, annulé si le serveur refuse
    const r = await envoyerJson(
      `${base}/ordre`,
      { elementIds: nouvel.map((e) => e.elementId) },
      "PUT",
    );
    if (!reussi(r)) setElements(avant);
  }

  async function envoyer() {
    setEnvoi(true);
    const d = traiter(
      await envoyerJson<{ version: { numero: number; envoyeLe: string } }>(`${base}/envoi`),
    );
    setEnvoi(false);
    if (!d) return;
    setDerniere(d.version);
    setModifie(false);
    setMessage({ type: "succes", texte: t("web.programme.envoiOk", { numero: d.version.numero }) });
  }

  let statut = t("web.programme.jamaisEnvoye");
  if (derniere && modifie) statut = t("web.programme.modifie", { numero: derniere.numero });
  else if (derniere) {
    statut = t("web.programme.envoye", {
      date: dateFr(derniere.envoyeLe),
      numero: derniere.numero,
    });
  }

  return (
    <div className="programme-ecran">
      <section className="programme-actuel" aria-labelledby="titre-programme">
        <h2 id="titre-programme">{t("web.programme.actuel")}</h2>
        <p className={`statut-envoi ${derniere && !modifie ? "statut-ok" : "statut-attente"}`}>
          {statut}
        </p>
        <p className="discret">
          {initial.destinataires.length > 0
            ? t("web.programme.destinataires", {
                noms: initial.destinataires.map((d) => `${d.prenom} ${d.nom}`).join(", "),
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
