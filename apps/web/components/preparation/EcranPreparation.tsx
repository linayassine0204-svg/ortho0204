"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  NIVEAUX,
  dureeSeance,
  filtresPourPatient,
  filtrerExercices,
  materielSeance,
  t,
  type ExerciceBibliotheque,
  type Niveau,
  type PatientBibliotheque,
} from "@app/shared";
import {
  BibliothequeSelecteur,
  type CategorieFiltre,
} from "@/components/bibliotheque/BibliothequeSelecteur";
import { IconeCategorie } from "@/components/bibliotheque/IconeCategorie";
import { Message } from "@/components/Message";
import { EtatEnvoi } from "@/components/programme/EditeurProgramme";
import {
  useProgramme,
  type EtatProgramme,
  type MessageEcran,
} from "@/components/programme/useProgramme";
import { envoyerJson } from "@/lib/client/api";
import { jourFr } from "@/lib/format";
import type { ElementSeanceVue, Preparation } from "@/lib/serveur/seances";
import { Dictee } from "./Dictee";
import { ResumeAvantSeance } from "./ResumeAvantSeance";

const P = "web.preparation";

/**
 * Préparer une séance en quelques minutes :
 * - en haut, le résumé avant séance ;
 * - au centre, la séance en construction (proposée, puis retenue) et le programme ;
 * - à droite, le panneau Bibliothèque (le composant <BibliothequeSelecteur>, réutilisé).
 */
export function EcranPreparation({
  patient,
  initial,
  programme: programmeInitial,
  exercices,
  categories,
}: {
  patient: PatientBibliotheque;
  initial: Preparation;
  programme: EtatProgramme;
  exercices: ExerciceBibliotheque[];
  categories: CategorieFiltre[];
}) {
  const [preparation, setPreparation] = useState(initial);
  const programme = useProgramme(patient.id, programmeInitial);

  /** Après « Terminer » : on relit la préparation (nouvelle séance proposée). */
  async function recharger() {
    const r = await fetch(`/api/patients/${encodeURIComponent(patient.id)}/preparation`, {
      credentials: "same-origin",
    });
    if (r.ok) setPreparation((await r.json()) as Preparation);
  }

  return (
    <div className="preparation-ecran">
      <ResumeAvantSeance resume={preparation.resume} />
      <SeanceEtBibliotheque
        // Nouvelle séance : on repart d'un état propre.
        key={preparation.seance.id}
        patient={patient}
        preparation={preparation}
        programme={programme}
        destinataires={programmeInitial.destinataires}
        exercices={exercices}
        categories={categories}
        onTerminee={recharger}
      />
    </div>
  );
}

