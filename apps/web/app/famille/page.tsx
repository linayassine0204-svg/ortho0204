import { t } from "@app/shared";
import { db } from "@/lib/serveur/db";
import { listerPatientsVisibles } from "@/lib/serveur/patients";
import { familleConnectee } from "@/lib/serveur/session-page";

// Espace web des parents et patients : mêmes droits que l'application mobile.
// Programme, conseils et suivi s'ajouteront ici dans les prochaines tâches.
export default async function FamillePage() {
  const utilisateur = await familleConnectee();
  const patients = await listerPatientsVisibles(db(), utilisateur);
  return (
    <main className="contenu">
      <h1>
        {t(utilisateur.role === "PARENT" ? "web.famille.titreParent" : "web.famille.titrePatient")}
      </h1>
      {patients.length === 0 ? (
        <p>{t("web.famille.aucun")}</p>
      ) : (
        <ul className="liste">
          {patients.map((p) => (
            <li key={p.id}>{p.prenom}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
