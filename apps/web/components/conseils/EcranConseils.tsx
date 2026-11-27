"use client";

import { useEffect, useRef, useState } from "react";
import {
  jourLocal,
  lignes,
  t,
  type ConseilModele,
  type ContenuConseil,
  type Planification,
  type RepetitionConseil,
} from "@app/shared";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";
import { dateFr, jourFr } from "@/lib/format";

/** Conseil envoyé à ce patient (réponse de l'API ; dates en texte côté navigateur). */
export interface ConseilEnvoyeVue {
  id: string;
  titre: string;
  aFaire: string[];
  aEviter: string[];
  aValider: boolean;
  origine: "modele" | "modifie" | "libre";
  modeleSourceId: string | null;
  nbEnvois: number;
  dernierEnvoi: {
    id: string;
    envoyeLe: Date | string;
    luLe: Date | string | null;
    luPar: string | null;
  } | null;
  plans: { id: string; repetition: RepetitionConseil; prochainEnvoi: Date | string }[];
}

export interface ConseilsPatientVue {
  patient: {
    id: string;
    prenom: string;
    age: number;
    pathologies: { slug: string; nom: string }[];
  };
  proposes: ConseilModele[];
  autres: ConseilModele[];
  envoyes: ConseilEnvoyeVue[];
  destinataires: { id: string; prenom: string; nom: string }[];
}

type Edition =
  | { mode: "telQuel"; modele: ConseilModele }
  | { mode: "modifier"; modele: ConseilModele }
  | { mode: "libre" }
  | { mode: "renvoi"; conseil: ConseilEnvoyeVue };

type Retour = { type: "erreur" | "succes"; texte: string } | null;

function tranche(m: Pick<ConseilModele, "ageMin" | "ageMax">): string {
  if (m.ageMin !== null && m.ageMax !== null) {
    return t("web.conseils.tranche", { min: m.ageMin, max: m.ageMax });
  }
  if (m.ageMin !== null) return t("web.conseils.trancheMin", { min: m.ageMin });
  if (m.ageMax !== null) return t("web.conseils.trancheMax", { max: m.ageMax });
  return t("web.conseils.trancheTous");
}

/**
 * Écran Conseils d'un patient :
 * 1. en haut, les conseils PROPOSÉS (même pathologie, âge dans la tranche : simple filtre) ;
 * 2. envoyer tel quel, modifier avant envoi, ou écrire un conseil ;
 * 3. les conseils envoyés, avec « lu / pas lu » et la répétition.
 */
