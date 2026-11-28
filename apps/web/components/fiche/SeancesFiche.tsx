"use client";

import { useState } from "react";
import { t } from "@app/shared";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";
import { jourFr } from "@/lib/format";
import type { SeancePassee } from "@/lib/serveur/seances";

const S = "web.fiche.seances";

/**
 * Zone « Séances » de la Fiche : séances passées, de la plus récente à la plus ancienne.
 * Cliquer sur une séance l'ouvre en lecture (notes, matériel, export PDF) ;
 * « Réutiliser cette séance » pré-remplit la préparation, puis ouvre Préparation.
 */
export function SeancesFiche({
  patientId,
  seances,
  naviguer = (url) => window.location.assign(url),
}: {
  patientId: string;
  seances: SeancePassee[];
  /** Ouvre la Préparation après « Réutiliser » (remplaçable dans les tests). */
  naviguer?: (url: string) => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const patient = `/patients/${encodeURIComponent(patientId)}`;

  async function reutiliser(seanceId: string) {
    setEnvoi(true);
    const r = await envoyerJson(
      `/api${patient}/seances/${encodeURIComponent(seanceId)}/reutiliser`,
      {},
    );
    setEnvoi(false);
    if (r.ok) naviguer(`${patient}/preparation`);
    else setErreur(r.message);
  }

  if (seances.length === 0) return <p>{t(`${S}.aucune`)}</p>;

  return (
    <>
      {erreur && <Message type="erreur" texte={erreur} />}
      <ol className="liste-seances-fiche" aria-label={t(`${S}.titre`)}>
        {seances.map((s) => {
          const date = jourFr(s.date);
          return (
            <li key={s.id}>
              <details className="seance-fiche">
                <summary>
                  <strong>{t(`${S}.seanceDu`, { date })}</strong>
                  <span className="discret">
                    {s.exercices.length > 0
                      ? s.exercices
                          .map((e) => t(`${S}.exercice`, { titre: e.titre, niveau: e.niveau }))
                          .join(", ")
                      : t(`${S}.aucunExercice`)}
                  </span>
                  {s.notes && <span className="resume-notes">{s.notes}</span>}
                </summary>

                <div className="seance-fiche-detail">
                  {s.objectifs && (
                    <>
                      <h3>{t(`${S}.objectifs`)}</h3>
                      <p className="texte-libre">{s.objectifs}</p>
                    </>
                  )}
                  <h3>{t(`${S}.exercices`)}</h3>
                  {s.exercices.length === 0 ? (
                    <p className="discret">{t(`${S}.aucunExercice`)}</p>
                  ) : (
                    <ul>
                      {s.exercices.map((e) => (
                        <li key={e.titre}>
                          <strong>
                            {t(`${S}.exercice`, { titre: e.titre, niveau: e.niveau })}
                          </strong>
                          {e.consigne && <span className="discret"> — {e.consigne}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3>{t(`${S}.notes`)}</h3>
                  <p className="texte-libre">{s.notes ?? t(`${S}.aucuneNote`)}</p>
                  {s.pointsAReprendre && (
                    <>
                      <h3>{t(`${S}.points`)}</h3>
                      <p className="texte-libre points-a-reprendre">{s.pointsAReprendre}</p>
                    </>
                  )}
                  <h3>{t(`${S}.materiel`)}</h3>
                  {s.materiel.length === 0 && !s.materielEnPlus ? (
                    <p className="discret">{t(`${S}.aucunMateriel`)}</p>
                  ) : (
                    <ul>
                      {s.materiel.map((m) => (
                        <li key={m.nom}>{m.nom}</li>
                      ))}
                      {s.materielEnPlus && <li>{s.materielEnPlus}</li>}
                    </ul>
                  )}
                  <div className="actions">
                    <a
                      className="bouton bouton-exporter"
                      href={`/api${patient}/seances/${encodeURIComponent(s.id)}/pdf`}
                      target="_blank"
                      rel="noopener"
                    >
                      {t(`${S}.pdf`)}
                    </a>
                    <button
                      type="button"
                      disabled={envoi}
                      onClick={() => reutiliser(s.id)}
                      aria-label={`${t(`${S}.reutiliser`)} : ${t(`${S}.seanceDu`, { date })}`}
                    >
                      {t(`${S}.reutiliser`)}
                    </button>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </>
  );
}
