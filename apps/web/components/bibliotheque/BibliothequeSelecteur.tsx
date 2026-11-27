"use client";

import { useId, useMemo, useState } from "react";
import {
  DUREES_FILTRE,
  NIVEAUX,
  consigneNiveau,
  filtresPourPatient,
  filtrerExercices,
  t,
  type ExerciceBibliotheque,
  type FiltresBibliotheque,
  type Niveau,
  type PatientBibliotheque,
} from "@app/shared";
import { IconeCategorie } from "./IconeCategorie";

export interface CategorieFiltre {
  id: string;
  nom: string;
  slug: string;
}

interface PropsCommunes {
  exercices: ExerciceBibliotheque[];
  categories: CategorieFiltre[];
  /** Marquer / retirer un favori. Renvoie false en cas d'échec. Absent : pas d'étoile. */
  onFavori?: (exercice: ExerciceBibliotheque, favori: boolean) => Promise<boolean>;
}

/** Mode complet : la page /bibliotheque, sans patient (pas de bouton « Ajouter »). */
interface PropsComplet extends PropsCommunes {
  mode: "complet";
}

/**
 * Mode sélection : panneau affiché dans une autre page (Préparation, Programme).
 * Les filtres partent de la pathologie et de l'âge du patient.
 */
interface PropsSelection extends PropsCommunes {
  mode: "selection";
  patient: PatientBibliotheque;
  /** Renvoyer false (ou Promise<false>) si l'ajout a échoué : pas de message « ajouté ». */
  onAjouter: (exercice: ExerciceBibliotheque, niveau: Niveau) => unknown;
  /** Libellé du bouton (ex. « Ajouter au programme »). Par défaut : « Ajouter ». */
  libelleAjouter?: string;
}

export type BibliothequeSelecteurProps = PropsComplet | PropsSelection;

/**
 * Bibliothèque d'exercices : recherche, filtres, liste et aperçu.
 * UN SEUL composant pour la page /bibliotheque et pour les panneaux de sélection.
 */
