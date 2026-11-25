import { t } from "@app/shared";
import { DemandeConsentement, RetirerConsentement } from "@/components/famille/Consentement";
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
