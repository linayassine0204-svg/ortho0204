"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TYPES_CREABLES, estCourrier, jourFr, t, type TypeCreable } from "@app/shared";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";
import type { ListeBilans as Donnees, VueBilan } from "@/lib/serveur/bilans";
import { BadgeStatut } from "./BadgeStatut";

const B = "web.bilans";

/**
 * Sous-partie Bilans : documents du patient avec leur statut (Rempli, Automatique,
 * À relire, À écrire), et création d'un document à partir d'un modèle.
 */
export function ListeBilans({
  patientId,
  initial,
  naviguer = (url) => window.location.assign(url),
}: {
  patientId: string;
  initial: Donnees;
  /** Ouvre l'éditeur après la création (remplaçable dans les tests). */
  naviguer?: (url: string) => void;
}) {
  const { documents, pathologies, seances } = initial;
  const [type, setType] = useState<TypeCreable>("EVOLUTION");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const base = `/patients/${encodeURIComponent(patientId)}/bilans`;
  const avecPeriode = type !== "INITIAL" && type !== "COMPTE_RENDU_SEANCE";

  async function creer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const valeur = (nom: string) => {
      const v = f.get(nom);
      return typeof v === "string" && v !== "" ? v : null;
    };
    setEnvoi(true);
    const r = await envoyerJson<{ bilan: VueBilan }>(`/api${base}`, {
      type,
      pathologie: valeur("pathologie"),
      dateDebut: avecPeriode ? valeur("dateDebut") : null,
      date: avecPeriode ? valeur("date") : null,
      seanceId: type === "COMPTE_RENDU_SEANCE" ? valeur("seanceId") : null,
      destinataire: estCourrier(type) ? valeur("destinataire") : null,
    });
    setEnvoi(false);
    if (!r.ok) {
      setErreur(r.message);
      return;
    }
    naviguer(`${base}/${encodeURIComponent(r.donnees.bilan.id)}`);
  }

  return (
    <div className="bilans-ecran">
      {documents.length === 0 ? (
        <p className="carte">{t(`${B}.liste.vide`)}</p>
      ) : (
        <table className="tableau-bilans">
          <thead>
            <tr>
              <th scope="col">{t(`${B}.liste.colTitre`)}</th>
              <th scope="col">{t(`${B}.liste.colDate`)}</th>
              <th scope="col">{t(`${B}.liste.colStatut`)}</th>
              <th scope="col">{t(`${B}.liste.colParties`)}</th>
              <th scope="col">{t(`${B}.liste.colPartage`)}</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`${base}/${encodeURIComponent(d.id)}`}>{d.titre}</Link>
                  <span className="discret"> — {t(`${B}.types.${d.type}`)}</span>
                </td>
                <td>{jourFr(d.date)}</td>
                <td>
                  <BadgeStatut statut={d.statut} />
                </td>
                <td>{t(`${B}.liste.parties`, { rempli: d.parties.REMPLI, total: d.total })}</td>
                <td>{d.partage ? t(`${B}.liste.partage`) : t(`${B}.liste.nonPartage`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="carte formulaire-bilan" onSubmit={creer}>
        <h2>{t(`${B}.creer.titre`)}</h2>
        <p className="aide">{t(`${B}.creer.aValider`)}</p>
        <label className="champ">
          <span>{t(`${B}.creer.type`)}</span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.currentTarget.value as TypeCreable)}
          >
            {TYPES_CREABLES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`${B}.types.${ty}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>{t(`${B}.creer.pathologie`)}</span>
          <select name="pathologie" defaultValue={pathologies[0]?.slug ?? ""}>
            {pathologies.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.nom}
              </option>
            ))}
            <option value="">{t(`${B}.creer.sansPathologie`)}</option>
          </select>
        </label>
        {type === "COMPTE_RENDU_SEANCE" && (
          <label className="champ">
            <span>{t(`${B}.creer.seance`)}</span>
            <select name="seanceId" defaultValue="">
              <option value="">{t(`${B}.creer.derniereSeance`)}</option>
              {seances.map((s) => (
                <option key={s.id} value={s.id}>
                  {jourFr(s.jour)}
                </option>
              ))}
            </select>
          </label>
        )}
        {estCourrier(type) && (
          <label className="champ">
            <span>{t(`${B}.creer.destinataire`)}</span>
            <input
              type="text"
              name="destinataire"
              maxLength={300}
              placeholder={t(`${B}.creer.destinataireAide`)}
            />
          </label>
        )}
        {avecPeriode && (
          <fieldset className="periode">
            <legend className="visuellement-cache">{t(`${B}.creer.debut`)}</legend>
            <label className="champ champ-court">
              <span>{t(`${B}.creer.debut`)}</span>
              <input type="date" name="dateDebut" />
            </label>
            <label className="champ champ-court">
              <span>{t(`${B}.creer.fin`)}</span>
              <input type="date" name="date" />
            </label>
            <p className="aide">{t(`${B}.creer.periodeAide`)}</p>
          </fieldset>
        )}
        {erreur && <Message type="erreur" texte={erreur} />}
        <button type="submit" disabled={envoi}>
          {t(`${B}.creer.bouton`)}
        </button>
      </form>
    </div>
  );
}
