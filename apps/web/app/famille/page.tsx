import { jourFr, t } from "@app/shared";
import { DemandeConsentement, RetirerConsentement } from "@/components/famille/Consentement";
import { listerBilansPartages } from "@/lib/serveur/bilans";
import { db } from "@/lib/serveur/db";
import { listerPatientsVisibles } from "@/lib/serveur/patients";
import { familleConnectee } from "@/lib/serveur/session-page";

// Espace web des parents et patients : mêmes droits que l'application mobile.
// Sans consentement, seul l'écran de consentement s'affiche (aucune donnée).
export default async function FamillePage() {
  const utilisateur = await familleConnectee();
  const patients = await listerPatientsVisibles(db(), utilisateur);
  const aConsentir = patients.filter((p) => "consentementRequis" in p);
  const suivis = patients.filter((p) => !("consentementRequis" in p));
  // Seulement les documents que l'orthophoniste a cochés « partager » (lecture journalisée).
  const documents = new Map(
    await Promise.all(
      suivis.map(async (p) => [p.id, await listerBilansPartages(db(), utilisateur, p.id)] as const),
    ),
  );
  return (
    <main className="contenu">
      <h1>
        {t(utilisateur.role === "PARENT" ? "web.famille.titreParent" : "web.famille.titrePatient")}
      </h1>
      {aConsentir.map((p) => (
        <DemandeConsentement key={p.id} patientId={p.id} prenom={p.prenom} />
      ))}
      {patients.length === 0 && <p>{t("web.famille.aucun")}</p>}
      {suivis.length > 0 && (
        <ul className="liste">
          {suivis.map((p) => (
            <li key={p.id}>
              <span>{p.prenom}</span>
              <RetirerConsentement patientId={p.id} />
              <section className="documents-partages" aria-label={t("web.famille.documents.titre")}>
                <h2>{t("web.famille.documents.titre")}</h2>
                {(documents.get(p.id) ?? []).length === 0 ? (
                  <p className="discret">{t("web.famille.documents.aucun")}</p>
                ) : (
                  <ul>
                    {(documents.get(p.id) ?? []).map((d) => (
                      <li key={d.id}>
                        <a
                          href={`/api/patients/${encodeURIComponent(p.id)}/bilans-partages/${encodeURIComponent(d.id)}/pdf`}
                          target="_blank"
                          rel="noopener"
                        >
                          {d.titre} — {t("web.famille.documents.lire")}
                        </a>{" "}
                        <span className="discret">
                          {t("web.famille.documents.partageLe", { date: jourFr(d.date) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
