import { t } from "@app/shared";
import type { Preparation } from "@/lib/serveur/seances";
import { dateFr, jourFr } from "@/lib/format";

const pourcent = (part: number) => Math.round(part * 100);
const jour = (aaaammjj: string) => dateFr(`${aaaammjj}T00:00:00Z`);

/**
 * En haut de « Préparation » : ce qui a été fait à la maison depuis la dernière séance
 * (taux, ressenti, scores), les notes de la dernière séance et les points à reprendre.
 */
export function ResumeAvantSeance({ resume }: { resume: Preparation["resume"] }) {
  const { maison, derniereSeance } = resume;
  const r = "web.preparation.resume";
  return (
    <section className="resume-seance" aria-labelledby="titre-resume">
      <h2 id="titre-resume">{t(`${r}.titre`)}</h2>
      <div className="resume-colonnes">
        <div className="carte">
          <h3>{t(`${r}.maison`)}</h3>
          {!maison ? (
            <p>{t(`${r}.pasDeProgramme`)}</p>
          ) : (
            <>
              <p className="discret">
                {t(`${r}.periode`, { depuis: jour(maison.depuis), jusqua: jour(maison.jusqua) })}
                {!derniereSeance && ` — ${t(`${r}.aucuneSeance`)}`}
              </p>
              <p className="resume-taux">
                {maison.taux === null
                  ? t(`${r}.tauxInconnu`)
                  : t(`${r}.taux`, {
                      faites: maison.faites,
                      prevues: maison.prevues,
                      pourcent: pourcent(maison.taux),
                    })}
              </p>
              <p>
                {t(`${r}.ressentis`, {
                  facile: maison.ressentis.FACILE,
                  moyen: maison.ressentis.MOYEN,
                  difficile: maison.ressentis.DIFFICILE,
                })}
              </p>
              <ul className="resume-lignes">
                {maison.lignes.map((l) => (
                  <li key={l.elementId}>
                    <strong>{l.titre}</strong> —{" "}
                    {l.taux === null
                      ? t(`${r}.tauxInconnu`)
                      : t(`${r}.taux`, {
                          faites: l.faites,
                          prevues: l.prevues,
                          pourcent: pourcent(l.taux),
                        })}
                    {l.scoreMoyen !== null &&
                      ` · ${t(`${r}.scoreMoyen`, { pourcent: pourcent(l.scoreMoyen) })}`}
                    {l.dernierScore &&
                      ` · ${t(`${r}.dernierScore`, {
                        score: l.dernierScore.score,
                        max: l.dernierScore.scoreMax,
                      })}`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="carte">
          {derniereSeance ? (
            <>
              <h3>{t(`${r}.notes`, { date: jourFr(derniereSeance.date) })}</h3>
              <p className="texte-libre">{derniereSeance.notes ?? t(`${r}.aucuneNote`)}</p>
              <h3>{t(`${r}.points`)}</h3>
              <p className="texte-libre points-a-reprendre">
                {derniereSeance.pointsAReprendre ?? t(`${r}.aucunPoint`)}
              </p>
            </>
          ) : (
            <p>{t(`${r}.aucuneSeance`)}</p>
          )}
        </div>
      </div>
    </section>
  );
}