export function EcranConseils({ initial }: { initial: ConseilsPatientVue }) {
  const { patient } = initial;
  const [envoyes, setEnvoyes] = useState(initial.envoyes);
  const [edition, setEdition] = useState<Edition | null>(null);
  const [retour, setRetour] = useState<Retour>(null);
  const base = `/api/patients/${encodeURIComponent(patient.id)}/conseils`;
  const dejaEnvoyes = new Set(envoyes.map((c) => c.modeleSourceId).filter(Boolean));

  function remplacer(conseil: ConseilEnvoyeVue) {
    setEnvoyes((liste) => [conseil, ...liste.filter((c) => c.id !== conseil.id)]);
  }

  async function envoyer(e: Edition, contenu: ContenuConseil | null, planification: Planification) {
    const url = e.mode === "renvoi" ? `${base}/${encodeURIComponent(e.conseil.id)}/envois` : base;
    const corps =
      e.mode === "renvoi"
        ? { planification }
        : {
            ...(e.mode === "libre" ? {} : { modeleId: e.modele.id }),
            ...(contenu ? { contenu } : {}),
            planification,
          };
    const r = await envoyerJson<{ conseil: ConseilEnvoyeVue }>(url, corps);
    if (!r.ok) {
      setRetour({ type: "erreur", texte: r.message });
      return;
    }
    remplacer(r.donnees.conseil);
    setEdition(null);
    const aujourdhui = jourLocal(new Date()).date;
    setRetour({
      type: "succes",
      texte:
        planification.date && planification.date > aujourdhui
          ? t("web.conseils.programmeOk", { date: dateFr(planification.date) })
          : t("web.conseils.envoiOk"),
    });
  }

  async function arreter(planId: string) {
    const r = await envoyerJson<{ conseil: ConseilEnvoyeVue }>(
      `${base}/plans/${encodeURIComponent(planId)}`,
      undefined,
      "DELETE",
    );
    if (!r.ok) {
      setRetour({ type: "erreur", texte: r.message });
      return;
    }
    setEnvoyes((liste) =>
      liste.map((c) => (c.id === r.donnees.conseil.id ? r.donnees.conseil : c)),
    );
    setRetour({ type: "succes", texte: t("web.conseils.arretOk") });
  }

  const ouvrir = (e: Edition) => {
    setRetour(null);
    setEdition(e);
  };

  return (
    <div className="conseils-ecran">
      <p className="discret">
        {initial.destinataires.length > 0
          ? t("web.conseils.destinataires", {
              noms: initial.destinataires.map((d) => `${d.prenom} ${d.nom}`).join(", "),
            })
          : t("web.conseils.aucunDestinataire")}
      </p>
      <Message type={retour?.type ?? "succes"} texte={retour?.texte ?? null} />

      {edition && (
        <EditeurConseil
          key={JSON.stringify(edition)}
          edition={edition}
          onAnnuler={() => setEdition(null)}
          onEnvoyer={(contenu, planification) => envoyer(edition, contenu, planification)}
        />
      )}

      <section aria-labelledby="titre-proposes">
        <h2 id="titre-proposes">{t("web.conseils.proposes", { prenom: patient.prenom })}</h2>
        {patient.pathologies.length === 0 ? (
          <p className="carte">{t("web.conseils.sansPathologie", { prenom: patient.prenom })}</p>
        ) : (
          <p className="discret">
            {t("web.conseils.proposesAide", {
              pathologies: patient.pathologies.map((p) => p.nom).join(", "),
              age: t(patient.age > 1 ? "web.patients.ans" : "web.patients.an", {
                age: patient.age,
              }),
            })}
          </p>
        )}
        {patient.pathologies.length > 0 && initial.proposes.length === 0 && (
          <p className="carte">{t("web.conseils.aucunPropose")}</p>
        )}
        <ul
          className="grille-conseils"
          aria-label={t("web.conseils.proposes", { prenom: patient.prenom })}
        >
          {initial.proposes.map((m) => (
            <CarteModele
              key={m.id}
              modele={m}
              dejaEnvoye={dejaEnvoyes.has(m.id)}
              onTelQuel={() => ouvrir({ mode: "telQuel", modele: m })}
              onModifier={() => ouvrir({ mode: "modifier", modele: m })}
            />
          ))}
        </ul>
        <button
          type="button"
          className="bouton bouton-ecrire"
          onClick={() => ouvrir({ mode: "libre" })}
        >
          {t("web.conseils.ecrire")}
        </button>
      </section>

      <section aria-labelledby="titre-envoyes">
        <h2 id="titre-envoyes">{t("web.conseils.envoyes")}</h2>
        {envoyes.length === 0 ? (
          <p className="carte">{t("web.conseils.aucunEnvoye")}</p>
        ) : (
          <TableauEnvoyes
            envoyes={envoyes}
            onRenvoyer={(c) => ouvrir({ mode: "renvoi", conseil: c })}
            onArreter={arreter}
          />
        )}
      </section>

      {initial.autres.length > 0 && (
        <details className="autres-conseils">
          <summary>{t("web.conseils.autres", { n: initial.autres.length })}</summary>
          <ul className="grille-conseils">
            {initial.autres.map((m) => (
              <CarteModele
                key={m.id}
                modele={m}
                dejaEnvoye={dejaEnvoyes.has(m.id)}
                onTelQuel={() => ouvrir({ mode: "telQuel", modele: m })}
                onModifier={() => ouvrir({ mode: "modifier", modele: m })}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Blocs({ aFaire, aEviter }: { aFaire: string[]; aEviter: string[] }) {
  return (
    <div className="blocs-conseil">
      {aFaire.length > 0 && (
        <div className="bloc-a-faire">
          <h4>{t("web.conseils.aFaire")}</h4>
          <ul>
            {aFaire.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      {aEviter.length > 0 && (
        <div className="bloc-a-eviter">
          <h4>{t("web.conseils.aEviter")}</h4>
          <ul>
            {aEviter.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CarteModele({
  modele,
  dejaEnvoye,
  onTelQuel,
  onModifier,
}: {
  modele: ConseilModele;
  dejaEnvoye: boolean;
  onTelQuel: () => void;
  onModifier: () => void;
}) {
  return (
    <li className="carte carte-conseil" aria-label={modele.titre}>
      <h3>{modele.titre}</h3>
      <div className="etiquettes">
        {modele.pathologies.map((p) => (
          <span key={p.slug} className="etiquette">
            {p.nom}
          </span>
        ))}
        <span className="etiquette">{tranche(modele)}</span>
        {dejaEnvoye && <span className="badge-perso">{t("web.conseils.dejaEnvoye")}</span>}
      </div>
      {modele.aValider && <span className="badge-a-valider">{t("web.conseils.aValider")}</span>}
      <Blocs aFaire={modele.aFaire} aEviter={modele.aEviter} />
      <div className="actions-conseil">
        <button type="button" className="bouton" onClick={onTelQuel}>
          {t("web.conseils.envoyerTelQuel")}
        </button>
        <button type="button" className="bouton bouton-secondaire-vert" onClick={onModifier}>
          {t("web.conseils.modifier")}
        </button>
      </div>
    </li>
  );
}

function EditeurConseil({
  edition,
  onAnnuler,
  onEnvoyer,
}: {
  edition: Edition;
  onAnnuler: () => void;
  onEnvoyer: (contenu: ContenuConseil | null, planification: Planification) => Promise<void>;
}) {
  const source =
    edition.mode === "renvoi"
      ? edition.conseil
      : edition.mode === "libre"
        ? { titre: "", aFaire: [], aEviter: [], aValider: false }
        : edition.modele;
  const modifiable = edition.mode === "modifier" || edition.mode === "libre";
  const aujourdhui = jourLocal(new Date()).date;
  const [titre, setTitre] = useState(source.titre);
  const [aFaire, setAFaire] = useState(source.aFaire.join("\n"));
  const [aEviter, setAEviter] = useState(source.aEviter.join("\n"));
  const [quand, setQuand] = useState<"maintenant" | "date">("maintenant");
  const [date, setDate] = useState(aujourdhui);
  const [repetition, setRepetition] = useState<RepetitionConseil>("UNE_FOIS");
  const [enCours, setEnCours] = useState(false);
  const titreRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titreRef.current?.focus();
    titreRef.current?.scrollIntoView?.({ block: "start" });
  }, []);

  const entete =
    edition.mode === "telQuel"
      ? t("web.conseils.editeurTelQuel")
      : edition.mode === "modifier"
        ? t("web.conseils.editeurModifier")
        : edition.mode === "libre"
          ? t("web.conseils.editeurLibre")
          : t("web.conseils.editeurRenvoi", { titre: edition.conseil.titre });
  const programme = quand === "date" && date > aujourdhui;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    const planification: Planification = {
      repetition,
      ...(quand === "date" ? { date } : {}),
    };
    const contenu = modifiable
      ? { titre: titre.trim(), aFaire: lignes(aFaire), aEviter: lignes(aEviter) }
      : null;
    await onEnvoyer(contenu, planification);
    setEnCours(false);
  }

  return (
    <section className="carte editeur-conseil" aria-labelledby="titre-editeur">
      <h2 id="titre-editeur" ref={titreRef} tabIndex={-1}>
        {entete}
      </h2>
      <form onSubmit={soumettre}>
        {modifiable ? (
          <>
            <label className="champ">
              <span>{t("web.conseils.champTitre")}</span>
              <input
                type="text"
                value={titre}
                required
                maxLength={120}
                onChange={(e) => setTitre(e.currentTarget.value)}
              />
            </label>
            <label className="champ">
              <span>{t("web.conseils.champAFaire")}</span>
              <textarea
                rows={4}
                value={aFaire}
                onChange={(e) => setAFaire(e.currentTarget.value)}
              />
            </label>
            <label className="champ">
              <span>{t("web.conseils.champAEviter")}</span>
              <textarea
                rows={3}
                value={aEviter}
                onChange={(e) => setAEviter(e.currentTarget.value)}
              />
            </label>
          </>
        ) : (
          <>
            <h3>{source.titre}</h3>
            <Blocs aFaire={source.aFaire} aEviter={source.aEviter} />
          </>
        )}
        {source.aValider && (
          <p className="alerte">
            <strong>{t("web.conseils.aValider")}</strong> — {t("web.conseils.aValiderAide")}
          </p>
        )}

        <div className="planification">
          <fieldset>
            <legend>{t("web.conseils.quand")}</legend>
            <label className="choix">
              <input
                type="radio"
                name="quand"
                checked={quand === "maintenant"}
                onChange={() => setQuand("maintenant")}
              />
              {t("web.conseils.maintenant")}
            </label>
            <label className="choix">
              <input
                type="radio"
                name="quand"
                checked={quand === "date"}
                onChange={() => setQuand("date")}
              />
              {t("web.conseils.aLaDate")}
            </label>
            {quand === "date" && (
              <label className="champ">
                <span>{t("web.conseils.date")}</span>
                <input
                  type="date"
                  value={date}
                  min={aujourdhui}
                  required
                  onChange={(e) => setDate(e.currentTarget.value)}
                />
              </label>
            )}
          </fieldset>
          <fieldset>
            <legend>{t("web.conseils.repetition")}</legend>
            <label className="choix">
              <input
                type="radio"
                name="repetition"
                checked={repetition === "UNE_FOIS"}
                onChange={() => setRepetition("UNE_FOIS")}
              />
              {t("web.conseils.uneFois")}
            </label>
            <label className="choix">
              <input
                type="radio"
                name="repetition"
                checked={repetition === "HEBDOMADAIRE"}
                onChange={() => setRepetition("HEBDOMADAIRE")}
              />
              {t("web.conseils.chaqueSemaine")}
            </label>
          </fieldset>
        </div>

        <div className="actions-conseil">
          <button type="submit" className="bouton" disabled={enCours}>
            {programme ? t("web.conseils.programmer") : t("web.conseils.confirmer")}
          </button>
          <button type="button" className="bouton bouton-secondaire-vert" onClick={onAnnuler}>
            {t("web.conseils.annuler")}
          </button>
        </div>
      </form>
    </section>
  );
}

function TableauEnvoyes({
  envoyes,
  onRenvoyer,
  onArreter,
}: {
  envoyes: ConseilEnvoyeVue[];
  onRenvoyer: (c: ConseilEnvoyeVue) => void;
  onArreter: (planId: string) => void;
}) {
  const origine = {
    modele: t("web.conseils.origineModele"),
    modifie: t("web.conseils.origineModifie"),
    libre: t("web.conseils.origineLibre"),
  };
  return (
    <table className="tableau-conseils">
      <thead>
        <tr>
          <th scope="col">{t("web.conseils.colConseil")}</th>
          <th scope="col">{t("web.conseils.colEnvoi")}</th>
          <th scope="col">{t("web.conseils.colLecture")}</th>
          <th scope="col">{t("web.conseils.colRepetition")}</th>
          <th scope="col">
            <span className="visuellement-cache">{t("web.conseils.renvoyer")}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {envoyes.map((c) => {
          const dernier = c.dernierEnvoi;
          return (
            <tr key={c.id}>
              <td data-titre={t("web.conseils.colConseil")}>
                <strong>{c.titre}</strong>
                <span className="discret"> — {origine[c.origine]}</span>
                {c.aValider && (
                  <span className="badge-a-valider">{t("web.conseils.aValider")}</span>
                )}
              </td>
              <td data-titre={t("web.conseils.colEnvoi")}>
                {dernier ? jourFr(dernier.envoyeLe) : t("web.conseils.pasEncoreEnvoye")}
                {c.nbEnvois > 1 && (
                  <span className="discret">
                    {" "}
                    ({t("web.conseils.nbEnvois", { n: c.nbEnvois })})
                  </span>
                )}
              </td>
              <td data-titre={t("web.conseils.colLecture")}>
                {dernier &&
                  (dernier.luLe ? (
                    <span className="statut-lecture statut-ok">
                      ✓{" "}
                      {dernier.luPar
                        ? t("web.conseils.luPar", {
                            date: jourFr(dernier.luLe),
                            prenom: dernier.luPar,
                          })
                        : t("web.conseils.lu", { date: jourFr(dernier.luLe) })}
                    </span>
                  ) : (
                    <span className="statut-lecture statut-attente">{t("web.conseils.pasLu")}</span>
                  ))}
              </td>
              <td data-titre={t("web.conseils.colRepetition")}>
                {c.plans.length === 0
                  ? t("web.conseils.aucuneRepetition")
                  : c.plans.map((plan) => (
                      <div key={plan.id} className="plan-conseil">
                        <span>
                          {plan.repetition === "HEBDOMADAIRE"
                            ? t("web.conseils.hebdo", { date: jourFr(plan.prochainEnvoi) })
                            : t("web.conseils.prevuLe", { date: jourFr(plan.prochainEnvoi) })}
                        </span>
                        <button
                          type="button"
                          className="bouton-lien"
                          onClick={() => onArreter(plan.id)}
                          aria-label={`${
                            plan.repetition === "HEBDOMADAIRE"
                              ? t("web.conseils.arreterHebdo")
                              : t("web.conseils.annulerPrevu")
                          } : ${c.titre}`}
                        >
                          {plan.repetition === "HEBDOMADAIRE"
                            ? t("web.conseils.arreter")
                            : t("web.conseils.annulerPrevu")}
                        </button>
                      </div>
                    ))}
              </td>
              <td>
                <button
                  type="button"
                  className="bouton bouton-secondaire-vert"
                  onClick={() => onRenvoyer(c)}
                  aria-label={`${t("web.conseils.renvoyer")} : ${c.titre}`}
                >
                  {t("web.conseils.renvoyer")}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