function SeanceEtBibliotheque({
  patient,
  preparation,
  programme,
  destinataires,
  exercices,
  categories,
  onTerminee,
}: {
  patient: PatientBibliotheque;
  preparation: Preparation;
  programme: ReturnType<typeof useProgramme>;
  destinataires: EtatProgramme["destinataires"];
  exercices: ExerciceBibliotheque[];
  categories: CategorieFiltre[];
  onTerminee: () => Promise<void>;
}) {
  const { seance } = preparation;
  const [elements, setElements] = useState<ElementSeanceVue[]>(seance.elements);
  const [message, setMessage] = useState<MessageEcran>(null);
  const base = `/api/patients/${encodeURIComponent(patient.id)}/seances/${encodeURIComponent(seance.id)}`;

  const proposes = elements.filter((e) => !e.retenu);
  const retenus = elements.filter((e) => e.retenu);
  const materiel = materielSeance(retenus);

  /** Remplace (ou ajoute) un élément renvoyé par l'API. */
  const integrer = (el: ElementSeanceVue) =>
    setElements((liste) =>
      liste.some((x) => x.id === el.id)
        ? liste.map((x) => (x.id === el.id ? el : x))
        : [...liste, el],
    );

  async function appel<T>(url: string, corps?: unknown, methode?: "POST" | "PATCH" | "DELETE") {
    const r = await envoyerJson<T>(url, corps, methode);
    if (!r.ok) {
      setMessage({ type: "erreur", texte: r.message });
      return null;
    }
    setMessage(null);
    return r.donnees ?? ({} as T);
  }

  async function ajouterALaSeance(exercice: ExerciceBibliotheque, niveau: Niveau) {
    const d = await appel<{ element: ElementSeanceVue }>(`${base}/elements`, {
      exerciceId: exercice.id,
      niveau,
    });
    if (!d) return false;
    integrer(d.element);
    return true;
  }

  async function modifier(
    el: ElementSeanceVue,
    champs: { retenu?: true; niveau?: number; exerciceId?: string },
  ) {
    const d = await appel<{ element: ElementSeanceVue }>(
      `${base}/elements/${encodeURIComponent(el.id)}`,
      champs,
      "PATCH",
    );
    if (d) integrer(d.element);
    return Boolean(d);
  }

  async function retirer(el: ElementSeanceVue) {
    const d = await appel(`${base}/elements/${encodeURIComponent(el.id)}`, undefined, "DELETE");
    if (d) setElements((liste) => liste.filter((x) => x.id !== el.id));
  }

  async function toutAccepter() {
    for (const el of proposes) {
      if (!(await modifier(el, { retenu: true }))) return;
    }
  }

  async function reproposer() {
    const d = await appel<{ elements: ElementSeanceVue[] }>(`${base}/proposition`, {});
    if (d) setElements(d.elements);
  }

  async function copier(depuisSeanceId: string) {
    const d = await appel<{ copies: number; elements: ElementSeanceVue[] }>(`${base}/copie`, {
      depuisSeanceId,
    });
    if (!d) return;
    setElements(d.elements);
    setMessage({
      type: "succes",
      texte:
        d.copies > 0
          ? t(`${P}.reutiliser.copiee`, { n: d.copies })
          : t(`${P}.reutiliser.rienACopier`),
    });
  }

  async function terminer() {
    if (!window.confirm(t(`${P}.terminerConfirmer`))) return;
    if (await appel(`${base}/terminer`, {})) await onTerminee();
  }

  // Exercices possibles pour « Remplacer par » : ceux de la pathologie et de l'âge du patient.
  const remplacants = useMemo(() => {
    const presents = new Set(elements.map((e) => e.exerciceId));
    return filtrerExercices(exercices, filtresPourPatient(patient)).filter(
      (e) => !presents.has(e.id),
    );
  }, [elements, exercices, patient]);

  return (
    <div className="preparation-zones">
      <div className="preparation-centre">
        <section className="seance-construction" aria-labelledby="titre-seance">
          <div className="entete-seance">
            <h2 id="titre-seance">{t(`${P}.seance.titre`)}</h2>
            <span className="discret">{t(`${P}.seanceDu`, { date: jourFr(seance.date) })}</span>
          </div>
          {message && <Message type={message.type} texte={message.texte} />}

          <div className="bloc-propose">
            <h3>{t(`${P}.seance.proposee`)}</h3>
            <p className="aide">{t(`${P}.seance.proposeeAide`)}</p>
            {proposes.length === 0 ? (
              <p className="discret">{t(`${P}.seance.aucuneProposition`)}</p>
            ) : (
              <ul className="liste-seance" aria-label={t(`${P}.seance.proposee`)}>
                {proposes.map((el) => (
                  <PropositionSeance
                    key={el.id}
                    el={el}
                    remplacants={remplacants}
                    onAccepter={() => modifier(el, { retenu: true })}
                    onNiveau={(niveau) => modifier(el, { niveau })}
                    onRemplacer={(exerciceId) => modifier(el, { exerciceId })}
                    onRetirer={() => retirer(el)}
                  />
                ))}
              </ul>
            )}
            <div className="actions">
              {proposes.length > 0 && (
                <button type="button" className="bouton-secondaire-vert" onClick={toutAccepter}>
                  {t(`${P}.seance.toutAccepter`)}
                </button>
              )}
              <button type="button" className="bouton-lien" onClick={reproposer}>
                {t(`${P}.seance.recalculer`)}
              </button>
            </div>
          </div>

          <div className="bloc-retenu">
            <h3>{t(`${P}.seance.retenus`)}</h3>
            {retenus.length === 0 ? (
              <p className="carte">{t(`${P}.seance.vide`)}</p>
            ) : (
              <>
                <ol className="liste-seance" aria-label={t(`${P}.seance.retenus`)}>
                  {retenus.map((el) => (
                    <ExerciceRetenu
                      key={el.id}
                      el={el}
                      onNiveau={(niveau) => modifier(el, { niveau })}
                      onRetirer={() => retirer(el)}
                    />
                  ))}
                </ol>
                <p className="statut-envoi">
                  {t(`${P}.seance.duree`, { minutes: dureeSeance(retenus) })}
                </p>
              </>
            )}
          </div>

          <div className="bloc-materiel">
            <h3>{t(`${P}.materiel.titre`)}</h3>
            {materiel.length === 0 ? (
              <p className="discret">{t(`${P}.materiel.aucun`)}</p>
            ) : (
              <ul className="liste-materiel" aria-label={t(`${P}.materiel.titre`)}>
                {materiel.map((m) => (
                  <li key={m.nom}>
                    <strong>{m.nom}</strong>{" "}
                    <span className="discret">
                      {t(`${P}.materiel.pour`, { exercices: m.exercices.join(", ") })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <a className="bouton bouton-exporter" href={`${base}/pdf`} target="_blank" rel="noopener">
            {t(`${P}.pdf.exporter`)}
          </a>

          <NotesSeance base={base} seance={seance} />

          <button type="button" className="bouton-terminer" onClick={terminer}>
            {t(`${P}.terminer`)}
          </button>
        </section>

        <ProgrammeRapide
          patientId={patient.id}
          programme={programme}
          destinataires={destinataires}
        />

        <section className="seances-passees" aria-labelledby="titre-passees">
          <h2 id="titre-passees">{t(`${P}.reutiliser.titre`)}</h2>
          {preparation.seancesPassees.length === 0 ? (
            <p className="discret">{t(`${P}.reutiliser.aucune`)}</p>
          ) : (
            <ul className="liste-passees">
              {preparation.seancesPassees.map((s) => (
                <li key={s.id} className="carte">
                  <strong>{t(`${P}.seanceDu`, { date: jourFr(s.date) })}</strong>
                  <span className="discret">
                    {s.exercices
                      .map(
                        (e) =>
                          `${e.titre} (${t("web.bibliotheque.niveauCourt", { niveau: e.niveau })})`,
                      )
                      .join(", ")}
                  </span>
                  <button
                    type="button"
                    className="bouton-secondaire-vert"
                    onClick={() => copier(s.id)}
                    aria-label={`${t(`${P}.reutiliser.copier`)} : ${t(`${P}.seanceDu`, { date: jourFr(s.date) })}`}
                  >
                    {t(`${P}.reutiliser.copier`)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside
        className="panneau-selection"
        aria-label={t("web.bibliotheque.titreSelection", { prenom: patient.prenom })}
      >
        <h2>{t(`${P}.bibliotheque`)}</h2>
        <BibliothequeSelecteur
          mode="selection"
          patient={patient}
          exercices={exercices}
          categories={categories}
          libelleAjouter={t(`${P}.seance.ajouter`)}
          onAjouter={ajouterALaSeance}
          autresAjouts={[{ libelle: t("web.programme.ajouter"), onAjouter: programme.ajouter }]}
        />
      </aside>
    </div>
  );
}

function ChoixNiveau({
  niveau,
  titre,
  onNiveau,
}: {
  niveau: Niveau;
  titre: string;
  onNiveau: (n: Niveau) => void;
}) {
  return (
    <label className="champ champ-court">
      <span>{t(`${P}.seance.niveau`)}</span>
      <select
        value={niveau}
        aria-label={`${t(`${P}.seance.niveau`)} : ${titre}`}
        onChange={(e) => onNiveau(Number(e.currentTarget.value) as Niveau)}
      >
        {NIVEAUX.map((n) => (
          <option key={n} value={n}>
            {t("web.bibliotheque.niveauCourt", { niveau: n })}
          </option>
        ))}
      </select>
    </label>
  );
}

function PropositionSeance({
  el,
  remplacants,
  onAccepter,
  onNiveau,
  onRemplacer,
  onRetirer,
}: {
  el: ElementSeanceVue;
  remplacants: ExerciceBibliotheque[];
  onAccepter: () => void;
  onNiveau: (n: Niveau) => void;
  onRemplacer: (exerciceId: string) => void;
  onRetirer: () => void;
}) {
  const [changer, setChanger] = useState(false);
  const [choix, setChoix] = useState("");
  return (
    <li className="element-seance element-propose" aria-label={el.titre}>
      <div className="element-entete">
        <IconeCategorie slug={el.categorie.slug} />
        <div className="element-titre">
          <strong>{el.titre}</strong>
          <span className="badge-raison">
            {el.raison
              ? t(`${P}.seance.raisons.${el.raison}`)
              : t(`${P}.seance.origines.${el.origine}`)}{" "}
            · {t("web.bibliotheque.niveauCourt", { niveau: el.niveau })}
          </span>
          <span className="discret">{el.consigne}</span>
          {el.aValider && <span className="badge-a-valider">{t("web.bibliotheque.aValider")}</span>}
        </div>
      </div>
      <div className="actions">
        <button
          type="button"
          className="bouton-accepter"
          onClick={onAccepter}
          aria-label={`${t(`${P}.seance.accepter`)} : ${el.titre}`}
        >
          {t(`${P}.seance.accepter`)}
        </button>
        <button
          type="button"
          className="bouton-secondaire-vert"
          aria-expanded={changer}
          onClick={() => setChanger((v) => !v)}
          aria-label={`${t(`${P}.seance.changer`)} : ${el.titre}`}
        >
          {t(`${P}.seance.changer`)}
        </button>
        <button
          type="button"
          className="bouton-lien bouton-danger"
          onClick={onRetirer}
          aria-label={`${t(`${P}.seance.retirer`)} : ${el.titre}`}
        >
          {t(`${P}.seance.retirer`)}
        </button>
      </div>
      {changer && (
        <div className="changer-exercice">
          <ChoixNiveau niveau={el.niveau} titre={el.titre} onNiveau={onNiveau} />
          <label className="champ">
            <span>{t(`${P}.seance.remplacerPar`)}</span>
            <select value={choix} onChange={(e) => setChoix(e.currentTarget.value)}>
              <option value="">{t(`${P}.seance.choisirExercice`)}</option>
              {remplacants.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titre}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="button" disabled={!choix} onClick={() => onRemplacer(choix)}>
              {t(`${P}.seance.remplacer`)}
            </button>
            <button type="button" className="bouton-lien" onClick={() => setChanger(false)}>
              {t(`${P}.seance.annuler`)}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ExerciceRetenu({
  el,
  onNiveau,
  onRetirer,
}: {
  el: ElementSeanceVue;
  onNiveau: (n: Niveau) => void;
  onRetirer: () => void;
}) {
  return (
    <li className="element-seance" aria-label={el.titre}>
      <div className="element-entete">
        <IconeCategorie slug={el.categorie.slug} />
        <div className="element-titre">
          <strong>{el.titre}</strong>
          <span className="discret">
            {t(`${P}.seance.origines.${el.origine}`)} ·{" "}
            {t("web.bibliotheque.minutes", { minutes: el.dureeMinutes })}
          </span>
          <span>{el.consigne}</span>
          {el.aValider && <span className="badge-a-valider">{t("web.bibliotheque.aValider")}</span>}
        </div>
      </div>
      <div className="actions">
        <ChoixNiveau niveau={el.niveau} titre={el.titre} onNiveau={onNiveau} />
        <button
          type="button"
          className="bouton-lien bouton-danger"
          onClick={onRetirer}
          aria-label={`${t(`${P}.seance.retirer`)} : ${el.titre}`}
        >
          {t(`${P}.seance.retirer`)}
        </button>
      </div>
    </li>
  );
}

/** Notes prises pendant ou après la séance (clavier, ou dictée locale si disponible). */
function NotesSeance({ base, seance }: { base: string; seance: Preparation["seance"] }) {
  const [valeurs, setValeurs] = useState({
    objectifs: seance.objectifs ?? "",
    notes: seance.notes ?? "",
    pointsAReprendre: seance.pointsAReprendre ?? "",
    materiel: seance.materiel ?? "",
  });
  const [etat, setEtat] = useState<MessageEcran>(null);
  type Champ = keyof typeof valeurs;
  const changer = (champ: Champ, valeur: string) => {
    setValeurs((v) => ({ ...v, [champ]: valeur }));
    setEtat(null);
  };
  const ajouterDicte = (champ: Champ) => (texte: string) =>
    setValeurs((v) => ({ ...v, [champ]: v[champ] ? `${v[champ]} ${texte}` : texte }));

  async function enregistrer() {
    const r = await envoyerJson(base, valeurs, "PATCH");
    setEtat(
      r.ok
        ? { type: "succes", texte: t(`${P}.notes.enregistrees`) }
        : { type: "erreur", texte: r.message },
    );
  }

  const champ = (nom: Champ, libelle: string, lignes: number, dictee: boolean, aide?: string) => (
    <div className="champ-notes">
      <label className="champ">
        <span>{libelle}</span>
        <textarea
          rows={lignes}
          maxLength={10_000}
          value={valeurs[nom]}
          placeholder={aide}
          onChange={(e) => changer(nom, e.currentTarget.value)}
        />
      </label>
      {dictee && <Dictee libelle={libelle} onTexte={ajouterDicte(nom)} />}
    </div>
  );

  return (
    <div className="bloc-notes">
      <h3>{t(`${P}.notes.titre`)}</h3>
      {champ("objectifs", t(`${P}.notes.objectifs`), 2, false)}
      {champ("materiel", t(`${P}.materiel.enPlus`), 1, false, t(`${P}.materiel.enPlusAide`))}
      {champ("notes", t(`${P}.notes.notes`), 5, true, t(`${P}.notes.notesAide`))}
      {champ("pointsAReprendre", t(`${P}.notes.points`), 3, true)}
      <div className="actions">
        <button type="button" onClick={enregistrer}>
          {t(`${P}.notes.enregistrer`)}
        </button>
        {etat && <Message type={etat.type} texte={etat.texte} />}
      </div>
    </div>
  );
}

/** Programme à la maison : lecture et ajustement rapide (même programme que l'écran Programme). */
function ProgrammeRapide({
  patientId,
  programme,
  destinataires,
}: {
  patientId: string;
  programme: ReturnType<typeof useProgramme>;
  destinataires: EtatProgramme["destinataires"];
}) {
  const { elements, ajuster, retirer } = programme;
  return (
    <section className="programme-rapide" aria-labelledby="titre-programme-rapide">
      <h2 id="titre-programme-rapide">{t(`${P}.programme.titre`)}</h2>
      <p className="aide">{t(`${P}.programme.aide`)}</p>
      <EtatEnvoi programme={programme} destinataires={destinataires} />
      {elements.length === 0 ? (
        <p className="carte">{t("web.programme.vide")}</p>
      ) : (
        <ul className="liste-seance" aria-label={t(`${P}.programme.titre`)}>
          {elements.map((el) => (
            <li key={el.elementId} className="element-seance" aria-label={el.titre}>
              <div className="element-entete">
                <IconeCategorie slug={el.categorie.slug} />
                <div className="element-titre">
                  <strong>{el.titre}</strong>
                  <span className="discret">
                    {el.jours.length > 0
                      ? el.jours.map((j) => t(`web.programme.joursCourts.${j}`)).join(", ")
                      : t(`${P}.programme.rythmeLibre`, { fois: el.foisParSemaine })}
                  </span>
                </div>
              </div>
              <div className="element-niveau">
                <button
                  type="button"
                  className="bouton-niveau"
                  disabled={el.niveau <= 1}
                  onClick={() => ajuster(el, "baisser")}
                  aria-label={`${t("web.programme.baisser")} : ${el.titre}`}
                >
                  −
                </button>
                <span className="niveau-actuel">
                  {t("web.programme.niveau", { niveau: el.niveau })}
                </span>
                <button
                  type="button"
                  className="bouton-niveau"
                  disabled={el.niveau >= 3}
                  onClick={() => ajuster(el, "monter")}
                  aria-label={`${t("web.programme.monter")} : ${el.titre}`}
                >
                  +
                </button>
                <button
                  type="button"
                  className="bouton-lien bouton-danger"
                  onClick={() => retirer(el)}
                  aria-label={`${t("web.programme.retirer")} : ${el.titre}`}
                >
                  {t("web.programme.retirer")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link className="bouton-lien" href={`/patients/${encodeURIComponent(patientId)}/programme`}>
        {t(`${P}.programme.ouvrir`)}
      </Link>
    </section>
  );
}