export function BibliothequeSelecteur(props: BibliothequeSelecteurProps) {
  const { categories, onFavori } = props;
  const patient = props.mode === "selection" ? props.patient : undefined;
  const ids = useId();

  const [exercices, setExercices] = useState(props.exercices);
  const [filtres, setFiltres] = useState<FiltresBibliotheque>(() => filtresPourPatient(patient));
  const [choisiId, setChoisiId] = useState<string | null>(null);
  const [niveauChoisi, setNiveauChoisi] = useState<Niveau>(filtres.niveau ?? 1);
  const [annonce, setAnnonce] = useState<string | null>(null);

  const resultats = useMemo(() => filtrerExercices(exercices, filtres), [exercices, filtres]);
  const choisi = resultats.find((e) => e.id === choisiId) ?? resultats[0] ?? null;

  const changer = (partiel: Partial<FiltresBibliotheque>) => {
    setFiltres((f) => ({ ...f, ...partiel }));
    if (partiel.niveau) setNiveauChoisi(partiel.niveau);
  };

  const choisir = (e: ExerciceBibliotheque) => {
    setChoisiId(e.id);
    setNiveauChoisi(filtres.niveau ?? 1);
    setAnnonce(null);
  };

  const basculerFavori = async (e: ExerciceBibliotheque) => {
    if (!onFavori) return;
    const favori = !e.favori;
    if (await onFavori(e, favori)) {
      setExercices((liste) => liste.map((x) => (x.id === e.id ? { ...x, favori } : x)));
    }
  };

  const nombre = resultats.length;

  return (
    <div className={`bibliotheque bibliotheque-${props.mode}`}>
      {patient && (
        <p className="bandeau-patient">
          {t("web.bibliotheque.filtresPatient", { prenom: patient.prenom, age: patient.age })}
        </p>
      )}

      <div className="filtres-bibliotheque" role="search">
        <label className="champ champ-recherche">
          <span>{t("web.bibliotheque.recherche")}</span>
          <input
            type="search"
            value={filtres.q}
            placeholder={t("web.bibliotheque.rechercheAide")}
            onChange={(e) => changer({ q: e.currentTarget.value })}
          />
        </label>
        <label className="champ">
          <span>{t("web.bibliotheque.pathologie")}</span>
          <select
            value={filtres.pathologie ?? ""}
            onChange={(e) => changer({ pathologie: e.currentTarget.value || null })}
          >
            <option value="">{t("web.bibliotheque.toutes")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="champ champ-court">
          <span>{t("web.bibliotheque.age")}</span>
          <input
            type="number"
            min={0}
            max={120}
            inputMode="numeric"
            value={filtres.age ?? ""}
            placeholder={t("web.bibliotheque.tousAges")}
            onChange={(e) => {
              const v = e.currentTarget.value;
              changer({ age: v === "" ? null : Math.max(0, Math.min(120, Number(v))) });
            }}
          />
        </label>
        <label className="champ champ-court">
          <span>{t("web.bibliotheque.niveau")}</span>
          <select
            value={filtres.niveau ?? ""}
            onChange={(e) =>
              changer({
                niveau: e.currentTarget.value ? (Number(e.currentTarget.value) as Niveau) : null,
              })
            }
          >
            <option value="">{t("web.bibliotheque.tousNiveaux")}</option>
            {NIVEAUX.map((n) => (
              <option key={n} value={n}>
                {t("web.bibliotheque.niveauCourt", { niveau: n })}
              </option>
            ))}
          </select>
        </label>
        <label className="champ champ-court">
          <span>{t("web.bibliotheque.duree")}</span>
          <select
            value={filtres.dureeMax ?? ""}
            onChange={(e) =>
              changer({ dureeMax: e.currentTarget.value ? Number(e.currentTarget.value) : null })
            }
          >
            <option value="">{t("web.bibliotheque.toutesDurees")}</option>
            {DUREES_FILTRE.map((d) => (
              <option key={d} value={d}>
                {t("web.bibliotheque.dureeMax", { minutes: d })}
              </option>
            ))}
          </select>
        </label>
        <div className="filtres-cases">
          <label className="choix">
            <input
              type="checkbox"
              checked={filtres.mesExercices}
              onChange={(e) => changer({ mesExercices: e.currentTarget.checked })}
            />
            {t("web.bibliotheque.mesExercices")}
          </label>
          <label className="choix">
            <input
              type="checkbox"
              checked={filtres.favoris}
              onChange={(e) => changer({ favoris: e.currentTarget.checked })}
            />
            {t("web.bibliotheque.favoris")}
          </label>
          <button
            type="button"
            className="bouton-lien"
            onClick={() => {
              setFiltres(filtresPourPatient(undefined));
              setNiveauChoisi(1);
            }}
          >
            {t("web.bibliotheque.effacer")}
          </button>
        </div>
      </div>

      <p className="nombre-resultats" aria-live="polite">
        {nombre === 0
          ? t("web.bibliotheque.aucun")
          : t(nombre > 1 ? "web.bibliotheque.resultats" : "web.bibliotheque.resultat", {
              n: nombre,
            })}
      </p>

      <div className="bibliotheque-colonnes">
        <ul className="liste-exercices" aria-label={t("web.bibliotheque.liste")}>
          {resultats.map((e) => {
            const actif = choisi?.id === e.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className={`ligne-exercice ${actif ? "actif" : ""}`}
                  aria-pressed={actif}
                  onClick={() => choisir(e)}
                >
                  <IconeCategorie slug={e.categorie.slug} />
                  <span className="ligne-texte">
                    <span className="ligne-titre">
                      {e.titre}
                      {e.favori && (
                        <>
                          <span aria-hidden="true"> ★</span>
                          <span className="visuellement-cache">
                            {" "}
                            {t("web.bibliotheque.estFavori")}
                          </span>
                        </>
                      )}
                    </span>
                    <span className="ligne-details">
                      {e.categorie.nom} ·{" "}
                      {t("web.bibliotheque.minutes", { minutes: e.dureeMinutes })}
                    </span>
                    {filtres.niveau && (
                      <span className="ligne-details">
                        {t("web.bibliotheque.niveauCourt", { niveau: filtres.niveau })} :{" "}
                        {consigneNiveau(e, filtres.niveau)}
                      </span>
                    )}
                    {e.aValider && (
                      <span className="badge-a-valider">{t("web.bibliotheque.aValider")}</span>
                    )}
                    {e.perso && <span className="badge-perso">{t("web.bibliotheque.perso")}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <section className="apercu" aria-labelledby={`${ids}-apercu`}>
          <h2 id={`${ids}-apercu`} className="visuellement-cache">
            {t("web.bibliotheque.apercu")}
          </h2>
          {!choisi ? (
            <p>{t("web.bibliotheque.choisir")}</p>
          ) : (
            <div>
              <div className="apercu-entete">
                {choisi.apercuImage?.startsWith("/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image locale, taille libre
                  <img src={choisi.apercuImage} alt="" className="apercu-image" />
                ) : (
                  <IconeCategorie slug={choisi.categorie.slug} grande />
                )}
                <div>
                  <h3 className="apercu-titre">{choisi.titre}</h3>
                  <p className="discret">{choisi.categorie.nom}</p>
                </div>
                {onFavori && (
                  <button
                    type="button"
                    className="bouton-favori"
                    aria-pressed={choisi.favori}
                    onClick={() => basculerFavori(choisi)}
                  >
                    {choisi.favori ? "★" : "☆"}{" "}
                    {choisi.favori
                      ? t("web.bibliotheque.favoriRetirer")
                      : t("web.bibliotheque.favoriAjouter")}
                  </button>
                )}
              </div>

              {choisi.aValider && (
                <p className="alerte">
                  <strong>{t("web.bibliotheque.aValider")}</strong>
                  <br />
                  {t("web.bibliotheque.aValiderAide")}
                </p>
              )}

              <p>{choisi.description}</p>
              <p className="apercu-consigne">« {choisi.apercuConsigne} »</p>

              <dl className="apercu-details">
                <dt>{t("web.bibliotheque.materiel")}</dt>
                <dd>
                  {choisi.materiel.length > 0
                    ? choisi.materiel.join(", ")
                    : t("web.bibliotheque.aucunMateriel")}
                </dd>
                <dt>{t("web.bibliotheque.duree")}</dt>
                <dd>{t("web.bibliotheque.minutes", { minutes: choisi.dureeMinutes })}</dd>
                <dt>{t("web.bibliotheque.ageConseille")}</dt>
                <dd>
                  {choisi.ageMax >= 99
                    ? t("web.bibliotheque.agesPlus", { min: choisi.ageMin })
                    : t("web.bibliotheque.ages", { min: choisi.ageMin, max: choisi.ageMax })}
                </dd>
              </dl>

              <fieldset className="choix-niveau">
                <legend>{t("web.bibliotheque.niveaux")}</legend>
                <div className="onglets-niveau">
                  {NIVEAUX.map((n) => (
                    <label key={n} className={`onglet-niveau ${niveauChoisi === n ? "actif" : ""}`}>
                      <input
                        type="radio"
                        name={`${ids}-niveau`}
                        value={n}
                        checked={niveauChoisi === n}
                        onChange={() => setNiveauChoisi(n)}
                      />
                      {t("web.bibliotheque.niveauCourt", { niveau: n })}
                    </label>
                  ))}
                </div>
                <p className="consigne-niveau" aria-live="polite">
                  <span className="visuellement-cache">
                    {t("web.bibliotheque.consigneNiveau", { niveau: niveauChoisi })} :{" "}
                  </span>
                  {consigneNiveau(choisi, niveauChoisi)}
                </p>
              </fieldset>

              {props.mode === "selection" && (
                <button
                  type="button"
                  className="bouton-ajouter"
                  onClick={async () => {
                    if ((await props.onAjouter(choisi, niveauChoisi)) === false) return;
                    setAnnonce(
                      t("web.bibliotheque.ajoute", { titre: choisi.titre, niveau: niveauChoisi }),
                    );
                  }}
                >
                  {props.libelleAjouter ?? t("web.bibliotheque.ajouter")} —{" "}
                  {t("web.bibliotheque.niveauCourt", { niveau: niveauChoisi })}
                </button>
              )}
              {annonce && (
                <p className="message message-succes" role="status">
                  {annonce}
                </p>
              )}
              {props.mode === "complet" && choisi.perso && (
                <p>
                  <a
                    className="bouton bouton-secondaire-vert"
                    href={`/bibliotheque/${choisi.id}/modifier`}
                  >
                    {t("web.bibliotheque.modifier")}
                  </a>
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
